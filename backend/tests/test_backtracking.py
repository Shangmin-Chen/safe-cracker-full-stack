import unittest

from backend.backtracking import crack_backtracking_attempts


class FakeBacktrackingScorer:
    def __init__(self, target: str) -> None:
        self.target = target
        self.count_guesses: list[str] = []
        self.open_guesses: list[str] = []

    def count_matches(self, guess: str, /) -> int:
        self.count_guesses.append(guess)
        return self.target.count(guess[0])

    def opens(self, guess: str, /) -> bool:
        self.open_guesses.append(guess)
        return guess == self.target


class BacktrackingTests(unittest.TestCase):
    def test_all_zeroes_opens_on_first_probe_without_a_second_call(self):
        scorer = FakeBacktrackingScorer("0000000000")
        attempts = list(crack_backtracking_attempts(scorer))

        self.assertEqual(scorer.count_guesses, ["0000000000"])
        self.assertEqual(scorer.open_guesses, [])
        self.assertEqual(len(attempts), 1)
        self.assertEqual(attempts[0].current_combination, "0000000000")
        self.assertTrue(attempts[0].opened)

    def test_preserves_leading_zeroes_when_searching_permutations(self):
        scorer = FakeBacktrackingScorer("0100000000")
        attempts = list(crack_backtracking_attempts(scorer))

        self.assertEqual(len(scorer.count_guesses), 10)
        self.assertEqual(attempts[-1].current_combination, "0100000000")
        self.assertTrue(attempts[-1].opened)
        self.assertEqual(attempts[-1].attempts, 10 + len(scorer.open_guesses))

    def test_duplicate_digit_permutations_are_checked_once_each(self):
        scorer = FakeBacktrackingScorer("1111111110")
        attempts = list(crack_backtracking_attempts(scorer))

        self.assertEqual(len(scorer.count_guesses), 10)
        self.assertEqual(len(scorer.open_guesses), 10)
        self.assertEqual(len(scorer.open_guesses), len(set(scorer.open_guesses)))
        self.assertEqual(attempts[-1].current_combination, "1111111110")
        self.assertTrue(attempts[-1].opened)

    def test_every_probe_has_one_contiguous_attempt_number(self):
        scorer = FakeBacktrackingScorer("0000000001")
        attempts = list(crack_backtracking_attempts(scorer))
        actual_probes = len(scorer.count_guesses) + len(scorer.open_guesses)

        self.assertEqual(len(attempts), actual_probes)
        self.assertEqual(
            [attempt.attempts for attempt in attempts],
            list(range(1, actual_probes + 1)),
        )
        self.assertEqual(
            [attempt.current_combination for attempt in attempts[:10]],
            [str(digit) * 10 for digit in range(10)],
        )
        self.assertTrue(attempts[-1].opened)


if __name__ == "__main__":
    unittest.main()
