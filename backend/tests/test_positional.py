import unittest
from unittest.mock import patch

from backend.positional import crack_safe, sound_tool


class PositionalTests(unittest.TestCase):
    def test_sound_tool_counts_only_exact_position_matches(self):
        self.assertEqual(sound_tool("0900", "9888"), 0)
        self.assertEqual(sound_tool("0900", "8988"), 1)
        self.assertEqual(sound_tool("0900", "0900"), 4)
        self.assertEqual(sound_tool("0900", "9000"), 2)

    def test_sound_tool_rejects_different_combination_lengths(self):
        with self.assertRaises(ValueError):
            sound_tool("0900", "090")

    def test_all_zero_combination_opens_on_initial_guess(self):
        with patch("backend.positional.sound_tool", wraps=sound_tool) as scorer:
            result = crack_safe("0000")

        scorer.assert_called_once_with("0000", "0000")
        self.assertEqual(result["attempts"], 1)
        self.assertEqual(set(result), {"attempts", "time_taken"})
        self.assertGreaterEqual(result["time_taken"], 0)

    def test_attempts_count_every_sound_tool_call_including_success(self):
        for target in ("0", "9", "0900", "0800666666", "3141592653"):
            with self.subTest(target=target):
                with patch("backend.positional.sound_tool", wraps=sound_tool) as scorer:
                    result = crack_safe(target)

                self.assertEqual(result["attempts"], scorer.call_count)
                self.assertLessEqual(result["attempts"], 1 + 10 * len(target))
                self.assertEqual(scorer.call_args.args, (target, target))
                self.assertGreaterEqual(result["time_taken"], 0)

    def test_all_nines_requires_101_attempts(self):
        result = crack_safe("9999999999")

        self.assertEqual(result["attempts"], 101)

    def test_rejects_invalid_combinations(self):
        for combination in ("", "123x", "１２３４", 1234567890, None):
            with self.subTest(combination=combination):
                with self.assertRaises(ValueError):
                    crack_safe(combination)


if __name__ == "__main__":
    unittest.main()
