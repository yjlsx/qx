const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SCRIPT = path.join(__dirname, "..", "task", "readify.js");
const ORIGIN = "https://readifyapp.voiceclub.cn";
const CAMPAIGN = "reading-streak-7d-202607";
const AUTH = {
  "x-user-id": "{{NAME_ab12cd34}}",
  "x-token": "test-secret-token",
  "x-device-id": "test-secret-device",
};
const PREFS = { readify_auth: JSON.stringify(AUTH) };

function state(overrides = {}) {
  return {
    campaignId: CAMPAIGN,
    activityStatus: "ACTIVE",
    roundStatus: "IN_PROGRESS",
    currentDay: 1,
    nextDay: 2,
    streakedToday: false,
    canCheckIn: true,
    canClaim: false,
    ...overrides,
  };
}

function checked(overrides = {}) {
  return state({ currentDay: 2, nextDay: 3, streakedToday: true,
    canCheckIn: false, checkInResult: "CHECKED_IN", ...overrides });
}

function ok(data) {
  return { statusCode: 200, body: JSON.stringify({ code: 0, data }) };
}

async function run({ values = PREFS, responses = [], request, writeFails = false, persistent = false } = {}) {
  const calls = [];
  const store = { ...values };
  const read = (key) => store[key] ?? "";
  const write = (value, key) => {
    if (writeFails) return false;
    store[key] = value;
    return true;
  };
  const context = {
    console: { log: (...args) => calls.push({ type: "log", text: args.join(" ") }) },
    $notify: (...args) => calls.push({ type: "notify", args }),
    $done: (...args) => calls.push({ type: "done", args }),
    $task: {
      fetch: async (options) => {
        calls.push({ type: "fetch", options });
        assert.ok(responses.length, "Unexpected additional API request");
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next;
      },
    },
  };
  if (persistent) context.$persistentStore = { read, write };
  else context.$prefs = { valueForKey: read, setValueForKey: write };
  if (request) context.$request = request;
  await vm.runInNewContext(fs.readFileSync(SCRIPT, "utf8"), context, { filename: SCRIPT, timeout: 1000 });
  assert.equal(calls.filter((entry) => entry.type === "done").length, 1, "$done must run once");
  const visible = JSON.stringify(calls.filter((entry) => entry.type === "log" || entry.type === "notify"));
  for (const secret of Object.values(AUTH)) assert.ok(!visible.includes(secret), "Credentials leaked");
  for (const notice of calls.filter((entry) => entry.type === "notify")) assert.equal(notice.args.length, 3);
  return { calls, store, visible,
    posts: calls.filter((entry) => entry.type === "fetch" && entry.options.method === "POST") };
}

test("captures headers case-insensitively and preserves placeholder text", async () => {
  const result = await run({ values: {}, request: {
    url: ORIGIN + "/api/campaigns/streaks/status?campaignId=" + CAMPAIGN,
    headers: { "X-User-Id": AUTH["x-user-id"], "X-TOKEN": AUTH["x-token"], "X-Device-Id": AUTH["x-device-id"], Cookie: "ignore-cookie", Host: "ignore-host" },
  } });
  assert.deepEqual(JSON.parse(result.store.readify_auth), AUTH);
  assert.equal(result.store.readify_campaign_id, CAMPAIGN);
  assert.match(result.visible, /凭证已保存/);
  const repeated = await run({ values: result.store, request: { url: ORIGIN + "/api/users", headers: AUTH } });
  assert.equal(repeated.calls.filter((entry) => entry.type === "notify").length, 0);
});

test("replaces account credentials together and captures campaign from POST", async () => {
  const result = await run({ request: {
    url: ORIGIN + "/api/campaigns/streaks",
    headers: { "x-user-id": "next-user", "x-token": "next-token", "x-device-id": "next-device" },
    body: JSON.stringify({ campaignId: "next-campaign" }),
  } });
  assert.deepEqual(JSON.parse(result.store.readify_auth), { "x-user-id": "next-user", "x-token": "next-token", "x-device-id": "next-device" });
  assert.equal(result.store.readify_campaign_id, "next-campaign");
});

test("ignores incomplete captures and unrelated URLs", async () => {
  for (const request of [
    { url: ORIGIN + "/api/users", headers: { "x-user-id": "other-user", "x-token": "other-token" } },
    { url: "https://example.com/api/users", headers: AUTH },
    { url: ORIGIN + "/api/unrelated", headers: AUTH },
  ]) {
    const result = await run({ request });
    assert.equal(result.store.readify_auth, PREFS.readify_auth);
    assert.equal(result.posts.length, 0);
  }
});

test("reports storage failure without claiming credentials were saved", async () => {
  const result = await run({ values: {}, writeFails: true, request: { url: ORIGIN + "/api/users", headers: AUTH } });
  assert.match(result.visible, /保存失败/);
  assert.doesNotMatch(result.visible, /凭证已保存/);
});

test("checks in once with the HAR request contract", async () => {
  const result = await run({ responses: [ok(state()), ok(checked())] });
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].options.url, ORIGIN + "/api/campaigns/streaks");
  assert.deepEqual(JSON.parse(result.posts[0].options.body), { campaignId: CAMPAIGN });
  assert.equal(result.posts[0].options.headers["x-token"], AUTH["x-token"]);
  assert.match(result.visible, /签到成功/);
  assert.match(result.visible, /2\/7/);
});

