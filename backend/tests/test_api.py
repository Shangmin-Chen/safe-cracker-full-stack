import json
import unittest
from unittest.mock import Mock

from backend.adapters.http import create_app
from backend.app import app
from backend.application import CrackSafe
from backend.domain import CrackMetrics
from backend.ports import CrackingAlgorithm


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
        self.assertLessEqual(result["attempts"], 101)
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

    def test_positional_sse_records_each_probe_and_the_final_result(self):
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

        self.assertEqual(len(progress_events), 101)
        self.assertEqual(
            [step["attempts"] for step in progress_events], list(range(1, 102))
        )
        self.assertEqual(len(result_events), 1)
        self.assertEqual(progress_events[-1]["current_combination"], "9999999999")
        self.assertEqual(progress_events[-1]["attempts"], 101)
        self.assertEqual(
            progress_events[-1]["time_taken"], result_events[0]["time_taken"]
        )
        self.assertEqual(result_events[0]["cracked_combination"], "9999999999")
        self.assertTrue(result_events[0]["success"])
        self.assertEqual(len(events), len(progress_events) + 1)

    def test_backtracking_sse_records_discovery_and_permutations(self):
        response = self.client.post(
            "/api/crack_safe/",
            json={"actual_combination": "0100000000", "algorithm": "backtracking"},
            headers={"Accept": "text/event-stream"},
        )

        self.assertEqual(response.status_code, 200)
        events = decode_sse_events(response.get_data(as_text=True))
        progress_events = [data for event, data in events if event == "progress"]
        result_events = [data for event, data in events if event == "result"]

        self.assertEqual(len(progress_events), 19)
        self.assertTrue(
            all(step["phase"] == "discovery" for step in progress_events[:10])
        )
        self.assertTrue(
            all(step["phase"] == "permutation" for step in progress_events[10:])
        )
        self.assertEqual(len(result_events), 1)
        self.assertEqual(result_events[0]["cracked_combination"], "0100000000")
        self.assertEqual(result_events[0]["attempts"], 19)
        self.assertTrue(result_events[0]["success"])
        self.assertEqual(progress_events[-1]["attempts"], result_events[0]["attempts"])
        self.assertEqual(
            progress_events[-1]["time_taken"], result_events[0]["time_taken"]
        )

    def test_http_adapter_uses_an_injected_algorithm_and_preserves_final_totals(self):
        algorithm = Mock(spec=CrackingAlgorithm)
        algorithm.crack.return_value = CrackMetrics(8201, 8.201)
        client = create_app(CrackSafe({"positional": algorithm})).test_client()

        response = client.post(
            "/api/crack_safe/",
            json={"actual_combination": "0123456789"},
            headers={"Accept": "text/event-stream"},
        )

        self.assertEqual(response.status_code, 200)
        algorithm.crack.assert_called_once_with("0123456789", include_steps=True)
        self.assertEqual(response.headers["Cache-Control"], "no-cache")
        self.assertIn("Accept", response.vary)
        events = decode_sse_events(response.get_data(as_text=True))
        progress_events = [data for event, data in events if event == "progress"]
        result_events = [data for event, data in events if event == "result"]

        self.assertEqual(len(progress_events), 1)
        self.assertEqual(len(result_events), 1)
        self.assertEqual(progress_events[0]["attempts"], 8201)
        self.assertEqual(result_events[0]["attempts"], 8201)
        self.assertEqual(result_events[0]["time_taken"], 8.201)
        self.assertEqual(result_events[0]["cracked_combination"], "0123456789")
        self.assertTrue(result_events[0]["success"])

    def test_regression_algorithm_reports_45_probes_for_the_worst_case(self):
        response = self.client.post(
            "/api/crack_safe/",
            json={"actual_combination": "9876543210", "algorithm": "regression"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["attempts"], 45)
        self.assertEqual(response.get_json()["cracked_combination"], "9876543210")
        self.assertTrue(response.get_json()["success"])

    def test_regression_rejects_repeated_digits_with_an_http_400(self):
        response = self.client.post(
            "/api/crack_safe/",
            json={"actual_combination": "0000000000", "algorithm": "regression"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("exactly once", response.get_json()["error"])

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
                response = self.client.post("/api/crack_safe/", json=body, **kwargs)

                self.assertEqual(response.status_code, 400)
                self.assertIsInstance(response.get_json().get("error"), str)


if __name__ == "__main__":
    unittest.main()
