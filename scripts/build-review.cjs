// SPDX-License-Identifier: GPL-3.0-only
"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { zip } = require("../setup/deployment.cjs");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, ".build", process.argv.includes("--release") ? "setup-release" : "review"),
  dist = path.join(root, "dist");
fs.mkdirSync(out, { recursive: true });
const artifact = "com.mbs.cameraoverlay_1.2.0_all.ipk",
  bytes = fs.readFileSync(path.join(dist, artifact)),
  sum = crypto.createHash("sha256").update(bytes).digest("hex");
if (
  !fs
    .readFileSync(path.join(dist, "SHA256SUMS.txt"), "utf8")
    .split(/\r?\n/)
    .some((l) => l.startsWith(sum) && l.trim().endsWith(artifact))
)
  throw Error("TV IPK checksum mismatch");
function collect(relative) {
  const result = {};
  function visit(rel) {
    for (const entry of fs.readdirSync(path.join(root, rel), {
      withFileTypes: true,
    })) {
      const name = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) visit(name);
      else if (entry.isFile())
        result[name] = fs.readFileSync(path.join(root, name));
    }
  }
  visit(relative);
  return result;
}
const entries = {};
for (const folder of ["setup", "relay", "source", "blueprints", "packaging", "scripts", "tests", "docs"])
  Object.assign(entries, collect(folder));
for (const file of [
  "tooling/package.json",
  "tooling/package-lock.json",
  "scripts/build.cjs",
  "scripts/verify-package.cjs",
  "SECURITY.md",
  "docs/PRIVACY-AND-NETWORK.md",
])
  entries[file] = fs.readFileSync(path.join(root, file));
for (const file of [
  "package.json",
  "package-lock.json",
  "LICENSE",
  "NOTICE",
  "Dockerfile",
  "Start Setup.cmd",
  "Start Setup.command",
  ".dockerignore",
  ".gitignore",
  "README.md",
  "TODO.md",
  "CHANGELOG.md",
])
  entries[file] = fs.readFileSync(path.join(root, file));
entries["scripts/check-config.cjs"] = fs.readFileSync(
  path.join(root, "scripts/check-config.cjs"),
);
entries["dist/" + artifact] = bytes;
entries["dist/SHA256SUMS.txt"] = sum + "  " + artifact + "\n";
entries["START-HERE.md"] = "# Start here\n\nExtract this ZIP first. Install Node.js 22 or newer. On Windows open Start Setup.cmd; on Mac/Linux run sh \"Start Setup.command\" from this folder. Keep the window open and visit http://127.0.0.1:8786/.\n\nFollow the [illustrated six-step installation guide](docs/CONFIGURATOR.md). The separate HA OS App is experimental and has NOT been tested.\n";
const desktop = zip(entries);
fs.writeFileSync(
  path.join(out, process.argv.includes("--release") ? "LG-Camera-Overlay-Setup-1.2.0.zip" : "LG-Camera-Overlay-Setup-LOCAL-REVIEW.zip"),
  desktop,
);
const ha = {};
for (const [name, data] of Object.entries(entries))
  if (
    name.startsWith("setup/") ||
    name.startsWith("relay/") ||
    name.startsWith("source/") ||
    name.startsWith("dist/") ||
    ["package.json", "package-lock.json", "LICENSE", "NOTICE"].includes(name)
  )
    ha["lg_camera_overlay/" + name] = data;
ha["lg_camera_overlay/Dockerfile"] = fs.readFileSync(
  path.join(root, "packaging/Dockerfile.ha"),
);
ha["lg_camera_overlay/config.yaml"] = fs.readFileSync(
  path.join(root, "packaging/ha-config.yaml"),
);
ha["lg_camera_overlay/entrypoint.sh"] = fs.readFileSync(
  path.join(root, "packaging/ha-entrypoint.sh"),
);
ha["lg_camera_overlay/README.md"] =
  "# Camera Overlay HA OS App — EXPERIMENTAL / NOT TESTED\n\nThis package has NOT been tested in HA OS or Supervisor ingress. NAS Docker acceptance does not validate this package. Use only a disposable HA OS test environment. Copy this folder into /addons, refresh local Apps, install, start and open its web UI. See https://github.com/mbsintegrations/LG-Camera-Overlay/blob/main/docs/CONFIGURATOR.md#ha-os-app-experimental-and-not-tested .\n";
fs.writeFileSync(
  path.join(out, process.argv.includes("--release") ? "LG-Camera-Overlay-HA-App-EXPERIMENTAL-1.2.0.zip" : "LG-Camera-Overlay-HA-App-LOCAL-REVIEW.zip"),
  zip(ha),
);
const hashes = fs
  .readdirSync(out)
  .filter((n) => process.argv.includes("--release") ? n.endsWith("-1.2.0.zip") : n.endsWith("-LOCAL-REVIEW.zip"))
  .map(
    (name) =>
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(out, name)))
        .digest("hex") +
      "  " +
      name,
  )
  .join("\n");
fs.writeFileSync(path.join(out, "SHA256SUMS.txt"), hashes + "\n");
console.log("Setup packages saved to " + out + ". Nothing uploaded.");
