# Crack Safe HTTP contract

`POST /api/crack_safe/` and `POST /api/cracksafe/` take a JSON object with `actual_combination` as a string of ten ASCII digits. A combination can start with zero. `algorithm` accepts `"positional"` (the default) or `"backtracking"`.

The Angular client sends both fields for every run. To select backtracking, send:

```json
{"actual_combination":"0800666666","algorithm":"backtracking"}
```

Use `"positional"` as the algorithm value to select positional matching explicitly. Existing callers can omit `algorithm` to use the positional default.

With `Accept: text/event-stream`, a successful request streams `progress` events and ends with one `result` event. For example, a run with an all-zero target can produce these frames:

```text
event: progress
data: {"attempts":1,"current_combination":"0000000000","time_taken":0.00002}

event: result
data: {"attempts":1,"cracked_combination":"0000000000","time_taken":0.00002,"success":true}

```

`attempts` counts evaluated guesses, including digit-frequency probes and the successful guess. `time_taken` is elapsed seconds. A stream that closes without `result` represents an interrupted run. The current payload supports an activity indicator while a run is in progress.

Positional matching streams every probe. Backtracking streams the first 1,024 probes, every 4,096th probe after that, and the successful probe. In a sampled run, consecutive progress events can have nonconsecutive attempt numbers. The final result always reports the exact total.

Without the SSE accept header, the response is the result object as JSON. Invalid requests return HTTP 400 with a JSON `error` string in either mode.

`GET /api/crack_safe/algorithms/<algorithm>/` returns `{ "algorithm": "positional", "source": "..." }` for either supported mode. `source` contains the Python function used by the running server. The `positional` mode serves `crack_positional_attempts` from `backend/positional.py`. The `backtracking` mode serves `crack_backtracking_attempts` from `backend/backtracking.py`. An unknown mode returns HTTP 404 with a JSON `error` string.
