# Crack Safe HTTP contract

`POST /api/crack_safe/` and `POST /api/cracksafe/` take a JSON object with `actual_combination` as a string of ten ASCII digits. A combination can start with zero. `algorithm` accepts `"positional"` (the default), `"backtracking"`, or `"regression"`. Regression additionally requires every digit `0–9` exactly once; repeated digits return HTTP 400 for that algorithm.

The Angular client sends both fields for every run and offers the three algorithms individually. To select backtracking, send:

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

`attempts` counts evaluated guesses, including digit-frequency probes and the successful guess. `time_taken` is elapsed seconds. A stream that closes without `result` represents an interrupted run. Computation finishes before the server sends the recorded steps; the UI shows a waiting indicator during computation and provides playback afterward.

All algorithms send recorded progress events after the search completes, followed by the result. Progress includes `phase`, nullable `score`, nullable `baseline_score`, nullable zero-based `position`, `discovered_digits`, and `fixed_prefix`. Phases are `baseline`, `position`, `discovery`, `permutation`, `regression`, and `inferred`. Short runs record every attempt; long runs retain the first 256 attempts, every 4,096th attempt, and the final attempt.

Positional matching counts every `sound_tool` call. Backtracking counts ten digit-discovery calls to `sound_tool`, then one attempt for each complete permutation tested against the safe. Generating a partial permutation does not count as an attempt, and permutation testing does not call `sound_tool` again. Regression counts its scoring probes, up to 45; its final combination is inferred without an additional opening attempt. Its `inferred` event therefore shares the previous probe's attempt number. The final result always reports the exact total. Playback speed does not alter execution time.

Without the SSE accept header, the response is the result object as JSON. Invalid requests return HTTP 400 with a JSON `error` string in either mode.

`GET /api/crack_safe/algorithms/<algorithm>/` returns `{ "algorithm": "positional", "source": "..." }` for each supported mode. `source` contains the complete running algorithm file, including imports, `sound_tool`, and `crack_safe`: `backend/positional.py`, `backend/backtracking.py`, or `backend/regression.py`. An unknown mode returns HTTP 404 with a JSON `error` string.
