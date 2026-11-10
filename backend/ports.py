"""The algorithm capabilities required by the application."""

from typing import Protocol

from .domain import CrackMetrics


class CrackingAlgorithm(Protocol):
    def crack(
        self, actual_combination: str, include_steps: bool = False
    ) -> CrackMetrics:
        """Run the algorithm and return its measured result."""
        ...

    def source(self) -> str:
        """Return the source of the implementation being run."""
        ...
