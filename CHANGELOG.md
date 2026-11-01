# Changelog

## Unreleased (samsung-tizen branch)

- Experimental Samsung Tizen TV app: HDMI input shown full-screen behind the camera panel through TVWindow.
- Relay: per-TV `platform` (`webos` default, `tizen`), `listenHost` LAN listener, token-checked `/show` and one-shot `/pending` routes, constant-time token comparison.
- Samsung HA script blueprint, `compose.tizen.yaml` port override, `npm run build:tizen` and tests.
- Tested on a Samsung QE55QN94AATXXU (2021); fixes from that test:
  - The app stays open between alerts and checks the relay every second. Exiting made the TV fall back to its default source instead of the HDMI input, and relaunching flashed the screen black.
  - The camera is a text-free picture-in-picture in the top-right corner (10–55% wide, default 25%) with the seconds remaining in its corner, hidden until the first frame arrives.
  - The countdown starts at the first frame, so the full duration is always on screen; no picture within 20 seconds gives up quietly.
  - The stream starts in parallel with the HDMI switch, and the relay starts FFmpeg as soon as `/show` arrives, with a shorter input probe, to cut startup time.
  - BACK hides a showing camera; BACK with nothing showing leaves the app.
  - `npm run build:tizen` writes `dist/CameraOverlay.wgt`: `tizen install` fails without a reason when the file name contains a space.
  - Blueprint: optional on/off switch, opening the app through the TV's port 8001 API (default) or the Samsung integration, repeat-trigger cooldown, new size and duration defaults. Existing input keys are unchanged.
  - Rewritten Samsung guide: build computer without admin rights, relay on a Raspberry Pi with systemd, Samsung certificate setup, Home Assistant in Docker, troubleshooting and compatibility.

## 1.0.0

- Public project based on the previously deployed multi-TV overlay.
- Portable software decode by default; optional macOS VideoToolbox fallback.
- Strict config validation, required explicit camera/TV route and secret-safe encoder diagnostics.
- Official CLI pairing import with verified SSH authentication and host-key pinning.
- Separate build-tool dependency tree, local Docker/Compose build and cross-platform CI.
- Home Assistant launch and alert blueprints, installation, troubleshooting and recovery guides.
