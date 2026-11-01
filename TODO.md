# Samsung roadmap

Planned or wanted for the Samsung version. What has been tested so far is recorded in [test results](docs/VALIDATION.md).

## Features

- [ ] **Hide the picture early from Home Assistant.** Add a "hide now" request to the relay and app, so a dashboard button, a Zigbee button, or a Sky Q state change through a Home Assistant integration can close the picture before it times out. The Sky remote can't reach the TV app directly. BACK on the Samsung remote already works.
- [ ] Let a priority (doorbell) request replace a picture that's already showing, as it does on LG. At the moment it's shown after the current picture closes.
- [ ] Optionally keep the TV screen on while a picture shows, if Samsung's screensaver turns out to hide it. Not observed so far.

## Testing

- [ ] Other Samsung models and years, and other HDMI sources and video modes.
- [ ] HDMI audio continuing while the picture shows, confirmed separately.
- [ ] The 1.2.0 appearance settings on a TV (so far checked in a desktop browser only).
- [ ] Motion, person and doorbell triggers through the alert blueprint, the pause helper and the quiet-hours blueprint.
- [ ] The blueprint's Samsung-integration launch option, and several TVs with the templated `{{ tv_id }}` URL.
- [ ] The relay in Docker (`compose.tizen.yaml`), on a Mac, and on a Pi 4 or 5.
- [ ] Recovery after a relay reboot and a TV power cut, and whether the app keeps working with Developer mode turned off.
- [ ] What happens when the Samsung certificate expires.
- [ ] The relay's faster-start FFmpeg options with LG TVs, before any merge towards `main`.

## Known issues

- [ ] The relay on a Raspberry Pi Zero 2 W running Home Assistant stopped answering once and needed a restart. Capture `journalctl` and memory output when it next happens, to find the cause.
