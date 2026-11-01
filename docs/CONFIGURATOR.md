# Setup wizard (configurator)

**The setup wizard isn't used for Samsung TVs.** It is built around LG TVs: LG Developer Mode pairing over SSH, installing the LG app package, and an LG-only Home Assistant script. It can't pair with, build for or install on a Samsung TV, and it would generate a configuration without the LAN listener Samsung TVs need. The wizard's files remain in this branch only because the code is shared with the LG version.

For a Samsung TV, use the [Samsung installation guide](SAMSUNG-TIZEN.md). This table shows where each wizard screen's job is done instead:

| Wizard screen (LG) | Samsung equivalent |
|---|---|
| 1. Your setup: choose the relay computer | [Choose your setup](START-HERE.md) |
| 2. TV: Developer Mode pairing and app install | [Guide step 6](SAMSUNG-TIZEN.md#6-prepare-the-tv-and-tizen-studio) (Developer mode, `sdb`, Samsung certificate) and [step 7](SAMSUNG-TIZEN.md#7-build-and-install-the-tv-app) (build and install) |
| 3. Camera: stream address | [Guide step 4](SAMSUNG-TIZEN.md#4-configure-the-relay) (`private/config.json`) |
| 4. Camera panel: size, position, border, compact | The Home Assistant script's settings ([Home Assistant setup](HOME-ASSISTANT.md#create-the-camera-script)); no rebuild needed |
| 5. Home Assistant: generated script | [Home Assistant setup](HOME-ASSISTANT.md), or the [Samsung script blueprint](../blueprints/script/samsung-camera-overlay.yaml) |
| 6. Finish: private Docker bundle | [Guide step 5](SAMSUNG-TIZEN.md#5-run-the-relay-on-a-raspberry-pi) (systemd on a Pi) or [Docker with `compose.tizen.yaml`](INSTALL.md#running-the-relay) |

The LG wizard's guide, with screenshots, is on the [upstream project's `main` branch](https://github.com/mbsintegrations/LG-Camera-Overlay/blob/main/docs/CONFIGURATOR.md).
