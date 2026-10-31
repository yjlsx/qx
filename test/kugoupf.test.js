const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const SCRIPT = fs.readFileSync(path.join(ROOT, "rewrite/kg/kugoupf.js"), "utf8");
const LIST = "https://gateway.kugou.com/player/v1/model/list";
const SET = "https://gateway.kugou.com/vipdress/v1/record_rack/set_user_record_rack";
const ZIP = "https://vipimgbssdl.kugou.com/live-skin.zip";
const NOW = 1800000000000;
const rejected = () => ({ status: 0, errcode: 2001, errmsg: "No resource", data: {} });

function listing(id = 9001, version = 2, url = ZIP) {
  return { status: 1, errcode: 0, data: { list: [{
    record_id: 8888, theme_id: String(id), theme_type: "5", version: 2,
    theme_content_5: { record_rack_id: id, record_rack_version: version,
      record_rack_url: url, play_version: 2, auto_effect: 1, extend: "{}" },
  }] } };
}

async function run({ url = LIST, response = listing(), store = {}, now = NOW, body,
  storageFails = false, noStorage = false, statusCode = 200 } = {}) {
  const calls = [], done = [], logs = [], writes = [];
  const original = typeof response === "string" ? response : JSON.stringify(response);
  const context = {
    Date: class extends Date { static now() { return now; } },
    console: { log: message => logs.push(String(message)) },
    $request: { url, body, headers: {} },
    $response: { body: original, statusCode, headers: {} },
    $done: value => done.push(value),
    $task: { fetch: options => { calls.push(options); return Promise.resolve({ statusCode: 200, body: "{}" }); } },
  };
  if (!noStorage) context.$prefs = {
    valueForKey: key => store[key] || "",
    setValueForKey: (value, key) => {
      if (storageFails) return false;
      store[key] = value; writes.push(key); return true;
    },
  };
  vm.runInNewContext("(function(){\n" + SCRIPT + "\n})()", context, { timeout: 1000 });
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(done.length, 1, "Every invocation must finish exactly once");
  assert.equal(calls.length, 0, "No GitHub or other background network request is allowed");
  return { output: done[0], data: JSON.parse(done[0].body || original), logs: logs.join("\n"), store, writes };
}

test("uncached skins retain the original failure without GitHub requests", async () => {
  const result = await run({ url: SET + "?record_rack_id=9001", response: rejected() });
  assert.deepEqual(result.data, rejected());
  assert.match(result.logs, /无.*资源|未.*缓存|未.*地址/);
});

test("a new nested live resource works across invocations and keeps animation metadata", async () => {
  const store = {};
  const captured = await run({ store });
  assert.ok(captured.writes.length);
  assert.equal(captured.data.data.list[0].theme_type, "5");
  const result = await run({ url: SET + "?record_rack_id=9001", response: rejected(), store });
  assert.equal(result.data.data.record_rack_url, ZIP);
  assert.equal(result.data.data.record_rack_version, 2);
  assert.equal(result.data.data.play_version, 2);
  assert.equal(result.data.data.auto_effect, 1);
  assert.equal(result.data.status, 1);
  assert.match(result.logs, /本地缓存/);
});

test("catalog record_id must not alias a different nested record_rack_id", async () => {
  const store = {}; await run({ store });
  const result = await run({ url: SET + "?record_rack_id=8888", response: rejected(), store });
  assert.deepEqual(result.data, rejected());
});

test("a native URL wins over cache and refreshes the resource", async () => {
  const store = {}; await run({ store });
  const fresh = ZIP.replace("live-skin", "new-skin");
  const native = { status: 1, data: { record_rack_url: fresh, record_rack_version: 3, play_version: 4 } };
  const result = await run({ url: SET + "?record_rack_id=9001", response: native, store });
  assert.equal(result.data.data.record_rack_url, fresh);
  assert.equal(result.data.data.play_version, 4);
  const reused = await run({ url: SET + "?record_rack_id=9001", response: rejected(), store });
  assert.equal(reused.data.data.record_rack_url, fresh);
});

test("new versions replace old resources while stale list pages cannot roll them back", async () => {
  const store = {};
  await run({ response: listing(9001, 3, ZIP + "?v=3"), store });
  await run({ response: listing(9001, 2, ZIP + "?v=2"), store, now: NOW + 1000 });
  const result = await run({ url: SET + "?record_rack_id=9001", response: rejected(), store, now: NOW + 2000 });
  assert.equal(result.data.data.record_rack_url, ZIP + "?v=3");
});

test("a newly observed version without a URL invalidates an older cached package", async () => {
  const store = {}; await run({ store });
  await run({ store, response: listing(9001, 3, ""), now: NOW + 1000 });
  const result = await run({ url: SET + "?record_rack_id=9001", response: rejected(), store, now: NOW + 2000 });
  assert.deepEqual(result.data, rejected());
});

test("JSON and form request bodies can identify the selected rack", async () => {
  const store = {}; await run({ store });
  for (const body of [JSON.stringify({ record_rack_id: 9001 }), "record_rack_id=9001&token=request-secret"]) {
    const result = await run({ url: SET, body, response: rejected(), store });
    assert.equal(result.data.data.record_rack_url, ZIP);
    assert.ok(!result.logs.includes("request-secret"));
  }
});

