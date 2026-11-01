# Installation, in order

For graphical pairing, settings and deployment export, use the [illustrated configurator](CONFIGURATOR.md). **HA OS App/ingress is experimental and has NOT been tested.**

For a manual first Docker installation, use [Choose your setup](START-HERE.md): Windows, Mac or Linux, with Home Assistant on the same computer or elsewhere. This page is the detailed reference, including native installations.

Do one manual camera test before enabling automatic alerts. Keep a private copy of your configuration and previous IPK before updating an existing installation.

## 1. Prepare the network and server

You need an LG webOS television supporting Developer Mode, a free LG Developer account, Home Assistant with its native LG integration, and a computer/NAS available whenever an overlay is wanted. The relay needs Node.js 22 or newer and an FFmpeg build with RTSP/RTSPS input and the `mpeg1video` encoder. Use a supported Node LTS release.

The relay computer must reach the TV's Developer Mode SSH port 9922 and the camera's stream port. HA must reach the TV's normal webOS control endpoint. Put static DHCP reservations in place if appropriate. Do not forward these ports from the Internet. The relay itself binds to `127.0.0.1` only; the encrypted reverse tunnel makes it available on each TV's loopback address.

Install FFmpeg from your operating system's trusted package manager, for example `brew install ffmpeg` on macOS or `sudo apt-get install ffmpeg` on Debian/Ubuntu. Verify `ffmpeg -version` and `ffmpeg -encoders` include MPEG-1 video. This project does not ship an FFmpeg executable. Windows users can use a trusted FFmpeg installation and set its absolute path in configuration; the native Windows service lifecycle is not supplied.

## 2. Enable TV Developer Mode

1. Create/sign into your [LG Developer account](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app).
2. Install **Developer Mode** from LG Apps on the TV.
3. Sign in, enable **Dev Mode Status** and allow the TV to restart.
4. Reopen Developer Mode and enable **Key Server**. Note the TV IP and displayed passphrase privately.

Developer Mode expires. If it is disabled after expiry, development-installed apps may be removed. Keep your account/pairing details available; do not assume the background renewal helper guarantees permanent installation.

## 3. Install the TV app

The graphical route is [webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop/releases), a community application available for Windows, macOS and Linux (v1.99.20 was current when this guide was prepared). Add your TV using its IP, Developer Mode connection and displayed passphrase. Install `com.mbs.cameraoverlay_1.2.0_all.ipk` from this project's release. Check its SHA-256 against `SHA256SUMS.txt` first.

Expected result: Camera Overlay appears in the installed apps list. Launching it without parameters displays **No stream** and closes automatically; that is expected at this stage.

