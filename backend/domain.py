"""Combination validation and attempt data shared by the cracking methods."""

from dataclasses import dataclass
from typing import TypeGuard


COMBINATION_LENGTH = 10


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
