# 1.2.0 roadmap

All three planned items are included in 1.2.0. Validation applies only to the setups recorded in [test results](docs/VALIDATION.md).

- [x] Add customization options for the look and feel of the camera overlay (included in 1.2.0).
- [x] Add a Home Assistant automation blueprint for the Disable feature, allowing users to pause and resume camera overlays (included in 1.2.0).
- [x] Test whether the camera overlay appears above LG's built-in screensaver and add optional temporary dismissal without permanently disabling screensaver protection.

On 31 October, the overlay was not visible above the OLED65B9PLA's active LG screensaver. A separate screen-on test dismissed it and preserved YouTube. The combined dismissal-plus-overlay test also worked, with Launcher already underneath and preserved afterward. The launch blueprint and configurator now offer this as an opt-in setting; other TV models are unverified.

## Further validation

- [ ] Screensaver dismissal on other LG models and software versions.
- [ ] HA OS/Supervisor installation, ingress and lifecycle acceptance.
