import unittest
from unittest.mock import patch

from backend.adapters.algorithms import FunctionAlgorithm
from backend.adapters.steps import StepRecorder
from backend.backtracking import (
    crack_safe as backtracking,
    sound_tool as multiset_score,
)
from backend.positional import crack_safe as positional
from backend.regression import crack_safe as regression, sound_tool as positional_score


class StepTests(unittest.TestCase):
    def test_positional_steps_capture_the_actual_probe_feedback(self):
        metrics = FunctionAlgorithm(positional).crack("9999999999", include_steps=True)

        self.assertEqual(metrics.attempts, 101)
        self.assertEqual(len(metrics.steps), 101)
        self.assertEqual(metrics.steps[0].phase, "baseline")
        self.assertEqual(metrics.steps[0].score, 0)
        self.assertEqual(metrics.steps[-1].score, 10)
        self.assertEqual(metrics.steps[-1].fixed_prefix, "9999999999")
        self.assertEqual(metrics.steps[-1].time_taken, metrics.time_taken)

    def test_backtracking_only_scores_during_discovery(self):
        target = "0100000000"
        with patch("backend.backtracking.sound_tool", wraps=multiset_score) as scorer:
            metrics = FunctionAlgorithm(backtracking).crack(target, include_steps=True)

        self.assertEqual(scorer.call_count, 10)
        self.assertEqual(metrics.attempts, 19)
        self.assertEqual(metrics.steps[9].discovered_digits, "0000000001")
        self.assertTrue(all(step.score is None for step in metrics.steps[10:]))
        self.assertEqual(metrics.steps[-1].current_combination, target)

    def test_regression_inference_adds_a_step_without_adding_a_probe(self):
        target = "9876543210"
        with patch("backend.regression.sound_tool", wraps=positional_score) as scorer:
            metrics = FunctionAlgorithm(regression).crack(target, include_steps=True)

        self.assertEqual(scorer.call_count, 45)
        self.assertEqual(metrics.attempts, 45)
        self.assertEqual(len(metrics.steps), 46)
        self.assertEqual(metrics.steps[-1].phase, "inferred")
        self.assertEqual(metrics.steps[-1].attempts, 45)
        self.assertEqual(metrics.steps[-1].current_combination, target)
        times = [step.time_taken for step in metrics.steps]
        self.assertEqual(times, sorted(times))

    def test_long_traces_are_bounded_and_preserve_the_final_attempt(self):
        recorder = StepRecorder()
        for number in range(1, 20002):
            recorder(f"{number:010d}", None, "permutation", None, number / 1000)
        steps = recorder.finish(21)

        self.assertLess(len(steps), 300)
        self.assertEqual(steps[0].attempts, 1)
        self.assertEqual(steps[-1].attempts, 20001)
        self.assertEqual(steps[-1].time_taken, 21)
