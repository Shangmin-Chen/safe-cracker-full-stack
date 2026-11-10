import math
import unittest
from inspect import getmodule, getsource
from unittest.mock import patch

from backend.app import app
from backend.backtracking import (
    crack_safe as crack_backtracking,
    sound_tool as backtracking_sound_tool,
)
from backend.positional import (
    crack_safe as crack_positional,
    sound_tool as positional_sound_tool,
)
from backend.regression import crack_safe as crack_regression


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
            ("positional", crack_positional),
            ("backtracking", crack_backtracking),
            ("regression", crack_regression),
        ):
            with self.subTest(algorithm=name):
                response = self.client.get(f"/api/crack_safe/algorithms/{name}/")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response.get_json(),
                    {"algorithm": name, "source": getsource(getmodule(implementation))},
                )

        response = self.client.get("/api/crack_safe/algorithms/unknown/")
        self.assertEqual(response.status_code, 404)
        self.assertIsInstance(response.get_json()["error"], str)

    def test_positional_uses_its_local_sound_tool(self):
        target = "0800666666"
        with patch(
            "backend.positional.sound_tool", wraps=positional_sound_tool
        ) as scorer:
            response = self.client.post(
                "/api/cracksafe/",
                json={"actual_combination": target, "algorithm": "positional"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["cracked_combination"], target)
        self.assertEqual(response.get_json()["attempts"], scorer.call_count)
        scorer.assert_any_call(target, "0000000000")

    def test_backtracking_uses_multiset_sound_tool(self):
        target = "0800666666"
        with patch(
            "backend.backtracking.sound_tool", wraps=backtracking_sound_tool
        ) as scorer:
            response = self.client.post(
                "/api/cracksafe/",
                json={"actual_combination": target, "algorithm": "backtracking"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["cracked_combination"], target)
        self.assertEqual(response.get_json()["attempts"], 235)
        self.assertEqual(scorer.call_count, 10)
        scorer.assert_any_call(target, "0000000000")
