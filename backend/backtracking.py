"""Multiset-guided search for a safe combination's digit ordering."""

from collections.abc import Iterator
from time import perf_counter
from typing import Protocol

from .domain import COMBINATION_LENGTH, Attempt


class BacktrackingScoringPort(Protocol):
    def count_matches(self, guess: str, /) -> int:
        """Return how many guessed digits occur in the secret, including repeats."""
        ...

    def opens(self, guess: str, /) -> bool:
        """Return whether the exact guess opens the safe."""
        ...


def crack_backtracking_attempts(
    score_guess: BacktrackingScoringPort,
) -> Iterator[Attempt]:
    """Recover digit counts from overlap, counting repeats in any position.

    Test each distinct arrangement with the separate yes/no safe-open signal.
    """
    started_at = perf_counter()
    attempts = 0
    digit_counts = [0] * 10

    def record_attempt(guess: str, opened: bool) -> Attempt:
        nonlocal attempts
        attempts += 1
        return Attempt(
            attempts=attempts,
            current_combination=guess,
            time_taken=perf_counter() - started_at,
            opened=opened,
        )

    for digit in range(10):
        guess = str(digit) * COMBINATION_LENGTH
        count = score_guess.count_matches(guess)
        if count == COMBINATION_LENGTH:
            yield record_attempt(guess, True)
            return

        digit_counts[digit] = count
        yield record_attempt(guess, False)

    current = [""] * COMBINATION_LENGTH
    opened = False

    def search(position: int) -> Iterator[Attempt]:
        nonlocal opened
        if opened:
            return

        if position == COMBINATION_LENGTH:
            guess = "".join(current)
            opened = score_guess.opens(guess)
            yield record_attempt(guess, opened)
            return

        for digit, count in enumerate(digit_counts):
            if count == 0:
                continue

            digit_counts[digit] -= 1
            current[position] = str(digit)
            yield from search(position + 1)
            digit_counts[digit] += 1

            if opened:
                return

    yield from search(0)

    if not opened:
        raise RuntimeError("backtracking search exhausted without opening the safe")
