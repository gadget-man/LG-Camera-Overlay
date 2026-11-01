# Home Assistant setup

This page covers Home Assistant for Samsung TVs: the TV integration, the camera script, automatic alerts and pausing. The [installation guide](SAMSUNG-TIZEN.md#9-home-assistant) has the same steps with the exact commands for Home Assistant in Docker. Home Assistant can share a computer with the relay; see [hosting](HOSTING.md).

Home Assistant never handles the video. It sends the relay a "show this camera" request and makes sure the TV app is open.

## Add the TV

In **Settings → Devices & services**, add **Samsung Smart TV** using the TV's address, and accept the prompt on the TV. Under **Developer tools → States**, its `media_player.` entity should show `on` with the TV on and `off` in standby. The camera script uses this, so nothing happens and the TV isn't woken while it's off.

Use your own entity IDs, found in the entity settings or **Developer tools → States**. Friendly names aren't IDs.

## Add the relay commands

Two `rest_command` entries go in `configuration.yaml`, with the relay's address and token in `secrets.yaml`:

```yaml
# secrets.yaml
camera_overlay_show_url: "http://RELAY_IP:8766/show/YOUR_TOKEN/lounge"
```

```yaml
# configuration.yaml
rest_command:
  camera_overlay_show:
    url: !secret camera_overlay_show_url
    method: POST
    content_type: application/json
    payload: >-
      {"camera": {{ camera | to_json }}, "label": {{ label | to_json }},
       "duration": {{ duration | int }}, "width": {{ width | int }}, "hdmi": {{ hdmi | int }},
       "position": {{ position | default('top-right') | to_json }}, "margin": {{ margin | default(3) | int }},
       "border": {{ border | default(true) | to_json }}, "borderColor": {{ borderColor | default('') | to_json }},
       "compact": {{ compact | default(false) | to_json }},
       "detectedAt": {{ (as_timestamp(now()) * 1000) | int }}}
  camera_overlay_launch:
    url: "http://TV_IP:8001/api/v2/applications/MbsCamOvly.CameraOverlay"
    method: POST
```

`lounge` is the TV ID from the relay's configuration. If `configuration.yaml` already has a `rest_command:` line, add only the indented entries under it; a second `rest_command:` line replaces the first. Check the configuration (**Developer tools → YAML**) and restart. Both commands should then appear under **Developer tools → Actions**.

The token is in `secrets.yaml`, and in any trace that shows the URL. Treat scripts, traces and backups as private.

## Create the camera script

You can import the blueprint:

```text
https://github.com/mbsintegrations/LG-Camera-Overlay/blob/samsung-tizen/blueprints/script/samsung-camera-overlay.yaml
```

Create a script from it with the Samsung media player, the relay's TV ID and camera ID, and the camera label. Leave **How to open the TV app** on **TV network API**. That route is user-confirmed. The **Samsung integration** route is untested.

Or write the script yourself. This is the user-confirmed version, using an optional on/off **Toggle** helper:

```yaml
alias: Show TV camera overlay
mode: single
max_exceeded: silent
sequence:
  - condition: state
    entity_id: input_boolean.tv_camera_overlay
    state: "on"
  - condition: state
    entity_id: media_player.YOUR_TV
    state: "on"
  - action: rest_command.camera_overlay_show
    data:
      camera: outside
      label: Outside
      duration: 20
      width: 25
      hdmi: 1
      position: top-right
      margin: 3
      border: true
      borderColor: ""
      compact: false
  - action: rest_command.camera_overlay_launch
    continue_on_error: true
  - delay: "00:00:30"
```

| Setting | Meaning | Values (default) |
|---|---|---|
| `duration` | Seconds on screen, counted from when the picture appears | 15–90 (45) |
| `width` | Picture width | 10–55% of the screen (25) |
| `hdmi` | Input kept behind the picture; `0` keeps the current source | 0–4 (from the relay config) |
| `position` | `top-right`, `top-left`, `bottom-right`, `bottom-left` or `center` | `top-right` |
| `margin` | Distance from the edges; ignored for `center` | 0–10% of the screen width (3) |
| `border`, `borderColor` | Border on/off, and `#rrggbb` or `""` for translucent white | on, `""` |
| `compact` | Camera label on a strip across the top of the picture | off |

None of these needs a rebuild. Invalid values are ignored and the default used. The final delay stops repeated triggers while the picture starts and shows.

Run the script with the TV on your HDMI input. The first run opens the app, so the TV shows its loading screen once. After that, the picture appears over the programme with no flash, and HDMI carries on when it closes. For more cameras, create one script per camera and TV.

## Add optional automatic alerts

First read [how detections reach Home Assistant](DETECTION-FLOW.md). A camera stream on its own doesn't create alerts; you need a detection, motion or doorbell signal in Home Assistant.

**Simple:** an automation per trigger that runs the script:

```yaml
alias: TV camera overlay - outside motion
mode: single
triggers:
  - trigger: state
    entity_id: binary_sensor.YOUR_MOTION_SENSOR
    to: "on"
actions:
  - action: script.turn_on
    target:
      entity_id: script.show_tv_camera_overlay
```

**Several cameras, cooldown and doorbell priority:** use the shared alert blueprint:

```text
https://github.com/mbsintegrations/LG-Camera-Overlay/blob/samsung-tizen/blueprints/automation/camera-alert.yaml
```

1. Create a **Timer** helper dedicated to this automation.
2. Set **Normal detection triggers** to your person or vehicle sensors. For binary sensors, use an `off` → `on` state trigger.
3. Set **Priority triggers** to the doorbell's ring event. In each priority trigger's menu choose **Edit ID** and set it to exactly `priority`.
4. Set the normal and priority launch actions to **Script: Turn on** with your camera script(s). Keep them short, with no waits.
5. Select the timer, starting with 60 seconds of cooldown.

**Priority on Samsung differs from LG.** While a picture is showing, the Samsung app doesn't take a new request. A doorbell press during a picture is shown **after** the current picture closes, as long as that's within 60 seconds of the press. It does not replace the picture straight away. The `mode: single` delay in the camera script above also blocks a second run of the same script for 30 seconds, so give the doorbell its own script. This behaviour comes from the code and hasn't yet been tested with a real doorbell.

## Pausing

There are two independent switches. Use either or both:

| Switch | On means | Blocks |
|---|---|---|
| The script's own Toggle (`input_boolean.tv_camera_overlay` above, or the blueprint's **On/off switch**) | Overlay allowed | Everything that runs the script, including dashboard buttons |
| **Pause camera overlays**, selected in the alert blueprint | Alerts paused | Automatic alerts only; buttons still work |

