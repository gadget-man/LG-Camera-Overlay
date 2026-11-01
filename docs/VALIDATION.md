# Validation record (Samsung)

This page records what has been tested on Samsung TVs, and how. Results apply only to the setups listed. Test records for LG TVs are kept in the [upstream project](https://github.com/mbsintegrations/LG-Camera-Overlay/blob/main/docs/VALIDATION.md).

The labels below mean:
- **User-confirmed:** seen on the TV by the person testing.
- **Automated:** checked by `npm test`.
- **Browser-checked:** the real app page rendered in desktop Chromium with Samsung's API simulated.
- **Unverified:** not tested yet.

## Test setup

| Part | Details |
|---|---|
| TV | Samsung QE55QN94AATXXU (Neo QLED, 2021, model code `21_NIKEM2_QTV`) |
| Source | Sky box on HDMI 1 |
| Camera | Lorex camera, RTSP with username and password |
| Relay | Raspberry Pi Zero 2 W (512 MB, 64-bit OS), native Node.js 22 and static FFmpeg 7.0.2, systemd service |
| Home Assistant | Docker on the same Pi, with the Samsung Smart TV integration |
| Build computer | Intel Mac, macOS 15, Tizen Studio with the Samsung Certificate Extension and a Samsung (Public) certificate |

## First real-TV test, 31 October 2026

**User-confirmed:**
- The app installs and runs on the QN94A, signed with a Samsung certificate.
- The camera appears as a picture-in-picture over the Sky picture on HDMI 1, so TVWindow shows the HDMI input behind the page on this model.
- The picture closes on its timer and the TV stays on HDMI 1, once the app was changed to stay open instead of exiting.
- After the first alert, later alerts appear without the TV's black loading flash.
- The TV accepts `POST http://TV:8001/api/v2/applications/MbsCamOvly.CameraOverlay` to open the app (`true`, HTTP 200).
- The Home Assistant button runs the script and the picture appears, gated by the on/off Toggle and the Samsung integration's TV state.

**Problems found and fixed during the test:**
- The app exited when the timer ended, and the TV fell back to the tuner. The app now stays open.
- Each relaunch flashed black. Fixed by the same change.
- The panel took several seconds to show video, so about half the duration was used up before the picture appeared. Startup was shortened, and the countdown now starts at the first frame.
- `tizen install` failed with no reason because the package file name contained a space. The build now writes `CameraOverlay.wgt`.
- Tizen-type certificates built but wouldn't install. A Samsung-type certificate is required.

**Known issue.** Once, the relay on the Pi Zero 2 W stopped answering `/show` and needed a service restart. The Pi had about 90 MB of memory available before the relay started, with swap nearly full. The cause wasn't captured; see [hosting](HOSTING.md).

## 1.2.0 alignment, 1 November 2026

- **Automated:** 17 tests pass, including:
  - the app staying open
  - the countdown starting at the first frame, and the 20-second no-picture timeout
  - BACK behaviour
  - the appearance settings and their fallbacks
  - the relay's validation of the appearance fields and its early encoder start
- **Automated:** the Home Assistant payload template renders valid JSON with and without the appearance settings.
- **Browser-checked:** default top-right, compact bottom-left with label, and centre without border.
- **User-reported:** the updated app, relay and Home Assistant configuration are working (1 November). Which appearance settings were tried on the TV wasn't itemised.

## Not yet tested on Samsung

- Other Samsung models, years and firmware, and other HDMI sources and video modes (HDR, Dolby Vision, refresh rates).
- Whether HDMI audio continues while the picture shows. It is expected to, but hasn't been confirmed separately.
- Motion, person and doorbell triggers, the alert blueprint's cooldown and priority, and the pause helper and quiet-hours blueprint with a Samsung TV.
- The blueprint's **Samsung integration** launch option, and the templated `{{ tv_id }}` relay URL for several TVs.
- The relay in Docker, on a Mac, or on a Pi 4 or 5, and several TVs or cameras at once.
- Recovery after a relay reboot or TV power cut, and behaviour after certificate expiry.
- The relay's faster-start FFmpeg options with LG TVs. They apply to all TVs; see the [installation guide](SAMSUNG-TIZEN.md#how-it-works).

To add a result, report the TV model and year, the source, the relay computer, and the four checks in [installation step 8](SAMSUNG-TIZEN.md#8-test-without-home-assistant).
