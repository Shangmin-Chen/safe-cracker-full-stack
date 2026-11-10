import unittest
from unittest.mock import Mock

from backend.application import CrackSafe, InvalidCrackRequest, UnknownAlgorithm
from backend.domain import CrackMetrics, CrackResult
from backend.ports import CrackingAlgorithm


class CrackSafeApplicationTests(unittest.TestCase):
    def setUp(self):
        self.positional = Mock(spec=CrackingAlgorithm)
        self.positional.crack.return_value = CrackMetrics(7, 0.02)
        self.backtracking = Mock(spec=CrackingAlgorithm)
        self.backtracking.crack.return_value = CrackMetrics(13, 0.03)
        self.use_case = CrackSafe({
            "positional": self.positional,
            "backtracking": self.backtracking,
        })

    def test_default_algorithm_receives_the_combination_with_leading_zeroes(self):
        result = self.use_case.execute("0800666666")

        self.assertEqual(result, CrackResult(7, 0.02, "0800666666"))
        self.positional.crack.assert_called_once_with("0800666666")
        self.backtracking.crack.assert_not_called()

    def test_selected_algorithm_supplies_the_result(self):
        result = self.use_case.execute("0800666666", "backtracking")

        self.assertEqual(result, CrackResult(13, 0.03, "0800666666"))
        self.backtracking.crack.assert_called_once_with("0800666666")
        self.positional.crack.assert_not_called()

    def test_invalid_combinations_do_not_reach_an_algorithm(self):
        for combination in (None, [], 1234567890, "123", "１２３４５６７８９０", "123456789x"):
            with self.subTest(combination=combination):
                with self.assertRaises(InvalidCrackRequest):
                    self.use_case.execute(combination)

        self.positional.crack.assert_not_called()
        self.backtracking.crack.assert_not_called()

    def test_invalid_algorithm_selection_does_not_execute_an_algorithm(self):
        for algorithm in (None, [], {}, 42, "unknown"):
            with self.subTest(algorithm=algorithm):
                with self.assertRaises(InvalidCrackRequest):
                    self.use_case.execute("0123456789", algorithm)

        self.positional.crack.assert_not_called()
        self.backtracking.crack.assert_not_called()

    def test_source_comes_from_the_injected_algorithm_without_running_it(self):
        self.backtracking.source.return_value = "def fake_algorithm(): pass"

        self.assertEqual(
            self.use_case.read_algorithm("backtracking"), "def fake_algorithm(): pass"
        )
        self.backtracking.source.assert_called_once_with()
        self.backtracking.crack.assert_not_called()

    def test_unknown_source_raises_an_application_error(self):
        with self.assertRaises(UnknownAlgorithm):
            self.use_case.read_algorithm("unknown")

    def test_another_algorithm_can_be_injected_without_changing_the_use_case(self):
        use_case = CrackSafe({"custom": self.positional})

        result = use_case.execute("0123456789", "custom")

        self.assertEqual(result, CrackResult(7, 0.02, "0123456789"))
        self.positional.crack.assert_called_once_with("0123456789")
