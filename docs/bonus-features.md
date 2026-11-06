# Safe Cracker bonus features

## Backend

- Positional matching and multiset-guided backtracking use separate scoring ports. Their adapters call the shared Python `sound_tool` for scoring, and backtracking uses a separate safe-open signal. Each probe counts toward the exact total.
- Server-sent events report the current guess, attempts, and elapsed time. Long backtracking runs sample the stream and always include the successful probe.
- The algorithm source endpoint serves the Python function used by the running server.
- `make check-backend` runs Ruff and the backend test suite. The HTTP contract test posts the sample code to both route spellings and verifies JSON attempt and timing fields.

## Frontend

- The mission moves from briefing to suite, safe close-up, and dossier debrief. The safe hotspot and matched artwork connect the scenes.
- The decoder provides random codes, two search method buttons, live progress, verified results, and a Python source dialog.
- The combination field filters typed and pasted text to ASCII digits, preserves leading zeros, and checks for exactly ten digits on submit.
- Replay steps through the captured probes with the final attempt count and elapsed time visible. Sampled traces show the original probe numbers.
- **Try the other method** runs the same submitted combination again and compares both attempt totals and timings in the debrief. The comparison belongs to the current drill.
- The Angular UI calls a gateway port. Its HTTP/SSE adapter handles the Flask protocol, so UI tests can supply a fake gateway and verify replay, retries, and comparisons independently.
- **Skip to decoder** provides a direct route from the briefing. Scene transitions and the safe reveal respect reduced motion.
- Angular Material supplies the decoder controls and dialog. Keyboard focus follows scene changes and returns to the source button when the dialog closes.
- Angular ESLint checks templates for accessibility. Playwright and axe check the story, decoder, dialog, replay, and debrief at desktop and phone sizes using WCAG 2.2 AA rule tags. These automated checks cover the rules axe can evaluate.

GitHub Actions runs both quality gates on changes to their respective parts of the application.

## Reproduce a comparison

1. Start the backend and frontend using the [local setup steps](../frontend/README.md#run-locally).
2. Open the decoder, enter one of the codes below, select either method, and crack the safe.
3. Select **Recover the dossier**, then **Try the other method**. The debrief shows both results for the same code.

| Combination | Positional probes | Backtracking probes |
| --- | ---: | ---: |
| `0800666666` | 48 | 235 |
| `0123456789` | 47 | 11 |

Positional matching uses exact-position scores. Backtracking uses multiset scores to recover digit counts and a separate safe-open signal to check their order. Elapsed times vary by run.
