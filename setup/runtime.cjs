// SPDX-License-Identifier: GPL-3.0-only
"use strict";
const { spawn } = require("node:child_process"),
  path = require("node:path"),
  fs = require("node:fs");
const { fail, cameraURL } = require("./store.cjs");
function run(executable, args, { timeout = 15000, limit = 131072 } = {}) {
  return new Promise((resolve, reject) => {
    const c = spawn(executable, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let output = "",
      size = 0,
      settled = false;
    const timer = setTimeout(() => {
      c.kill();
      finish(Error("timeout"));
    }, timeout);
    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(result);
    }
    c.on("error", (e) => finish(e));
    c.stdout.on("data", (b) => {
      size += b.length;
      if (size > limit) {
        c.kill();
        finish(Error("too much output"));
      } else output += b;
    });
    c.stderr.on("data", () => {});
    c.on("close", (code) =>
      code === 0 ? finish(null, output) : finish(Error("command failed")),
    );
  });
}
class Runtime {
  constructor(store) {
    this.store = store;
    this.child = null;
    this.lastExit = null;
  }
  async tools() {
    const check = async (exe, args) => {
      try {
        await run(exe, args, { timeout: 5000 });
        return true;
      } catch {
        return false;
      }
    };
    return {
      node: process.versions.node,
      ffmpeg: await check(this.store.read().ffmpeg, ["-version"]),
      docker: await check("docker", ["compose", "version"]),
    };
  }
  async camera(url) {
    cameraURL(url);
    await run(
      this.store.read().ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-rtsp_transport",
        "tcp",
        "-i",
        url,
        "-an",
        "-frames:v",
        "1",
        "-f",
        "null",
        "-",
      ],
      { timeout: 18000 },
    );
    return { decoded: true };
  }
  async health() {
    try {
      const r = await fetch(
        "http://127.0.0.1:" + this.store.read().port + "/health",
        { signal: AbortSignal.timeout(2000), redirect: "error" },
      );
      const parts = [];
      let n = 0;
      for await (const b of r.body) {
        n += b.length;
        if (n > 131072) throw Error();
        parts.push(b);
      }
      return JSON.parse(Buffer.concat(parts).toString());
    } catch {
      return null;
    }
  }
  async start() {
    if (this.child) return { started: true };
    if (!this.store.summary().ready)
      fail("Save a paired TV and camera before starting the relay.");
    if (await this.health())
      fail("A relay already uses this port. It was left untouched.");
    const child = spawn(
      process.execPath,
      [path.resolve(__dirname, "../relay/relay.cjs")],
      {
        env: { ...process.env, OVERLAY_DATA_DIR: this.store.root },
        windowsHide: true,
        stdio: "ignore",
      },
    );
    this.child = child;
    child.on("error", () => {
      if (this.child === child) this.child = null;
      this.lastExit = "Could not start relay";
    });
    child.on("exit", (code) => {
      if (this.child === child) this.child = null;
      this.lastExit = code;
    });
    return { started: true };
  }
  stop() {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
    return { stopped: true };
  }
  async status() {
    const h = await this.health();
    return {
      owned: !!this.child,
      reachable: !!h,
      lastExit: this.lastExit,
      connections: h?.tv_tunnels || {},
      viewers: h?.clients ?? null,
      firstFrame: !!h?.first_frame,
      encoderRunning: !!h?.encoder_running,
      renewal: Object.values(h?.developer_modes || {}).map((s) => ({
        checked: !!s?.checked_at,
        success: s?.success === true,
        remaining: s?.remaining || null,
      })),
    };
  }
}
async function haConnect(body) {
  let u;
  try {
    u = new URL(body.url);
  } catch {
    fail("Enter your Home Assistant website address.");
  }
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !["https:", "http:"].includes(u.protocol) ||
    (u.protocol === "http:" && !body.allowHttp)
  )
    fail("Use HTTPS, or explicitly allow HTTP on your trusted local network.");
  if (u.hostname === "169.254.169.254")
    fail("That address is not a Home Assistant server.");
  if (
    typeof body.token !== "string" ||
    body.token.length < 20 ||
    body.token.length > 8192 ||
    /\s/.test(body.token)
  )
    fail("Enter a valid Home Assistant access token.");
  const base = u.href.replace(/\/$/, "");
  const r = await fetch(base + "/api/states", {
    headers: { Authorization: "Bearer " + body.token },
    redirect: "error",
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok)
    fail(
      "Home Assistant rejected the connection. Check its address and token.",
    );
  const parts = [];
  let n = 0;
  for await (const b of r.body) {
    n += b.length;
    if (n > 12582912) fail("Home Assistant returned too much data.");
    parts.push(b);
  }
  const values = JSON.parse(Buffer.concat(parts).toString());
  if (!Array.isArray(values))
    fail("This address did not return Home Assistant entities.");
  return {
    base,
    token: body.token,
    entities: values
      .filter(
        (s) =>
          s &&
          /^(media_player|binary_sensor|event)\.[a-z0-9_]+$/.test(s.entity_id),
      )
      .map((s) => ({
        id: s.entity_id,
        label: String(s.attributes?.friendly_name || s.entity_id).slice(0, 120),
      })),
  };
}
async function haLaunch(connection, payload, dismissScreensaver = false) {
  if (typeof dismissScreensaver !== "boolean") fail("Choose screensaver dismissal on or off.");
  if (!connection) fail("Connect Home Assistant before running a TV test.");
  const headers = {
    Authorization: "Bearer " + connection.token,
    "Content-Type": "application/json",
  };
  const state = await fetch(
    connection.base + "/api/states/" + encodeURIComponent(payload.entity_id),
    { headers, redirect: "error", signal: AbortSignal.timeout(8000) },
  );
  if (!state.ok) fail("Could not check whether the selected TV is on.");
  const current = await state.json();
  if (!["on", "playing", "paused", "idle", "buffering"].includes(current.state))
    fail("The TV is off or unavailable. Turn it on yourself before testing.");
  if (dismissScreensaver) {
    const screen = await fetch(connection.base + "/api/services/webostv/command", {
      method: "POST", headers,
      body: JSON.stringify({ entity_id: payload.entity_id, command: "com.webos.service.tvpower/power/turnOnScreen" }),
      redirect: "error", signal: AbortSignal.timeout(12000),
    });
    if (!screen.ok) fail("Home Assistant did not accept screen-on. The overlay was not launched.");
    await screen.body.cancel();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const check = await fetch(connection.base + "/api/states/" + encodeURIComponent(payload.entity_id), {
      headers, redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (!check.ok || !["on", "playing", "paused", "idle", "buffering"].includes((await check.json()).state))
      fail("The TV is no longer active. The overlay was not launched.");
  }
  const r = await fetch(connection.base + "/api/services/webostv/command", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    redirect: "error",
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok)
    fail(
      "Home Assistant did not accept the launch. Check the selected LG integration.",
    );
  await r.body.cancel();
  return { accepted: true };
}
module.exports = { Runtime, run, haConnect, haLaunch };
