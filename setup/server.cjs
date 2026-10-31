// SPDX-License-Identifier: GPL-3.0-only
"use strict";
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto");
const { Store, fail, id, panel, appId, dismissScreensaver } = require("./store.cjs"),
  devices = require("./devices.cjs"),
  { Runtime, haConnect, haLaunch } = require("./runtime.cjs"),
  deployment = require("./deployment.cjs");
function createServer(options = {}) {
  const root =
    options.root ||
    process.env.OVERLAY_DATA_DIR ||
    path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), ".local/share"),
      "LG-Camera-Overlay",
    );
  const store = options.store || new Store(root),
    runtime = options.runtime || new Runtime(store),
    adapter = options.devices || devices,
    preview = !!options.preview,
    ingress = !!options.ingress;
  const csrf = crypto.randomBytes(32).toString("hex");
  let pairing = null,
    connection = null,
    busy = false;
  function send(res, code, data, type = "application/json") {
    res.writeHead(code, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'",
    });
    res.end(
      Buffer.isBuffer(data)
        ? data
        : type === "application/json"
          ? JSON.stringify(data)
          : data,
    );
  }
  function artifact() {
    const file = path.resolve(
        __dirname,
        "../dist/" + appId() + "_1.2.0_all.ipk",
      ),
      manifest = path.resolve(__dirname, "../dist/SHA256SUMS.txt");
    if (!fs.existsSync(file) || !fs.existsSync(manifest))
      fail("The release IPK and SHA256SUMS.txt are missing from dist.");
    const actual = crypto
      .createHash("sha256")
      .update(fs.readFileSync(file))
      .digest("hex");
    const match = fs
      .readFileSync(manifest, "utf8")
      .split(/\r?\n/)
      .find((l) => l.trim().split(/\s+/)[1] === appId() + "_1.2.0_all.ipk");
    if (!match || match.split(/\s+/)[0] !== actual)
      fail("The TV package checksum does not match.");
    return file;
  }
  async function body(req) {
    if (req.headers["content-type"] !== "application/json")
      fail("Expected JSON.");
    const parts = [];
    let n = 0;
    for await (const b of req) {
      n += b.length;
      if (n > 65536) fail("Request too large.");
      parts.push(b);
    }
    return JSON.parse(Buffer.concat(parts).toString());
  }
  const demo = () => ({
    revision: "preview",
    ready: false,
    port: 8766,
    renewDeveloperMode: false,
    dataFolder: "Sample only — no private settings loaded",
    cameras: ["entrance"],
    tvs: [{ id: "living_room", host: "192.0.2.30", paired: false }],
  });
  const server = http.createServer(async (req, res) => {
    const expected = "127.0.0.1:" + server.address().port;
    if (ingress) {
      if (
        req.socket.remoteAddress !== "172.30.32.2" &&
        req.socket.remoteAddress !== "::ffff:172.30.32.2"
      )
        return send(res, 403, {
          error: "Open setup through Home Assistant ingress.",
        });
    } else if (req.headers.host !== expected)
      return send(res, 403, {
        error: "Open setup on this computer at 127.0.0.1.",
      });
    const origin = ingress
      ? (req.headers["x-forwarded-proto"] || "http") + "://" + req.headers.host
      : "http://" + expected;
    if (req.headers.origin && req.headers.origin !== origin)
      return send(res, 403, {
        error: "This request came from a different website.",
      });
    const pathname = new URL(req.url, "http://localhost").pathname;
    try {
      if (pathname.startsWith("/api/")) {
        if (req.headers["x-setup-session"] !== csrf)
          return send(res, 403, {
            error: "Reload setup to restore your local session.",
          });
        if (req.method === "GET" && pathname === "/api/state")
          return send(res, 200, {
            ...(preview ? demo() : store.summary()),
            preview,
            ingress,
            connected: !!connection,
            entities: connection?.entities || [],
            profiles: preview
              ? []
              : adapter.profiles().map((p) => ({ name: p.name, host: p.host })),
            pairedPending: !!pairing,
          });
        if (req.method === "GET" && pathname === "/api/status")
          return send(
            res,
            200,
            preview
              ? {
                  owned: false,
                  reachable: false,
                  connections: {},
                  sample: true,
                }
              : await runtime.status(),
          );
        if (req.method === "GET" && pathname === "/api/tools")
          return send(
            res,
            200,
            preview
              ? {
                  sample: true,
                  node: process.versions.node,
                  ffmpeg: false,
                  docker: false,
                }
              : await runtime.tools(),
          );
        if (req.method !== "POST")
          return send(res, 405, { error: "POST required." });
        const b = await body(req);
        if (pathname === "/api/profile")
          return send(res, 200, deployment.profile(b));
        if (preview)
          fail(
            "This is the sample preview. Start normal setup to save settings or connect devices.",
          );
        if (busy)
          return send(res, 409, {
            error: "Another setup action is still running.",
          });
        busy = true;
        try {
          if (pathname === "/api/camera") {
            send(res, 200, store.camera(b));
            return;
          }
          if (pathname === "/api/camera/test") {
            const url = b.url || store.read().sources[id(b.id)];
            send(res, 200, await runtime.camera(url));
            return;
          }
          if (pathname === "/api/pair/prepare") {
            id(b.id);
            pairing = null;
            const d = await adapter.prepare(b, store.read().tvs[b.id]);
            pairing = {
              ...d,
              id: b.id,
              revision: b.revision,
              expires: Date.now() + 300000,
            };
            send(res, 200, { host: d.host, fingerprint: d.fingerprint });
            return;
          }
          if (pathname === "/api/pair/confirm") {
            if (
              !pairing ||
              pairing.expires < Date.now() ||
              b.fingerprint !== pairing.fingerprint ||
              b.confirm !== true
            )
              fail("Review the TV identity and confirm pairing again.");
            const info = await adapter.verify(pairing);
            const result = store.tv(pairing, pairing.key);
            pairing = null;
            send(res, 200, { ...result, info });
            return;
          }
          if (pathname === "/api/install") {
            if (b.confirm !== true)
              fail("Confirm installation on the selected TV.");
            id(b.tv);
            const file = artifact();
            await adapter.install(store, b.tv, file);
            send(res, 200, { installed: true });
            return;
          }
          if (pathname === "/api/settings") {
            send(res, 200, store.settings(b));
            return;
          }
          if (pathname === "/api/ha/connect") {
            connection = null;
            connection = await (options.haConnect || haConnect)(b);
            send(res, 200, { connected: true, entities: connection.entities });
            return;
          }
          if (pathname === "/api/ha/disconnect") {
            connection = null;
            send(res, 200, { connected: false });
            return;
          }
          if (pathname === "/api/ha/script") {
            send(res, 200, {
              script: JSON.stringify(store.blueprint(b), null, 2),
              route: store.route(b.camera, b.tv),
            });
            return;
          }
          if (pathname === "/api/ha/test") {
            if (b.confirm !== true)
              fail("Confirm the test on your selected TV.");
            if (!connection?.entities.some((e) => e.id === b.entity))
              fail("Choose an entity from the connected Home Assistant.");
            send(
              res,
              200,
              await (options.haLaunch || haLaunch)(connection, store.launch(b), dismissScreensaver(b)),
            );
            return;
          }
          if (pathname === "/api/relay/start") {
            send(res, 200, await runtime.start());
            return;
          }
          if (pathname === "/api/relay/stop") {
            send(res, 200, runtime.stop());
            return;
          }
          if (pathname === "/api/bundle") {
            if (b.confirm !== true)
              fail("Confirm this download contains private credentials.");
            send(res, 200, deployment.bundle(store, b), "application/zip");
            return;
          }
          if (pathname === "/api/report") {
            const state = store.summary(),
              status = await runtime.status();
            send(res, 200, {
              version: "1.2.0",
              platform: process.platform,
              node: process.versions.node,
              ready: state.ready,
              cameraCount: state.cameras.length,
              tvCount: state.tvs.length,
              relayReachable: status.reachable,
              relayStartedBySetup: status.owned,
            });
            return;
          }
          send(res, 404, { error: "Unknown setup action." });
        } finally {
          busy = false;
        }
        return;
      }
      if (req.method !== "GET")
        return send(res, 405, { error: "GET required." });
      const files = {
        "/": ["index.html", "text/html"],
        "/wizard.js": ["wizard.js", "application/javascript"],
        "/wizard.css": ["wizard.css", "text/css"],
      };
      if (!files[pathname]) return send(res, 404, { error: "Not found." });
      const [file, type] = files[pathname];
      let data = fs.readFileSync(path.join(__dirname, file), "utf8");
      if (file === "index.html") data = data.replace("__SESSION__", csrf);
      send(res, 200, data, type);
    } catch (e) {
      send(res, e.safe ? 400 : 502, {
        error: e.safe
          ? e.message
          : "That step could not complete. Check the address, credentials and connection; private error details were not displayed.",
      });
    }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 60000;
  server.on("close", () => {
    connection = null;
    pairing = null;
    runtime.stop();
  });
  return { server, store, runtime };
}
if (require.main === module) {
  const ingress = process.argv.includes("--ingress"),
    preview = process.argv.includes("--preview"),
    container = process.argv.includes("--container-local");
  const app = createServer({ ingress, preview });
  const port = Number(process.env.PORT || (ingress ? 8099 : 8786));
  app.server.listen(
    port,
    ingress || container ? "0.0.0.0" : "127.0.0.1",
    async () => {
      console.log(
        ingress
          ? "Open Camera Overlay through Home Assistant."
          : `Camera Overlay ${preview ? "sample preview" : "setup"}: http://127.0.0.1:${port}/`,
      );
      if (!preview && process.argv.includes("--managed") && app.store.summary().ready)
        try {
          await app.runtime.start();
        } catch {
          console.log("Saved relay could not start. Open setup to check it.");
        }
    },
  );
  for (const sig of ["SIGINT", "SIGTERM"])
    process.on(sig, () => {
      app.runtime.stop();
      app.server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 2500).unref();
    });
}
module.exports = { createServer };
