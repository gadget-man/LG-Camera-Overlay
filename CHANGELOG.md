# Changelog

## Unreleased (samsung-tizen branch)

- Experimental Samsung Tizen TV app: HDMI input shown full-screen behind the camera panel through TVWindow.
- Relay: per-TV `platform` (`webos` default, `tizen`), `listenHost` LAN listener, token-checked `/show` and one-shot `/pending` routes, constant-time token comparison.
- Samsung HA script blueprint, `compose.tizen.yaml` port override, `npm run build:tizen` and tests.

## 1.0.0

- Public project based on the previously deployed multi-TV overlay.
- Portable software decode by default; optional macOS VideoToolbox fallback.
- Strict config validation, required explicit camera/TV route and secret-safe encoder diagnostics.
- Official CLI pairing import with verified SSH authentication and host-key pinning.
- Separate build-tool dependency tree, local Docker/Compose build and cross-platform CI.
- Home Assistant launch and alert blueprints, installation, troubleshooting and recovery guides.
