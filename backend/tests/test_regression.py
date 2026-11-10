import unittest
from random import Random
from unittest.mock import patch

from backend.regression import crack_safe, sound_tool


class RegressionTests(unittest.TestCase):
    def test_sound_tool_uses_exact_positions(self):
        self.assertEqual(sound_tool("9876543210", "9876543210"), 10)
        self.assertEqual(sound_tool("9876543210", "0123456789"), 0)

    def test_descending_combination_requires_45_probes(self):
        target = "9876543210"
        with patch("backend.regression.sound_tool", wraps=sound_tool) as scorer:
            result = crack_safe(target)

        self.assertEqual(result["attempts"], 45)
        self.assertEqual(scorer.call_count, 45)
        self.assertEqual(set(result), {"attempts", "time_taken"})
        self.assertGreaterEqual(result["time_taken"], 0)
        self.assertEqual(scorer.call_args.args[1][:8], target[:8])

    def test_ascending_combination_requires_nine_probes(self):
        self.assertEqual(crack_safe("0123456789")["attempts"], 9)

    def test_first_flip_can_increase_the_score_without_a_false_regression(self):
        self.assertEqual(crack_safe("1023456789")["attempts"], 10)

    def test_sampled_permutations_preserve_the_solved_prefix_and_probe_bound(self):
        random = Random(0)
        for _ in range(100):
            target = "".join(random.sample("0123456789", 10))
            with self.subTest(target=target):
                with patch("backend.regression.sound_tool", wraps=sound_tool) as scorer:
                    result = crack_safe(target)

                self.assertLessEqual(result["attempts"], 45)
                self.assertEqual(result["attempts"], scorer.call_count)
                self.assertEqual(scorer.call_args.args[1][:8], target[:8])

    def test_rejects_inputs_that_are_not_permutations_of_zero_to_nine(self):
        for combination in (None, 9876543210, "012345678", "01234567800", "0000000000", "０１２３４５６７８９"):
            with self.subTest(combination=combination):
                with self.assertRaises(ValueError):
                    crack_safe(combination)