test("signed and old unsigned resource URLs expire instead of persisting forever", async () => {
  for (const [url, elapsed] of [[ZIP, 8 * 86400000], [ZIP + "?token=resource-secret", 2 * 3600000]]) {
    const store = {}; await run({ response: listing(9001, 2, url), store });
    const result = await run({ url: SET + "?record_rack_id=9001", response: rejected(), store, now: NOW + elapsed });
    assert.deepEqual(result.data, rejected());
    assert.ok(!result.logs.includes("resource-secret"));
  }
});

test("explicit URL expiry is honored even within the signed-URL cache lifetime", async () => {
  const store = {};
  await run({ response: listing(9001, 2, ZIP + "?expires=" + (NOW / 1000 + 60)), store });
  const result = await run({ url: SET + "?record_rack_id=9001", response: rejected(), store, now: NOW + 61000 });
  assert.deepEqual(result.data, rejected());
});

test("malformed, HTTP-failed and unrelated responses pass through exactly once", async () => {
  for (const options of [
    { url: SET, response: "{bad" }, { url: LIST, response: "{bad" },
    { url: LIST, response: null }, { url: SET, response: rejected(), statusCode: 503 },
    { url: "https://example.com/player/v1/model/list", response: listing() },
  ]) {
    if (typeof options.response === "string") {
      // JSON parsing the output is not appropriate for malformed passthrough bodies.
      const valid = options.response;
      const local = SCRIPT; const done = [];
      vm.runInNewContext("(function(){\n" + local + "\n})()", {
        $request: { url: options.url }, $response: { body: valid },
        console: { log() {} }, $done: value => done.push(value),
      });
      assert.equal(done.length, 1); assert.equal(done[0].body, undefined);
    } else {
      const result = await run(options);
      assert.equal(result.output.body, undefined);
      assert.equal(result.writes.length, 0);
    }
  }
});

test("a successful built-in skin without a ZIP remains unchanged", async () => {
  const original = { status: 1, errcode: 0, data: { record_rack_id: 0, is_set: 1 } };
  const result = await run({ url: SET + "?record_rack_id=0", response: original });
  assert.deepEqual(result.data, original);
});

test("missing or failing storage does not block native resources or claim a successful cache write", async () => {
  for (const options of [{ noStorage: true }, { storageFails: true }]) {
    const captured = await run(options);
    assert.equal(captured.writes.length, 0);
    assert.match(captured.logs, /缓存.*失败|存储.*不可用/);
    const result = await run({ ...options, url: SET, response: { status: 1, data: { record_rack_url: ZIP } } });
    assert.equal(result.data.data.record_rack_url, ZIP);
  }
});

test("direct rack lists are collected on alternate Kugou hosts", async () => {
  for (const url of [
    "https://vipdress.kugou.com/v1/record_rack/get_record_rack_list",
    "https://gatewayretry.kugou.com/vipdress/v1/record_rack/get_record_rack_list",
    "https://gateway3.kugou.com/player/v1/model/list",
  ]) {
    const store = {};
    await run({ url, store, response: { status: 1, data: { record_rack: [
      { record_rack_id: 9001, record_rack_url: ZIP, record_rack_version: 2 },
    ] } } });
    const result = await run({ url: SET + "?record_rack_id=9001", response: rejected(), store });
    assert.equal(result.data.data.record_rack_url, ZIP);
  }
});

test("untrusted URLs, hash-only entries and theme IDs cannot become a downloadable rack", async () => {
  for (const entry of [
    { record_rack_id: 9001, record_rack_url: "https://kugou.com.evil.example/a.zip" },
    { record_rack_id: 9001, file_hash: "0123456789abcdef0123456789abcdef" },
    { theme_id: 9001, record_rack_url: ZIP },
  ]) {
    const store = {};
    await run({ response: { status: 1, data: { list: [entry] } }, store });
    const result = await run({ url: SET + "?record_rack_id=9001", response: rejected(), store });
    assert.deepEqual(result.data, rejected());
  }
});

test("signed resource URLs and unrelated account fields stay out of logs and cached metadata", async () => {
  const payload = listing(9001, 2, ZIP + "?token=resource-secret");
  payload.data.token = "account-secret";
  const captured = await run({ response: payload });
  assert.ok(!captured.logs.includes("resource-secret"));
  assert.ok(!JSON.stringify(captured.store).includes("account-secret"));
});

test("both import rule blocks route live lists and selection checks to the cache script", () => {
  for (const filename of ["rewrite/kugou.js", "rewrite/kg/kugoupf.js"]) {
    const content = fs.readFileSync(path.join(ROOT, filename), "utf8");
    const rules = content.split(/\r?\n/).filter(line => line.startsWith("^") && line.endsWith("/kg/kugoupf.js"));
    for (const url of [LIST, SET + "?record_rack_id=9001",
      "https://vipdress.kugou.com/v1/record_rack/get_record_rack_list",
      "https://gatewayretry.kugou.com/vipdress/v1/record_rack/set_record_rack_check?id=9001"]) {
      assert.ok(rules.some(line => new RegExp(line.split(" url " )[0]).test(url)), filename + " misses " + url);
    }
  }
});
