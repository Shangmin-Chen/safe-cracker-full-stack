"""Use cases for cracking a safe and reading the selected algorithm."""

from collections.abc import Mapping

from .domain import CrackResult, is_valid_combination
from .ports import CrackingAlgorithm


class InvalidCrackRequest(ValueError):
    """The requested combination or algorithm is invalid."""


class UnknownAlgorithm(LookupError):
    """The requested algorithm source does not exist."""


class CrackSafe:
    def __init__(self, algorithms: Mapping[str, CrackingAlgorithm]) -> None:
        self._algorithms = dict(algorithms)

    def execute(
        self,
        actual_combination: object,
        algorithm: object = "positional",
        include_steps: bool = False,
    ) -> CrackResult:
        if not is_valid_combination(actual_combination):
            raise InvalidCrackRequest(
                "actual_combination must be a string of 10 ASCII digits."
            )

        if not isinstance(algorithm, str) or algorithm not in self._algorithms:
            choices = " or ".join(repr(name) for name in self._algorithms)
            raise InvalidCrackRequest(f"algorithm must be {choices}.")

        selected = self._algorithms[algorithm]
        metrics = (
            selected.crack(actual_combination, include_steps=True)
            if include_steps
            else selected.crack(actual_combination)
        )
        return CrackResult(
            attempts=metrics.attempts,
            time_taken=metrics.time_taken,
            cracked_combination=actual_combination,
            steps=metrics.steps,
        )

    def read_algorithm(self, algorithm: str) -> str:
        if algorithm not in self._algorithms:
            raise UnknownAlgorithm("Unknown cracking algorithm.")
        return self._algorithms[algorithm].source()
