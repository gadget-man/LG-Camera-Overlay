# Samsung Tizen TVs (HDMI sources)

Shows a live camera as a small picture-in-picture over an HDMI source, such as a Sky box, on a Samsung Tizen TV, triggered from Home Assistant.

> **Status: working on one TV.** User-confirmed on a Samsung QE55QN94AATXXU (Neo QLED, 2021, model code `21_NIKEM2_QTV`) with the relay on a Raspberry Pi Zero 2 W and Home Assistant in Docker on the same Pi. Other models are untested. See [Compatibility](#compatibility) and please report your results.

## Contents

1. [How it works](#how-it-works)
2. [What you need](#what-you-need)
3. [Prepare the build computer](#3-prepare-the-build-computer)
4. [Configure the relay](#4-configure-the-relay)
5. [Run the relay on a Raspberry Pi](#5-run-the-relay-on-a-raspberry-pi)
6. [Prepare the TV and Tizen Studio](#6-prepare-the-tv-and-tizen-studio)
7. [Build and install the TV app](#7-build-and-install-the-tv-app)
8. [Test without Home Assistant](#8-test-without-home-assistant)
9. [Home Assistant](#9-home-assistant)
10. [Everyday behaviour](#everyday-behaviour) · [Troubleshooting](#troubleshooting) · [Compatibility](#compatibility) · [Updating](#updating)

## How it works

Samsung does not let third-party apps float a window over other apps. Instead, the overlay app runs full-screen and uses Samsung's TVWindow API to show an HDMI input **behind** a transparent page, with the camera drawn on top.

```text
Camera (RTSP) ──► relay (Pi or other always-on computer) ──WebSocket──► TV app ──► picture-in-picture
                          ▲                                               │
Home Assistant ── POST /show ──┘          TV app checks /pending every second ┘
Home Assistant ── POST TV:8001 "open app" (only does something if the app is closed)
```

- **The video never goes through Home Assistant.** The relay pulls the camera's RTSP stream with FFmpeg, converts it to MPEG-1 (the only format the app's in-page player can decode) and streams it to the TV. Home Assistant only sends "show this camera".
- **The app stays open between alerts.** When the time runs out, the picture disappears and the HDMI input carries on full-screen. Quitting would make the TV fall back to its own default source (the tuner) instead of the HDMI input, and relaunching causes a black flash. The open app checks the relay once a second for the next request.
- **The relay starts FFmpeg as soon as a request arrives**, so the stream is ready when the app connects. It stops FFmpeg when no TV is watching (at the latest 20 seconds after the request, and never later than 95 seconds).
- **The countdown starts when the picture first appears**, so the full time is always on screen whatever the startup delay.
- **Appearance is set per request from Home Assistant**, with the same setting names as the LG launch blueprint: position (four corners or centre), distance from the edge, border and border colour, and compact (the camera label on a strip over the picture). Changing them needs no rebuild.

| Watching | Works? |
|---|---|
| A box on HDMI (Sky, Apple TV, SHIELD) | Yes |
| Apps built into the TV (Netflix, iPlayer on the Samsung) | No: opening the overlay app sends them to the background |

Differences from the LG version:

- **No SSH tunnel.** The TV app connects straight to the relay over your LAN, so the relay listens on a LAN address. The 64-character token is the only protection: keep it private and keep the relay off the Internet.
- **No Developer Mode renewal.** `devmode.cjs` is LG-only and is skipped for Tizen TVs.
- **Picture style.** The Samsung picture is a borderless-looking picture-in-picture with only the seconds remaining in its corner. There is no LIVE or frame-rate text, so the LG `fps` setting does not apply. Compact mode adds the camera label over the top of the picture.
- **No screensaver dismissal.** The 1.2.0 LG screensaver option sends a webOS-only command and has no Samsung equivalent.
- **The relay's faster stream start applies to all TVs.** The relay opens camera streams with `-fflags nobuffer` and a 0.5-second probe. This shortens startup on LG TVs too, but it has only been checked on the Samsung setup so far. If an LG camera that used to work now fails to start, check `/health` for an encoder error and report it.

## What you need

| Item | Used for |
|---|---|
| A Samsung Tizen TV with your box on an HDMI input | Showing the overlay |
| A Mac or PC with Tizen Studio (the **build computer**) | Building and installing the TV app. Needed once, and again to rebuild or renew the certificate |
| An always-on computer for the relay, with a fixed LAN IP | Converting the camera stream. A Raspberry Pi is covered below; any machine that can run Node.js 22 and FFmpeg works |
| A camera with an RTSP stream, and its username and password | The video |
| Home Assistant with the **Samsung Smart TV** integration | Triggering the overlay and knowing whether the TV is on |
| A Samsung account | Signing the developer certificate |

Nothing is installed from the TV's app store, and nothing is installed on the HDMI box.

Commands below use placeholder addresses. Replace them with your own:

| Placeholder | Meaning |
|---|---|
| `192.0.2.10` | Relay computer (Raspberry Pi) |
| `192.0.2.20` | Camera |
| `192.0.2.40` | Samsung TV |
| `192.0.2.50` | Build computer (Mac or PC) |
| `PI_USER@PI_HOST` | Your SSH login for the Pi, for example `pi@homeassistant.local` |
| `lounge`, `outside` | The TV ID and camera ID you choose in the relay config |

Set a DHCP reservation in your router for the relay, TV and camera, because their addresses are built into the TV app and Home Assistant.

## 3. Prepare the build computer

The build computer needs Git and Node.js 22 or newer. It does not need FFmpeg if the relay runs elsewhere.

**macOS without admin rights, or on an Intel Mac:** Homebrew no longer ships prebuilt packages for Intel Macs, so `brew install node` compiles from source and can take hours. Use the official Node tarball in your home folder instead (no `sudo`). Use `darwin-arm64` instead of `darwin-x64` on Apple Silicon, and check [nodejs.org](https://nodejs.org/dist/latest-v22.x/) for the current 22.x version:

```bash
V=v22.23.4; A=darwin-x64
mkdir -p ~/.local/node && cd ~/Downloads
curl -fLO https://nodejs.org/dist/$V/node-$V-$A.tar.gz
curl -fsSL https://nodejs.org/dist/$V/SHASUMS256.txt | grep node-$V-$A.tar.gz
shasum -a 256 node-$V-$A.tar.gz
tar -xzf node-$V-$A.tar.gz -C ~/.local/node --strip-components=1
echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
node --version
```

The two hashes must match. If `node --version` still shows an older version from nvm, run `nvm deactivate`.

Then get the code:

```bash
cd ~
git clone --branch samsung-tizen https://github.com/gadget-man/LG-Camera-Overlay.git
cd LG-Camera-Overlay
npm ci --ignore-scripts
mkdir -p private logs
cp config.tizen.example.json private/config.json
chmod 700 private logs && chmod 600 private/config.json
```

> When pasting into the macOS Terminal, paste commands without `#` comment lines. zsh does not treat `#` as a comment in interactive pastes by default.

## 4. Configure the relay

Edit `private/config.json` on the build computer. It is copied to the relay computer in step 5.

```json
{
  "port": 8766,
  "listenHost": "0.0.0.0",
  "token": "REPLACE_WITH_64_HEX_CHARACTERS",
  "ffmpeg": "ffmpeg",
  "hardwareDecode": "none",
  "sources": { "outside": "rtsp://USERNAME:PASSWORD@192.0.2.20:554/STREAM_PATH" },
  "tvs": { "lounge": { "platform": "tizen", "hdmi": 1 } }
}
```

- **Token:** generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. It is built into the TV app, so if you change it you must rebuild the app and update Home Assistant.
- **Camera URL:** most cameras need the username and password in the URL. A `401 Unauthorized` error means they are missing or wrong. If the password contains `@ : / # ? % & +` or spaces, encode it first with `node -p "encodeURIComponent('PASSWORD')"`. Use a sub-stream or medium-quality stream if the camera has one: the relay scales to 768×432 anyway, and a 4K stream only adds CPU load.
- **`hdmi`:** the input to keep behind the picture (Sky on HDMI 1 → `1`). `0` keeps whatever source the app finds.
- **IDs** must start with a lowercase letter and use only lowercase letters, digits or underscores. LG TVs (`"platform": "webos"`, the default) can sit in the same file and keep using SSH.

Check the camera stream works from the build computer (needs FFmpeg there), or wait and do it on the Pi in step 5:

```bash
ffmpeg -nostdin -hide_banner -loglevel error -rtsp_transport tcp -i "rtsp://USERNAME:PASSWORD@192.0.2.20:554/STREAM_PATH" -t 3 -c copy -f null - && echo WORKS
```

The camera password ends up in `private/config.json` (mode 600) and in your shell history. Consider a dedicated low-privilege camera user for this stream.

## 5. Run the relay on a Raspberry Pi

The relay must run all the time, so put it on an always-on machine rather than the build computer. These steps download everything on the build computer and copy it across, so the Pi never runs `npm install` or unpacks large archives, which can exhaust a small Pi's memory.

> **Raspberry Pi Zero 2 W (512 MB):** it works, but only just when it also runs Home Assistant. The tested Pi had about 90 MB available before the relay started, and the relay stopped answering once during testing; restarting the service recovered it. A Pi 4 or 5, or any machine with 1 GB or more free, is a safer home for the relay. The service below makes the kernel kill the relay before Home Assistant if memory runs out.

**5a. Check the Pi.** On the build computer:

```bash
ssh PI_USER@PI_HOST 'uname -m; hostname -I; free -m; df -h ~ | tail -1'
```

`aarch64` means a 64-bit OS (use `arm64` below); `armv7l` means 32-bit (use `armv7l` for Node and `armhf` for FFmpeg). The first address from `hostname -I` is the relay address. Node and FFmpeg need about 300 MB of disk.

**5b. Download Node and a static FFmpeg for the Pi.** On the build computer:

```bash
V=v22.23.4; NA=arm64; FA=arm64
mkdir -p ~/pi-stage/.local/bin ~/pi-stage/.local/node ~/pi-stage/ffx && cd ~/pi-stage
curl -fLO https://nodejs.org/dist/$V/node-$V-linux-$NA.tar.gz
curl -fsSL https://nodejs.org/dist/$V/SHASUMS256.txt | grep node-$V-linux-$NA.tar.gz
shasum -a 256 node-$V-linux-$NA.tar.gz
tar -xzf node-$V-linux-$NA.tar.gz -C .local/node --strip-components=1
curl -fLO https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-$FA-static.tar.xz
tar -xJf ffmpeg-release-$FA-static.tar.xz -C ffx --strip-components=1
cp ffx/ffmpeg .local/bin/ffmpeg && chmod +x .local/bin/ffmpeg
```

The two hashes must match. If the FFmpeg download fails, run `sudo apt install ffmpeg` on the Pi instead and set `"ffmpeg": "/usr/bin/ffmpeg"` in the config.

**5c. Copy them to the Pi.** `tar` over SSH needs nothing extra on the Pi and keeps Node's symlinks intact:

```bash
COPYFILE_DISABLE=1 tar -C ~/pi-stage -cf - .local | ssh PI_USER@PI_HOST 'tar -xf - -C ~ && echo COPIED'
```

**5d. Test FFmpeg and the camera on the Pi:**

```bash
ssh PI_USER@PI_HOST 'PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"; node --version; ffmpeg -encoders 2>/dev/null | grep mpeg1video; ffmpeg -nostdin -hide_banner -loglevel error -rtsp_transport tcp -i "rtsp://USERNAME:PASSWORD@192.0.2.20:554/STREAM_PATH" -t 3 -c copy -f null - && echo WORKS'
```

You want the Node version, a line containing `mpeg1video`, and `WORKS`.

**5e. Copy a lean copy of the app and your config to the Pi.** This replaces any existing `~/LG-Camera-Overlay` on the Pi:

```bash
rm -rf ~/pi-stage/app
rsync -a --exclude .git --exclude dist --exclude .build --exclude node_modules --exclude logs ~/LG-Camera-Overlay/ ~/pi-stage/app/
cd ~/pi-stage/app && npm ci --omit=dev --ignore-scripts
COPYFILE_DISABLE=1 tar -C ~/pi-stage -cf - app | ssh PI_USER@PI_HOST 'rm -rf ~/LG-Camera-Overlay.new && mkdir -p ~/LG-Camera-Overlay.new && tar -xf - -C ~/LG-Camera-Overlay.new --strip-components=1 && rm -rf ~/LG-Camera-Overlay && mv ~/LG-Camera-Overlay.new ~/LG-Camera-Overlay && mkdir -p ~/LG-Camera-Overlay/logs && echo COPIED'
```

If SSH warns `REMOTE HOST IDENTIFICATION HAS CHANGED` for an IP address that worked by hostname, that address has a stale entry in `~/.ssh/known_hosts` from an earlier device. Check the fingerprints match before removing it with `ssh-keygen -R ADDRESS`.

**5f. Run the relay as a service.** Open a session with `ssh PI_USER@PI_HOST` and paste:

```bash
sudo tee /etc/systemd/system/camera-overlay.service > /dev/null <<EOF
[Unit]
Description=Camera overlay relay
After=network-online.target
Wants=network-online.target

[Service]
User=$USER
WorkingDirectory=$HOME/LG-Camera-Overlay
Environment=PATH=$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=$HOME/.local/node/bin/node relay/relay.cjs
Restart=on-failure
RestartSec=10
OOMScoreAdjust=500
Nice=10

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now camera-overlay
systemctl is-active camera-overlay
curl -s http://127.0.0.1:8766/health
exit
```

Expect `active` and a JSON health response. Read the log any time with `ssh PI_USER@PI_HOST 'journalctl -u camera-overlay -n 50 --no-pager'`.

**Docker instead:** on a machine with Docker, the relay can run with `docker compose -f compose.yaml -f compose.tizen.yaml up -d --build`, which publishes port 8766 on the LAN.

## 6. Prepare the TV and Tizen Studio

**6a. Install Tizen Studio** on the build computer from [Samsung's SDK page](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html). It installs to `~/tizen-studio` without admin rights. Add its tools to your PATH:

```bash
echo 'export PATH="$HOME/tizen-studio/tools:$HOME/tizen-studio/tools/ide/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

**6b. Install the extensions.** Open **Package Manager** and, under **Extension SDK**, install **TV Extensions** and **Samsung Certificate Extension**.

- **Close Tizen Studio first.** If it is open, the extension install fails with an error dialog whose text can be unreadable (white on white). Turning on **Invert colours** in macOS Accessibility settings makes it readable.
- If **Samsung Certificate Extension** is not listed, check the extension is activated in Package Manager's configuration, then restart Package Manager.

**6c. Turn on Developer mode on the TV.** Open **Apps**, press `1 2 3 4 5` on the remote, switch **Developer mode** on, enter the build computer's IP address (`192.0.2.50`, not the relay's), then turn the TV off at the mains for 30 seconds. A restart from standby often does not apply it.

Check the TV took the setting. This also shows the model name:

```bash
curl -s -m 8 http://192.0.2.40:8001/api/v2/ | tr ',' '\n' | grep -i -E 'modelname|developer|"ip"'
```

You want `"developerMode":"1"` and `"developerIP"` equal to the build computer's address.

**6d. Connect to the TV:**

```bash
sdb kill-server; sdb start-server; sdb connect 192.0.2.40; sdb devices
```

`sdb devices` should list the TV. The last column (for example `QE55QN94AATXXU`) is the device name used below. `sdb` drops the connection regularly. Running `sdb connect` alone then fails with `failed to connect to remote target`, so always use the full line above, which restarts the server first. On macOS 15, also allow **Terminal** under **System Settings → Privacy & Security → Local Network**.

**6e. Create a Samsung certificate profile.** A Samsung TV only installs apps signed with a **Samsung** certificate that lists the TV's DUID. Tizen Studio's default **Tizen** certificate type builds fine but the install fails with no reason given.

1. Keep the TV connected (step 6d), so Certificate Manager can read its DUID. To read it yourself: `sdb shell 0 getduid`.
2. Open **Tools → Certificate Manager**, click **+** and choose **Samsung** as the type, then **TV** as the device.
3. Create a new profile with a clear name, for example `Samsung_tv`. Create a new author certificate with a password you write down, and sign in with your Samsung account when asked.
4. For the distributor certificate, choose the **Public** privilege level and make sure the TV's DUID is in the list.

Check it really is a Samsung profile:

```bash
tizen security-profiles list
grep -o 'key="[^"]*"' ~/tizen-studio-data/profile/profiles.xml
```

The new profile's distributor path must point under `~/SamsungCertificate/...`. If it points to `tools/certificate-generator/.../tizen-distributor-signer-new.p12`, it is the Tizen default type and the TV will reject it.

## 7. Build and install the TV app

The build bakes the relay address, token and TV ID into the app, so build one package per TV. Use the **relay's** address:

```bash
cd ~/LG-Camera-Overlay
npm run build:tizen -- --tv lounge --relay http://192.0.2.10:8766 --profile Samsung_tv
```

In the output, `Distributor1 certificate` must not point to `tizen-distributor-signer-new.p12`, and there must be no `Not found tizen signature file` warnings (those mean the profile name was wrong). The build writes `dist/CameraOverlay.wgt`. It renames the Tizen CLI's `Camera Overlay.wgt`, because `tizen install` fails without a reason when the file name contains a space.

Install it, using the device name from `sdb devices`:

```bash
sdb kill-server; sdb start-server; sdb connect 192.0.2.40; sdb devices
tizen install-permit -t DEVICE_NAME
tizen install -n CameraOverlay.wgt -t DEVICE_NAME -- dist
```

`install-permit` should print `Install Permitted`. If the install still fails, run `tizen uninstall -p MbsCamOvly -t DEVICE_NAME` (`The package is not exist` is fine) and try again. The CLI never shows the TV's own error. The usual causes are, in order: a Tizen-type certificate, a TV missing from the certificate's DUID list, or a space in the package file name.

The `.wgt` contains the token: don't share it.

## 8. Test without Home Assistant

Put the TV on the configured HDMI input. Open the app the same way Home Assistant will:

```bash
curl -m 10 -s -w " HTTP %{http_code}\n" -X POST http://192.0.2.40:8001/api/v2/applications/MbsCamOvly.CameraOverlay
```

Expect `true HTTP 200`. The first time, the TV shows its loading screen briefly, then the HDMI picture. Then ask the relay to show the camera. You can repeat this as often as you like while the app is open:

```bash
cd ~/LG-Camera-Overlay
TOKEN=$(node -p "require('./private/config.json').token")
curl -m 10 -s -w "HTTP %{http_code}\n" -X POST "http://192.0.2.10:8766/show/$TOKEN/lounge" -H "Content-Type: application/json" -d "{\"camera\":\"outside\",\"label\":\"Outside\",\"duration\":20,\"width\":25,\"hdmi\":1,\"detectedAt\":$(($(date +%s)*1000))}"
```

Expect `HTTP 204`. Then check:

1. **Picture:** the picture-in-picture appears in the top-right corner (the default position) over the HDMI picture, with the seconds remaining in its corner. If the HDMI picture is replaced by black, TVWindow could not show the input on this model.
2. **Sound:** audio from the HDMI box continues.
3. **End:** after the countdown the picture disappears and the HDMI input keeps playing.
4. **Relay:** `curl -s http://192.0.2.10:8766/health` lists the TV under `tv_clients` while the picture is up, and `clients: 0` shortly afterwards.

To try the appearance settings, add them to the same request, for example `\"position\":\"bottom-left\",\"margin\":5,\"compact\":true,\"borderColor\":\"#67dfad\"` before `\"detectedAt\"`.

`tizen run -p MbsCamOvly.CameraOverlay -t DEVICE_NAME` also opens the app, but only while `sdb` is connected.

## 9. Home Assistant

These steps use Home Assistant in Docker on the Pi, edited over SSH. With Home Assistant OS, use the File editor add-on for the same files.

**9a. Find the config folder.** On the Pi:

```bash
sudo docker ps --format '{{.Names}}'
sudo docker inspect homeassistant --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
```

The path to the left of `-> /config` is the config folder (for example `/home/PI_USER/homeassistant/config`).

**9b. Add the relay address to `secrets.yaml`.** Print the token on the build computer with `node -p "require('$HOME/LG-Camera-Overlay/private/config.json').token"`, then add:

```yaml
camera_overlay_show_url: "http://192.0.2.10:8766/show/YOUR_TOKEN/lounge"
```

This puts the TV ID (`lounge`) in the address, which is the tested setup for one TV. For several Samsung TVs, end the address with `/{{ tv_id }}` instead of `/lounge`. `rest_command` addresses are templates, and the blueprint passes its **Relay TV ID** as `tv_id`. That form is untested.

**9c. Add two commands to `configuration.yaml`.** If the file already has a `rest_command:` line, add only the indented entries under it, because a second `rest_command:` line silently replaces the first.

```yaml
rest_command:
  camera_overlay_show:
    url: !secret camera_overlay_show_url
    method: POST
    content_type: application/json
    payload: >-
      {"camera": {{ camera | to_json }}, "label": {{ label | to_json }},
       "duration": {{ duration | int }}, "width": {{ width | int }}, "hdmi": {{ hdmi | int }},
       "position": {{ position | default('top-right') | to_json }}, "margin": {{ margin | default(3) | int }},
       "border": {{ border | default(true) | to_json }}, "borderColor": {{ borderColor | default('') | to_json }},
       "compact": {{ compact | default(false) | to_json }},
       "detectedAt": {{ (as_timestamp(now()) * 1000) | int }}}
  camera_overlay_launch:
    url: "http://192.0.2.40:8001/api/v2/applications/MbsCamOvly.CameraOverlay"
    method: POST
```

The first tells the relay what to show and how. The second opens the TV app. If the app is already open, it does nothing visible.

The appearance lines use defaults, so scripts that don't set them still work. An installation set up before 1.2.0 with the shorter payload (without the `position` to `compact` lines) also keeps working, with the default look.

**9d. Check and restart.** In Home Assistant, go to **Developer tools → YAML → Check configuration**, then restart (`sudo docker restart homeassistant`). On a Pi Zero 2 W, startup takes several minutes. Afterwards, **Developer tools → Actions** should list both `rest_command.camera_overlay_show` and `rest_command.camera_overlay_launch`. If they are missing, check for a duplicate top-level key with `sudo grep -n -E "^[a-z_]+:" CONFIG_FOLDER/configuration.yaml`.

**9e. Add the Samsung Smart TV integration** under **Settings → Devices & services**, accepting the prompt on the TV. Under **Developer tools → States**, its `media_player.` entity should show `on` with the TV on and `off` in standby. The script uses this so nothing happens while the TV is off.

**9f. Create the helpers** under **Settings → Devices & services → Helpers → Create helper**:

- **Toggle** named `TV Camera Overlay` (`input_boolean.tv_camera_overlay`): the on/off switch. When it is off, nothing appears.
- **Button** named `Show TV Camera Overlay` (`input_button.show_tv_camera_overlay`): for testing.

**9g. Create the script.** Either import the blueprint and create a script from it:

```text
https://github.com/gadget-man/LG-Camera-Overlay/blob/samsung-tizen/blueprints/script/samsung-camera-overlay.yaml
```

Choose the Samsung media player, TV ID `lounge`, camera ID `outside`, and the `TV Camera Overlay` switch, and leave **How to open the TV app** on **TV network API**.

Or paste this script in YAML (**Settings → Automations & scenes → Scripts → Add script → ⋮ → Edit in YAML**), replacing `media_player.YOUR_TV`. This version was user-confirmed on the QN94A:

```yaml
alias: Show TV camera overlay
mode: single
max_exceeded: silent
sequence:
  - condition: state
    entity_id: input_boolean.tv_camera_overlay
    state: "on"
  - condition: state
    entity_id: media_player.YOUR_TV
    state: "on"
  - action: rest_command.camera_overlay_show
    data:
      camera: outside
      label: Outside
      duration: 20
      width: 25
      hdmi: 1
      position: top-right
      margin: 3
      border: true
      borderColor: ""
      compact: false
  - action: rest_command.camera_overlay_launch
    continue_on_error: true
  - delay: "00:00:30"
```

None of these settings needs a rebuild:

| Setting | Meaning | Values (default) |
|---|---|---|
| `duration` | Time on screen, counted from when the picture appears | 15 to 90 seconds (45) |
| `width` | Picture width | 10 to 55% of the screen (25) |
| `position` | Where the picture sits | `top-right`, `top-left`, `bottom-right`, `bottom-left`, `center` (`top-right`) |
| `margin` | Distance from the screen edges; ignored for `center` | 0 to 10% of the screen width (3) |
| `border` | Draw a border | `true` or `false` (`true`) |
| `borderColor` | Border colour | `#rrggbb`, or `""` for translucent white (`""`) |
| `compact` | Show the camera label on a strip over the top of the picture | `true` or `false` (`false`) |

An invalid value is ignored and the default used. The final delay ignores repeat triggers while the picture starts up and shows.

**9h. Trigger it.** An automation for the test button:

```yaml
alias: TV camera overlay - button
mode: single
triggers:
  - trigger: state
    entity_id: input_button.show_tv_camera_overlay
actions:
  - action: script.turn_on
    target:
      entity_id: script.show_tv_camera_overlay
```

For motion or a doorbell, copy it and change the trigger, for example `entity_id: binary_sensor.YOUR_MOTION_SENSOR` with `to: "on"`. The switch and the TV-on check apply to every trigger, because they are inside the script.

**Alert automation and pause (1.2.0).** For several cameras, a doorbell that should take priority, or a cooldown, use the project's alert blueprint ([`camera-alert.yaml`](../blueprints/automation/camera-alert.yaml)) and point its launch actions at this script. See [Home Assistant setup](HOME-ASSISTANT.md). Its optional **Pause camera overlays** helper and the quiet-hours [pause blueprint](../blueprints/automation/pause-overlays.yaml) work with Samsung TVs too, because they act before the script runs. One pause helper can then cover LG and Samsung TVs together. The two switches work in opposite directions and block different things:

| Switch | On means | Blocks |
|---|---|---|
| `TV Camera Overlay` in this script (or the blueprint's **On/off switch**) | Overlay allowed | Everything that runs this script, including the test button |
| **Pause camera overlays** in the alert automation | Alerts paused | Automatic alerts only; buttons still work |

Use either or both.

**9i. Add the switch and button to a dashboard** (an **Entities** card), then test:

1. Switch off, press the button: nothing appears.
2. Switch on, press the button: the app opens once (one loading screen), then the picture shows and closes, and HDMI carries on.
3. Press it again: the picture appears with no flash.
4. TV in standby, press the button: the TV stays off.

## Everyday behaviour

- **Keep the app open.** After the first alert the app stays in the foreground over the HDMI input, and later alerts appear without a flash. Home Assistant reopens it automatically if it was closed.
- **BACK:** with a camera showing, it hides the camera. With nothing showing, it closes the app, and the TV then usually switches to its default source.
- **Remote buttons:** while the app is open, the Samsung remote's arrow, OK and BACK buttons go to the app, so Anynet+ (HDMI-CEC) control of the box from the Samsung remote does not work. Volume works, and the box's own remote is unaffected.
- **TV off, another app or another source:** the overlay app closes or goes to the background. The next alert reopens it.
- **Clocks:** Home Assistant, the relay and the TV should agree on the time within a minute. Requests older than 60 seconds are ignored.
- **Certificate expiry:** Samsung developer certificates expire. Rebuild and reinstall with a new certificate from the build computer when that happens. Check the expiry with `openssl pkcs12 -in ~/SamsungCertificate/PROFILE/distributor.p12 -clcerts -nokeys | openssl x509 -noout -enddate`.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `sdb connect` fails although the TV answers ping | Run `sdb kill-server; sdb start-server; sdb connect TV_IP`. Check `developerIP` with the `curl …:8001/api/v2/` command in step 6c, then power-cycle the TV at the mains |
| `Failed to install Tizen application.` with an empty log | Tizen-type certificate (step 6e), the TV's DUID missing from the certificate, or a space in the package file name |
| Build prints `Not found tizen signature file` | The `--profile` name doesn't exist. List profiles with `tizen security-profiles list` |
| `401 Unauthorized` from the camera | Add `USERNAME:PASSWORD@` to the RTSP URL, encoding special characters |
| Show request returns `204` but nothing appears | The app isn't open: run the launch `curl` from step 8, or open it from the TV's Apps screen |
| Show request hangs or `curl` times out | The relay has stopped answering. Run `sudo systemctl restart camera-overlay` on the Pi and check its memory with `free -m`. If the Pi itself is unresponsive, power-cycle it. Then send the output of `journalctl -u camera-overlay -n 40 --no-pager` and `journalctl -k | grep -i "out of memory"` with your report |
| TV goes to the tuner when the picture ends | You are running an older build that exits at the end. Rebuild from this branch |
| `rest_command.camera_overlay_*` missing in HA | YAML error or a duplicate `rest_command:` key in `configuration.yaml` (step 9d) |

## Compatibility

| Model | Year | Result | Notes |
|---|---|---|---|
| QE55QN94AATXXU (`21_NIKEM2_QTV`) | 2021 | Works (user-confirmed) | HDMI 1 behind the picture; opened through port 8001; relay on a Pi Zero 2 W. Tested with the default top-right picture; the 1.2.0 appearance settings have been checked in a desktop browser only |

Please add your TV's model, year and results (the four checks in step 8) to an issue or pull request.

## Updating

After changing the app or relay code:

1. Rebuild and reinstall the app (step 7). Installing closes the app, so the next alert opens it once with the loading screen.
2. Copy the relay to the Pi again (step 5e), then run `ssh -t PI_USER@PI_HOST 'sudo systemctl restart camera-overlay'`.

Changing only the script's settings (`duration`, `width`, `hdmi`, `position`, `margin`, `border`, `borderColor`, `compact`) needs neither.

### Upgrading an earlier Samsung install to 1.2.0

1. Rebuild and reinstall the app (step 7). The app version becomes 1.2.0.
2. Copy the relay to the Pi and restart it (step 5e, then the restart command above). The older relay drops the appearance settings, so the picture keeps the default look until the relay is updated.
3. To use the appearance settings, replace the `payload:` of `camera_overlay_show` with the 1.2.0 version in step 9c, check the configuration, restart Home Assistant, and add the settings to your script (step 9g). Re-import the blueprint if you use it.
4. Optionally, select a **Pause camera overlays** helper in your alert automations (step 9h).
