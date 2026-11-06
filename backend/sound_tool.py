"""Simulated acoustic feedback for a safe with a known combination."""

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
