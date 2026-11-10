"""Combination validation and results independent of transport and algorithms."""

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
class CrackStep:
    attempts: int
    current_combination: str
    time_taken: float
    phase: str
    score: int | None = None
    baseline_score: int | None = None
    position: int | None = None
    discovered_digits: str = ""
    fixed_prefix: str = ""


@dataclass(frozen=True)
class CrackMetrics:
    attempts: int
    time_taken: float
    steps: tuple[CrackStep, ...] = ()


@dataclass(frozen=True)
class CrackResult:
    attempts: int
    time_taken: float
    cracked_combination: str
    success: bool = True
    steps: tuple[CrackStep, ...] = ()
