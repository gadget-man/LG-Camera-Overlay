// SPDX-License-Identifier: GPL-3.0-only
"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const { fail, panel, dismissScreensaver } = require("./store.cjs");
function profile(body) {
  const p = panel(body);
  if (!["windows", "mac", "linux", "nas", "haos"].includes(body.host))
    fail("Choose where the relay will run.");
  return {
    version: 1,
    host: body.host,
    haLocation: body.haLocation === "same" ? "same" : "elsewhere",
    panel: p,
    dismissScreensaver: dismissScreensaver(body),
  };
}
function compose(port) {
  return `services:\n  camera-overlay:\n    image: lg-camera-overlay:1.2.0\n    restart: unless-stopped\n    init: true\n    volumes:\n      - ./private:/data/private\n      - ./logs:/data/logs\n    read_only: true\n    tmpfs:\n      - /tmp:size=16m\n    cap_drop: [ALL]\n    security_opt: [no-new-privileges:true]\n    mem_limit: 512m\n    healthcheck:\n      test: [CMD, node, -e, "fetch('http://127.0.0.1:${port}/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]\n      interval: 30s\n      timeout: 5s\n      retries: 3\n`;
}
// ZIP with stored entries: generated private settings are small; no archive dependency.
function crc32(b) {
  let n = 0xffffffff;
  for (const byte of b) {
    n ^= byte;
    for (let k = 0; k < 8; k++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
  }
  return (n ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const chunks = [],
    directory = [];
  let offset = 0;
  for (const [filename, raw] of Object.entries(entries)) {
    if (filename.includes("..") || filename.startsWith("/"))
      throw Error("Unsafe archive path");
    const name = Buffer.from(filename),
      data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw),
      crc = crc32(data),
      h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50);
    h.writeUInt16LE(20, 4);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(data.length, 18);
    h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(name.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    chunks.push(h, name, data);
    directory.push(c, name);
    offset += h.length + name.length + data.length;
  }
  const central = Buffer.concat(directory),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, central, end]);
}
function bundle(store, body) {
  const config = store.read();
  if (!store.summary().ready)
    fail(
      "Complete TV pairing and camera settings before downloading an installation bundle.",
    );
  const p = profile(body);
  const exported = structuredClone(config);
  exported.ffmpeg = "ffmpeg";
  exported.hardwareDecode = "none";
  const entries = {
    "private/config.json": JSON.stringify(exported, null, 2) + "\n",
    "compose.yaml": compose(config.port),
    "layout-profile.json": JSON.stringify(p, null, 2) + "\n",
    "home-assistant-script.yaml":
      JSON.stringify(store.blueprint(body), null, 2) + "\n",
    "logs/.keep": "",
  };
  for (const tv of Object.values(config.tvs))
    entries[tv.privateKey] = fs.readFileSync(
      path.join(store.root, tv.privateKey),
    );
  entries["READ-ME-FIRST.txt"] =
    "PRIVATE INSTALLATION BUNDLE — contains camera URLs, relay token and TV keys.\nKeep outside cloud sync and public shares. Extract into a NEW private folder; never overwrite an existing installation.\n\nINSTALLATION 1.2.0\nThe image lg-camera-overlay:1.2.0 is not on a public registry. Build the supplied project Dockerfile with that tag on the relay host, or load the locally built image archive first.\nRun docker compose up -d from this folder after checking folder permissions. No ports are published.\nLinux/NAS: the container runs as UID 1000. Grant that user private folder access; do not use world-readable permissions.\nWindows/Mac: keep Docker Desktop running and the host awake. Enable its sign-in startup if needed.\n\nHOME ASSISTANT\nImport the project launch blueprint first, then use the supplied script in the HA script YAML editor. It is JSON-formatted YAML. Keep it private. No automatic alert is enabled.\n\nTV\nInstall the supplied release IPK using the wizard or webOS Dev Manager. The relay must run before a TV test.\n";
  return zip(entries);
}
module.exports = { profile, compose, zip, bundle };
