# Security

See [privacy and network protection](docs/PRIVACY-AND-NETWORK.md) for Samsung privacy settings, network isolation, the connections the overlay needs, and handling camera credentials and the token.

Report vulnerabilities using this repository's private GitHub security advisory reporting, when available. Don't disclose camera stream URLs, the relay token, certificate files or passwords, built `.wgt` files or unredacted Home Assistant traces in public issues. If private reporting isn't available, open an issue asking for a private route, without exploit details or secrets.

**The Samsung route is designed for a trusted home network only.**
- The TV app talks to the relay over the LAN using unencrypted HTTP and WebSocket.
- The single relay token, built into the TV app and stored in Home Assistant, grants access to every configured camera route.
- `/health` answers without the token.

Don't expose the relay to the Internet, put it behind a public reverse proxy, or run it on a shared or untrusted network or host. If the token or a built `.wgt` leaks, generate a new token, rebuild the app, and update Home Assistant ([how](docs/PRIVACY-AND-NETWORK.md#camera-and-credential-privacy)).

Fixes target the latest version of this branch. Production runtime packages are audited with `npm audit --omit=dev`.
