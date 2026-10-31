"use strict";
const $ = (id) => document.getElementById(id),
  session = document.querySelector('meta[name="setup-session"]').content;
let step = 0,
  state = null,
  pin = null,
  pending = 0;
const pages = [
  [
    "Make yourself at home.",
    "Choose where your camera relay will run. We’ll guide you through the rest.",
  ],
  [
    "Meet your television.",
    "Pair once, then install the overlay with the same connection.",
  ],
  [
    "A view of what matters.",
    "Add your camera addresses privately, without editing a settings file.",
  ],
  [
    "Make room for the moment.",
    "Choose how the camera looks above your programme.",
  ],
  [
    "Bring it together.",
    "Choose your LG in Home Assistant and create a camera button.",
  ],
  [
    "Ready for the first look.",
    "Finish your installation, then try one camera on one television.",
  ],
];
const tips = {
  windows:
    "Install Docker Desktop with Linux containers. Your Windows PC must stay awake; Docker Desktop normally starts when you sign in.",
  mac: "Use Docker Desktop for your Mac’s processor. Keep the Mac awake while you want camera alerts.",
  linux:
    "Reuse your existing Docker installation. The relay runs separately from Home Assistant.",
  nas: "Prepare the TV pairing here, then move the private installation bundle to your NAS. No TV or camera ports need to be published.",
  haos: "Experimental and NOT TESTED: the HA OS App requires a disposable HA OS test system. HA Container does not have Apps. Use the tested separate Docker route for normal installation.",
};
function selection() {
  return document.querySelector("input[name=host]:checked").value;
}
function values() {
  return {
    host: selection(),
    haLocation: $("ha-location").value,
    label: $("label").value,
    width: Number($("width").value),
    duration: Number($("duration").value),
    position: $("position").value,
    margin: Number($("margin").value),
    borderColor: $("border-color").value,
    fps: $("fps").checked,
    border: $("border").checked,
    compact: $("compact").checked,
    dismissScreensaver: $("dismiss-screensaver").checked,
    tv: $("route-tv").value,
    camera: $("route-camera").value,
    entity: $("ha-entity").value,
  };
}
function message(text, error = false) {
  $("status").textContent = text;
  $("status").classList.toggle("error", error);
}
async function api(route, data) {
  const r = await fetch("api/" + route, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "x-setup-session": session,
      ...(data === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (!r.ok) {
    const result = await r.json();
    throw Error(result.error || "Please try again.");
  }
  return r.headers.get("content-type").includes("application/zip")
    ? r.blob()
    : r.json();
}
function download(name, contents, type = "application/json") {
  const blob =
      contents instanceof Blob
        ? contents
        : new Blob(
            [
              typeof contents === "string"
                ? contents
                : JSON.stringify(contents, null, 2),
            ],
            { type },
          ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function options(select, items) {
  const old = select.value;
  select.replaceChildren();
  for (const [value, label] of items) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    select.append(o);
  }
  if (items.some((i) => i[0] === old)) select.value = old;
}
async function refresh() {
  state = await api("state");
  if (state.ingress) {
    document.querySelector('input[name=host][value="haos"]').checked = true;
    $("ha-location").value = "same";
    $("start-relay").textContent = "Start App relay";
    $("stop-relay").textContent = "Stop App relay";
    const details = $("start-relay").closest("details");
    details.querySelector("summary").textContent = "Manage this App’s relay";
    details.querySelector("p").textContent = "Start after saving your first camera and TV. A saved configuration starts automatically when this App starts.";
  }
  $("preview-banner").hidden = !state.preview;
  $("count-tvs").textContent = state.tvs.length;
  $("count-cameras").textContent = state.cameras.length;
  $("renew").checked = state.renewDeveloperMode;
  for (const s of document.querySelectorAll("[data-tv]"))
    options(
      s,
      state.tvs.map((t) => [t.id, t.id]),
    );
  for (const s of document.querySelectorAll("[data-camera]"))
    options(
      s,
      state.cameras.map((c) => [c, c]),
    );
  options($("profile"), [
    ["", "Set up a new TV"],
    ...state.profiles.map((p) => [p.name, p.name + " · " + p.host]),
  ]);
  $("entities").replaceChildren();
  for (const e of state.entities.filter((e) =>
    e.id.startsWith("media_player."),
  )) {
    const o = document.createElement("option");
    o.value = e.id;
    o.label = e.label;
    $("entities").append(o);
  }
  $("saved-cameras").replaceChildren();
  for (const id of state.cameras) {
    const el = document.createElement("span");
    el.textContent = id;
    $("saved-cameras").append(el);
  }
  $("finish-summary").textContent =
    `${state.tvs.length} TV(s) · ${state.cameras.length} camera(s). ${state.ready ? "Settings are ready." : "Complete pairing and camera setup to install."}`;
  update();
}
function update() {
  $("host-help").textContent = tips[selection()];
  $("panel-label").textContent = $("label").value || "Camera";
  $("camera-panel").style.width = $("width").value + "%";
  // The TV margin is a share of screen width; on the 16:9 sample, vertical % is 16/9 larger.
  const m = Number($("margin").value),
    x = m + "%",
    y = (m * 16) / 9 + "%",
    place = {
      "top-right": [y, x, "auto", "auto"],
      "top-left": [y, "auto", "auto", x],
      "bottom-right": ["auto", x, y, "auto"],
      "bottom-left": ["auto", "auto", y, x],
      center: ["50%", "auto", "auto", "50%"],
    }[$("position").value],
    preview = $("camera-panel").style;
  [preview.top, preview.right, preview.bottom, preview.left] = place;
  preview.transform =
    $("position").value === "center" ? "translate(-50%, -50%)" : "none";
  preview.borderColor = $("border-color").value;
  preview.borderWidth = $("border").checked ? "1px" : "0";
  $("border-color").disabled = !$("border").checked;
  $("camera-panel").classList.toggle("compact", $("compact").checked);
  $("panel-status").textContent = $("fps").checked ? "LIVE · 25 fps" : "LIVE";
  $("margin-value").textContent = m + "%";
  $("margin").disabled = $("position").value === "center";
  $("width-value").textContent = $("width").value + "%";
  $("duration-value").textContent = $("duration").value + " seconds";
  $("panel-duration").textContent =
    "Closes in " + $("duration").value + "s · BACK to dismiss";
  $("count-duration").textContent = $("duration").value + "s";
  $("deploy-help").textContent =
    selection() === "haos"
      ? "EXPERIMENTAL — NOT TESTED on HA OS. Install the experimental package only in a disposable HA OS system. No one-click App repository is supplied."
      : "Build or load the lg-camera-overlay:1.2.0 image on your relay host first, then extract the private bundle into a new folder. Follow the illustrated configurator guide for startup and folder permissions.";
}
function navigate(n) {
  step = Math.max(0, Math.min(5, n));
  document
    .querySelectorAll("[data-page]")
    .forEach((el) => (el.hidden = Number(el.dataset.page) !== step));
  document.querySelectorAll("[data-step]").forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.step) === step);
    el.setAttribute(
      "aria-current",
      Number(el.dataset.step) === step ? "step" : "false",
    );
  });
  $("heading").textContent = pages[step][0];
  $("intro").textContent = pages[step][1];
  $("eyebrow").textContent =
    "STEP " + String(step + 1).padStart(2, "0") + " OF 06";
  $("back").disabled = step === 0;
  $("next").hidden = step === 5;
  message("");
}
function action(button, fn) {
  $(button).addEventListener("click", async () => {
    if (pending) return;
    pending++;
    $(button).disabled = true;
    message("Working…");
    try {
      await fn();
    } catch (e) {
      message(e.message, true);
    } finally {
      pending--;
      $(button).disabled = false;
    }
  });
}
document
  .querySelectorAll("[data-step]")
  .forEach((b) => (b.onclick = () => navigate(Number(b.dataset.step))));