To set up the shared pause:

1. Create a **Toggle** helper named **Pause camera overlays**, left off.
2. Select it in each alert automation's **Pause camera overlays (optional)** field.
3. Add it to your dashboard.

Pausing doesn't close a picture already showing. A selected helper that is missing or unavailable blocks alerts until it reports `off`.

**Pause on a schedule:** create a **Schedule** helper for quiet hours, import this blueprint and create an automation from it:

```text
https://github.com/mbsintegrations/LG-Camera-Overlay/blob/samsung-tizen/blueprints/automation/pause-overlays.yaml
```

Choose the schedule (or another Toggle or binary sensor) as the source and **Pause camera overlays** as the helper. On means paused. It also resynchronises when Home Assistant starts. Don't select the same helper for both fields.

Put the switches, test buttons and camera scripts on a standard **Entities** card. No custom dashboard is needed.

## Test alerts before relying on them

Temporarily give the alert automation two **event triggers** you can fire yourself from **Developer tools → Events**: one normal, and one with ID `priority`. Then confirm:

- a normal event shows the camera
- a repeat during cooldown doesn't
- a priority event shows its camera, after any picture that is still on screen
- **Pause camera overlays** blocks both

Restore the real triggers afterwards.

## Updates

- **Home Assistant settings only** (size, position, duration and so on): edit the script. Nothing else needs changing.
- **New relay or TV app version:** see [updating](SAMSUNG-TIZEN.md#updating) in the installation guide.
- **Upgrading an earlier Samsung install to 1.2.0:** replace the `payload:` with the version above to use the appearance settings. The older payload keeps working with the default look. Re-import any blueprints you use.

LG-only settings from the upstream project don't apply to Samsung: screensaver dismissal, the frame-rate display, the setup wizard's generated scripts and Home Launcher coexistence.
