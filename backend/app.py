"""Flask API for positional and backtracking safe cracking."""

import json
from collections.abc import Iterator
from inspect import getsource

from flask import Flask, Response, jsonify, request

from .backtracking import crack_backtracking_attempts
from .solver import Attempt, crack_attempts, is_valid_combination
from .sound_tool import SimulatedMultisetSoundTool, SimulatedSoundTool


app = Flask(__name__)

ALGORITHM_IMPLEMENTATIONS = {
    "positional": crack_attempts,
    "backtracking": crack_backtracking_attempts,
}


def _result(attempt: Attempt) -> dict[str, int | float | str | bool]:
    return {
        "attempts": attempt.attempts,
        "time_taken": attempt.time_taken,
        "cracked_combination": attempt.current_combination,
        "success": attempt.opened,
    }


def _should_stream_progress(attempt: Attempt) -> bool:
    return attempt.attempts <= 1024 or attempt.attempts % 4096 == 0 or attempt.opened


def _stream_attempts(attempts: Iterator[Attempt]) -> Iterator[str]:
    for attempt in attempts:
        if _should_stream_progress(attempt):
            progress = {
                "attempts": attempt.attempts,
                "current_combination": attempt.current_combination,
                "time_taken": attempt.time_taken,
            }
            yield f"event: progress\ndata: {json.dumps(progress)}\n\n"

        if attempt.opened:
            yield f"event: result\ndata: {json.dumps(_result(attempt))}\n\n"
            return


def _last_attempt(attempts: Iterator[Attempt]) -> Attempt:
    final_attempt = None
    for attempt in attempts:
        final_attempt = attempt

    if final_attempt is None or not final_attempt.opened:
        raise RuntimeError("cracking algorithm exhausted without opening the safe")

    return final_attempt


@app.get("/api/crack_safe/algorithms/<algorithm>/")
def algorithm_source(algorithm: str) -> Response | tuple[Response, int]:
    implementation = ALGORITHM_IMPLEMENTATIONS.get(algorithm)
    if implementation is None:
        return jsonify(error="Unknown cracking algorithm."), 404
    return jsonify(algorithm=algorithm, source=getsource(implementation))


@app.post("/api/cracksafe/")
@app.post("/api/crack_safe/")
def crack_safe_endpoint() -> Response | tuple[Response, int]:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(error="Expected a JSON object."), 400

    actual_combination = payload.get("actual_combination")
    if not is_valid_combination(actual_combination):
        return jsonify(error="actual_combination must be a string of 10 ASCII digits."), 400

    algorithm = payload.get("algorithm", "positional")
    if not isinstance(algorithm, str) or algorithm not in ALGORITHM_IMPLEMENTATIONS:
        return jsonify(error="algorithm must be 'positional' or 'backtracking'."), 400

    if algorithm == "backtracking":
        attempts = crack_backtracking_attempts(SimulatedMultisetSoundTool(actual_combination))
    else:
        attempts = crack_attempts(SimulatedSoundTool(actual_combination))

    if request.accept_mimetypes.best_match(
        ["application/json", "text/event-stream"]
    ) == "text/event-stream":
        response = Response(
            _stream_attempts(attempts),
            mimetype="text/event-stream",
            headers={"Cache-Control": "no-cache"},
        )

    else:
        response = jsonify(_result(_last_attempt(attempts)))

    response.vary.add("Accept")
    return response
