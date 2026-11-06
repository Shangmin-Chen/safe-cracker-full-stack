"""Positional search for a ten-digit safe combination."""

from collections.abc import Iterator
from time import perf_counter
from typing import Protocol

from .domain import COMBINATION_LENGTH, Attempt


class PositionalScoringPort(Protocol):
    def __call__(self, guess: str, /) -> int:
        """Return the number of digits in the correct positions."""
        ...


def crack_positional_attempts(score_guess: PositionalScoringPort) -> Iterator[Attempt]:
    """Find the combination from exact-position match counts.

    Change one digit at a time and compare the new score with the previous one.
    """
    started_at = perf_counter()
    attempts = 0
    current = ["0"] * COMBINATION_LENGTH

    def probe(guess: str) -> tuple[int, Attempt]:
        nonlocal attempts
        score = score_guess(guess)
        attempts += 1
        attempt = Attempt(
            attempts=attempts,
            current_combination=guess,
            time_taken=perf_counter() - started_at,
            opened=score == COMBINATION_LENGTH,
        )
        return score, attempt

    score, attempt = probe("".join(current))
    yield attempt
    if attempt.opened:
        return

    for position in range(COMBINATION_LENGTH):
        for digit in "123456789":
            current[position] = digit
            new_score, attempt = probe("".join(current))
            yield attempt

            if attempt.opened:
                return

            if new_score > score:
                score = new_score
                break

            if new_score < score:
                current[position] = "0"
                break

    raise RuntimeError("positional search exhausted without opening the safe")


def crack_positional(score_guess: PositionalScoringPort) -> Attempt:
    """Run the probe sequence and return the successful attempt."""
    final_attempt = None
    for attempt in crack_positional_attempts(score_guess):
        final_attempt = attempt

    if final_attempt is None or not final_attempt.opened:
        raise RuntimeError("positional search exhausted without opening the safe")

    return final_attempt
