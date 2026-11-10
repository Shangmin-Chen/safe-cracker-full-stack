from time import perf_counter


def sound_tool(actual_combination: str, combination: str) -> int:
    """Return the number of digits that match in the same position."""
    return sum(
        actual == guessed
        for actual, guessed in zip(actual_combination, combination, strict=True)
    )


def crack_safe(actual_combination: str, on_step=None) -> dict[str, int | float]:
    """Crack the safe; each sound_tool call counts as one attempt."""
    if (
        not isinstance(actual_combination, str)
        or not actual_combination.isascii()
        or not actual_combination.isdigit()
    ):
        raise ValueError("actual_combination must be a non-empty ASCII digit string")

    started_at = perf_counter()
    combination = ["0"] * len(actual_combination)
    score = sound_tool(actual_combination, "".join(combination))
    attempts = 1
    if on_step:
        on_step(
            "".join(combination), score, "baseline", None, perf_counter() - started_at
        )

    for position in range(len(combination)):
        if score == len(combination):
            break

        for digit in "0123456789":
            trial = combination.copy()
            trial[position] = digit
            new_score = sound_tool(actual_combination, "".join(trial))
            attempts += 1
            if on_step:
                on_step(
                    "".join(trial),
                    new_score,
                    "position",
                    position,
                    perf_counter() - started_at,
                )

            if new_score > score:
                combination = trial
                score = new_score
                break

    return {"attempts": attempts, "time_taken": perf_counter() - started_at}
