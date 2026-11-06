import json
import unittest

from backend.app import app


def decode_sse_events(response_text):
    events = []
    for frame in response_text.strip().split("\n\n"):
        event_name = None
        data = None
        for line in frame.splitlines():
            if line.startswith("event: "):
                event_name = line.removeprefix("event: ")
            elif line.startswith("data: "):
                data = json.loads(line.removeprefix("data: "))
        if event_name is not None and data is not None:
            events.append((event_name, data))
    return events


class CrackSafeApiTests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.client = app.test_client()

    def test_json_response_includes_successful_result(self):
        response = self.client.post(
            "/api/crack_safe/",
            json={"actual_combination": "0800666666"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "application/json")
        result = response.get_json()
        self.assertEqual(result["cracked_combination"], "0800666666")
        self.assertTrue(result["success"])
        self.assertGreaterEqual(result["attempts"], 1)
        self.assertLessEqual(result["attempts"], 91)
        self.assertGreaterEqual(result["time_taken"], 0)

    def test_sse_stream_reports_every_attempt_then_final_result(self):
        response = self.client.post(
            "/api/crack_safe/",
            json={"actual_combination": "9999999999"},
            headers={"Accept": "text/event-stream"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "text/event-stream")
        events = decode_sse_events(response.get_data(as_text=True))
        progress_events = [data for event, data in events if event == "progress"]
        result_events = [data for event, data in events if event == "result"]

        self.assertEqual(len(progress_events), 91)
        self.assertEqual(len(result_events), 1)
        self.assertEqual(progress_events[-1]["current_combination"], "9999999999")
        self.assertEqual(progress_events[-1]["attempts"], 91)
        self.assertEqual(
            progress_events[-1]["time_taken"], result_events[0]["time_taken"]
        )
        self.assertEqual(result_events[0]["cracked_combination"], "9999999999")
        self.assertTrue(result_events[0]["success"])
        self.assertEqual(len(events), len(progress_events) + 1)

    def test_rejects_malformed_requests_and_unsupported_algorithm(self):
        invalid_requests = (
            (None, {"Content-Type": "application/json"}),
            ({"actual_combination": "123"}, None),
            ({"actual_combination": "１２３４５６７８９０"}, None),
            (
                {"actual_combination": "1234567890", "algorithm": "backtracking"},
                None,
            ),
        )

        for body, headers in invalid_requests:
            with self.subTest(body=body):
                kwargs = {"headers": headers} if headers else {}
                response = self.client.post(
                    "/api/crack_safe/", json=body, **kwargs
                )

                self.assertEqual(response.status_code, 400)
                self.assertIsInstance(response.get_json().get("error"), str)


if __name__ == "__main__":
    unittest.main()
