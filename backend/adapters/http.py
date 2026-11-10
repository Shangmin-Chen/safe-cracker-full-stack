"""Flask inbound adapter for the safe-cracking use cases."""

import json
from dataclasses import asdict

from flask import Flask, Response, jsonify, request

from ..application import CrackSafe, InvalidCrackRequest, UnknownAlgorithm


def create_app(crack_safe: CrackSafe) -> Flask:
    app = Flask(__name__)

    @app.get("/api/crack_safe/algorithms/<algorithm>/")
    def algorithm_source(algorithm: str) -> Response | tuple[Response, int]:
        try:
            source = crack_safe.read_algorithm(algorithm)
        except UnknownAlgorithm as error:
            return jsonify(error=str(error)), 404
        return jsonify(algorithm=algorithm, source=source)

    @app.post("/api/cracksafe/")
    @app.post("/api/crack_safe/")
    def crack_safe_endpoint() -> Response | tuple[Response, int]:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify(error="Expected a JSON object."), 400

        stream = (
            request.accept_mimetypes.best_match(
                ["application/json", "text/event-stream"]
            )
            == "text/event-stream"
        )
        try:
            result = crack_safe.execute(
                payload.get("actual_combination"),
                payload.get("algorithm", "positional"),
                include_steps=stream,
            )
        except InvalidCrackRequest as error:
            return jsonify(error=str(error)), 400

        result_payload = {
            "attempts": result.attempts,
            "time_taken": result.time_taken,
            "cracked_combination": result.cracked_combination,
            "success": result.success,
        }
        if stream:
            progress = {
                "attempts": result.attempts,
                "current_combination": result.cracked_combination,
                "time_taken": result.time_taken,
            }

            def events():
                for step in result.steps:
                    yield f"event: progress\ndata: {json.dumps(asdict(step))}\n\n"
                if not result.steps:
                    yield f"event: progress\ndata: {json.dumps(progress)}\n\n"
                yield f"event: result\ndata: {json.dumps(result_payload)}\n\n"

            response = Response(
                events(),
                mimetype="text/event-stream",
                headers={"Cache-Control": "no-cache"},
            )
        else:
            response = jsonify(result_payload)

        response.vary.add("Accept")
        return response

    return app
