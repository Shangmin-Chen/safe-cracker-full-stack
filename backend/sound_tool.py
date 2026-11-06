"""Simulated acoustic feedback for a safe with a known combination."""

from collections import Counter

from .solver import is_valid_combination


class SimulatedSoundTool:
    def __init__(self, actual_combination: str) -> None:
        if not is_valid_combination(actual_combination):
            raise ValueError("actual_combination must contain exactly 10 ASCII digits")
        self._actual_combination = actual_combination

    def __call__(self, guess: str, /) -> int:
        return sum(
            guessed_digit == secret_digit
            for guessed_digit, secret_digit in zip(guess, self._actual_combination)
        )


class SimulatedMultisetSoundTool:
    """Provide multiset feedback and a safe-open signal for backtracking."""

    def __init__(self, actual_combination: str) -> None:
        if not is_valid_combination(actual_combination):
            raise ValueError("actual_combination must contain exactly 10 ASCII digits")
        self._actual_combination = actual_combination
        self._actual_digit_counts = Counter(actual_combination)

    def count_matches(self, guess: str) -> int:
        """Return matching digit frequency, independent of digit position."""
        return sum((Counter(guess) & self._actual_digit_counts).values())

    def opens(self, guess: str) -> bool:
        """Return whether the guess opens the safe."""
        return guess == self._actual_combination
