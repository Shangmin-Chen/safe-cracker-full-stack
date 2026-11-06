"""Positional search for a ten-digit safe combination."""

from collections.abc import Iterator
from dataclasses import dataclass
from time import perf_counter
from typing import Protocol, TypeGuard


COMBINATION_LENGTH = 10


class ScoringPort(Protocol):
    def __call__(self, guess: str, /) -> int:
        """Return the number of digits in the correct positions."""
        ...


def is_valid_combination(value: object) -> TypeGuard[str]:
    """Return whether value is exactly ten ASCII decimal digits."""
    return (
        isinstance(value, str)
        and len(value) == COMBINATION_LENGTH
        and value.isascii()
        and value.isdigit()
    )


@dataclass(frozen=True)
class Attempt:
    attempts: int
    current_combination: str
    time_taken: float
    opened: bool


def crack_attempts(score_guess: ScoringPort) -> Iterator[Attempt]:
    """Yield each guess made while finding the combination position by position."""
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


def crack_safe(score_guess: ScoringPort) -> Attempt:
    """Run the probe sequence and return the successful attempt."""
    final_attempt = None
    for attempt in crack_attempts(score_guess):
        final_attempt = attempt

    if final_attempt is None or not final_attempt.opened:
        raise RuntimeError("positional search exhausted without opening the safe")

    return final_attempt
