# Samsung Tizen TVs (HDMI sources)

> **Experimental, not yet tested on a Samsung TV.** The relay and app logic pass automated tests, but nobody has confirmed the picture on real hardware yet. Check the [first-run checks](#first-run-checks) before relying on it.

## How it differs from LG

Samsung does not let third-party apps float a transparent window over other apps. Instead the Tizen app runs full-screen and uses Samsung's TVWindow API to show an HDMI input **behind** a transparent page, with the camera panel drawn on top. To the viewer it looks like the LG overlay, but:

| Watching | Works? |
|---|---|
| A box on HDMI (Sky, Apple TV, SHIELD) | Yes: the app shows that input behind the panel |
| Apps built into the TV (Netflix, iPlayer on the Samsung) | No: launching the overlay sends them to the background |

When the panel closes (timer or BACK) the app exits and the TV returns to the HDMI input.

Other differences:

- **No SSH tunnel.** The TV app connects straight to the relay over your LAN, so the relay listens on a LAN address and its port is reachable on your network. The 64-character token is the only protection; keep it private, and keep the relay off the Internet.
- **No Developer Mode renewal.** `devmode.cjs` is LG-only and is skipped for Tizen TVs.
- **Home Assistant posts the camera choice to the relay first**, then launches the app, because the Samsung integration cannot pass launch parameters. The app asks the relay what to show when it starts. A request older than 60 seconds is ignored.

## 1. Relay configuration

Start from [`config.tizen.example.json`](../config.tizen.example.json):

```json
{
  "port": 8766,
  "listenHost": "0.0.0.0",
  "token": "REPLACE_WITH_64_HEX_CHARACTERS",
  "ffmpeg": "ffmpeg",
  "sources": { "entrance": "rtsp://192.0.2.20:554/REPLACE_STREAM_PATH" },
  "tvs": { "lounge": { "platform": "tizen", "hdmi": 1 } }
}
```

- `hdmi` is the input shown behind the panel (Sky on HDMI 1 → `1`). `0` keeps whatever source the app finds.
- LG TVs (`"platform": "webos"`, the default) can sit in the same file, and keep using SSH.
- Generate the token with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

With Docker, publish the port by adding the Tizen override:

```bash
docker compose -f compose.yaml -f compose.tizen.yaml up -d --build
```

Give the relay computer a fixed LAN IP address (a DHCP reservation), because the TV app has it built in.

## 2. Prepare the TV and Tizen Studio

1. Install [Tizen Studio](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html). In its Package Manager, add **TV Extensions** and **Samsung Certificate Extension**.
2. On the TV, open **Apps**, press `1 2 3 4 5` on the remote, switch **Developer mode** on, enter the IP address of the computer running Tizen Studio, and restart the TV.
3. Connect from the computer (`sdb` is in `tizen-studio/tools`):

   ```bash
   sdb connect TV_IP_ADDRESS
   ```

4. In Tizen Studio's **Certificate Manager**, create a **Samsung** certificate profile for **TV**, signed in with a Samsung account, and add the connected TV's DUID when asked. Remember the profile name.

## 3. Build and install the TV app

The build bakes the relay address, token and TV ID into the app, so build one package per TV:

```bash
npm run build:tizen -- --tv lounge --relay http://RELAY_IP:8766 --profile YOUR_PROFILE
```

The `tizen` command-line tool must be on your PATH (`tizen-studio/tools/ide/bin`), or set `TIZEN_CLI` to its full path. Then install the `.wgt` file the build placed in `dist`, using the device name that `sdb devices` shows:

```bash
tizen install -n "WGT_FILE_NAME.wgt" -t DEVICE_NAME -- dist
```

The built `.wgt` contains the token: don't share it.

## 4. Home Assistant

Add the built-in **Samsung Smart TV** integration for the TV.

Add this to `configuration.yaml` and restart HA. Put the URL in `secrets.yaml` so the token stays out of the main config:

```yaml
rest_command:
  camera_overlay_show:
    url: !secret camera_overlay_show_url
    method: POST
    content_type: application/json
    payload: >-
      {"camera": {{ camera | to_json }}, "label": {{ label | to_json }},
       "duration": {{ duration | int }}, "width": {{ width | int }}, "hdmi": {{ hdmi | int }},
       "detectedAt": {{ (as_timestamp(now()) * 1000) | int }}}
```

```yaml
# secrets.yaml
camera_overlay_show_url: "http://RELAY_IP:8766/show/YOUR_TOKEN/{{ tv_id }}"
```

Then import the script blueprint:

```text
https://github.com/gadget-man/LG-Camera-Overlay/blob/samsung-tizen/blueprints/script/samsung-camera-overlay.yaml
```

Create a script from it: choose the Samsung media player, enter the relay TV ID (`lounge`) and camera ID (`entrance`), and leave the app ID as `MbsCamOvly.CameraOverlay`. The existing alert blueprint works unchanged: point its launch actions at this script.

If the script runs but the app doesn't open, the Samsung integration may not launch sideloaded apps on your model. One fallback to try is a second `rest_command` that posts to the TV's own API at `http://TV_IP:8001/api/v2/applications/MbsCamOvly.CameraOverlay`.

## First-run checks

Run these once, with Sky playing on HDMI 1:

1. **Picture:** run the script. The Sky picture should stay full-screen with the camera panel in the corner. If you see the panel on black with "No HDMI picture", TVWindow could not show the input on this model.
2. **Sound:** check that Sky audio continues while the panel is up.
3. **Return:** after the timer, and again with BACK, the TV should be back on Sky.
4. **Relay:** `curl http://RELAY_IP:8766/health` should list the TV under `tv_clients` while the panel is up, and `clients: 0` afterwards.

Report results (TV model, year and Tizen version) so the compatibility table can be filled in.
