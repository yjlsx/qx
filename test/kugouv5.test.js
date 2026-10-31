const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SCRIPT = fs.readFileSync(path.join(__dirname, "../rewrite/kg/kugouv5.js"), "utf8");
const HASH = "0123456789abcdef0123456789abcdef";
const TRACK = { name: "너나 해 (Egotistic)", artist: ["MAMAMOO"], id: "song-1" };
const AUDIO = "https://audio.example/song.mp3?token=audio-secret";
const metadata = { "server-md5": HASH, "content-length": "4000000" };

async function run(route, { cached = false, original = {} } = {}) {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const calls = [], logs = [], done = [], writes = [];
  const store = {
    ["kg_otter_meta_" + HASH]: JSON.stringify({ songName: TRACK.name, singername: "MAMAMOO" }),
  };
  if (cached) store["kg_otter_match_v6_128_" + HASH] = JSON.stringify({ ...TRACK, source: "netease", br: 128 });
  function timer(fn, delay) {
    const id = ++nextId;
    timers.set(id, { at: now + delay, fn });
    return id;
  }
  const context = {
    Date: class extends Date { static now() { return now; } },
    setTimeout: timer,
    clearTimeout: (id) => timers.delete(id),
    console: { log: (text) => logs.push({ at: now, text: String(text) }) },
    $request: { url: "https://gatewayretry.kugou.com/tracker/v5/url?hash=" + HASH +
      "&quality=128&key=request-secret&token=token-secret&userid=user-secret", headers: {} },
    $response: { body: JSON.stringify(original), headers: {} },
    $prefs: {
      valueForKey: (key) => store[key] || "",
      setValueForKey: (value, key) => { writes.push({ at: now, key }); store[key] = value; return true; },
    },
    $done: (value) => done.push({ at: now, value }),
    $task: { fetch: (options) => {
      const url = new URL(options.url);
      const kind = url.hostname === "music-api.gdstudio.xyz" ? url.searchParams.get("types") :
        url.hostname === "cache.api.joox.com" ? "search" :
        url.hostname === "api.joox.com" ? "url" :
        url.hostname === "u.y.qq.com" ? (JSON.parse(options.body).req_1.method === "DoSearchForQQMusicDesktop" ? "search" : "url") : "metadata";
      const source = url.searchParams.get("source") ||
        (url.hostname === "u.y.qq.com" ? "qq_direct" : url.hostname.includes("joox.com") ? "joox_direct" : "audio");
      const call = { ...options, at: now, kind, source };
      calls.push(call);
      const reply = route(call);
      if (reply.hang) return new Promise(() => {});
      return new Promise((resolve, reject) => timer(() => {
        if (reply.error) reject(new Error(reply.error));
        else resolve({ statusCode: reply.status || 200,
          body: typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body ?? {}), headers: reply.headers || {} });
      }, reply.delay || 0));
    } },
  };
  vm.runInNewContext("(function () {\n" + SCRIPT + "\n})()", context, { timeout: 1000 });
  // Drain promise chains between virtual timers, including cancelled late responses.
  for (let step = 0; step < 200; step++) {
    for (let flush = 0; flush < 60; flush++) await Promise.resolve();
    if (!timers.size) break;
    const [id, next] = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    timers.delete(id);
    now = next.at;
    next.fn();
  }
  assert.equal(done.length, 1, "Rewrite must finish exactly once, even with late responses");
  assert.ok(done[0].at <= 4000, "All requests, including metadata, must respect the total budget");
  const visible = logs.map((line) => line.text).join("\n");
  for (const secret of ["request-secret", "token-secret", "user-secret", "audio-secret"]) {
    assert.ok(!visible.includes(secret), "Sensitive URL values must not appear in logs");
  }
  assert.ok(logs.every((line) => line.at <= done[0].at), "Late workers must not write logs after $done");
  assert.ok(writes.every((write) => write.at <= done[0].at), "Late workers must not change cache after $done");
  return { calls, logs, visible, done: done[0], writes };
}

test("fast final source succeeds without waiting for earlier slow searches", async () => {
  const result = await run(({ kind, source }) => {
    if (kind === "metadata") return { delay: 50, headers: metadata };
    if (source === "joox" && kind === "search") return { delay: 100, body: [TRACK] };
    if (source === "joox" && kind === "url") return { delay: 100, body: { url: AUDIO, br: 128 } };
    return { delay: 1400, body: [] };
  });
  const body = JSON.parse(result.done.value.body);
  assert.equal(body.data.kg_otter_source, "joox");
  assert.equal(body.url[0], AUDIO);
  assert.equal(result.calls.filter((call) => call.kind === "search" && call.at === 0).length, 5);
  assert.ok(result.done.at < 1000);
  assert.equal(result.writes.length, 1, "Only the selected source is cached");
});

test("a hanging search cannot block another usable source", async () => {
  const result = await run(({ kind, source }) => {
    if (source === "netease") return { hang: true };
    if (kind === "metadata") return { headers: metadata };
    if (source === "kuwo") return { delay: 200, body: kind === "search" ? [TRACK] : { url: AUDIO, br: 128 } };
    return { body: [] };
  });
  assert.equal(JSON.parse(result.done.value.body).data.kg_otter_source, "kuwo");
});

