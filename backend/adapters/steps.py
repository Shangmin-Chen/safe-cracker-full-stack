"""Bounded recording of events reported by standalone algorithm functions."""

from dataclasses import replace

from ..domain import CrackStep


class StepRecorder:
    def __init__(self) -> None:
        self.attempts = 0
        self.steps: list[CrackStep] = []
        self.last = None
        self.best_score = 0
        self.discovered_digits = ""

    def __call__(
        self,
        guess: str,
        score: int | None,
        phase: str,
        position: int | None,
        elapsed: float,
    ) -> None:
        if phase != "inferred":
            self.attempts += 1
        self.last = (guess, score, phase, position, elapsed)

        # Keep every short-run step and sample long permutation searches.
        if self.attempts > 256 and self.attempts % 4096 and phase != "inferred":
            return

        baseline = None
        fixed_prefix = ""
        if phase == "baseline":
            self.best_score = score
        elif phase == "position":
            baseline = self.best_score
            improved = score > baseline
            fixed_prefix = guess[: position + (1 if improved else 0)]
            self.best_score = max(self.best_score, score)
        elif phase == "discovery":
            self.discovered_digits += guess[0] * score
        elif phase == "regression":
            baseline = position + 1
            fixed_prefix = guess[:position]
            if score < baseline:
                fixed_prefix += guess[-1]
        elif phase == "inferred":
            fixed_prefix = guess

        if score == len(guess) and phase != "discovery":
            fixed_prefix = guess

        self.steps.append(
            CrackStep(
                attempts=self.attempts,
                current_combination=guess,
                time_taken=elapsed,
                phase=phase,
                score=score,
                baseline_score=baseline,
                position=position,
                discovered_digits=self.discovered_digits,
                fixed_prefix=fixed_prefix,
            )
        )

    def finish(self, elapsed: float) -> tuple[CrackStep, ...]:
        if self.last is None:
            return ()
        guess, score, phase, position, _ = self.last
        if (
            self.steps
            and self.steps[-1].attempts == self.attempts
            and self.steps[-1].phase == phase
        ):
            self.steps[-1] = replace(self.steps[-1], time_taken=elapsed)
        else:
            self.steps.append(
                CrackStep(
                    attempts=self.attempts,
                    current_combination=guess,
                    time_taken=elapsed,
                    phase=phase,
                    score=score,
                    position=position,
                    discovered_digits=self.discovered_digits,
                )
            )
        return tuple(self.steps)
