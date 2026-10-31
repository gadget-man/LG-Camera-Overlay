# Choose your setup: Docker installation

**Prefer the graphical setup? Use the [illustrated configurator guide](CONFIGURATOR.md).** It saves settings and generates the private Docker bundle for you. The manual route below remains available, using the same 1.2.0 setup/source package.

Before setup, review [LG TV privacy and network protection](PRIVACY-AND-NETWORK.md).

This guide starts with one TV and one camera. You do not need to write code, but you will paste a few commands and replace one camera address in a settings file. Run commands one at a time; if a step reports an error, stop at that step and use the help table at the end.

**What goes where?** The LG gets a small TV app. Your chosen computer runs the **relay**, which converts the camera picture for the TV. Home Assistant provides the button and optional automatic alerts. Docker runs the relay in its own container, keeping its software together.

## 1. Select your situation

Choose the computer that will run the relay, not the computer you happen to be reading this on.

| My relay computer | Where Home Assistant runs | Follow this route |
|---|---|---|
| Windows PC | On another device | [Windows preparation](#windows-preparation), then [HA elsewhere](#ha-elsewhere) |
| Windows PC | Already on this PC, for example in a VM | [Windows preparation](#windows-preparation), then [HA-on-this-computer](#ha-on-this-computer) |
| Mac | On another device | [Mac preparation](#mac-preparation), then [HA elsewhere](#ha-elsewhere) |
| Mac | Already on this Mac, for example in a VM | [Mac preparation](#mac-preparation), then [HA-on-this-computer](#ha-on-this-computer) |
| Linux computer | On another device | [Linux preparation](#linux-preparation), then [HA elsewhere](#ha-elsewhere) |
| Linux computer | Already on this computer in Docker or a VM | [Linux preparation](#linux-preparation), then [HA-on-this-computer](#ha-on-this-computer) |

**Using HA OS directly on the hardware, such as HA Green?** These Docker commands cannot be pasted into HA OS. Choose another relay computer. An experimental HA OS App package now exists, but it has **NOT been tested**. Do not treat it as the tested Docker route; see [its limits](CONFIGURATOR.md#ha-os-app-experimental-and-not-tested). A NAS with its own container manager may use the [NAS instructions](INSTALL.md#6-docker--nas-option); its folder permissions depend on the NAS.

**No Home Assistant anywhere yet?** This guide assumes a working HA installation. Set that up using the [official HA installation guide](https://www.home-assistant.io/installation/) first, then return here. “HA elsewhere” means you already have HA on another device; it does not mean HA is optional for these instructions.

**Before buying hardware:** read [hardware recommendations](HOSTING.md). Windows/macOS Docker Desktop and ARM64 container-to-TV operation have not been physically validated by this project. These are documented setup routes requiring your own viewing checks, not certified combinations. Linux x86-64 NAS-to-TV acceptance, container CI and native Mac viewing have separate evidence in [validation](VALIDATION.md).

### Windows preparation

1. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/), following its current system requirements and WSL 2 instructions. Use **Linux containers** for this project. Complete any restart the installer requests.
2. Open Docker Desktop and wait until its engine is running.
3. Install a supported **LTS version of Node.js, version 22 or newer**, from [Node.js](https://nodejs.org/en/download). Node is used on this PC for TV pairing; Docker supplies the relay's own Node and FFmpeg.
4. Open **PowerShell** from Start after installation. Paste each line separately:

```powershell
node --version
npm.cmd --version
docker compose version
docker info --format '{{.OSType}}'
```

You should see versions and then `linux`. These instructions use `npm.cmd` so you do not need to relax PowerShell's script execution policy.

Continue with the HA location you selected below, then step 2.

### Mac preparation

1. Open Apple menu → About This Mac to check whether you have an Apple chip or Intel processor.
2. Install the matching [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/) download. Open Docker and wait for its engine to run.
3. Install a supported **Node.js LTS, version 22 or newer**, using the macOS installer from [Node.js](https://nodejs.org/en/download).
4. Open **Terminal** from Applications → Utilities and paste each line separately:

```sh
node --version
npm --version
docker compose version
docker info --format '{{.OSType}}'
```

You should see versions and then `linux`. You do not need to install FFmpeg on the Mac for this Docker route. Leave hardware decoding set to `none`; macOS VideoToolbox applies to the native relay, not this Linux container.

Continue with the HA location you selected below, then step 2.

### Linux preparation

1. If Docker is already running HA or other services, keep that installation. Do not uninstall or replace it for this project.
2. Otherwise follow Docker's instructions for [your Linux distribution](https://docs.docker.com/engine/install/) (for example [Ubuntu](https://docs.docker.com/engine/install/ubuntu/)). Install the **Docker Compose plugin** too.
3. Install a supported **Node.js LTS, version 22 or newer**, following the Linux options on [Node.js](https://nodejs.org/en/download). A distribution's older Node package may not meet this requirement.
4. Open **Terminal** and run:

```sh
node --version
npm --version
docker compose version
docker info --format '{{.OSType}}'
```

You should see versions and then `linux`. If Docker reports permission denied, use `sudo docker` instead of `docker` for this guide's Docker commands, according to your host's administration policy. Do not change permissions on the Docker socket. You do not need a separate host FFmpeg installation.

Continue with the HA location you selected below, then step 2.

### HA elsewhere

Keep HA on its existing device. Do all the computer commands below on your selected relay computer. At step 7, open your existing HA website to add the launch script. The relay computer needs access to the TV and camera over your local network; HA needs access to the TV. No router Internet port forwarding is needed.

### HA on this computer

Leave your working HA installation in place. Run the relay as its **own Docker Compose project**, in the folder created below. Do not add its commands inside the HA container, change HA's Compose file or install another HA instance. For HA OS in a VM, run the relay on the underlying Windows/Mac/Linux host, outside the HA VM. Check that the host and HA VM can both reach the TV and that the host has spare capacity.

## 2. Download the project

1. Open the [v1.2.0 release](https://github.com/mbsintegrations/LG-Camera-Overlay/releases/tag/v1.2.0).
2. Under **Assets**, download these three files: `LG-Camera-Overlay-Setup-1.2.0.zip`, `com.mbs.cameraoverlay_1.2.0_all.ipk` and `SHA256SUMS.txt`. Use the named source ZIP rather than GitHub's automatically generated source archive, so the checksum matches.
3. In PowerShell or Terminal, type `cd ` (with a space), drag your download folder into the window, and press Enter. If the path contains spaces, enclose it in double quotes. Verify the two downloads using your system's commands below. Compare the long values with the matching lines in `SHA256SUMS.txt`; letter case does not matter. If they differ, stop and download again.

**Windows:**

```powershell
Get-FileHash LG-Camera-Overlay-Setup-1.2.0.zip -Algorithm SHA256
Get-FileHash com.mbs.cameraoverlay_1.2.0_all.ipk -Algorithm SHA256
```

**Mac:**

```sh
shasum -a 256 LG-Camera-Overlay-Setup-1.2.0.zip com.mbs.cameraoverlay_1.2.0_all.ipk
```

**Linux:**

```sh
sha256sum LG-Camera-Overlay-Setup-1.2.0.zip com.mbs.cameraoverlay_1.2.0_all.ipk
```

4. Extract the ZIP using your file manager. Put the extracted project in a permanent folder you own, outside cloud-sync folders or public shares. It will contain private camera and TV access details later.
5. Find the extracted folder containing **`package.json`, `compose.yaml` and `config.example.json`**. Open your command window in that folder: type `cd `, then drag that folder into the window (or type its full path in double quotes) and press Enter. Use this folder for every remaining command. Do not work from inside the ZIP.

## 3. Prepare the TV and install its app

1. On the LG, install **Developer Mode** from LG Apps and sign in with a free [LG Developer account](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app).
2. Enable **Dev Mode Status** and allow the TV to restart. Reopen Developer Mode, enable **Key Server**, and privately note its IP address and passphrase. Keep the TV on during setup.
3. On your computer, download and open [webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop/releases). This is a separate community tool. Add the TV using its IP address and Developer Mode passphrase.
4. Use Dev Manager's app installation option to select the downloaded `com.mbs.cameraoverlay_1.2.0_all.ipk`.

**Success:** Camera Overlay appears in the installed app list. Opening it alone may say **No stream** and close: this is expected before HA supplies a camera route. Plex on Apple TV still uses the app on the **LG**, not an app installed on Apple TV.

## 4. Pair the relay with the TV

Installing the TV app is only half the connection. This step lets the computer send the video to the TV. Run the commands for your computer only, from the project folder.

**Windows PowerShell:**

```powershell
npm.cmd ci --omit=dev --ignore-scripts
npm.cmd ci --prefix tooling --ignore-scripts
New-Item -ItemType Directory private,logs
Copy-Item config.example.json private/config.json
.\tooling\node_modules\.bin\ares-setup-device.cmd
```

**Mac or Linux Terminal:**

```sh
npm ci --omit=dev --ignore-scripts
npm ci --prefix tooling --ignore-scripts
mkdir private logs
cp config.example.json private/config.json
chmod 700 private logs
chmod 600 private/config.json
tooling/node_modules/.bin/ares-setup-device
```

These are **first-install commands**: do not copy the example over an existing private configuration. The two `npm` commands install the relay tools and LG's separate pairing tools. Do not run `npm audit fix` to change the pinned dependencies; see [third-party notices](../NOTICE).

The last command opens a question-and-answer device setup. Choose **Add** and supply these values when asked:

| Prompt | Value |
|---|---|
| Device name | `lounge-tv` |
| IP address | Your LG's actual IP from Developer Mode |
| Port | `9922` |
| SSH user | `prisoner` |
| Description, if asked | Any useful label, such as Living room TV |
| Select authentication, if asked | Choose `password` for this initial profile |
| Enter password | Leave empty and press Enter; the next command retrieves the Developer Mode key |
| Set default, if asked | No is fine; the commands explicitly select `lounge-tv` |
| Save | Yes |

Save/finish the prompts, then run:

**Windows:**

```powershell
.\tooling\node_modules\.bin\ares-novacom.cmd --device lounge-tv --getkey
npm.cmd run pair -- lounge-tv lounge
```

**Mac/Linux:**

```sh
tooling/node_modules/.bin/ares-novacom --device lounge-tv --getkey
npm run pair -- lounge-tv lounge
```

Enter the TV's displayed passphrase when `ares-novacom` asks. The pairing helper then shows the TV IP and a long fingerprint. Confirm that this is your TV on your trusted home network, copy that fingerprint into its confirmation prompt and press Enter. It pins the key seen on this first connection; it is not an independent identity check. Do not override a changed-key warning.

**Success:** `Pinned SSH verified; private config and key saved.` The helper generates your secret token and fills the TV settings. Keep the `private` folder private, including backups. On Windows use folder Properties → Security to check that unrelated users cannot read it; do not put it in a shared folder.

## 5. Add your camera address

1. In your camera system, enable/copy a supported **RTSP or RTSPS stream URL**, preferably a medium-quality/substream. For UniFi Protect use the camera's stream settings. A browser share link, snapshot URL or RTSPX link is not suitable.
2. Open `private/config.json` in a plain-text editor: Notepad on Windows, a Linux text editor, or TextEdit in **plain-text mode** on Mac. Preserve the `.json` filename and straight quotes.
3. Find the `sources` section. Replace **only** the example address between the quotes after `entrance` with your complete private camera URL. Keep the quotes, comma placement and braces as they are. The shape is:

```json
"sources": {
  "entrance": "YOUR_COMPLETE_RTSP_OR_RTSPS_URL"
}
```

This is an illustration of the section, not a replacement for the whole file. Keep the name `entrance` for this first test, even if your camera has a different display name. Keep `ffmpeg` as `ffmpeg` and `hardwareDecode` as `none` on **all three Docker routes**. Leave the generated token and TV settings in place, then save.

## 6. Build and start the relay

**Linux only:** after finishing the private settings, give the container's user access to these two folders:

```sh
sudo chown -R 1000:1000 private logs
sudo chmod 700 private logs
```

Run those commands only from the project folder. If your Linux account is not UID 1000, later edits may need an administrator or a deliberately configured ACL. NAS permissions differ; do not use world-writable permissions as a shortcut. Windows and Mac Docker Desktop handle file sharing separately: skip these Linux ownership commands.

**All three systems:** run these one at a time:

```sh
docker compose build
docker compose run --rm camera-overlay node scripts/check-config.cjs
docker compose run --rm camera-overlay node -e "const fs=require('fs'); for (const p of ['/data/private','/data/logs']) fs.accessSync(p,fs.constants.R_OK|fs.constants.W_OK); console.log('Folder access OK')"
docker compose up -d
docker compose logs --tail 30 camera-overlay
```

The first build downloads software and can take several minutes. Continue only if the configuration check succeeds and the folder check says `Folder access OK`. The `up -d` command starts the relay in the background; you may close this command window afterward.

**Success:** logs show `relay_ready` and `tv_tunnel_ready` for the powered-on TV. For a status check, run:

```sh
docker compose exec camera-overlay node -e "fetch('http://127.0.0.1:8766/health').then(r=>r.json()).then(console.log)"
```

Look for your TV under `tv_tunnels` with `ready: true`. This confirms the connection, not a visible camera picture yet. There is no relay website to open and no Docker port to publish. Do not change `127.0.0.1` to your computer's IP.

## 7. Add the Home Assistant button

This step is the same whether HA is on this computer or elsewhere. Open your **existing HA website** in a browser.

1. In Settings → Devices & services, add **LG webOS TV** if the LG is not already present. Accept its connection prompt on the television. Reuse an existing integration if already configured.
2. Open Settings → Automations & scenes → Blueprints → Import blueprint. Paste:

```text
https://github.com/mbsintegrations/LG-Camera-Overlay/blob/main/blueprints/script/camera-overlay.yaml
```

3. Create a script from this blueprint. Choose the **LG's media player**, including when you watch Apple TV through HDMI.
4. From your private `config.json`, copy the value after `token` without its quotation marks. Replace `YOUR_TOKEN` in this route with that value and paste the completed route into the script's stream URL field:

```text
ws://127.0.0.1:8766/live/YOUR_TOKEN/entrance/lounge
```

Here `127.0.0.1` means the LG TV's own connection. The route stays identical for HA on the same computer or a different device. Keep this URL private.

5. Choose a camera label, 30 seconds and 42% width. Leave the app ID as `com.mbs.cameraoverlay`. Save the script as, for example, **Show entrance camera**.
6. With the TV already playing something, run the script. Check moving camera video, the underlying picture and sound, timer dismissal, and BACK dismissal on a second run.

**Success:** the camera panel appears over the programme and closes cleanly. A manual script is enough to start; automatic alerts are optional. To add them, read [how detections reach Home Assistant](DETECTION-FLOW.md), then follow [automatic alert setup](HOME-ASSISTANT.md#add-optional-automatic-alerts). The first guide explains our UniFi example and the separate HA signal needed from other systems; an RTSP camera feed alone does not provide that signal. Check the [tested and operating setup matrix](VALIDATION.md#tested-and-operating-setups) for what has actually been validated.

## 8. Keep it available

On Windows/Mac, enable **Start Docker Desktop when you sign in to your computer** in Docker Desktop Settings → General. This starts at sign-in; it does not promise an unattended relay before login. See [Docker's settings guide](https://docs.docker.com/desktop/settings-and-maintenance/settings/#general). Keep the computer awake while you want alerts; a sleeping or shut-down computer cannot deliver video. For unattended operation, a suitable always-on Linux/NAS host may be more practical.

On Linux, verify Docker starts at boot using your installation's service settings. The relay has a restart policy, but it depends on Docker running. At a convenient time, test your actual restart/login path and confirm a fresh manual overlay works. Do not assume this from a successful first launch.

LG Developer Mode also has an expiry timer. Keep an eye on it; the helper's renewal attempts are not a guarantee against app removal after expiry. Back up the private folder securely and retain the downloaded IPK/source version.

To stop **only this relay**, run from its project folder:

```sh
docker compose stop camera-overlay
```

To start it again:

```sh
docker compose up -d camera-overlay
```

## If a step does not work

| What you see | What to do next |
|---|---|
| `node` / `npm` / `docker` not found | Finish the matching installation, then open a new command window |
| Cannot connect to Docker daemon | Start Docker Desktop, or check the Linux Docker service and your access |
| Cannot find `package.json` or Compose file | Return to the extracted folder that contains those files |
| JSON/configuration error | Check the camera URL's straight quotes and punctuation; do not overwrite the whole file with the small example |
| Pairing cannot reach the TV | Turn on the TV, check its IP, Developer Mode and Key Server, and check local-network access |
| Changed host key | Stop and investigate a TV reset, wrong address or network change; do not blindly replace the saved pin |
| Mount denied / folder access error | Check Docker Desktop folder sharing or Linux/NAS ownership for `private` and `logs`; do not add privileged mode |
| Tunnel ready but no picture | Check the camera's RTSP/RTSPS URL, token and `entrance/lounge` names; use [troubleshooting](TROUBLESHOOTING.md) |
| Stops working after logout/sleep/reboot | Check host power, Docker startup and Developer Mode status |

For help, report your OS, CPU architecture, Docker version, HA location and which numbered step failed. Redact tokens, stream URLs, keys and passphrases; never attach the `private` folder. The [detailed installation reference](INSTALL.md) covers native installs and further options.
