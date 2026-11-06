# safe-cracker-full-stack

## Run the backend

From the repository root with Python 3.10 or newer:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m flask --app backend.app run
```

## Crack a combination

Send `actual_combination` as a string of exactly 10 ASCII digits. The optional `algorithm` field accepts `positional` (the default) or `backtracking`. Both `/api/crack_safe/` and `/api/cracksafe/` accept this request.

```sh
curl http://127.0.0.1:5000/api/crack_safe/ \
  -H 'Content-Type: application/json' \
  -d '{"actual_combination":"0800666666"}'
```

The response contains `attempts`, `time_taken` in seconds, `cracked_combination`, and `success`. Each attempt represents one call to the simulated lock sensor. Invalid input returns HTTP 400 with an `error` message.

To select a method explicitly, send both fields. Use `"positional"` for exact-position feedback or `"backtracking"` for digit counts and the safe-open signal.

```json
{"actual_combination":"0800666666","algorithm":"backtracking"}
```

To stream progress, add `Accept: text/event-stream` to the same POST request:

```sh
curl --no-buffer http://127.0.0.1:5000/api/crack_safe/ \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"actual_combination":"0800666666"}'
```

Each `progress` event contains `attempts`, `current_combination`, and `time_taken`. Positional matching streams every probe. Backtracking samples long runs and always streams the successful probe. The final `result` event reports the exact total and uses the same fields as the JSON response, then the stream closes.

## Check the backend

```sh
python -m pip install -r backend/requirements-dev.txt
make check-backend PYTHON=python
```

The check runs Ruff and the backend tests, including the HTTP contract for the sample combination. GitHub Actions runs the same command.
