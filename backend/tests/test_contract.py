import math
import unittest
from inspect import getsource

from backend.app import app
from backend.backtracking import crack_backtracking_attempts
from backend.solver import crack_attempts


class CrackSafeContractTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_post_contract(self):
        for endpoint in ("/api/cracksafe/", "/api/crack_safe/"):
            with self.subTest(endpoint=endpoint):
                response = self.client.post(
                    endpoint, json={"actual_combination": "0800666666"}
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.mimetype, "application/json")
                result = response.get_json()
                self.assertIs(type(result["attempts"]), int)
                self.assertGreater(result["attempts"], 0)
                self.assertIn(type(result["time_taken"]), (int, float))
                self.assertTrue(math.isfinite(result["time_taken"]))
                self.assertGreaterEqual(result["time_taken"], 0)
                self.assertEqual(result["cracked_combination"], "0800666666")
                self.assertIs(result["success"], True)

    def test_algorithm_source_uses_the_running_implementation(self):
        for name, implementation in (
            ("positional", crack_attempts),
            ("backtracking", crack_backtracking_attempts),
        ):
            with self.subTest(algorithm=name):
                response = self.client.get(f"/api/crack_safe/algorithms/{name}/")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response.get_json(),
                    {"algorithm": name, "source": getsource(implementation)},
                )

        response = self.client.get("/api/crack_safe/algorithms/unknown/")
        self.assertEqual(response.status_code, 404)
        self.assertIsInstance(response.get_json()["error"], str)
