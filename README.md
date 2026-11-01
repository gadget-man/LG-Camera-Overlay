# LG Camera Overlay

[![Validation](https://github.com/mbsintegrations/LG-Camera-Overlay/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mbsintegrations/LG-Camera-Overlay/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/mbsintegrations/LG-Camera-Overlay?cacheSeconds=300&v=1.1.0)](https://github.com/mbsintegrations/LG-Camera-Overlay/releases)
[![GitHub stars](https://img.shields.io/github/stars/mbsintegrations/LG-Camera-Overlay?style=flat&logo=github)](https://github.com/mbsintegrations/LG-Camera-Overlay)
[![NAS Docker tested](https://img.shields.io/badge/NAS_Docker-tested-2ea44f)](docs/VALIDATION.md#configurator-and-nas-docker-acceptance-25-october-2026)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

[![PayPal](https://img.shields.io/badge/PayPal-00457C?style=flat&logo=paypal&logoColor=white)](https://paypal.me/mwahl1973)
[![MBS Integrations](https://img.shields.io/badge/MBS_Integrations-mbsintegrations.ie-73dbe2)](https://mbsintegrations.ie)

Show a live camera panel over what you are watching on an LG webOS TV, including native TV apps and HDMI sources such as Apple TV and NVIDIA SHIELD TV Pro. Home Assistant chooses when it appears; BACK or a timer dismisses it. Camera audio is disabled so the underlying app keeps its sound.

> **Samsung Tizen (this branch):** shows the camera as a picture-in-picture over an HDMI source such as a Sky box on Samsung TVs. User-confirmed on a 2021 QN94A; other models are untested. It cannot appear over apps built into the TV. See [Samsung Tizen TVs](docs/SAMSUNG-TIZEN.md).

## What it does

- Shows a live camera in a small panel over your TV programme, without switching away from it or replacing its sound.
- Lets Home Assistant show the panel from a dashboard button or an automation, such as a person detection or doorbell press.
- Closes automatically after your chosen time, or when you press BACK on the TV remote.

## What you need

- **Home Assistant**, with its built-in **LG webOS TV** integration connected to your TV. No HACS integration is required.
- **A compatible LG webOS TV**, with LG Developer Mode enabled and the Camera Overlay TV app installed. Check the [tested models and software](#compatibility).
- **A camera or recorder with an accessible RTSP/RTSPS video stream.** UniFi Protect is tested; other cameras depend on stream compatibility. For automatic alerts, your camera system or another sensor must also send a detection/event to Home Assistant.
- **An always-on computer or Docker-capable NAS** to run the video relay. Its FFmpeg component converts the camera stream for the TV; the TV app displays it. This can share a suitable Linux/NAS host with Home Assistant, or run on a separate machine. See [hardware and hosting options](docs/HOSTING.md).
- **Network access between these devices**, plus Node.js 22 or newer on the computer where you open the configurator. The [six-step setup guide](docs/CONFIGURATOR.md) walks you through pairing, camera settings and installation.

![LG TV - Home Assistant Camera Overlay](docs/images/lg-camera-overlay-header.png)

![LG television showing a programme with the Front Left night camera overlay in the upper-right corner](docs/images/lg-camera-overlay-tv.png)

User-confirmed viewing includes native LG apps and successful overlay appearance over **Netflix, Amazon Prime Video and Plex on both Apple TV and NVIDIA SHIELD TV Pro**, connected through HDMI to each of the two tested LG TVs. See the [viewing matrix](docs/VALIDATION.md#user-confirmed-hdmi-viewing-16-october-2026) for the exact combinations and scope.

**[Start here: illustrated configurator guide](docs/CONFIGURATOR.md)** · [Manual Docker routes](docs/START-HERE.md) · [Detailed installation reference](docs/INSTALL.md) · [Releases](https://github.com/mbsintegrations/LG-Camera-Overlay/releases) · [Home Assistant setup](docs/HOME-ASSISTANT.md) · [Troubleshooting](docs/TROUBLESHOOTING.md)

```mermaid
flowchart LR
  Camera[RTSP / RTSPS camera] --> Relay[Node relay + system FFmpeg]
  Relay -->|Pinned SSH reverse tunnel| TV[webOS overlay app / JSMpeg]
  HA[Home Assistant native LG integration] -->|Launch parameters| TV
  Events[Person / vehicle / doorbell] --> HA
```

The TV app, relay and Home Assistant configuration are three separate installation steps. This uses HA's native **LG webOS TV** integration; no custom HA integration or HACS installation is needed. The relay runs on an always-available computer or locally built Docker container, which can share a Linux/NAS host with Home Assistant. **v1.1.0 adds the local configurator and private deployment export. The separate HA OS App package is experimental and has NOT been tested.** See [hosting on HA hardware and hardware recommendations](docs/HOSTING.md) for the available options and their limits.

## Guided installation

Download **LG-Camera-Overlay-Setup-1.1.0.zip** from [v1.1.0](https://github.com/mbsintegrations/LG-Camera-Overlay/releases/tag/v1.1.0), extract it and open **Start Setup.cmd** on Windows (Node.js LTS 22+ required). Mac/Linux use `sh "Start Setup.command"`. The wizard guides TV pairing and app installation, camera settings, panel preview, HA script creation and private Docker export. The permanent relay still needs Docker or Node/FFmpeg; setup is not an unattended service installer.

![Configurator host selection with sample television preview](docs/images/setup-01-host.png)

**[Follow all six illustrated steps](docs/CONFIGURATOR.md)**. Screenshots use sample data. **HA OS App/ingress has not been tested**; NAS Docker acceptance does not validate it.

## Additional features

For LG privacy settings, camera credentials and recommended network isolation, read [Privacy and network protection](docs/PRIVACY-AND-NETWORK.md). The overlay does not disable LG's underlying viewing-recognition or advertising services.

- Continuous video decoded on a canvas, with a 25–55% width panel and 15–90 second duration.
- One encoder per visible camera, shared by multiple TVs. Encoding stops when its last viewer leaves.
- Separate pinned SSH tunnels and reconnects per TV; offline TVs are not woken.
- Optional Developer Mode session checks and renewal, with bounded, credential-free status.
- Reusable HA launch and alert blueprints, configurable camera routing, shared cooldown and doorbell priority.
- Loopback-only relay: no router port forwarding or public camera endpoint.

## What tells it to show a camera?

There are two separate paths: **RTSP/RTSPS provides video; a detection signal in Home Assistant triggers the overlay.** In the operating UniFi reference, Protect's person/vehicle sensors and doorbell events trigger HA rules, which select a camera, apply cooldown/priority and launch the app on already-on LG TVs. The relay does not perform object detection or read zone polygons.

Read [the complete detection flow](docs/DETECTION-FLOW.md) for the UniFi setup, the distinction between camera detections and notification-zone filters, and what other systems must provide to HA. Other camera/NVR integrations, Frigate, MQTT, webhooks or separate sensors are possible trigger sources, but have not been validated by this project.

**Operating reference:** UniFi Protect + HA native integrations + a native relay on an Apple Silicon Mac mini + LG OLED65B9PLA and 65NANO766QA. This installation predates public v1.0.0. The v1.1.0 configurator/relay also passed an actual NAS Docker → HA Test → Living Room LG test on 25 October 2026, including user-confirmed picture/sound and automatic close. See the [tested and operating setup matrix](docs/VALIDATION.md#tested-and-operating-setups) before choosing a deployment.

## Compatibility

Recorded TV software versions:

| LG TV model | TV firmware | webOS SDK version |
|---|---|---|
| OLED65B9PLA | 05.50.00 | 4.10.0 |
| 65NANO766QA | 04.60.91 | 7.6.0 |
| 55NANO766QA | 04.60.91 | 7.6.0 |

These are recorded device values, not minimum requirements. The SDK version is the TV's reported `sdkVersion`; a separate webOS marketing/platform version was not captured. Firmware and SDK values are not interchangeable. See [version evidence](docs/VALIDATION.md#tv-software-version-evidence) for dates and limits.

**Community-tested TV:** a user reported the overlay working on **OLED77C2AUA / webOS26 11.2.0-3704** (report received 26 October 2026), including all streaming apps they tested. The webOS version is reproduced as supplied; firmware and SDK values were not separately provided. See [community test results](docs/VALIDATION.md#community-tested-tvs).

The predecessor deployment was physically confirmed on **OLED65B9PLA / SDK 4.10.0** over YouTube and Netflix, and **65NANO766QA / SDK 7.6.0** over Netflix. These are historical observations, not certification of every firmware or this release. See [release validation](docs/VALIDATION.md) for new-build evidence and remaining limits.

On 15 October 2026, the user also confirmed that the overlay works on the **OLED65B9PLA** both with **Plex running directly on the LG** and with **Plex running on an Apple TV connected through HDMI**. The Apple TV requires no overlay app; the LG renders the panel above its HDMI picture. These are confirmations of the working installation; the exact package version was not identified in the viewing report.

On 16 October 2026, the user reported that the overlay appeared on **both OLED65B9PLA and 65NANO766QA**, testing **Netflix, Amazon Prime Video and Plex on Apple TV and NVIDIA SHIELD TV Pro** through HDMI: all 12 TV/player/service combinations. The overlay runs on the LG, so no overlay software is installed on either HDMI player. This architecture suggests independence from the connected player's app, but the confirmed combinations do not guarantee every HDMI device, video mode or TV firmware. See [test details](docs/VALIDATION.md#user-confirmed-hdmi-viewing-16-october-2026).

The transparent overlay window flag is not a documented LG compatibility contract. Protected video apps, firmware changes and other TV models can behave differently. Disney+ and other HDMI source/app combinations still require their own viewing checks. Developer Mode is required; root is not.

The relay accepts RTSP/RTSPS camera URLs. UniFi Protect is the original tested source. Other cameras depend on the installed FFmpeg build and are not individually certified. There is no cloud relay or video recording feature. Startup consumes part of the chosen display duration; latency varies with camera stream, network, server and TV.

## Next release

See the [next-release TODO list](TODO.md) for planned additions.

## Project contents

| Path | Purpose |
|---|---|
| `source/` | TV app and pinned MIT-licensed JSMpeg player |
| `relay/` | Portable Node relay and Developer Mode helper |
| `scripts/` | Pairing import, configuration check and IPK build |
| `blueprints/` | HA script and automation blueprints |
| `compose.yaml` | Local Docker build; no published ports |
| `tests/` | Lifecycle, privacy, configuration and encoder checks |
| `tooling/` | Isolated official webOS packager; not a relay dependency |

Own code is **GPL-3.0-only**. Third-party notices remain under their original licences; see [NOTICE](NOTICE) and [licensing](docs/LICENSING.md). LG, webOS, UniFi and Home Assistant are their respective owners' names; this project is independently maintained.