$("next").onclick = () => navigate(step + 1);
$("back").onclick = () => navigate(step - 1);
for (const el of document.querySelectorAll(
  "input[name=host],#label,#width,#duration,#position,#margin,#border,#border-color,#fps,#compact,#ha-location,#dismiss-screensaver",
))
  el.addEventListener("input", update);
$("profile").onchange = () => {
  const p = state.profiles.find((p) => p.name === $("profile").value);
  if (p) $("tv-host").value = p.host;
  $("tv-pass").disabled = !!p;
};
action("check-tools", async () => {
  const r = await api("tools");
  $("tools-result").textContent = r.sample
    ? "Sample mode: computer checks are disabled."
    : `Node ${r.node}\nFFmpeg: ${r.ffmpeg ? "available" : "not found — Docker supplies it for deployed use"}\nDocker Compose: ${r.docker ? "available" : "not found on this computer"}`;
  message("Computer check complete.");
});
action("prepare-tv", async () => {
  pin = await api("pair/prepare", {
    id: $("tv-id").value,
    host: $("tv-host").value,
    passphrase: $("tv-pass").value,
    profile: $("profile").value,
    revision: state.revision,
  });
  $("tv-pass").value = "";
  $("pin-review").hidden = false;
  $("pin-trust").checked = false;
  $("pin-host").textContent = pin.host;
  $("pin-value").textContent = pin.fingerprint;
  message("Review the TV identity before saving.");
});
action("confirm-tv", async () => {
  if (!$("pin-trust").checked) throw Error("Confirm this is your TV first.");
  const r = await api("pair/confirm", {
    fingerprint: pin?.fingerprint,
    confirm: true,
  });
  $("pin-review").hidden = true;
  $("tv-result").textContent =
    "Pairing saved. " + Object.values(r.info || {}).join(" · ");
  await refresh();
  message("TV pairing saved.");
});
action("install-tv-button", async () => {
  const tv = $("install-tv").value;
  if (!tv) throw Error("Pair your TV first.");
  if (!confirm("Install or update Camera Overlay on " + tv + "?")) return;
  await api("install", { tv, confirm: true });
  $("install-result").textContent = "The TV confirmed installation.";
  message("TV app installed.");
});
action("save-camera", async () => {
  await api("camera", {
    id: $("camera-id").value,
    url: $("camera-url").value,
    revision: state.revision,
  });
  $("camera-url").value = "";
  await refresh();
  $("camera-result").textContent =
    "Camera saved. Its private address is not shown.";
  message("Camera settings saved.");
});
action("test-camera", async () => {
  await api("camera/test", {
    url: $("camera-url").value,
    id: $("camera-id").value,
  });
  $("camera-result").textContent = "One video frame decoded successfully.";
  message("Camera decoding confirmed.");
});
action("connect-ha", async () => {
  try {
    await api("ha/connect", {
      url: $("ha-url").value,
      token: $("ha-token").value,
      allowHttp: $("allow-http").checked,
    });
    await refresh();
    $("ha-result").textContent = "Connected. Select your LG entity below.";
    message("Entity names retrieved; no household commands sent.");
  } finally {
    $("ha-token").value = "";
  }
});
action("disconnect-ha", async () => {
  await api("ha/disconnect", {});
  await refresh();
  $("ha-result").textContent =
    "Disconnected. The token has been forgotten by this session.";
  message("Disconnected.");
});
action("script-download", async () => {
  const r = await api("ha/script", values());
  download("camera-overlay-private-script.yaml", r.script, "application/yaml");
  message("Private HA script downloaded.");
});
action("bundle-download", async () => {
  if (
    !confirm(
      "Download a PRIVATE bundle containing camera addresses and TV access keys? Keep it outside shared/cloud folders.",
    )
  )
    return;
  const blob = await api("bundle", { ...values(), confirm: true });
  download("camera-overlay-private-installation.zip", blob);
  message("Private installation bundle downloaded.");
});
action("save-settings", async () => {
  await api("settings", {
    revision: state.revision,
    renewDeveloperMode: $("renew").checked,
  });
  await refresh();
  message("Maintenance choice saved. Restart your deployed relay to apply it.");
});
action("test-tv", async () => {
  const v = { ...values(), duration: 30 };
  if (!confirm("Show " + v.camera + " on " + v.entity + " for 30 seconds now?" + (v.dismissScreensaver ? " This will restore the TV screen first." : "")))
    return;
  await api("ha/test", { ...v, confirm: true });
  $("test-result").textContent =
    "HA accepted the launch. Check the camera picture and sound on the selected television.";
  message("Test requested. The TV picture still needs your confirmation.");
});
action("start-relay", async () => {
  await api("relay/start", {});
  message("Temporary relay starting. Use Check relay connection in a moment.");
});
action("stop-relay", async () => {
  await api("relay/stop", {});
  message("The relay started by this setup session was stopped.");
});
action("refresh-status", async () => {
  const r = await api("status");
  $("relay-result").textContent = r.sample
    ? "Sample preview: no relay is connected."
    : r.reachable
      ? "Relay is responding. " +
        Object.entries(r.connections)
          .map(
            ([id, t]) =>
              id + ": " + (t.ready ? "tunnel ready" : "not connected"),
          )
          .join(" · ") +
        `\nEncoder: ${r.encoderRunning ? "running" : "idle"} · First-frame evidence: ${r.firstFrame ? "received" : "not received"}`
      : "No local relay is responding. For a NAS, check status on that host.";
  message("Status refreshed.");
});
action("report-download", async () => {
  download("camera-overlay-support.json", await api("report", {}));
  message("Redacted report downloaded.");
});
action("export-profile", async () => {
  download("camera-overlay-layout.json", await api("profile", values()));
  message("Layout saved without camera addresses, tokens or keys.");
});
$("import-profile").onclick = () => $("profile-file").click();
$("profile-file").onchange = async () => {
  try {
    const file = $("profile-file").files[0];
    if (!file || file.size > 16384)
      throw Error("Choose a small exported layout JSON file.");
    const p = JSON.parse(await file.text());
    const result = await api("profile", {
      host: p.host,
      haLocation: p.haLocation,
      ...p.panel,
      dismissScreensaver: p.dismissScreensaver ?? false,
    });
    document.querySelector(`input[name=host][value="${result.host}"]`).checked =
      true;
    $("ha-location").value = result.haLocation;
    for (const key of ["label", "width", "duration", "position", "margin"])
      $(key).value = result.panel[key];
    $("border-color").value = result.panel.borderColor;
    $("border").checked = result.panel.border;
    $("fps").checked = result.panel.fps;
    $("compact").checked = result.panel.compact;
    $("dismiss-screensaver").checked = result.dismissScreensaver ?? false;
    update();
    message("Layout imported. No saved connections were changed.");
  } catch (e) {
    message(e.message, true);
  } finally {
    $("profile-file").value = "";
  }
};
refresh().catch((e) => message(e.message, true));
