// SPDX-License-Identifier: GPL-3.0-only
"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { validate } = require("../relay/config.cjs");
// Lab runs install a separate app and never replace the working TV installation.
function appId() {
  return process.env.OVERLAY_TEST_APP === "1"
    ? "com.mbs.cameraoverlaytest"
    : "com.mbs.cameraoverlay";
}
function fail(message) {
  const e = new Error(message);
  e.safe = true;
  throw e;
}
function id(value) {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{0,40}$/.test(value))
    fail(
      "Use a name beginning with a letter, then lowercase letters, numbers or underscores.",
    );
  return value;
}
function cameraURL(value) {
  try {
    const u = new URL(value);
    if (
      !["rtsp:", "rtsps:"].includes(u.protocol) ||
      !u.hostname ||
      /[\r\n]/.test(value) ||
      value.length > 4096
    )
      throw Error();
  } catch {
    fail("Enter a complete RTSP or RTSPS camera address.");
  }
  return value;
}
const positions = [
  "top-right",
  "top-left",
  "bottom-right",
  "bottom-left",
  "center",
];
function panel(value = {}) {
  const p = {
    label: value.label ?? "Entrance",
    width: Number(value.width ?? 42),
    duration: Number(value.duration ?? 30),
    position: value.position ?? "top-right",
    borderColor: String(value.borderColor ?? "#67dfad").toLowerCase(),
    compact: value.compact ?? false,
    margin: Number(value.margin ?? 3),
    border: value.border ?? true,
    fps: value.fps ?? true,
  };
  if (
    !positions.includes(p.position) ||
    !/^#[0-9a-f]{6}$/.test(p.borderColor) ||
    typeof p.compact !== "boolean" ||
    !Number.isInteger(p.margin) ||
    p.margin < 0 ||
    p.margin > 10 ||
    typeof p.border !== "boolean" ||
    typeof p.fps !== "boolean"
  )
    fail(
      "Choose a panel position, margin 0–10%, a #rrggbb border colour, and border, frame rate and compact on or off.",
    );
  if (
    typeof p.label !== "string" ||
    !p.label.trim() ||
    p.label.length > 80 ||
    /[\r\n]/.test(p.label) ||
    !Number.isInteger(p.width) ||
    p.width < 25 ||
    p.width > 55 ||
    !Number.isInteger(p.duration) ||
    p.duration < 15 ||
    p.duration > 90
  )
    fail("Choose a label, width 25–55% and duration 15–90 seconds.");
  return p;
}
function atomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = file + "." + crypto.randomBytes(6).toString("hex") + ".tmp";
  try {
    fs.writeFileSync(tmp, value, { mode: 0o600, flag: "wx" });
    fs.renameSync(tmp, file);
    fs.chmodSync(file, 0o600);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
class Store {
  constructor(root) {
    this.root = path.resolve(root);
    this.file = path.join(this.root, "private/config.json");
  }
  read() {
    if (!fs.existsSync(this.file))
      return {
        port: 8766,
        token: "",
        ffmpeg: "ffmpeg",
        hardwareDecode: "none",
        renewDeveloperMode: false,
        sources: {},
        tvs: {},
      };
    try {
      return JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {
      fail(
        "Existing settings could not be read. Restore a private backup before continuing.",
      );
    }
  }
  revision() {
    return fs.existsSync(this.file)
      ? crypto
          .createHash("sha256")
          .update(fs.readFileSync(this.file))
          .digest("hex")
      : "new";
  }
  update(revision, change) {
    if (revision !== this.revision())
      fail("Settings changed in another window. Refresh and try again.");
    const c = this.read();
    change(c);
    if (!c.token) c.token = crypto.randomBytes(32).toString("hex");
    if (fs.existsSync(this.file))
      atomic(this.file + ".before-setup", fs.readFileSync(this.file));
    atomic(this.file, JSON.stringify(c, null, 2) + "\n");
    return this.summary();
  }
  summary() {
    const c = this.read();
    let ready = false;
    try {
      validate(structuredClone(c));
      for (const tv of Object.values(c.tvs))
        fs.accessSync(path.join(this.root, tv.privateKey));
      ready = true;
    } catch {}
    return {
      revision: this.revision(),
      ready,
      port: c.port,
      renewDeveloperMode: !!c.renewDeveloperMode,
      cameras: Object.keys(c.sources || {}),
      tvs: Object.entries(c.tvs || {}).map(([key, t]) => ({
        id: key,
        host: t.host,
        paired: !!t.hostKeySha256,
      })),
      dataFolder: this.root,
    };
  }
  camera(body) {
    id(body.id);
    cameraURL(body.url);
    return this.update(body.revision, (c) => {
      c.sources[body.id] = body.url;
    });
  }
  tv(body, key) {
    id(body.id);
    const name =
      body.id +
      "-" +
      crypto.createHash("sha256").update(key).digest("hex").slice(0, 12) +
      "-key";
    if (body.revision !== this.revision())
      fail("Settings changed. Refresh before pairing again.");
    atomic(path.join(this.root, "private", name), key);
    return this.update(body.revision, (c) => {
      c.tvs[body.id] = {
        host: body.host,
        port: 9922,
        username: "prisoner",
        privateKey: "private/" + name,
        passphrase: body.passphrase,
        hostKeySha256: body.fingerprint,
      };
    });
  }
  settings(body) {
    if (typeof body.renewDeveloperMode !== "boolean")
      fail("Choose whether this relay maintains Developer Mode.");
    return this.update(body.revision, (c) => {
      c.renewDeveloperMode = body.renewDeveloperMode;
    });
  }
  route(camera, tv) {
    const c = this.read();
    if (!Object.hasOwn(c.sources, id(camera)) || !Object.hasOwn(c.tvs, id(tv)))
      fail("Select a saved camera and TV.");
    validate(structuredClone(c));
    return `ws://127.0.0.1:${c.port}/live/${c.token}/${camera}/${tv}`;
  }
  launch(body) {
    const p = panel(body),
      stream = this.route(body.camera, body.tv);
    if (!/^media_player\.[a-z0-9_]+$/.test(body.entity || ""))
      fail("Select the LG media-player entity in Home Assistant.");
    return {
      entity_id: body.entity,
      command: "system.launcher/launch",
      payload: {
        id: appId(),
        params: { stream, ...p, sentAt: Date.now() },
      },
    };
  }
  blueprint(body) {
    const launch = this.launch(body);
    return {
      alias: "Show " + launch.payload.params.label,
      use_blueprint: {
        path: "mbsintegrations/camera-overlay.yaml",
        input: {
          tv: body.entity,
          stream: launch.payload.params.stream,
          ...panel(body),
          app_id: appId(),
        },
      },
    };
  }
}
module.exports = { Store, atomic, fail, id, cameraURL, panel, appId };
