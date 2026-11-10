from time import perf_counter


def sound_tool(actual_combination: str, combination: str) -> int:
    """Return the number of digits that match in the same position."""
    return sum(
        actual == guessed
        for actual, guessed in zip(actual_combination, combination, strict=True)
    )


def crack_safe(actual_combination: str, on_step=None) -> dict[str, int | float]:
    """Infer a permutation of 0–9 using at most 45 regression probes."""
    if (
        not isinstance(actual_combination, str)
        or len(actual_combination) != 10
        or set(actual_combination) != set("0123456789")
    ):
        raise ValueError("regression requires each digit 0–9 exactly once")

    started_at = perf_counter()
    attempts = 0
    remaining = list("0123456789")
    combination = ""

    for position in range(10):
        chosen = remaining[-1]

        # Infer the final candidate if none of the others causes a regression.
        for digit in remaining[:-1]:
            sequence = list(combination + digit * (10 - position))
            sequence[position] = "1" if digit == "0" else "0"
            score = sound_tool(actual_combination, "".join(sequence))
            attempts += 1
            if on_step:
                on_step(
                    "".join(sequence),
                    score,
                    "regression",
                    position,
                    perf_counter() - started_at,
                )

            # The unflipped sequence would score position + 1.
            if score < position + 1:
                chosen = digit
                break

        combination += chosen
        remaining.remove(chosen)

    if on_step:
        on_step(combination, None, "inferred", None, perf_counter() - started_at)

    return {"attempts": attempts, "time_taken": perf_counter() - started_at}
