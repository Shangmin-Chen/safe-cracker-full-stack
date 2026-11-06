import json
import unittest

from backend.app import app
from backend.app import _stream_attempts
from backend.domain import Attempt


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

    def test_explicit_positional_algorithm_returns_json_result(self):
        response = self.client.post(
            "/api/crack_safe/",
            json={"actual_combination": "1234567890", "algorithm": "positional"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["cracked_combination"], "1234567890")
        self.assertTrue(response.get_json()["success"])

    def test_backtracking_algorithm_returns_json_result(self):
        response = self.client.post(
            "/api/crack_safe/",
            json={"actual_combination": "0101010101", "algorithm": "backtracking"},
        )

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["cracked_combination"], "0101010101")
        self.assertTrue(result["success"])
        self.assertGreaterEqual(result["attempts"], 1)
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

    def test_backtracking_sse_stream_ends_with_successful_result(self):
        response = self.client.post(
            "/api/crack_safe/",
            json={"actual_combination": "0000000000", "algorithm": "backtracking"},
            headers={"Accept": "text/event-stream"},
        )

        self.assertEqual(response.status_code, 200)
        events = decode_sse_events(response.get_data(as_text=True))
        progress_events = [data for event, data in events if event == "progress"]
        result_events = [data for event, data in events if event == "result"]

        self.assertGreaterEqual(len(progress_events), 1)
        self.assertEqual(len(result_events), 1)
        self.assertEqual(result_events[0]["cracked_combination"], "0000000000")
        self.assertTrue(result_events[0]["success"])
        self.assertEqual(
            progress_events[-1]["attempts"], result_events[0]["attempts"]
        )
        self.assertEqual(
            progress_events[-1]["time_taken"], result_events[0]["time_taken"]
        )

    def test_sse_sampling_preserves_attempt_numbers_and_final_total(self):
        def many_attempts():
            for number in range(1, 8202):
                yield Attempt(
                    attempts=number,
                    current_combination=f"{number:010d}",
                    time_taken=number / 1000,
                    opened=number == 8201,
                )

        events = decode_sse_events("".join(_stream_attempts(many_attempts())))
        progress_events = [data for event, data in events if event == "progress"]
        result_events = [data for event, data in events if event == "result"]

        self.assertEqual(
            [event["attempts"] for event in progress_events],
            [*range(1, 1025), 4096, 8192, 8201],
        )
        self.assertEqual(len(result_events), 1)
        self.assertEqual(result_events[0]["attempts"], 8201)
        self.assertEqual(result_events[0]["cracked_combination"], "0000008201")
        self.assertTrue(result_events[0]["success"])

    def test_rejects_malformed_requests_and_unsupported_algorithm(self):
        invalid_requests = (
            (None, {"Content-Type": "application/json"}),
            ({"actual_combination": "123"}, None),
            ({"actual_combination": "１２３４５６７８９０"}, None),
            (
                {"actual_combination": "1234567890", "algorithm": "unknown"},
                None,
            ),
            ({"actual_combination": "1234567890", "algorithm": []}, None),
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
