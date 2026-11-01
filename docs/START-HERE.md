# Choose your setup

The step-by-step instructions are in the [Samsung installation guide](SAMSUNG-TIZEN.md). This page helps you decide which computers do which job before you start.

Before setup, review [privacy and network protection](PRIVACY-AND-NETWORK.md).

## The three jobs

| Job | What it does | When it's needed |
|---|---|---|
| **Build computer** (Mac or PC with Tizen Studio) | Builds the TV app, signs it with your Samsung certificate and installs it on the TV | Once at the start, then again only to update the app or renew the certificate |
| **Relay computer** (always on) | Pulls the camera stream, converts it and sends it to the TV | Whenever you want alerts |
| **Home Assistant** | Shows the camera from a button or automation, and opens the TV app | Whenever you want alerts |

The relay and Home Assistant can share one machine. The build computer can be your everyday laptop, because nothing needs to keep running on it.

## 1. Choose the relay computer

| Relay computer | How to run the relay | Status for Samsung |
|---|---|---|
| Raspberry Pi (Linux), with or without Home Assistant on it | Native Node.js and FFmpeg as a systemd service. Everything is downloaded on the build computer and copied across | **Tested** on a Pi Zero 2 W also running Home Assistant in Docker. It works but memory is tight; see [hosting](HOSTING.md) |
| Linux computer or NAS with Docker | `docker compose -f compose.yaml -f compose.tizen.yaml up -d --build` | Not yet tested with a Samsung TV |
| Always-on Mac | Native Node.js and FFmpeg | Not yet tested with a Samsung TV. A Mac only runs it while it's awake and logged in |

**Home Assistant OS installed directly on the hardware** (Home Assistant Green, for example) can't run the relay. HA OS doesn't let you install programs or containers yourself, and the project's experimental HA OS package is LG-only and untested. Run the relay on another computer.

Whichever you choose, give the relay computer, the TV and the camera fixed addresses with DHCP reservations in your router. The relay's address is built into the TV app.

## 2. Check where Home Assistant runs

| Home Assistant | Editing its configuration |
|---|---|
| In Docker (HA Container), for example on the Pi | Edit `configuration.yaml` and `secrets.yaml` in the folder mounted at `/config`, over SSH. The [guide](SAMSUNG-TIZEN.md#9-home-assistant) shows how to find it |
| Home Assistant OS (on its own hardware or in a VM) | Use the File editor app (add-on) for the same two files |

Either way, add the built-in **Samsung Smart TV** integration. The script uses it to check the TV is on.

**No Home Assistant yet?** Set it up with the [official installation guide](https://www.home-assistant.io/installation/) first. You can still test the overlay from a terminal without it ([step 8](SAMSUNG-TIZEN.md#8-test-without-home-assistant)).

## 3. Prepare the build computer

- **Mac (Intel or Apple Silicon):** Git, Node.js 22 or newer, and Tizen Studio. On an Intel Mac, or without admin rights, use the official Node tarball rather than Homebrew. The [guide](SAMSUNG-TIZEN.md#3-prepare-the-build-computer) has the commands.
- **Windows or Linux:** the same tools. The guide's commands are written for macOS, so adapt the paths and the `PATH` lines.

## 4. Follow the guide

Work through the [Samsung installation guide](SAMSUNG-TIZEN.md) in order:

1. Configure the relay.
2. Run the relay on the relay computer.
3. Turn on the TV's Developer mode and create a **Samsung** (not Tizen) certificate.
4. Build and install the TV app.
5. Test it from a terminal.
6. Set up Home Assistant.

Test one camera on one TV manually before adding automatic alerts.

## If a step doesn't work

| What you see | Where to look |
|---|---|
| `sdb connect` fails | [Guide step 6d](SAMSUNG-TIZEN.md#6-prepare-the-tv-and-tizen-studio) and [troubleshooting](TROUBLESHOOTING.md) |
| `Failed to install Tizen application.` | Usually the certificate type or DUID. See [troubleshooting](TROUBLESHOOTING.md) |
| `401 Unauthorized` from the camera | The camera URL needs its username and password |
| Request accepted but nothing on the TV | The app isn't open. See [troubleshooting](TROUBLESHOOTING.md) |
| Relay stops answering | Memory on the relay computer. See [hosting](HOSTING.md) and [troubleshooting](TROUBLESHOOTING.md) |

When asking for help, give the TV model, relay computer, Home Assistant installation type and the step that failed. Remove tokens, camera URLs and passwords first, and never attach the `private` folder or the `.wgt` file.