Alternatively install the [official webOS CLI](https://webostv.developer.lge.com/develop/tools/cli-installation), then:

```sh
ares-setup-device
# Add: name lounge-tv, TV IP, port 9922, user prisoner. No SSH password.
ares-novacom --device lounge-tv --getkey
# Enter the displayed TV passphrase at the prompt, not in a shell command.
ares-device --system-info --device lounge-tv
ares-install --device lounge-tv com.mbs.cameraoverlay_1.2.0_all.ipk
```

Installing an IPK does **not** configure the relay's SSH tunnel. Complete the next section even if Dev Manager successfully installed the app.

## 4. Download source and configure pairing

Download the matching source archive from the release or clone the tag:

```sh
git clone --branch v1.2.0 https://github.com/mbsintegrations/LG-Camera-Overlay.git
cd LG-Camera-Overlay
npm ci --omit=dev --ignore-scripts
mkdir private logs
cp config.example.json private/config.json
```

On PowerShell use `New-Item -ItemType Directory private,logs` and `Copy-Item config.example.json private/config.json`. Keep the folder private: on Linux/macOS use `chmod 700 private logs` and `chmod 600 private/config.json`; on Windows restrict its ACL to your account. `.gitignore` is not an access control.

The supported pairing-import path uses an **official CLI device profile**. Graphical pairing alone does not necessarily create that profile. On the computer holding the pairing material, install the isolated CLI:

```sh
npm ci --prefix tooling --ignore-scripts
# Executables are in tooling/node_modules/.bin; on Windows use their .cmd variants.
tooling/node_modules/.bin/ares-setup-device
tooling/node_modules/.bin/ares-novacom --device lounge-tv --getkey
npm run pair -- lounge-tv lounge
```

Use the same TV IP, `prisoner`, port 9922 and passphrase as above. The helper imports the encrypted key from the CLI profile, displays the TV host-key fingerprint, and asks you to type it to establish a **trust-on-first-use pin**. Verify the IP is your television on a trusted local network. This does not independently authenticate an unknown network. The helper then verifies authentication with that exact pin before saving anything. A changed existing pin is refused: investigate a TV reset, wrong address or unexpected host before manually replacing it. `--trust-local-network` is available for an unattended setup only when you have separately established trust.

The default CLI profile file is `%APPDATA%/.webos/tv/novacom-devices.json` on Windows or `~/.webos/tv/novacom-devices.json` on Unix. If your CLI uses another path, set `WEBOS_DEVICES_FILE` to that file. The helper writes `private/lounge-key`, updates `private/config.json`, generates a random relay token when needed, and keeps `private/config.json.before-pair`. All these files are private. Repeat with another profile and TV ID for additional televisions. Remove the unpaired example `lounge` entry if you chose a different ID.

If pairing on a desktop for a NAS server, securely copy the complete private directory to the relay host. Preserve file permissions, then delete redundant transfer copies. Neither the key nor its passphrase belongs in GitHub or a support issue.

## 5. Configure cameras and runtime

Edit `private/config.json` in a private local editor. Do not edit application source.

| Key | Meaning |
|---|---|
| `port` | Relay and TV loopback port; default 8766; use an unused port for side-by-side testing |
| `token` | 64 lowercase hexadecimal characters; pairing helper generates 32 cryptographically random bytes |
| `ffmpeg` | `ffmpeg` on PATH, or absolute executable path on the relay host |
| `hardwareDecode` | `none` for portable software decode; optional `videotoolbox` on macOS |
| `renewDeveloperMode` | `true` enables daily checks and renewal below seven days |
| `sources` | Camera ID to private RTSP/RTSPS URL mapping |
| `tvs` | TV ID to pinned SSH pairing configuration |

Camera and TV IDs must begin with a lowercase letter and contain only lowercase letters, digits or underscores (maximum 41 characters). Use a medium/substream initially. The output is 768×432, 25 fps MPEG-1; sending a 4K source increases decoding cost without increasing overlay detail.

For UniFi Protect, open the camera's settings in your Protect version and enable/copy the supported **RTSP/RTSPS stream** for the desired quality. Use the URL generated by your own console. UI wording varies by Protect version. Keep its secret path intact. Do not invent a stream token, blindly substitute a port/protocol, or disable TLS checks to make a copied RTSPS URL work. If FFmpeg rejects that console's RTSPS endpoint, use a supported RTSP endpoint available in your configuration and assess the LAN privacy implications. RTSP traffic to the relay is not encrypted; the TV tunnel is encrypted in both cases. HTTP snapshots, browser share links, HLS and RTSPX are not accepted source types in this release.

```sh
npm run check
npm start
```

Expected output: `relay_ready`, then `tv_tunnel_ready` for each powered-on, reachable TV. No encoder starts until a viewer connects. Check locally:

```sh
curl http://127.0.0.1:8766/health
```

`tv_tunnels.<id>.ready: true` proves SSH forwarding is established, not that video is visible. An off TV may show false; retries occur every 15 seconds and do not wake it. Keep this terminal running during the first test. Ctrl+C closes tunnels and encoders.

## 6. Docker / NAS option

This can run as a separate container on the same Linux/NAS host as Home Assistant Container, or alongside an HA OS VM where the host supports containers. The Compose file is not an HA OS App installer. Read [hosting options and hardware recommendations](HOSTING.md) before choosing a shared host.

The supplied Dockerfile builds locally using Debian's FFmpeg package. No prebuilt container image is published. Set `ffmpeg` to `ffmpeg` and `hardwareDecode` to `none` in the container configuration. Prepare private config and keys using step 4 first. On Linux, ensure the container's UID 1000 can read/write `private` (session-token caching) and write `logs`; avoid world-readable permissions. On a NAS, adapt folder ownership/ACL to its Docker user mapping.

```sh
mkdir -p logs
sudo chown -R 1000:1000 private logs
sudo chmod 700 private logs
docker compose build
docker compose run --rm camera-overlay node scripts/check-config.cjs
docker compose up -d
docker compose logs --tail 30 camera-overlay
docker compose exec camera-overlay node -e "fetch('http://127.0.0.1:8766/health').then(r=>r.json()).then(console.log)"
```

There are intentionally **no published ports**. The relay's outbound SSH connections forward TV loopback traffic directly into container loopback. Bridge networking is sufficient if the container can reach the TV and camera VLANs. Do not add host networking, privileged mode or a public reverse proxy to fix pairing. The healthcheck tests the listener only; inspect `tv_tunnels` separately. If you change `port`, also change the healthcheck URL in Compose.

The container is non-root, read-only apart from the two mounted folders and temporary memory storage, with a 512 MiB limit. Multiple camera encoders can exceed resources on a small NAS. Start with one feed and inspect actual CPU/RAM before expanding. No native Windows/macOS Docker Desktop acceptance is implied by a Linux CI build.

## 7. Configure Home Assistant and test

Follow [Home Assistant setup](HOME-ASSISTANT.md). The launch URL is:

```text
ws://127.0.0.1:8766/live/YOUR_TOKEN/entrance/lounge
```

`127.0.0.1` means **the TV**, not HA or the server. `entrance` and `lounge` must match your private config exactly. Test over a native app or HDMI source already playing, then check live motion, underlying picture and sound, BACK, and timeout. Native LG Plex and Plex through Apple TV over HDMI have been user-confirmed on the OLED65B9PLA; test each app and source you rely on separately. The overlay app is installed on the LG, including when watching Apple TV. Only after those checks should you enable detection triggers.

## 8. Run persistently

Docker Compose supplies a restart policy. For a native relay, use your OS service manager with an absolute Node executable and working directory, a dedicated non-root user, and private logs. Set `OVERLAY_DATA_DIR` if config/logs live outside the source tree. On macOS a user LaunchAgent starts at GUI login, not before login; on Linux use a systemd service with `WorkingDirectory`, `ExecStart=/absolute/node /absolute/project/relay/relay.cjs`, `Restart=on-failure` and `User=`. Verify your own reboot/login behavior rather than assuming it from a successful foreground run.

Keep the private directory outside release replacements. [Updates and recovery](TROUBLESHOOTING.md) explain renewal, log interpretation and rollback.
