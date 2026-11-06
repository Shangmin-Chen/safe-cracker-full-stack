import unittest

from backend.solver import crack_attempts, crack_safe
from backend.sound_tool import SimulatedSoundTool


class FakeScorer:
    def __init__(self, target: str) -> None:
        self.target = target
        self.guesses: list[str] = []

    def __call__(self, guess: str) -> int:
        self.guesses.append(guess)
        return sum(guess[index] == digit for index, digit in enumerate(self.target))


class CrackSafeTests(unittest.TestCase):
    def test_all_zero_combination_opens_on_initial_guess(self):
        scorer = FakeScorer("0000000000")
        result = crack_safe(scorer)

        self.assertEqual(scorer.guesses, ["0000000000"])
        self.assertEqual(result.attempts, 1)
        self.assertEqual(result.current_combination, "0000000000")
        self.assertTrue(result.opened)
        self.assertGreaterEqual(result.time_taken, 0)

    def test_preserves_leading_zeroes(self):
        result = crack_safe(FakeScorer("0800666666"))

        self.assertTrue(result.opened)
        self.assertEqual(result.current_combination, "0800666666")
        self.assertLessEqual(result.attempts, 91)

    def test_all_nines_requires_at_most_91_attempts(self):
        scorer = FakeScorer("9999999999")
        result = crack_safe(scorer)

        self.assertTrue(result.opened)
        self.assertEqual(result.current_combination, "9999999999")
        self.assertEqual(result.attempts, 91)
        self.assertEqual(result.attempts, len(scorer.guesses))

    def test_attempt_stream_counts_each_probe_and_ends_at_the_secret(self):
        scorer = FakeScorer("3141592653")
        attempts = list(crack_attempts(scorer))

        self.assertEqual(
            [attempt.current_combination for attempt in attempts], scorer.guesses
        )
        self.assertGreater(len(attempts), 1)
        self.assertLessEqual(len(attempts), 91)
        self.assertEqual(
            [attempt.attempts for attempt in attempts],
            list(range(1, len(attempts) + 1)),
        )
        self.assertEqual(attempts[0].current_combination, "0000000000")
        self.assertEqual(attempts[-1].current_combination, "3141592653")
        self.assertTrue(attempts[-1].opened)
        self.assertTrue(all(not attempt.opened for attempt in attempts[:-1]))

    def test_simulated_sound_tool_rejects_invalid_combinations(self):
        invalid_values = (
            "123",
            "12345678901",
            "123456789x",
            "１２３４５６７８９０",
            1234567890,
            None,
        )

        for combination in invalid_values:
            with self.subTest(combination=combination):
                with self.assertRaises(ValueError):
                    SimulatedSoundTool(combination)


if __name__ == "__main__":
    unittest.main()
