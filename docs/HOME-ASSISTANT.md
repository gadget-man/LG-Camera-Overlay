# Home Assistant setup

The relay can share suitable hardware with HA. For HA Container, use a separate relay container on the host. The separate HA OS App package is experimental and has not been tested with Supervisor. See [hosting options and hardware recommendations](HOSTING.md).

## Add the TV

In Settings → Devices & services, add **LG webOS TV** using the television's IP. Accept the connection prompt on the TV if shown. This pairing is separate from Developer Mode SSH pairing. Open the resulting media player and confirm it reports the TV's current state. Do not add a wake action for camera alerts.

Find entity IDs in the entity settings or Tools → States (called Developer Tools on older HA versions). Use your own actual IDs; friendly names are not necessarily IDs. The launch script accepts `on`, `playing`, `paused`, `idle` and `buffering`, and skips everything else. This matters because native apps can report `playing` instead of `on`.

## Import and create a manual script

Go to Settings → Automations & scenes → Blueprints → Import blueprint. Import:

```text
https://github.com/mbsintegrations/LG-Camera-Overlay/blob/main/blueprints/script/camera-overlay.yaml
```

Create a script from it. Select the real LG media player, paste the private loopback URL from the installation guide, set the camera label, and start with 30 seconds and 42% width. Position (default top right), edge distance (default 3% of screen width), border (default on) and its colour (default `#67dfad`), frame rate next to LIVE (default on) and compact mode are optional; existing scripts keep the original look. Leave app ID as `com.mbs.cameraoverlay` unless deliberately using a separate test app. Save with a useful name such as “Lounge entrance camera.” The URL includes the relay token: treat script configuration, HA backups and traces as private.

Run the script while the TV is already showing a native app or your chosen HDMI source. Target the LG media player even when watching Plex on an Apple TV connected through HDMI. Check the relay health and the physical TV. `first_frame` means the TV player acknowledged decoding a frame; it cannot prove that underlying audio stayed audible. After timeout, `clients` should return to zero and `encoder_running` to false. Test BACK separately.

Create additional scripts for each camera/TV combination. For several TVs, make a wrapper script with parallel calls to those launch scripts, so an unavailable TV does not hold up the others. No camera URL or RTSP password is needed inside HA; HA only knows the token-bearing relay route.

## Add optional automatic alerts