test("all hanging sources finish with timeout diagnostics, not a no-URL verdict", async () => {
  const result = await run(() => ({ hang: true }));
  assert.equal(result.done.value.body, undefined);
  assert.match(result.visible, /超时/);
  assert.doesNotMatch(result.visible, /匹配到但无可用URL/);
});

test("hanging metadata requests cannot exceed the overall rewrite deadline", async () => {
  const result = await run(({ kind, source }) => {
    if (kind === "metadata") return { hang: true };
    if (source === "kuwo") return { delay: 1400, body: kind === "search" ? [TRACK] : { url: AUDIO, br: 128 } };
    return { body: [] };
  });
  assert.ok(result.calls.some((call) => call.kind === "metadata"));
});

test("a stale hanging cache leaves time for fresh source searches", async () => {
  const result = await run(({ kind, source }) => {
    if (source === "netease") return { hang: true };
    if (kind === "metadata") return { headers: metadata };
    if (source === "kuwo") return { delay: 100, body: kind === "search" ? [TRACK] : { url: AUDIO, br: 128 } };
    return { body: [] };
  }, { cached: true });
  assert.equal(JSON.parse(result.done.value.body).data.kg_otter_source, "kuwo");
  assert.ok(result.done.at < 2500);
  assert.doesNotMatch(result.visible, /缓存\(netease\):URL失效/);
});

test("true search misses are distinct from transport failures", async () => {
  const result = await run(() => ({ body: [] }));
  assert.equal(result.done.value.body, undefined);
  assert.match(result.visible, /搜索无结果/);
  assert.doesNotMatch(result.visible, /超时中断/);
});

test("transport errors do not leak signed request URLs", async () => {
  const result = await run(() => ({ error: "failed https://example.com?token=token-secret" }));
  assert.match(result.visible, /搜索.*失败|搜索报错/);
});

test("playable original response is preserved without source requests", async () => {
  const result = await run(() => { throw new Error("No fetch expected"); }, {
    original: { url: [AUDIO], bitRate: 128, fileSize: 4000000 },
  });
  assert.equal(result.calls.length, 0);
  assert.equal(result.done.value.body, undefined);
});

test("a slow Joox search is diagnosed as search timeout before URL lookup", async () => {
  const result = await run(({ source }) => source === "joox_direct" ? {
    delay: 4200, body: { tracks: [{ id: "slow-joox", name: TRACK.name, artist_list: [{ name: "MAMAMOO" }] }] },
  } : { body: [] });
  assert.match(result.visible, /joox_direct:搜索超时/);
  assert.doesNotMatch(result.visible, /匹配到但无可用URL/);
  assert.ok(!result.calls.some((call) => call.kind === "url"));
});

test("a hanging URL query is distinguished from an empty successful reply", async () => {
  for (const hang of [true, false]) {
    const result = await run(({ kind, source }) => {
      if (source !== "kuwo") return { body: [] };
      return kind === "search" ? { body: [TRACK] } : hang ? { hang: true } : { body: {} };
    });
    assert.match(result.visible, hang ? /kuwo:播放地址查询超时/ : /kuwo:匹配到但无可用URL/);
    if (hang) assert.doesNotMatch(result.visible, /匹配到但无可用URL/);
  }
});

test("only one completed source writes its cache when sources tie", async () => {
  const result = await run(({ kind, source }) => {
    if (kind === "metadata") return { headers: metadata };
    if (source === "netease" || source === "kuwo") return {
      delay: 100, body: kind === "search" ? [TRACK] : { url: AUDIO, br: 128 },
    };
    return { body: [] };
  });
  assert.ok(result.done.value.body);
  assert.equal(result.writes.length, 1);
});

test("a fast usable cache avoids searching every source", async () => {
  const result = await run(({ kind }) => kind === "metadata" ? { headers: metadata } :
    { body: { url: AUDIO, br: 128 } }, { cached: true });
  assert.ok(result.done.value.body);
  assert.ok(!result.calls.some((call) => call.kind === "search"));
});

test("search HTTP errors are reported as failures instead of empty catalogs", async () => {
  const result = await run(() => ({ status: 503, body: {} }));
  assert.match(result.visible, /搜索失败/);
  assert.match(result.visible, /HTTP 503/);
  assert.doesNotMatch(result.visible, /搜索无结果/);
});

test("a slow source can use the remaining total budget to finish", async () => {
  const result = await run(({ kind, source }) => {
    if (kind === "metadata") return { delay: 100, headers: metadata };
    if (source === "kuwo") return {
      delay: kind === "search" ? 2400 : 500,
      body: kind === "search" ? [TRACK] : { url: AUDIO, br: 128 },
    };
    return { hang: true };
  });
  assert.ok(result.done.value.body, "A successful request within the total deadline must not be cut short");
  assert.equal(JSON.parse(result.done.value.body).data.kg_otter_source, "kuwo");
});

test("Joox HTTP 404 identifies the failed URL lookup without claiming no matching song", async () => {
  const result = await run(({ kind, source }) => {
    if (source !== "joox_direct") return { body: [] };
    return kind === "search" ? { body: { tracks: [
      { id: "joox-1", name: TRACK.name, artist_list: [{ name: "MAMAMOO" }] },
    ] } } : { status: 404, body: "" };
  });
  assert.match(result.visible, /joox_direct:播放地址查询失败（HTTP 404）/);
  assert.doesNotMatch(result.visible, /joox_direct:匹配到但无可用URL|超时中断/);
});
