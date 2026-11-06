# Safe Cracker bonus features

## Backend

- Positional matching and multiset-guided backtracking use separate scoring ports. Each probe counts toward the exact total.
- Server-sent events report the current guess, attempts, and elapsed time. Long backtracking runs sample the stream and always include the successful probe.
- The algorithm source endpoint serves the Python function used by the running server.
- `make check-backend` runs Ruff and the backend test suite. The HTTP contract test posts the sample code to both route spellings and verifies JSON attempt and timing fields.

## Frontend

- The mission moves from briefing to suite, safe close-up, and dossier debrief. The safe hotspot and matched artwork connect the scenes.
- The decoder provides random codes, two search method buttons, live progress, verified results, and a Python source dialog.
- Replay steps through the captured probes with the final attempt count and elapsed time visible. Sampled traces show the original probe numbers.
- Angular Material supplies the decoder controls and dialog. Keyboard focus follows scene changes and returns to the source button when the dialog closes.
- Angular ESLint checks templates for accessibility. Playwright and axe check the story, decoder, dialog, replay, and debrief at desktop and phone sizes using WCAG 2.2 AA rule tags. These automated checks cover the rules axe can evaluate.

GitHub Actions runs both quality gates on changes to their respective parts of the application.
