"""Adapt standalone Python algorithm functions to the application port."""

from collections.abc import Callable
from dataclasses import dataclass
from inspect import getmodule, getsource

from ..application import InvalidCrackRequest
from ..domain import CrackMetrics
from .steps import StepRecorder


@dataclass(frozen=True)
class FunctionAlgorithm:
    implementation: Callable[..., dict[str, int | float]]

    def crack(
        self, actual_combination: str, include_steps: bool = False
    ) -> CrackMetrics:
        recorder = StepRecorder() if include_steps else None
        try:
            if recorder is None:
                result = self.implementation(actual_combination)
            else:
                result = self.implementation(actual_combination, on_step=recorder)
        except ValueError as error:
            raise InvalidCrackRequest(str(error)) from error
        return CrackMetrics(
            attempts=result["attempts"],
            time_taken=result["time_taken"],
            steps=recorder.finish(result["time_taken"]) if recorder is not None else (),
        )

    def source(self) -> str:
        return getsource(getmodule(self.implementation))
