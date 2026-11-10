"""Composition root: connect the HTTP adapter, use case, and algorithms."""

from .adapters.algorithms import FunctionAlgorithm
from .adapters.http import create_app
from .application import CrackSafe
from .backtracking import crack_safe as crack_backtracking
from .positional import crack_safe as crack_positional
from .regression import crack_safe as crack_regression


app = create_app(
    CrackSafe(
        {
            "positional": FunctionAlgorithm(crack_positional),
            "backtracking": FunctionAlgorithm(crack_backtracking),
            "regression": FunctionAlgorithm(crack_regression),
        }
    )
)
