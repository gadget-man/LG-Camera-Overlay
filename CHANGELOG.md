# Changelog

## Unreleased

- Camera panel appearance: screen position (four corners or centre), distance from the screen edge, optional border and its colour, optional frame rate next to LIVE, and compact mode (title and countdown over the picture on a translucent background), set in the configurator's camera-panel step and in the launch blueprint. Defaults keep the previous look, and existing scripts need no change.

## 1.0.0

- Public project based on the previously deployed multi-TV overlay.
- Portable software decode by default; optional macOS VideoToolbox fallback.
- Strict config validation, required explicit camera/TV route and secret-safe encoder diagnostics.
- Official CLI pairing import with verified SSH authentication and host-key pinning.
- Separate build-tool dependency tree, local Docker/Compose build and cross-platform CI.
- Home Assistant launch and alert blueprints, installation, troubleshooting and recovery guides.
