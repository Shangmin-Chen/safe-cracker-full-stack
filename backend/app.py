import json
from collections.abc import Iterator

from flask import Flask, Response, jsonify, request

from .solver import Attempt, crack_attempts, crack_safe, is_valid_combination
from .sound_tool import SimulatedSoundTool

app = Flask(__name__)


def _result(attempt: Attempt) -> dict[str, int | float | str | bool]:
    return {
        "attempts": attempt.attempts,
        "time_taken": attempt.time_taken,
        "cracked_combination": attempt.current_combination,
        "success": attempt.opened,
    }


def _stream_attempts(attempts: Iterator[Attempt]) -> Iterator[str]:
    for attempt in attempts:
        progress = {
            "attempts": attempt.attempts,
            "current_combination": attempt.current_combination,
            "time_taken": attempt.time_taken,
        }
        yield f"event: progress\ndata: {json.dumps(progress)}\n\n"

        if attempt.opened:
            yield f"event: result\ndata: {json.dumps(_result(attempt))}\n\n"


@app.post("/api/crack_safe/")
def crack_safe_endpoint() -> Response | tuple[Response, int]:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(error="Expected a JSON object."), 400

    actual_combination = payload.get("actual_combination")
    if not is_valid_combination(actual_combination):
        return jsonify(error="actual_combination must be a string of 10 ASCII digits."), 400

    if payload.get("algorithm", "positional") != "positional":
        return jsonify(error="algorithm must be 'positional'."), 400

    score_guess = SimulatedSoundTool(actual_combination)
    if request.accept_mimetypes.best_match(["application/json", "text/event-stream"]) == "text/event-stream":
        response = Response(
            _stream_attempts(crack_attempts(score_guess)),
            mimetype="text/event-stream",
            headers={"Cache-Control": "no-cache"},
        )
    else:
        response = jsonify(_result(crack_safe(score_guess)))

    response.vary.add("Accept")
    return response
