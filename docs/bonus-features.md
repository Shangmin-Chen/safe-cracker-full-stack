# Safe Cracker bonus features

## Backend

- Each algorithm file exposes `sound_tool(actual_combination, combination)` and `crack_safe(actual_combination)`. Positional scoring counts exact-position matches. Backtracking scoring counts shared digits, including repeats. Backtracking first collects all digits using ten scoring probes, then uses a recursive helper to generate permutations without calling `sound_tool` again. An exact equality check simulates the safe opening. Each scoring probe and complete permutation tested counts as one attempt; partial permutations do not. All algorithms return only `attempts` and `time_taken`.
- Regression is available in the decoder and backend API for locks using each digit `0–9` exactly once. It identifies a combination in at most 45 probes by detecting score regressions and inferring the last remaining candidate. Submitting the inferred code as a separate opening attempt is outside that total.
- The [backend architecture](backend-architecture.md) connects the algorithms through an injected port and function adapter. Flask handles transport, while the use case handles validation and selection.
- An optional observer records actual algorithm steps. Server-sent events send those recorded steps and the result after each search completes. Long traces are sampled while preserving exact totals. See the [HTTP contract](../contracts/crack-safe/README.md).
- The algorithm source endpoint serves the complete Python file used by the running server. **Show algorithm** displays both functions, imports, the method's explanation, and its stages.

## Frontend

- The mission moves from briefing to suite to safe close-up. The safe hotspot and matched artwork connect the scenes, and the safe opens when the decoder verifies a match.
- The vault readout accepts up to ten ASCII digits from typing or paste, preserves leading zeros, and requires all ten digits to start. **Random** fills the readout with a valid code.
- The three search methods are Positional matching, Backtracking, and Regression. Each includes an explanation, stages, attempt bound, and example. Regression's **Random** generates a valid permutation of `0–9`.
- Results show exact attempt totals and algorithm execution time. Step visualization highlights the active position and confirmed digits, shows scoring feedback and the discovered digit pool, and explains each stage. **Previous**, **Next**, **Play steps**, a slider, and playback speed control the recorded trace. Sampled traces show original attempt numbers. Playback does not change execution time or issue additional algorithm calls.
- The Angular UI calls a gateway port. Its HTTP/SSE adapter handles the Flask protocol, so UI tests can supply a fake gateway to verify result handling and replay independently.
- **Skip to decoder** provides a direct route from the briefing. Scene transitions and the safe reveal respect reduced motion.
- Angular Material supplies the decoder controls and dialog. Keyboard focus follows scene changes and returns to the source button when the dialog closes.

## Quality checks

- `make check-backend` runs Ruff and the backend tests. The HTTP contract test posts `0800666666` to both route spellings and checks the JSON response, including the attempt count and elapsed time in seconds.
- The frontend runs Angular ESLint template accessibility rules, unit tests, a production build, and Playwright with axe. The browser checks cover the story, decoder, source dialog, results, and replay at desktop and phone widths using WCAG 2.2 AA rule tags.
- GitHub Actions runs both suites on pushes to `main` and runs the relevant suite on pull requests.

## Reproduce a comparison

1. Start the backend and frontend using the [local setup steps](../frontend/README.md#run-locally).
2. Open the decoder, enter one of the codes below, select Positional matching, and crack the safe.
3. Note the attempt count and timing, then repeat with Backtracking. Use the slider or playback controls to inspect each run.

| Combination | Positional probes | Backtracking probes |
| --- | ---: | ---: |
| `0800666666` | 82 | 235 |
| `0123456789` | 65 | 11 |

Positional matching uses exact-position scores. Backtracking uses multiset scores to recover digit counts and a separate safe-open signal to check their order. Elapsed times vary by run.
