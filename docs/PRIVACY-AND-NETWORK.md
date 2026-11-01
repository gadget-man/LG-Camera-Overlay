# Samsung TV privacy and your network

Camera Overlay shows your camera locally. It doesn't change any of the Samsung TV's own privacy settings, advertising, viewing-information or voice services, and doesn't block traffic from the TV or its apps.

## Samsung privacy settings

Samsung TVs have optional services such as viewing information (content recognition), interest-based advertising and voice recognition, controlled by agreements you accept on the TV. On recent models they're usually under **Settings → General & Privacy → Terms & Privacy**, but names and menus vary by model, year and region. Installing Camera Overlay doesn't change them. Review them yourself if they matter to you.

## How the Samsung route differs from LG

The LG version sends video through an encrypted SSH tunnel, and its relay listens only on the computer itself. Samsung TVs can't use SSH, so the Samsung route is simpler and **less protected**:

- The TV app connects straight to the relay over your LAN using plain HTTP and WebSocket. **The camera video and the 64-character token travel unencrypted** between the relay and the TV.
- The relay listens on a LAN address, so any device on that network can reach it. The token protects the camera routes, but **`/health` answers without the token** (camera IDs and timings, not stream addresses).
- The token is the only protection, and it's built into the TV app (`.wgt`) and stored in Home Assistant.

On a trusted home network this is a reasonable trade-off. Don't run it on a shared or untrusted network, and never expose the relay to the Internet.

## Connections Camera Overlay needs

Use these when planning firewall rules. Allow reply traffic, but don't open whole networks just to make one connection work.

| From | To | Port | Purpose |
|---|---|---|---|
| TV | Relay | TCP 8766 (the `port` setting) | Checks for camera requests and receives video; unencrypted |
| Home Assistant | Relay | TCP 8766 | Sends camera requests; unencrypted, token in the address |
| Home Assistant | TV | TCP 8001 | Opens the overlay app |
| Home Assistant | TV | The Samsung Smart TV integration's ports | TV power state and control, as the [integration](https://www.home-assistant.io/integrations/samsungtv/) requires |
| Relay | Camera or NVR | The stream port, usually 554 | RTSP over TCP, or RTSPS |
| Build computer | TV | TCP 26101 | `sdb`, only while installing the app with Developer mode on |
| Build computer | Samsung's certificate service | HTTPS | Creating the developer certificate, signed in with your Samsung account |

The TV doesn't need to reach the camera directly, and the app contains no camera credentials or Home Assistant token. It does contain the relay token and address.

## Practical network protection

- **Isolate the TV.** Put TVs and streaming boxes on a media or IoT network, with firewall rules allowing only the paths above. A separate Wi-Fi name or VLAN doesn't isolate anything without firewall rules. Apply rules to IPv6 as well as IPv4.
- **Keep camera, relay and TV traffic on trusted networks,** given the unencrypted relay-to-TV path. If they're on different VLANs, allow just TV → relay on the relay port.
- **Developer mode:** it lets the build computer install apps on the TV over the network. Only the address you entered can connect with `sdb`. Whether the overlay keeps working with Developer mode turned off hasn't been tested yet. If you try it, test an alert afterwards, and report the result. You'll need Developer mode on again to update the app or renew the certificate.
- **Never forward the relay port, port 8001 or 26101 from the Internet.**
- **Keep the TV's firmware updated,** and review its privacy options. Network isolation limits local access; it doesn't stop the TV's own Internet traffic.

## Camera and credential privacy

The relay converts video without audio, and doesn't record or use any cloud service.

**Camera to relay.** RTSP is unencrypted. RTSPS protection depends on the camera and FFmpeg's TLS handling. **Relay to TV:** unencrypted on Samsung (see above).

**Keep these private:**
- `private/config.json`: camera URLs with passwords, and the token
- the built `.wgt`: the token and relay address
- `secrets.yaml` and any Home Assistant traces showing the relay URL
- your Samsung certificate files and passwords

The token grants access to every configured camera route. Camera and TV IDs aren't separate permissions. Anyone who can read the relay computer's files, or its process list while FFmpeg runs, can see the camera credentials.

If any of these leak:
1. Change the camera passwords.
2. Generate a new token, then rebuild and reinstall the TV app.
3. Update `secrets.yaml`, then restart the relay and Home Assistant.

See [security reporting](../SECURITY.md). Installing Camera Overlay makes no router, firewall or TV privacy-setting changes.
