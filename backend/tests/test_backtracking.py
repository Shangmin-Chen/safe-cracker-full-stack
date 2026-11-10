import unittest
from itertools import permutations
from unittest.mock import patch

from backend.backtracking import crack_safe, sound_tool


class BacktrackingTests(unittest.TestCase):
    def test_sound_tool_counts_shared_digits_including_repeats(self):
        self.assertEqual(sound_tool("0900", "9000"), 4)
        self.assertEqual(sound_tool("0900", "9888"), 1)
        self.assertEqual(sound_tool("0900", "9999"), 1)
        self.assertEqual(sound_tool("0900", "0000"), 3)
        self.assertEqual(sound_tool("0900", "8888"), 0)

    def test_uniform_combinations_complete_discovery_then_test_one_permutation(self):
        for target in ("0000", "9999"):
            with self.subTest(target=target):
                with patch("backend.backtracking.sound_tool", wraps=sound_tool) as scorer:
                    result = crack_safe(target)

                self.assertEqual(scorer.call_count, 10)
                self.assertEqual(result["attempts"], 11)
                self.assertEqual(set(result), {"attempts", "time_taken"})
                self.assertGreaterEqual(result["time_taken"], 0)

    def test_preserves_leading_zeroes_when_searching_permutations(self):
        target = "0100000000"
        with patch("backend.backtracking.sound_tool", wraps=sound_tool) as scorer:
            result = crack_safe(target)

        self.assertEqual(result["attempts"], 19)
        self.assertEqual(scorer.call_count, 10)

    def test_duplicate_digit_permutations_are_checked_once_each(self):
        target = "1111111110"
        with patch("backend.backtracking.sound_tool", wraps=sound_tool) as scorer:
            result = crack_safe(target)

        self.assertEqual(scorer.call_count, 10)
        self.assertEqual(result["attempts"], 20)

    def test_full_digit_score_does_not_stop_on_the_wrong_order(self):
        target = "0900"
        with patch("backend.backtracking.sound_tool", wraps=sound_tool) as scorer:
            result = crack_safe(target)

        self.assertEqual(
            [call.args[1] for call in scorer.call_args_list[:10]],
            [digit * 4 for digit in "0123456789"],
        )
        self.assertEqual(scorer.call_count, 10)
        self.assertEqual(result["attempts"], 13)

    def test_discovers_123789_and_tries_permutations_until_983271(self):
        target = "983271"
        with patch("backend.backtracking.sound_tool", wraps=sound_tool) as scorer:
            result = crack_safe(target)

        expected = ["".join(digits) for digits in permutations("123789")]
        self.assertEqual(scorer.call_count, 10)
        self.assertEqual(result["attempts"], 10 + expected.index(target) + 1)

    def test_rejects_invalid_combinations(self):
        for combination in ("", "123x", "１２３４", 1234567890, None):
            with self.subTest(combination=combination):
                with self.assertRaises(ValueError):
                    crack_safe(combination)


if __name__ == "__main__":
    unittest.main()
