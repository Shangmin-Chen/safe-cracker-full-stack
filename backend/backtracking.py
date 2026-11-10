from collections import Counter
from time import perf_counter


def sound_tool(actual_combination: str, combination: str) -> int:
    """Count shared digits, including repeats, regardless of position."""
    return sum((Counter(actual_combination) & Counter(combination)).values())


def crack_safe(actual_combination: str, on_step=None) -> dict[str, int | float]:
    """Discover the digits, then backtrack through their permutations."""
    if (
        not isinstance(actual_combination, str)
        or not actual_combination.isascii()
        or not actual_combination.isdigit()
    ):
        raise ValueError("actual_combination must be a non-empty ASCII digit string")

    started_at = perf_counter()
    attempts = 0
    length = len(actual_combination)
    digits = ""

    # Stage 1: discover all digits, including repeats, using sound_tool.
    for digit in "0123456789":
        combination = digit * length
        count = sound_tool(actual_combination, combination)
        attempts += 1
        digits += digit * count
        if on_step:
            on_step(combination, count, "discovery", None, perf_counter() - started_at)

    # Stage 2: generate permutations with backtracking and test each full guess.
    def backtrack(combination: str, remaining: str) -> bool:
        nonlocal attempts

        if not remaining:
            attempts += 1
            if on_step:
                on_step(
                    combination, None, "permutation", None, perf_counter() - started_at
                )
            return combination == actual_combination

        for index, digit in enumerate(remaining):
            if index > 0 and digit == remaining[index - 1]:
                continue

            next_remaining = remaining[:index] + remaining[index + 1 :]
            if backtrack(combination + digit, next_remaining):
                return True

        return False

    if not backtrack("", digits):
        raise RuntimeError("backtracking search exhausted without opening the safe")

    return {"attempts": attempts, "time_taken": perf_counter() - started_at}
