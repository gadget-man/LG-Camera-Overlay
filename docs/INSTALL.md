# Installation reference

The [Samsung installation guide](SAMSUNG-TIZEN.md) is the step-by-step route. This page is the reference behind it: what each part needs, the configuration keys, and the ways to run the relay. To choose which computer does what, see [Choose your setup](START-HERE.md).

## Requirements

| Part | Needs |
|---|---|
| Samsung TV | Tizen, Developer mode switched on with the build computer's address, and your box on an HDMI input |
| Build computer | Git, Node.js 22 or newer, Tizen Studio with **TV Extensions** and **Samsung Certificate Extension**, and a Samsung account |
| Relay computer | Node.js 22 or newer and an FFmpeg build with RTSP/RTSPS input and the `mpeg1video` encoder, or Docker |
| Home Assistant | The **Samsung Smart TV** integration and two `rest_command` entries |

## Network paths

| From | To | Port | Purpose |
|---|---|---|---|
| TV app | Relay | TCP 8766 (the `port` setting) | Asks for camera requests (`/pending`) and receives video (WebSocket `/live`) |
| Home Assistant | Relay | TCP 8766 | Sends camera requests (`/show`) |
| Home Assistant | TV | TCP 8001 | Opens the overlay app |
| Home Assistant | TV | The Samsung integration's own ports | Reads whether the TV is on |
| Relay | Camera | The stream's port, usually 554 | RTSP/RTSPS over TCP |
| Build computer | TV | TCP 26101 | `sdb`, only while installing |

There is no SSH tunnel: the TV app connects straight to the relay over your LAN, so the relay must listen on a LAN address. Don't forward any of these ports from the Internet. See [privacy and network protection](PRIVACY-AND-NETWORK.md).

## Relay configuration

The relay reads `private/config.json`. Start from [`config.tizen.example.json`](../config.tizen.example.json).

| Key | Meaning |
|---|---|
| `port` | Relay port, default 8766. Built into the TV app and used in Home Assistant's URL |
| `listenHost` | Must be a LAN address such as `0.0.0.0` for Samsung TVs. The relay refuses to start with a Tizen TV and a loopback address |
| `token` | 64 lowercase hex characters. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Built into the TV app and Home Assistant's URL |
| `ffmpeg` | `ffmpeg` on `PATH`, or the absolute path to the executable |
| `hardwareDecode` | `none` (software decoding). `videotoolbox` applies only to a native relay on macOS |
| `sources` | Camera ID → private RTSP/RTSPS URL, including the camera's username and password |
| `tvs` | TV ID → `{ "platform": "tizen", "hdmi": 1 }`. `hdmi` is the input kept behind the picture; `0` keeps whatever source the app finds |

IDs must start with a lowercase letter and contain only lowercase letters, digits or underscores. Use a camera sub-stream or medium-quality stream: the relay outputs 768×432 at 25 fps MPEG-1, so a 4K source only adds work. Run `npm run check` to validate the file.

Changing `token`, `port` or the relay's address means rebuilding and reinstalling the TV app. Changing `sources` or `hdmi` only needs a relay restart.

## Running the relay

**Native with systemd (tested on a Raspberry Pi).** Download Node.js and a static FFmpeg for the Pi on the build computer, copy them and a production-only copy of the project across, and run `relay/relay.cjs` as a systemd service with `Restart=on-failure`. The [guide's step 5](SAMSUNG-TIZEN.md#5-run-the-relay-on-a-raspberry-pi) has the exact commands and service file. Set `OVERLAY_DATA_DIR` if `private/` and `logs/` live outside the project folder.

**Docker (not yet tested with a Samsung TV).** The supplied Compose file builds the relay locally from Debian's FFmpeg. Samsung TVs need its port published, which the override file does:

```sh
mkdir -p logs
sudo chown -R 1000:1000 private logs
sudo chmod 700 private logs
docker compose -f compose.yaml -f compose.tizen.yaml build
docker compose -f compose.yaml -f compose.tizen.yaml run --rm camera-overlay node scripts/check-config.cjs
docker compose -f compose.yaml -f compose.tizen.yaml up -d
```

The container runs as a non-root user, read-only apart from its two mounted folders, with a 512 MiB memory limit. If you change `port`, also change the published port in `compose.tizen.yaml` and the healthcheck URL in `compose.yaml`.

**Native in a terminal (for testing).** `npm ci --omit=dev --ignore-scripts`, `npm run check`, then `npm start`. Ctrl+C stops it.

Check it's running with `curl http://RELAY_IP:8766/health`. `encoder_running` is true only while a camera is being sent. `tv_clients` lists TVs currently watching.

## The TV app

`npm run build:tizen -- --tv TV_ID --relay http://RELAY_IP:8766 --profile CERTIFICATE_PROFILE` builds `dist/CameraOverlay.wgt`. It bakes in the relay address, token, TV ID and HDMI input, so build one package per TV. Install it with `tizen install-permit` then `tizen install`. See [guide step 7](SAMSUNG-TIZEN.md#7-build-and-install-the-tv-app).

The app ID is `MbsCamOvly.CameraOverlay` and the package ID `MbsCamOvly`. The app needs the `internet` and `tv.window` privileges, both available with a Public-level Samsung certificate.

## Home Assistant

See [Home Assistant setup](HOME-ASSISTANT.md). Test one camera manually before turning on automatic alerts.

## Running it long-term

- Check the relay survives a reboot of its computer, and that the overlay still works after the TV has been in standby.
- Samsung developer certificates expire. Note the expiry date ([guide: everyday behaviour](SAMSUNG-TIZEN.md#everyday-behaviour)) and rebuild with a renewed certificate before then.
- Keep `private/config.json`, your certificate profile and its passwords backed up privately. The `.wgt` file contains the token, so treat it as private too.

For updating and recovery, see [troubleshooting](TROUBLESHOOTING.md#update-and-rollback).