test("does not POST when already checked in", async () => {
  const result = await run({ responses: [ok(checked())] });
  assert.equal(result.posts.length, 0);
  assert.match(result.visible, /今日已签到/);
});

test("claims seventh-day rewards after checking in", async () => {
  const result = await run({ responses: [ok(state({ currentDay: 6, nextDay: 7 })),
    ok(checked({ currentDay: 7, nextDay: null, canClaim: true })),
    ok({ campaignId: CAMPAIGN, claimResult: "CLAIMED", rewardCount: 7, ultraHdDays: 3 })] });
  assert.equal(result.posts.length, 2);
  assert.equal(result.posts[1].options.url, ORIGIN + "/api/campaigns/streaks/reward-claims");
  assert.match(result.visible, /签到成功/);
  assert.match(result.visible, /领奖成功/);
});

test("claims pending rewards even if already checked in today", async () => {
  const result = await run({ responses: [ok(checked({ currentDay: 7, canClaim: true })),
    ok({ campaignId: CAMPAIGN, claimResult: "CLAIMED", rewardCount: 0, ultraHdDays: null })] });
  assert.equal(result.posts.length, 1);
  assert.match(result.posts[0].options.url, /reward-claims$/);
  assert.match(result.visible, /领奖成功/);
  assert.match(result.visible, /奖励数量 0/);
});

test("can leave rewards for manual collection", async () => {
  const result = await run({ values: { ...PREFS, readify_auto_claim: false }, responses: [ok(checked({ currentDay: 7, canClaim: true }))] });
  assert.equal(result.posts.length, 0);
  assert.match(result.visible, /待领奖/);
});

test("retains check-in success when reward collection fails", async () => {
  const result = await run({ responses: [ok(state({ currentDay: 6, nextDay: 7 })),
    ok(checked({ currentDay: 7, canClaim: true })),
    { statusCode: 200, body: JSON.stringify({ code: 500, message: AUTH["x-token"] }) }] });
  assert.match(result.visible, /签到成功/);
  assert.match(result.visible, /领奖失败/);
});

test("skips ended, waiting, and temporarily unavailable rounds", async () => {
  for (const data of [state({ activityStatus: "ENDED" }), state({ roundStatus: "ENDED" }),
    state({ roundStatus: "CLAIMED_WAITING", canCheckIn: false }), state({ canCheckIn: false })]) {
    const result = await run({ responses: [ok(data)] });
    assert.equal(result.posts.length, 0);
    assert.match(result.visible, /跳过/);
  }
});

test("confirms a concurrent claim before reporting the waiting state", async () => {
  const claimed = ok(checked({ currentDay: 7, roundStatus: "CLAIMED_WAITING" }));
  const alreadyClaimed = { statusCode: 200, body: JSON.stringify({ code: 240010 }) };
  for (const initial of [state(), checked({ currentDay: 7, canClaim: true })]) {
    const result = await run({ responses: [ok(initial), alreadyClaimed, claimed] });
    assert.equal(result.posts.length, 1);
    assert.match(result.visible, /等待下一轮|领奖已确认/);
    assert.doesNotMatch(result.visible, /签到失败|领奖失败/);
  }
  const unconfirmed = await run({ responses: [ok(state()), alreadyClaimed, ok(state())] });
  assert.match(unconfirmed.visible, /签到失败/);
  assert.doesNotMatch(unconfirmed.visible, /签到成功|领奖已确认/);
});

test("reconciles a lost response using GET and never retries POST", async () => {
  const result = await run({ responses: [ok(state()), new Error("transport contains " + AUTH["x-token"]), ok(checked())] });
  assert.equal(result.posts.length, 1);
  assert.match(result.visible, /已确认今日签到/);
});

test("does not report success when a POST outcome cannot be confirmed", async () => {
  const result = await run({ responses: [ok(state()), new Error("timeout"), ok(state())] });
  assert.equal(result.posts.length, 1);
  assert.match(result.visible, /失败/);
  assert.doesNotMatch(result.visible, /签到成功/);
});

test("rejects HTTP failures, invalid JSON, business errors, and malformed status", async () => {
  for (const response of [{ statusCode: 401, body: AUTH["x-token"] },
    { statusCode: 503, body: "unavailable" }, { statusCode: 200, body: "not-json" },
    { statusCode: 200, body: JSON.stringify({ code: 200000, message: AUTH["x-token"] }) },
    ok({}), ok(state({ campaignId: "unexpected" })), ok(state({ canCheckIn: "false" }))]) {
    const result = await run({ responses: [response] });
    assert.equal(result.posts.length, 0);
    assert.match(result.visible, /失败/);
  }
});

test("does not request the API when disabled or auth is missing or malformed", async () => {
  for (const values of [{ ...PREFS, readify_enabled: false }, { ...PREFS, readify_enabled: "false" }, {}, { readify_auth: "invalid" }]) {
    const result = await run({ values });
    assert.equal(result.calls.filter((entry) => entry.type === "fetch").length, 0);
  }
});

test("also reads credentials from the persistent-store API", async () => {
  const result = await run({ persistent: true, responses: [ok(checked())] });
  assert.equal(result.posts.length, 0);
  assert.match(result.visible, /今日已签到/);
});
