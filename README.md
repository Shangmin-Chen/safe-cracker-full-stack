# safe-cracker-full-stack

Start with the [full-stack demo setup](frontend/README.md#run-locally) and the [bonus feature walkthrough](docs/bonus-features.md).

The [backend architecture](docs/backend-architecture.md) describes the use case, algorithm port, and adapters.

## Run the backend

From the repository root with Python 3.10 or newer:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m flask --app backend.app run --port 5001
```

## Crack a combination

Send `actual_combination` as a string of exactly 10 ASCII digits. The optional `algorithm` field accepts `positional` (the default), `backtracking`, or `regression`. Both `/api/crack_safe/` and `/api/cracksafe/` accept this request. Regression requires each digit `0–9` exactly once; positional and backtracking also support repeated digits.

```sh
curl http://127.0.0.1:5001/api/crack_safe/ \
  -H 'Content-Type: application/json' \
  -d '{"actual_combination":"0800666666"}'
```

The response contains `attempts`, `time_taken` in seconds, `cracked_combination`, and `success`. Each attempt counts one scoring probe or safe-open check. Invalid input returns HTTP 400 with an `error` message.

To select a method explicitly, send both fields. Use `"positional"` for exact-position feedback or `"backtracking"` for digit counts and the safe-open signal.

```json
{"actual_combination":"0800666666","algorithm":"backtracking"}
```

Regression uses exact-position feedback and infers a permutation of `0–9` in at most 45 scoring probes. It does not submit the final inferred combination as an additional opening attempt:

```json
{"actual_combination":"9876543210","algorithm":"regression"}
```

To stream progress, add `Accept: text/event-stream` to the same POST request:

```sh
curl --no-buffer http://127.0.0.1:5001/api/crack_safe/ \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"actual_combination":"0800666666"}'
```

Each `progress` event contains `attempts`, `current_combination`, `time_taken`, and step details such as the phase, score, and active position. The backend records actual algorithm events and sends them after computation completes, followed by the final `result`. Long backtracking traces retain the first 256 attempts, every 4,096th attempt, and the last attempt. Regression ends with an inference step that does not increment its attempt count.

The frontend offers all three methods with examples, explanations, the complete Python source file, and step playback. Execution time is measured by the algorithm and stays fixed while playback speed changes.

## Check the backend

```sh
python -m pip install -r backend/requirements-dev.txt
make check-backend PYTHON=python
```

The check runs Ruff and the backend tests, including the HTTP contract for the sample combination. GitHub Actions runs the same command.
