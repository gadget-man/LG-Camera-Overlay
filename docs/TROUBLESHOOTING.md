# Troubleshooting and recovery

Work from the bottom up: relay configuration, camera stream, relay running, TV app installed and open, then Home Assistant. Never post private config, full camera URLs, the token, the `.wgt` file or unredacted Home Assistant traces in an issue.

## Installing the TV app

| Symptom | Check / next action |
|---|---|
| `sdb connect` says `failed to connect to remote target` | Run `sdb kill-server; sdb start-server; sdb connect TV_IP; sdb devices`. `sdb` drops the connection often, so use this full line every time. On macOS 15, allow Terminal under **System Settings → Privacy & Security → Local Network** |
| Still can't connect | Check Developer mode took: `curl -s http://TV_IP:8001/api/v2/ \| tr ',' '\n' \| grep -i developer` should show `"developerMode":"1"` and `developerIP` equal to the build computer's address. If not, set it again and turn the TV off at the mains for 30 seconds |
| **Samsung Certificate Extension** won't install, or shows an unreadable error | Close Tizen Studio before installing it from Package Manager. Turning on macOS **Invert colours** makes the white-on-white error readable |
| Certificate Manager only offers **Tizen** profiles | The Samsung Certificate Extension isn't installed or activated. Install it, then restart Tizen Studio |
| Build prints `Not found tizen signature file` | The `--profile` name doesn't exist. List profiles with `tizen security-profiles list` |
| Build output shows `tizen-distributor-signer-new.p12` | The profile is the Tizen type, which the TV rejects. Create a **Samsung** profile ([guide step 6e](SAMSUNG-TIZEN.md#6-prepare-the-tv-and-tizen-studio)) |
| `Failed to install Tizen application.` with an empty log | In order of likelihood: a Tizen-type certificate, the TV's DUID missing from the certificate (`sdb shell 0 getduid` shows it), or a space in the package file name (current builds write `CameraOverlay.wgt`). Run `tizen install-permit -t DEVICE` before installing |
| `There is no connected target` | `sdb` lost the TV, or the `-t` device name is wrong. Reconnect and use the last column of `sdb devices` |

## Relay and camera

| Symptom | Check / next action |
|---|---|
| `Invalid configuration` | Run `npm run check` and fix only the named field. IDs and the token format are deliberately strict |
| `listenHost (Tizen TVs need a LAN address…)` | Set `"listenHost": "0.0.0.0"` (or the relay's LAN address) |
| `401 Unauthorized` from the camera | Put `USERNAME:PASSWORD@` in the RTSP URL. Encode special characters with `node -p "encodeURIComponent('PASSWORD')"` |
| FFmpeg not found | Set `ffmpeg` to a command on the service's `PATH`, or an absolute path. The systemd service in the guide sets its own `PATH` |
| Relay stops answering; `curl` to `/show` or `/health` hangs | Usually memory on a small relay computer. Restart it (`sudo systemctl restart camera-overlay`), check `free -m` and `journalctl -k \| grep -i "out of memory"`, and see [hosting](HOSTING.md). If the whole computer is unresponsive, power-cycle it. Include `journalctl -u camera-overlay -n 40 --no-pager` in any report |
| Picture freezes, or **Stream stalled** in the log | Check the network, the relay computer's CPU and the camera bitrate. Use a sub-stream |
| Camera stops after about 95 seconds | FFmpeg has a safety time limit, and `duration` is capped at 90 seconds. This is an alert display, not a monitoring player |

## On the TV

| Symptom | Check / next action |
|---|---|
| `show request` returns `204` but nothing appears | The app isn't open. Open it with `curl -X POST http://TV_IP:8001/api/v2/applications/MbsCamOvly.CameraOverlay` or from the TV's Apps screen. Home Assistant's script does this for you |
| HDMI picture replaced by black | TVWindow couldn't show the input on this model or source. Report the model and source in an issue |
| TV switches to the tuner when the picture ends | An older build that exits at the end. Rebuild from this branch |
| Black flash on every alert | The app is being closed between alerts. That happens after BACK with no camera showing, TV standby, or switching apps or sources. Only the first alert after that should flash |
| Picture appears too late and gets cut short | Older builds counted from the request. Current builds start the countdown at the first frame |
| Samsung remote's arrows and OK don't reach the Sky box | While the overlay app is open, those keys go to the app. Use the box's own remote. Volume still works |
| Picture is in the wrong place or the wrong size | Set `position`, `margin` and `width` in the Home Assistant script. A relay older than 1.2.0 ignores the appearance settings, so update it |

## Home Assistant

| Symptom | Check / next action |
|---|---|
| `rest_command.camera_overlay_*` missing | YAML error, or a second `rest_command:` key in `configuration.yaml`. Check with `grep -n -E "^[a-z_]+:" configuration.yaml` |
| Button does nothing | Is the script's on/off Toggle on? Is the Samsung `media_player` `on`? Check the script trace |
| Automatic alerts stopped but the button works | Check the alert automation is enabled and its **Pause camera overlays** helper is `off`. A missing or unavailable helper blocks alerts |
| Doorbell doesn't override cooldown | Its trigger ID must be exactly `priority`. On Samsung, a doorbell during a showing picture appears after that picture closes ([details](HOME-ASSISTANT.md#add-optional-automatic-alerts)) |
| Alerts from road traffic | Use person or vehicle sensors and detection zones in the camera system. This project doesn't do image recognition |

## Certificate expiry

Samsung developer certificates expire. What an installed app does once its certificate has expired hasn't been confirmed for this project, so plan to rebuild before then. Check the date:

```sh
openssl pkcs12 -in ~/SamsungCertificate/PROFILE/distributor.p12 -clcerts -nokeys | openssl x509 -noout -enddate
```

Before then, renew or recreate the Samsung profile in Certificate Manager, then rebuild and reinstall the app ([guide step 7](SAMSUNG-TIZEN.md#7-build-and-install-the-tv-app)). The TV keeps working with the relay and Home Assistant unchanged.

## Health and privacy

`curl http://RELAY_IP:8766/health` shows:
- whether an encoder is running (`encoder_running`, `streams`)
- which TVs are watching (`tv_clients`)
- recent first-frame timings (`timing_history`)

**For Samsung, `/health` answers anyone on your LAN without the token.** It contains camera IDs and timings, not stream addresses, but timings can still reveal household activity. Keep the relay on a trusted network.

The token authorises every camera and TV route. To change it:
1. Generate a new 64-character hex token.
2. Update `private/config.json` and copy it to the relay.
3. Rebuild and reinstall the TV app.
4. Update `secrets.yaml`, then restart the relay and Home Assistant.

## Update and rollback

1. Turn the overlay Toggle off, or pause alerts. Keep a copy of `private/config.json`, the working `.wgt` and your Home Assistant scripts.
2. Update the code on the build computer, run `npm test`, then rebuild and reinstall the app ([guide step 7](SAMSUNG-TIZEN.md#7-build-and-install-the-tv-app)).
3. Copy the relay to the relay computer and restart it ([guide step 5e](SAMSUNG-TIZEN.md#5-run-the-relay-on-a-raspberry-pi)).
4. Test from a terminal ([guide step 8](SAMSUNG-TIZEN.md#8-test-without-home-assistant)), then from Home Assistant. Then turn the overlay back on.
5. To roll back, reinstall the old `.wgt` with `tizen install`, copy the old relay back, and restore the old scripts.

## Uninstall

1. Delete the overlay scripts, automations and helpers in Home Assistant, and the two `rest_command` entries.
2. Stop and remove the relay: `sudo systemctl disable --now camera-overlay`, then delete the service file and project folder, or run `docker compose down`.
3. Remove the app from the TV with `tizen uninstall -p MbsCamOvly -t DEVICE`, or from the TV's Apps screen.
4. Turn Developer mode off on the TV if nothing else needs it.
5. Delete `private/` and the built `.wgt` once you no longer need them.
