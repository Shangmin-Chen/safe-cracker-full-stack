# Midnight Transfer

The Angular frontend for Safe Cracker.

Enter Suite 07 from the briefing and inspect the safe to open the decoder. A verified run unlocks the dossier. The briefing also offers a direct route to the decoder.

## Run locally

Use Node.js 22.22.3+, 24.15+, or 26.x. From the repository root, start Flask:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python -m flask --app backend.app run --port 5001
```

In a second terminal, start Angular:

```sh
cd frontend
npm ci
npm start
```

Open [http://localhost:4200](http://localhost:4200). The Angular dev server proxies `/api/` requests to Flask at `127.0.0.1:5001`. For a deployed build, route `/api/` to Flask on the same origin as the UI.

## Verify

From `frontend/`:

```sh
npm test -- --watch=false
npm run build
npm run lint
npx playwright install chromium
npm run test:a11y
```

The mission UI calls the `CrackSafeGateway` port with the selected algorithm. Angular injects the HTTP/SSE adapter at startup. Replay steps through probes captured from the completed run and preserves its reported time and attempt count. Long backtracking runs sample the progress stream. See the [HTTP contract](../contracts/crack-safe/README.md) for the event format.

## Scene artwork

`public/vault-study.webp` was generated with the built-in image generation tool using this prompt:

> Cinematic wide 16:9 environment still for a first-person spy heist. A closed olive-black steel safe with a circular silver wheel is centered at 50% width and 53% height, about a quarter of the image width, unobstructed in a walnut-paneled hotel study after midnight. A brass desk lamp and rain-blue window light pick out burgundy curtains and parquet. Hand-painted ink-and-gouache film background, tactile paper grain, rich midnight shadows and readable warm light. Keep the safe legible in a narrow center crop. No people, text, logos, overlays, or borders.

`public/vault-study-open.webp` uses the built-in image generation tool to edit the closed frame using this prompt:

> Edit the supplied wide hotel study painting as a matching animation end frame. Keep the same 16:9 framing, camera, scale, safe body placement, room, painterly texture, and warm desk lamp and blue rain light. Open only the central steel safe door outward on its existing right-hand hinges. Its heavy olive-black door with the same silver wheel is visible foreshortened to the right. Reveal a dark interior with a single cream envelope sealed in red wax on the middle shelf. Keep the entire open door and envelope inside the central half of the image for a vertical crop. No added text, people, labels, or UI.
