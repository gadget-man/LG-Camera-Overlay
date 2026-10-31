# Setup packaging

Run `npm run build:setup` after placing the verified v1.2.0 TV IPK and its checksum manifest in `dist/`. This creates `.build/setup-release/LG-Camera-Overlay-Setup-1.2.0.zip`, a separately named experimental HA OS App ZIP, and SHA256SUMS.txt. It does not upload anything. `npm run build:review` keeps the local-review output names for development.

The setup ZIP includes the existing verified TV app, readable source, locked dependencies and the illustrated guide. The runtime image is built locally; no registry image is published. Preserve exact FFmpeg/package sources and notices before distributing a container image.

The HA OS package is **EXPERIMENTAL AND NOT TESTED**. It must not be described as validated by the NAS Docker/HA Container test. See [installation and experimental App instructions](../docs/CONFIGURATOR.md).

For isolated acceptance only, `OVERLAY_TEST_APP=1` selects `com.mbs.cameraoverlaytest` for installation and generated launches. It requires the corresponding test IPK and checksum manifest, which are not in the public setup ZIP. The default always uses the normal Camera Overlay app.
