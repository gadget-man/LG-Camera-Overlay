"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  http = require("node:http");
const { Store, panel } = require("../setup/store.cjs"),
  { profile, bundle } = require("../setup/deployment.cjs"),
  { createServer } = require("../setup/server.cjs"),
  { host } = require("../setup/devices.cjs"),
  { haConnect, haLaunch } = require("../setup/runtime.cjs");
test("isolated lab mode never targets the production TV app", (t) => {
  const before = process.env.OVERLAY_TEST_APP;
  try {
    process.env.OVERLAY_TEST_APP = "1";
    const store = seed(t);
    const body = {camera:"entrance",tv:"living_room",entity:"media_player.test"};
    assert.equal(store.launch(body).payload.id, "com.mbs.cameraoverlaytest");
    assert.equal(store.blueprint(body).use_blueprint.input.app_id, "com.mbs.cameraoverlaytest");
  } finally {
    if (before === undefined) delete process.env.OVERLAY_TEST_APP;
    else process.env.OVERLAY_TEST_APP = before;
  }
});
function temp(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "overlay-setup-test-"));
  t.after(() => {
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
    assert.ok(path.basename(resolved).startsWith("overlay-setup-test-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return root;
}
function seed(t) {
  const s = new Store(temp(t));
  s.camera({
    id: "entrance",
    url: "rtsp://192.0.2.5/private-camera-secret",
    revision: s.revision(),
  });
  s.tv(
    {
      id: "living_room",
      host: "192.168.1.50",
      passphrase: "private-pair-secret",
      fingerprint: "a".repeat(64),
      revision: s.revision(),
    },
    Buffer.from("PRIVATE TEST KEY"),
  );
  return s;
}
const input = {
  host: "windows",
  haLocation: "elsewhere",
  camera: "entrance",
  tv: "living_room",
  entity: "media_player.lg_tv",
  label: "Entrance",
  width: 42,
  duration: 30,
};
test("save preserves existing cameras/TVs/token and backup; stale edits do not overwrite", (t) => {
  const s = seed(t),
    before = s.read(),
    revision = s.revision();
  s.camera({ id: "drive", url: "rtsps://192.0.2.9/secret", revision });
  assert.equal(s.read().token, before.token);
  assert.deepEqual(s.read().tvs, before.tvs);
  assert.equal(s.read().sources.entrance, before.sources.entrance);
  assert.throws(
    () => s.camera({ id: "stale", url: "rtsp://192.0.2.5/x", revision }),
    /changed/,
  );
  assert.equal(
    JSON.parse(fs.readFileSync(s.file + ".before-setup")).token,
    before.token,
  );
});
test("summary and layout export omit secrets; private bundle includes only required selected files", (t) => {
  const s = seed(t);
  const summary = JSON.stringify(s.summary()),
    p = JSON.stringify(
      profile({ ...input, token: s.read().token, url: "private-secret" }),
    );
  for (const text of [summary, p]) {
    assert.ok(!text.includes(s.read().token));
    assert.ok(!text.includes("private-camera-secret"));
    assert.ok(!text.includes("private-pair-secret"));
  }
  const bytes = bundle(s, input);
  assert.equal(bytes.readUInt32LE(0), 0x04034b50);
  assert.ok(bytes.includes(Buffer.from("private/config.json")));
  assert.ok(bytes.includes(Buffer.from("private-camera-secret")));
  assert.ok(!bytes.includes(Buffer.from("before-setup")));
  assert.equal(
    s.blueprint(input).use_blueprint.input.stream,
    s.route("entrance", "living_room"),
  );
});
test("identifiers, URLs, labels and addresses reject unsafe inputs", (t) => {
  const s = seed(t);
  assert.throws(() =>
    s.camera({
      id: "../escape",
      url: "rtsp://192.0.2.1/x",
      revision: s.revision(),
    }),
  );
  assert.throws(() =>
    s.camera({ id: "x", url: "file:///etc/passwd", revision: s.revision() }),
  );
  assert.throws(() => panel({ label: "x\ny", width: 42, duration: 30 }));
  for (const ip of [
    "127.0.0.1",
    "169.254.169.254",
    "8.8.8.8",
    "192.168.1.2;id",
  ])
    assert.throws(() => host(ip));
  assert.equal(host("192.168.1.50"), "192.168.1.50");
  assert.throws(() => s.launch({ ...input, entity: "switch.office" }));
});
test("panel appearance options default safely and reach the launch and blueprint", (t) => {
  const s = seed(t);
  assert.deepEqual(panel({}), {
    label: "Entrance",
    width: 42,
    duration: 30,
    position: "top-right",
    borderColor: "#67dfad",
    compact: false,
    margin: 3,
    border: true,
    fps: true,
  });
  const look = {
    position: "bottom-left",
    borderColor: "#FF8800",
    compact: true,
    margin: 0,
    border: false,
    fps: false,
  };
  assert.deepEqual(panel(look), {
    ...panel({}),
    ...look,
    borderColor: "#ff8800",
  });
  for (const bad of [
    { position: "top" },
    { position: "javascript:x" },
    { borderColor: "red" },
    { borderColor: "#ff8800;background:url(x)" },
    { compact: "yes" },
    { margin: 11 },
    { margin: 2.5 },
    { margin: "3vw" },
    { border: "no" },
    { fps: "off" },
  ])
    assert.throws(() => panel(bad), /position|colour|compact/);
  const body = { ...input, ...look };
  assert.equal(s.launch(body).payload.params.position, "bottom-left");
  assert.equal(s.launch(body).payload.params.compact, true);
  assert.equal(s.launch(body).payload.params.border, false);
  assert.equal(s.blueprint(body).use_blueprint.input.margin, 0);
  assert.equal(s.blueprint(body).use_blueprint.input.borderColor, "#ff8800");
  assert.equal(s.blueprint(body).use_blueprint.input.fps, false);
  assert.equal(profile(body).panel.position, "bottom-left");
});
async function server(t, opts = {}) {
  const app = createServer({
    root: temp(t),
    runtime: {
      stop() {},
      async status() {
        return { reachable: false };
      },
      async tools() {
        return {};
      },
      async camera() {
        return { decoded: true };
      },
    },
    ...opts,
  });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  t.after(
    () =>
      new Promise((r) => {
        app.server.closeAllConnections();
        app.server.close(r);
      }),
  );
  const base = "http://127.0.0.1:" + app.server.address().port;
  const html = await (await fetch(base)).text(),
    session = html.match(/name="setup-session" content="([a-f0-9]+)"/)[1];
  return {
    ...app,
    base,
    session,
    async post(route, value, extra = {}) {
      return fetch(base + "/api/" + route, {
        method: "POST",
        headers: {
          "x-setup-session": session,
          "Content-Type": "application/json",
          ...extra,
        },
        body: JSON.stringify(value),
      });
    },
  };
}
test("API requires local Host, matching Origin and setup-session token", async (t) => {
  const s = await server(t);
  assert.equal((await fetch(s.base + "/api/state")).status, 403);
  assert.equal(
    (await s.post("camera", {}, { "x-setup-session": "wrong" })).status,
    403,
  );
  assert.equal(
    (await s.post("camera", {}, { origin: "https://attacker.example" })).status,
    403,
  );
  const hostCode = await new Promise((resolve, reject) => {
    const req = http.get(
      s.base,
      { headers: { host: "attacker.example" } },
      (r) => {
        r.resume();
        resolve(r.statusCode);
      },
    );
    req.on("error", reject);
  });
  assert.equal(hostCode, 403);
  assert.equal((await fetch(s.base + "/private/config.json")).status, 404);
});
test("sample preview is isolated even if private settings exist", async (t) => {
  const store = seed(t),
    s = await server(t, { store, preview: true });
  const text = await (
    await fetch(s.base + "/api/state", {
      headers: { "x-setup-session": s.session },
    })
  ).text();
  assert.ok(text.includes("Sample only"));
  assert.ok(!text.includes(store.root));
  const revision = store.revision();
  assert.equal(
    (await s.post("camera", { id: "x", url: "rtsp://192.0.2.1/x", revision }))
      .status,
    400,
  );
  assert.equal(store.revision(), revision);
  assert.equal((await s.post("profile", input)).status, 200);
});
test("pairing requires an explicit matching fingerprint and revision, and retains secrets server-side", async (t) => {
  let verified = 0;
  const adapter = {
    profiles: () => [],
    prepare: async () => ({
      host: "192.168.1.50",
      key: Buffer.from("SECRET KEY"),
      passphrase: "SECRET PASS",
      fingerprint: "b".repeat(64),
    }),
    verify: async () => {
      verified++;
      return { modelName: "Sample LG" };
    },
  };
  const s = await server(t, { devices: adapter });
  const r = await s.post("pair/prepare", {
    id: "lounge",
    host: "192.168.1.50",
    passphrase: "x",
    revision: "new",
  });
  const p = await r.json();
  assert.ok(!JSON.stringify(p).includes("SECRET"));
  assert.equal(
    (
      await s.post("pair/confirm", {
        fingerprint: p.fingerprint,
        confirm: false,
      })
    ).status,
    400,
  );
  assert.equal(verified, 0);
  assert.equal(
    (
      await s.post("pair/confirm", {
        fingerprint: p.fingerprint,
        confirm: true,
      })
    ).status,
    200,
  );
  assert.equal(verified, 1);
  assert.equal(s.store.read().tvs.lounge.hostKeySha256, p.fingerprint);
});
test("raw device errors never reach API responses", async (t) => {
  const s = await server(t, {
    devices: {
      profiles: () => [],
      prepare: async () => {
        throw Error("rtsp://private:password@192.168.1.20/secret");
      },
    },
  });
  const r = await s.post("pair/prepare", {
    id: "lounge",
    host: "192.168.1.50",
    passphrase: "x",
    revision: "new",
  });
  assert.equal(r.status, 502);
  assert.ok(!(await r.text()).includes("password"));
});
test("TV test is explicit, uses known selected entity, and does not create automations", async (t) => {
  const store = seed(t);
  let calls = 0;
  const s = await server(t, {
    store,
    haConnect: async () => ({
      entities: [{ id: input.entity }],
      base: "http://example",
      token: "private-ha",
    }),
    haLaunch: async (c, p) => {
      calls++;
      assert.equal(p.entity_id, input.entity);
      assert.equal(
        p.payload.params.stream,
        store.route(input.camera, input.tv),
      );
      return { accepted: true };
    },
  });
  assert.equal(
    (await s.post("ha/test", { ...input, confirm: true })).status,
    400,
  );
  await s.post("ha/connect", {});
  assert.equal((await s.post("ha/test", input)).status, 400);
  assert.equal(
    (
      await s.post("ha/test", {
        ...input,
        entity: "media_player.other",
        confirm: true,
      })
    ).status,
    400,
  );
  assert.equal(calls, 0);
  assert.equal(
    (await s.post("ha/test", { ...input, confirm: true })).status,
    200,
  );
  assert.equal(calls, 1);
  await s.post("ha/disconnect", {});
  assert.equal(
    (await s.post("ha/test", { ...input, confirm: true })).status,
    400,
  );
});
test("ingress rejects connections that bypass Supervisor", async (t) => {
  const app = createServer({ root: temp(t), ingress: true });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  t.after(
    () =>
      new Promise((r) => {
        app.server.closeAllConnections();
        app.server.close(r);
      }),
  );
  assert.equal(
    (await fetch("http://127.0.0.1:" + app.server.address().port)).status,
    403,
  );
});
test("HA read-only discovery, active-TV guard, and launch use expected routes", async (t) => {
  let active = false;
  const requests = [];
  const fake = http.createServer((req, res) => {
    requests.push(req.method + " " + req.url);
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/states")
      res.end(
        JSON.stringify([
          {
            entity_id: input.entity,
            attributes: { friendly_name: "Test TV", secret: "do not return" },
          },
        ]),
      );
    else if (req.url.startsWith("/api/states/"))
      res.end(JSON.stringify({ state: active ? "playing" : "off" }));
    else res.end("[]");
  });
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));
  t.after(
    () =>
      new Promise((r) => {
        fake.closeAllConnections();
        fake.close(r);
      }),
  );
  const connection = await haConnect({
    url: "http://127.0.0.1:" + fake.address().port,
    token: "x".repeat(32),
    allowHttp: true,
  });
  assert.deepEqual(connection.entities, [
    { id: input.entity, label: "Test TV" },
  ]);
  const store = seed(t);
  await assert.rejects(
    () => haLaunch(connection, store.launch(input)),
    /off or unavailable/,
  );
  assert.ok(!requests.some((r) => r.startsWith("POST")));
  active = true;
  await haLaunch(connection, store.launch(input));
  assert.equal(requests.at(-1), "POST /api/services/webostv/command");
});
