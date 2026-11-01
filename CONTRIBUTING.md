# Contributing

Use a pull request with the concrete problem, changed behavior and verification. Keep credentials, real camera imagery, private network details and HA backups out of commits and issues. Use documentation addresses such as `192.0.2.30` and obvious placeholders.

Run `npm ci --ignore-scripts`, `npm test`, and `npm audit --omit=dev`. For the Samsung TV app, run `npm run build:tizen -- --tv TV_ID --relay http://RELAY_IP:8766 --profile SAMSUNG_PROFILE` with Tizen Studio and a Samsung certificate profile installed. App behaviour is covered by `tests/tizen-overlay.cjs` and the relay's Samsung routes by `tests/tizen-relay.cjs`. Use a distinct relay port and token when testing alongside an existing deployment. Never commit a built `.wgt`: it contains the relay token.

When reporting a Samsung TV result, include the model and year (from `curl -s http://TV_IP:8001/api/v2/`), the HDMI source, the relay computer and the four checks in [installation step 8](docs/SAMSUNG-TIZEN.md#8-test-without-home-assistant). Remove the TV's DUID and any tokens first.

With system FFmpeg installed, run `node tests/encoder-smoke.cjs`. This uses synthetic video, a real encoder and WebSocket, and fake TV SSH (the LG route). It does not establish TV compatibility. Describe tests as automated, visually observed, physically/user confirmed or unverified. Add regression tests for authentication, lifecycle, privacy or routing changes; keep input keys stable when updating blueprints.

Contributions to project-owned code are under GPL-3.0-only. Preserve third-party licences. Do not add binary dependencies without provenance and a redistribution/source plan.
