# Safe Cracker bonus features

## Backend

- Positional matching and multiset-guided backtracking use separate scoring ports. Both adapters call the shared Python `sound_tool` for scoring. Backtracking recovers the digit counts, then checks distinct arrangements with a separate yes/no safe-open signal.
- Server-sent events report the current guess, attempt count, and elapsed time. Positional matching streams every probe. Backtracking samples long runs, always streams the successful probe, and reports the exact final total. See the [HTTP contract](../contracts/crack-safe/README.md).
- The algorithm source endpoint serves the Python function used by the running server. **Show algorithm** displays the selected method’s source and explanation, or both implementations in **Both** mode.

## Frontend

- The mission moves from briefing to suite to safe close-up. The safe hotspot and matched artwork connect the scenes, and the safe opens when the decoder verifies a match.
- The vault readout accepts up to ten ASCII digits from typing or paste, preserves leading zeros, and requires all ten digits to start. **Random** fills the readout with a valid code.
- Each method has a separate guess display and activity bar, plus a live attempt count and timer that freeze on a verified match. **Both** runs positional matching first and then backtracking on the same code, with the two panels side by side.
- Replay appears automatically below the results. Drag the slider to jump to a captured probe or use **Previous** and **Next** to step through the trace. After a **Both** run, each trace remembers its position. Sampled traces show the original probe numbers.
- The Angular UI calls a gateway port. Its HTTP/SSE adapter handles the Flask protocol, so UI tests can supply a fake gateway to verify result handling and replay independently.
- **Skip to decoder** provides a direct route from the briefing. Scene transitions and the safe reveal respect reduced motion.
- Angular Material supplies the decoder controls and dialog. Keyboard focus follows scene changes and returns to the source button when the dialog closes.

## Quality checks

- `make check-backend` runs Ruff and the backend tests. The HTTP contract test posts `0800666666` to both route spellings and checks the JSON response, including the attempt count and elapsed time in seconds.
- The frontend runs Angular ESLint template accessibility rules, unit tests, a production build, and Playwright with axe. The browser checks cover the story, decoder, source dialog, results, and replay at desktop and phone widths using WCAG 2.2 AA rule tags.
- GitHub Actions runs both suites on pushes to `main` and runs the relevant suite on pull requests.

## Reproduce a comparison

1. Start the backend and frontend using the [local setup steps](../frontend/README.md#run-locally).
2. Open the decoder, enter one of the codes below, select **Both**, and crack the safe.
3. Compare the attempt counts and timings. Switch replay methods and drag the slider to inspect a recorded guess.

| Combination | Positional probes | Backtracking probes |
| --- | ---: | ---: |
| `0800666666` | 48 | 235 |
| `0123456789` | 47 | 11 |

Positional matching uses exact-position scores. Backtracking uses multiset scores to recover digit counts and a separate safe-open signal to check their order. Elapsed times vary by run.
