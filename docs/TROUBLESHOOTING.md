# Troubleshooting and recovery

Work from the bottom up: validate configuration, SSH tunnel, camera encoding, TV decoding, then HA triggers. Never post private config, full stream URLs, SSH material or unredacted HA traces in an issue.

| Symptom | Check / next action |
|---|---|
| Overlay is hidden by LG's screensaver | Enable the optional [screen restoration setting](HOME-ASSISTANT.md#optional-screensaver-dismissal) in the camera script and test while watching. Confirmed on OLED65B9PLA; other models are unverified. Do not permanently disable OLED screensaver protection. |
| Automatic alerts stopped but manual camera button works | Check both the alert automation's enabled state and its selected pause helper. A missing/unavailable selected helper blocks alerts. The Launcher camera-alert button may control only the automation, not the new pause helper. |
| `Invalid configuration` | Run `npm run check`; fix only the named field. IDs, pins and token formats are deliberately strict. |
| FFmpeg unavailable | Set an executable available to the service user/container. A relative custom path is not resolved against the config directory; use an absolute path or PATH command. |
| `tv_tunnels` false | Turn on the TV, verify Developer Mode and IP/9922 reachability, then run the official CLI system-info command. No wake-on-LAN is attempted. |
| SSH authentication fails | Re-enable Key Server and refresh pairing with the official CLI. Import it again with the helper. Do not replace the host pin merely to suppress a mismatch. |
| `tv_forward_unavailable` | Another relay may already own that TV loopback port. Stop the duplicate instance or choose a different port and update HA URLs/healthcheck. Keep production/test ports separate. |
| App immediately shows No stream | Launch it through the HA script with a valid `ws://127.0.0.1:PORT/live/TOKEN/CAMERA/TV` URL. Opening from the TV launcher supplies none. |
| HTTP 403 / no viewer | All five route segments must match, including both IDs and the 64-character token. Extra/trailing segments and missing TV IDs are rejected. |
| Viewer connects but no video | Check source reachability from the relay, the selected substream and FFmpeg's codecs/TLS support. Test the private source locally with FFmpeg without sharing its output. Encoder diagnostics intentionally omit raw FFmpeg stderr to prevent credential leakage. |
| Picture freezes | Check network, server CPU and camera bitrate. A slow client is disconnected without closing other TVs. A stalled frame is hidden; relaunch manually once the cause is fixed. |
| Encoder stops after about 95 seconds | The process has a safety time limit; TV duration is limited to 90 seconds. Long overlapping sessions sharing a camera can reach the encoder's limit and require a new launch. This is not a continuous monitoring player. |
| TV off/unavailable | Expected: HA skips it and SSH retries every 15 seconds. A powered-off TV is not a project failure. |
| Alert missing only in Netflix | Check that the TV state is `playing`, `paused`, `idle` or `buffering`, not just `on`. The supplied script includes these states. |
| Doorbell does not bypass cooldown | Set the actual priority trigger ID to `priority`. The nested trigger selector does not supply that ID for you. |
| Road traffic triggers alerts | Configure appropriate camera smart-detection zones and choose person/vehicle sensors deliberately. This project does not implement image recognition or road exclusion. |
| TV app replaced the main picture | Overlay behavior is firmware/app dependent. Recheck appinfo flags/package version and record model, firmware and native app in a compatibility issue. |
| Docker health is healthy but no TV | Healthcheck proves listener availability only. Inspect `tv_tunnels`; do not publish the container port as a workaround. |

## Developer Mode maintenance

With `renewDeveloperMode: true`, the relay checks daily and requests renewal below seven days remaining. It verifies that remaining time increased and retries failures after one hour. It privately caches the TV session token to allow checks while the TV is off. Only LG's HTTPS endpoint receives that session token. A host-key mismatch does not authorize changing the pin.

This relies on LG's session service and is not a guarantee: account, API or firmware changes can break it. Inspect `developer_modes` in `/health` and `logs/devmode-status-<tv>.json`. A false/missing status needs attention. You can extend the session manually in the TV's Developer Mode app while it remains valid. If expiry has disabled Developer Mode, sign in/enable it again, retrieve fresh pairing and reinstall the IPK as required. Do not clear all TV app caches as a routine repair.

## Health and privacy

`tv_tunnels` reports forwarding readiness. `streams` reports encoder/viewer counts and bytes. `first_frame` and `metrics` are player acknowledgements. `timing_history` shows eight recent entries; the private log is bounded to 100. No recording is performed, although camera identifiers and timing information can still reveal household activity. Health is available only on relay loopback but is not authenticated separately; local users/processes able to reach it can read status. Protect the relay host accordingly.

The route token authorizes access to every configured source/TV route; it is not per-camera authorization. Rotate it by generating 32 new random bytes as lowercase hex, updating the private config and all HA launch URLs, then restarting only the relay. Keep screenshots of HA script editors and traces private. FFmpeg receives the stream as an argument; privileged users on the relay host may inspect process arguments. Do not run this on an untrusted shared host.

## Update and rollback

1. Pause the alert automation. Save the current private config, blueprint instances and prior release IPK privately.
2. Stop only this relay/service. Install the new source dependencies from its lockfile and build/restart the local container if used.
3. Install the matching IPK using Dev Manager or `ares-install`; preserve private configuration outside the released files.
4. Run `npm run check`, inspect tunnel health, manually test video/BACK/timeout and native sound, then resume alerts.
5. On failure, stop this relay, restore its previous source/dependencies and private config, reinstall the old IPK, and restore only the affected HA scripts/blueprints. Do not restore all of HA or restart unrelated services to undo one overlay change.

Test recovery from your actual service restart and TV standby before relying on it. A successful config readback does not prove reboot/login or physical playback behavior.

## Uninstall

Disable/delete only the overlay alert automation and scripts, then its dedicated timer and unused blueprints. Stop/remove this relay's service or use `docker compose down` (preserve private folders until you decide to delete them). Remove Camera Overlay from Dev Manager, or use `ares-install --device YOUR_PROFILE --remove com.mbs.cameraoverlay`. Remove only this project's private key copies, token cache and logs when no longer needed. Do not disable Developer Mode if other apps depend on it, or delete shared CLI profiles without checking their other uses.