First read [how detections reach HA and select a stream](DETECTION-FLOW.md). It covers our operating UniFi rules, detection-zone limits and the signals required from other systems. A working RTSP stream alone does not create automatic alerts. The public blueprints were tested in the dedicated HA lab with inert event/counter triggers; real person/doorbell acceptance belongs to the older operating reference, as detailed in [validation](VALIDATION.md#tested-and-operating-setups).

Create a **Timer** helper in Settings → Devices & services → Helpers, named for this overlay's cooldown. Keep this timer dedicated to one alert coordinator. Then import:

```text
https://github.com/mbsintegrations/LG-Camera-Overlay/blob/main/blueprints/automation/camera-alert.yaml
```

Create an automation and configure:

1. **Normal detection triggers:** your actual person/vehicle sensors. Use the integration's suitable native trigger; for a binary sensor, an `off` → `on` state trigger avoids triggering merely because the sensor recovers from unavailable. Choose only the detections you want; camera motion and person detection are different signals.
2. **Priority triggers:** the doorbell's actual event or ring sensor. In each priority trigger's menu choose **Edit ID** and set it to exactly `priority`. This is essential: the generic trigger selector cannot assign a group ID. Use another ID for normal triggers. For event entities, inspect their real `event_types` and select the ring type; do not guess its spelling.
3. **Normal launch actions:** call the camera script. To route several cameras, use a Choose action based on the normal trigger ID (for example `driveway` or `entrance`) and select the appropriate script. Those IDs are your own trigger labels, not fixed project requirements.
4. **Priority launch actions:** call the doorbell camera script(s).
5. Select the cooldown timer and use 60 seconds initially.

Keep launch actions short. Prefer **Script: Turn on** targeting the camera scripts; do not add a display-duration delay or a wait-for-video action here. The TV manages its own timeout. The coordinator uses queued mode to serialize simultaneous events and check cooldown at execution time. Priority bypasses the timer and replaces the TV's visible overlay, but cannot preempt an arbitrarily long custom HA action already running. Duplicate ring events can relaunch the priority camera; filter/debounce those at the trigger if needed.

The first normal event starts the cooldown. Further normal events during it do nothing. A priority event starts/restarts the same timer and launches its camera. Each manual launch script checks its TV's state. If all TVs are off, no TV wakes; the automation may still consume a cooldown interval. Cooldown can survive restart only if you enable restoration on the Timer helper. HA does not replay missed detection events after restart.

## Pause / Resume and manual camera selection

Use the alert automation's normal on/off toggle as Pause/Resume. Put that entity on an Entities card next to the manual camera scripts. You can label it “Automatic camera alerts” and give each script a clear camera name. Turning it off affects only that automation, not manual scripts or unrelated automations. An already displayed panel closes on its own timeout or BACK.

### One pause switch for several camera alerts (1.2.0)

1. In **Settings → Devices & services → Helpers**, create a **Toggle** named **Pause camera overlays**. Start with it off.
2. Update the detection blueprint, open each camera alert automation, and select this helper in **Pause camera overlays (optional)**. Leave the field empty if you want the previous behaviour.
3. Add the helper to your dashboard. **On means paused; off means alerts are allowed.** It blocks normal detections and priority doorbells for the coordinators using it. Manual camera buttons still work.

Pausing does not close a panel already on screen, reset the cooldown, or change any automation's enabled state. Resuming never re-enables an automation you had disabled yourself. Events arriving during pause are discarded, and queued actions check the pause again before launching. A selected helper that is missing or unavailable blocks alerts until it reports off again.

### Pause automatically during quiet hours

Create a **Schedule** helper for the times when you do not want camera alerts. Then import this automation blueprint and create an automation from it:

```text
https://github.com/mbsintegrations/LG-Camera-Overlay/blob/main/blueprints/automation/pause-overlays.yaml
```

- **When should overlays be paused?** Select your quiet-hours Schedule helper. You can instead select a separate Toggle or binary sensor whose on/off state should control pause.
- **Pause camera overlays:** Select the same Toggle helper you used in the camera alert coordinators.

When the source is on, pause turns on; when the source is off, pause turns off. The blueprint also synchronizes on HA startup. An unknown/unavailable source leaves the current pause setting unchanged. Do not select the same helper for both fields. Use one controller per pause helper so separate schedules cannot overwrite each other.

You can change the pause switch manually; the next source on/off transition or HA restart will synchronize it again. To keep manual control, disable the quiet-hours controller. It does not change the enabled state of your camera alert automations.

### Using LG TV HA Home Launcher too

Keep the two projects' scripts and helpers separate. The overlay pause controller writes only to the Toggle helper you selected; it never enables/disables Launcher automations, selects the Launcher source, or handles the HOME key. Choose a new helper dedicated to overlays, not a helper already used by Launcher.

If your Launcher already has a camera-alert button that toggles the alert automation, it continues to work. That button shows whether the automation is enabled; it does not show the separate pause helper. Automatic alerts require both an enabled coordinator and an unpaused helper. Leave the optional helper empty if you prefer your existing single-toggle workflow.

Only one project should maintain Developer Mode on a given TV. Leave **Developer Mode maintenance** off in the Overlay configurator when Launcher already owns renewal. Updating the overlay app does not update or replace the Launcher app or its Home-key helper.

A standard Entities card works at desktop and phone widths without custom frontend dependencies. Use the UI card editor to select your actual entities. A custom dashboard is not required.

## Test alert behavior before connecting real detections

Temporarily use two uniquely named **event triggers** on the automation, one normal and one with ID `priority`. Fire those from Tools → Events. For an inert test, temporarily replace launch actions with counter increments or persistent notifications; record the original actions first. Confirm one normal event, a suppressed repeat, a priority event during cooldown, and another suppressed normal event. Pause the automation and confirm neither test event acts; resume and restore the real triggers/actions. Do this in a test HA instance if available.

## Updates

### Optional screensaver dismissal

In each camera launch script, enable **Restore screen before showing the camera** if you want alerts to dismiss LG's screensaver. In the configurator, the equivalent checkbox is **Restore the TV screen before camera alerts** in step 4; regenerate the script and private bundle after changing it.

The script first checks that HA reports the TV active, sends LG's screen-on command, waits 1.5 seconds, checks the TV again, then launches the overlay. It does not send HOME/BACK, select another source, or change the screensaver timeout. The screen-on command can also restore an intentionally blanked screen, so leave this option off if you want to preserve that state. It is off by default. HA's state can briefly lag the TV; this is not a wake-from-standby feature.

On OLED65B9PLA (firmware 05.50.00, SDK 4.10.0), a plain overlay was hidden by LG's screensaver. Dismissal preserved YouTube in one test; dismissal followed by an overlay worked with Home Launcher already underneath in another. Test your own model while watching before enabling automatic alerts. Do not permanently disable OLED screensaver protection. We have not verified the time until the screensaver returns after an alert.

### Upgrade from 1.0.0 or 1.1.0

1. Back up your private relay folder and your HA scripts/automations. Keep the old package until the new version passes a viewing test.
2. Extract the 1.2.0 setup ZIP into a new folder. Start the configurator; existing saved settings on the same setup computer remain available. Install the 1.2.0 TV app on each TV you use. Do not uninstall the Launcher app or its helper.
3. Build the new relay image with `docker build -t lg-camera-overlay:1.2.0 .` from the extracted source. In your existing private runtime Compose file, change only the image tag to `lg-camera-overlay:1.2.0`, then run `docker compose up -d`. Keep your existing private folder/volume mappings. Do not extract a new private bundle over a working runtime folder.
4. Re-import the launch and alert blueprints from their existing project URLs. Import the new [pause/resume blueprint](../blueprints/automation/pause-overlays.yaml) if wanted. Existing scripts and alert automations continue with defaults: screensaver restoration off and no pause helper selected.
5. Choose appearance settings in your camera scripts, select an optional shared pause helper in each alert coordinator, and enable screen restoration only where wanted. Configurator users can regenerate scripts after selecting the new controls.
6. Watch one manual camera test, then test normal/priority alerts and pause/resume. Check Launcher still behaves normally if installed. Keep only one Developer Mode renewal owner.

Rollback: reinstall the previous TV IPK, restore your blueprint/script backups and switch the Compose image back to the retained prior image tag. Private camera addresses and TV keys do not need to change.

Re-import a blueprint to update it, then inspect the automations/scripts using it and test a manual launch. Keep a prior blueprint/config copy to roll back. No HA custom integration or HACS repository entry is involved. See the [native LG integration documentation](https://www.home-assistant.io/integrations/webostv/) for supported webOS control setup.
