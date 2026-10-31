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

async function run({ values = PREFS, responses = [], request, writeFails = false, persistent = false,
  notifyFails = false, notifyAvailable = true } = {}) {
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
    $notify: (...args) => {
      calls.push({ type: "notify", args });
      if (notifyFails) throw new Error("notification error " + AUTH["x-token"]);
    },
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
  if (!notifyAvailable) delete context.$notify;
  if (persistent) context.$persistentStore = { read, write };
  else context.$prefs = { valueForKey: read, setValueForKey: write };
  if (request) context.$request = request;
  await vm.runInNewContext(fs.readFileSync(SCRIPT, "utf8"), context, { filename: SCRIPT, timeout: 1000 });
  assert.equal(calls.filter((entry) => entry.type === "done").length, 1, "$done must run once");
  const visible = JSON.stringify(calls.filter((entry) => entry.type === "log" || entry.type === "notify"));
  for (const secret of Object.values(AUTH)) assert.ok(!visible.includes(secret), "Credentials leaked");
  for (const notice of calls.filter((entry) => entry.type === "notify")) assert.equal(notice.args.length, 3);
  return { calls, store, visible,
    logs: calls.filter((entry) => entry.type === "log").map((entry) => entry.text),
    notices: calls.filter((entry) => entry.type === "notify").map((entry) => entry.args),
    posts: calls.filter((entry) => entry.type === "fetch" && entry.options.method === "POST") };
}

function assertNotice(result, subtitle, body) {
  assert.equal(result.notices.length, 1, "Each task must send exactly one final notification");
  assert.match(result.notices[0][1], subtitle);
  if (body) assert.match(result.notices[0][2], body);
}

function assertLogOrder(result, patterns) {
  let cursor = -1;
  for (const pattern of patterns) {
    cursor = result.logs.findIndex((line, index) => index > cursor && pattern.test(line));
    assert.ok(cursor >= 0, "Missing or out-of-order progress log: " + pattern);
  }
}

test("captures headers case-insensitively and preserves placeholder text", async () => {
  const result = await run({ values: {}, request: {
    url: ORIGIN + "/api/campaigns/streaks/status?campaignId=" + CAMPAIGN,
    headers: { "X-User-Id": AUTH["x-user-id"], "X-TOKEN": AUTH["x-token"], "X-Device-Id": AUTH["x-device-id"], Cookie: "ignore-cookie", Host: "ignore-host" },
  } });
  assert.deepEqual(JSON.parse(result.store.readify_auth), AUTH);
  assert.equal(result.store.readify_campaign_id, CAMPAIGN);
  assertNotice(result, /凭证已保存/);
  assertLogOrder(result, [/凭证抓取.*匹配/, /凭证完整/, /凭证已保存/]);
  const repeated = await run({ values: result.store, request: { url: ORIGIN + "/api/users", headers: AUTH } });
  assert.equal(repeated.calls.filter((entry) => entry.type === "notify").length, 0);
  assert.match(repeated.logs.join("\n"), /凭证未变化.*不重复通知/);
});

test("replaces account credentials together and captures campaign from POST", async () => {
  const result = await run({ request: {
    url: ORIGIN + "/api/campaigns/streaks",
    headers: { "x-user-id": "next-user", "x-token": "next-token", "x-device-id": "next-device" },
    body: JSON.stringify({ campaignId: "next-campaign" }),
  } });
  assert.deepEqual(JSON.parse(result.store.readify_auth), { "x-user-id": "next-user", "x-token": "next-token", "x-device-id": "next-device" });
  assert.equal(result.store.readify_campaign_id, "next-campaign");
  assertNotice(result, /凭证已更新/);
  assert.ok(["next-user", "next-token", "next-device"].every((secret) => !result.visible.includes(secret)));
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
  assertNotice(result, /凭证保存失败/);
});

test("checks in once with the HAR request contract", async () => {
  const result = await run({ responses: [ok(state()), ok(checked())] });
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].options.url, ORIGIN + "/api/campaigns/streaks");
  assert.deepEqual(JSON.parse(result.posts[0].options.body), { campaignId: CAMPAIGN });
  assert.equal(result.posts[0].options.headers["x-token"], AUTH["x-token"]);
  assert.match(result.visible, /签到成功/);
  assert.match(result.visible, /2\/7/);
  assertNotice(result, /签到成功/, /2\/7/);
});

test("does not POST when already checked in", async () => {
  const result = await run({ responses: [ok(checked())] });
  assert.equal(result.posts.length, 0);
  assert.match(result.visible, /今日已签到/);
  assertNotice(result, /今日已签到/, /2\/7/);
});

test("claims seventh-day rewards after checking in", async () => {
  const result = await run({ responses: [ok(state({ currentDay: 6, nextDay: 7 })),
    ok(checked({ currentDay: 7, nextDay: null, canClaim: true })),
    ok({ campaignId: CAMPAIGN, claimResult: "CLAIMED", rewardCount: 7, ultraHdDays: 3 })] });
  assert.equal(result.posts.length, 2);
  assert.equal(result.posts[1].options.url, ORIGIN + "/api/campaigns/streaks/reward-claims");
  assert.match(result.visible, /签到成功/);
  assert.match(result.visible, /领奖成功/);
  assertNotice(result, /签到成功.*领奖成功/, /7\/7.*奖励数量 7.*超高清权益 3 天/);
  assertLogOrder(result, [/签到已确认.*7\/7/, /\[4\/5\].*开始领取/, /领奖成功/, /任务结束/]);
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
  assertNotice(result, /待领奖/, /自动领奖已关闭/);
});

test("retains check-in success when reward collection fails", async () => {
  const result = await run({ responses: [ok(state({ currentDay: 6, nextDay: 7 })),
    ok(checked({ currentDay: 7, canClaim: true })),
    { statusCode: 200, body: JSON.stringify({ code: 500, message: AUTH["x-token"] }) }] });
  assert.match(result.visible, /签到成功/);
  assert.match(result.visible, /领奖失败/);
  assertNotice(result, /签到成功.*领奖失败/, /7\/7.*code=500/);
});

test("skips ended, waiting, and temporarily unavailable rounds", async () => {
  for (const data of [state({ activityStatus: "ENDED" }), state({ roundStatus: "ENDED" }),
    state({ roundStatus: "CLAIMED_WAITING", canCheckIn: false }), state({ canCheckIn: false })]) {
    const result = await run({ responses: [ok(data)] });
    assert.equal(result.posts.length, 0);
    assert.match(result.visible, /跳过/);
    assertNotice(result, /跳过/, /1\/7/);
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
  assertNotice(result, /已确认今日签到/, /2\/7/);
  assertLogOrder(result, [/提交签到/, /网络请求失败或超时/, /核验.*不重发/, /核验结果.*2\/7/, /任务结束/]);
});

test("does not report success when a POST outcome cannot be confirmed", async () => {
  const result = await run({ responses: [ok(state()), new Error("timeout"), ok(state())] });
  assert.equal(result.posts.length, 1);
  assert.match(result.visible, /失败/);
  assert.doesNotMatch(result.visible, /签到成功/);
  assertNotice(result, /签到失败/, /结果未确认.*未重发/);
});

test("rejects HTTP failures, invalid JSON, business errors, and malformed status", async () => {
  for (const response of [{ statusCode: 401, body: AUTH["x-token"] },
    { statusCode: 503, body: "unavailable" }, { statusCode: 200, body: "not-json" },
    { statusCode: 200, body: JSON.stringify({ code: 200000, message: AUTH["x-token"] }) },
    ok({}), ok(state({ campaignId: "unexpected" })), ok(state({ canCheckIn: "false" }))]) {
    const result = await run({ responses: [response] });
    assert.equal(result.posts.length, 0);
    assert.match(result.visible, /失败/);
    assertNotice(result, /签到失败/);
  }
});

test("does not request the API when disabled or auth is missing or malformed", async () => {
  for (const values of [{ ...PREFS, readify_enabled: false }, { ...PREFS, readify_enabled: "false" }, {}, { readify_auth: "invalid" }]) {
    const result = await run({ values });
    assert.equal(result.calls.filter((entry) => entry.type === "fetch").length, 0);
    assertNotice(result, /跳过|签到失败/, /停用|凭证/);
    assert.match(result.logs.at(-1), /任务结束.*耗时/);
  }
});

test("also reads credentials from the persistent-store API", async () => {
  const result = await run({ persistent: true, responses: [ok(checked())] });
  assert.equal(result.posts.length, 0);
  assert.match(result.visible, /今日已签到/);
});

test("logs check-in stages and state before and after the POST", async () => {
  const result = await run({ responses: [ok(state()), ok(checked())] });
  assertLogOrder(result, [/任务开始/, /\[1\/5\].*读取/, /凭证完整/,
    /\[2\/5\].*查询/, /查询结果.*1\/7.*今日未签到/,
    /\[3\/5\].*提交签到/, /签到已确认.*2\/7/,
    /\[4\/5\].*无需领奖/, /\[5\/5\].*签到成功/, /任务结束.*耗时/]);
  assert.ok(result.logs.every((line) => /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \[Readify\]/.test(line)));
  const getIndex = result.calls.findIndex((entry) => entry.type === "fetch" && entry.options.method === "GET");
  const postIndex = result.calls.findIndex((entry) => entry.type === "fetch" && entry.options.method === "POST");
  assert.ok(result.calls.slice(0, getIndex).some((entry) => entry.type === "log" && /查询/.test(entry.text)));
  assert.ok(result.calls.slice(getIndex + 1, postIndex).some((entry) => entry.type === "log" && /提交签到/.test(entry.text)));
  assert.ok(result.logs.some((line) => /HTTP 200.*耗时 \d+ ms/.test(line)));
});

test("logs the failed request stage and still notifies on authentication errors", async () => {
  const result = await run({ responses: [{ statusCode: 401, body: AUTH["x-token"] }] });
  assertNotice(result, /签到失败/, /凭证失效/);
  assertLogOrder(result, [/\[2\/5\].*查询/, /GET.*streaks\/status.*HTTP 401/, /签到失败/, /任务结束/]);
  assert.ok(!result.logs.some((line) => /提交签到/.test(line)));
});

test("logs missing capture field names without exposing captured values", async () => {
  const result = await run({ request: {
    url: ORIGIN + "/api/users",
    headers: { "x-user-id": AUTH["x-user-id"], "x-token": AUTH["x-token"] },
  } });
  assert.equal(result.notices.length, 0);
  assert.match(result.logs.join("\n"), /缺少.*x-device-id.*保留原配置/);
});

test("keeps results in logs when notification API fails or is missing", async () => {
  for (const options of [{ notifyFails: true }, { notifyAvailable: false }]) {
    const result = await run({ ...options, responses: [ok(checked())] });
    assert.equal(result.posts.length, 0);
    assert.match(result.logs.join("\n"), /今日已签到.*2\/7/);
    assert.match(result.logs.join("\n"), /通知发送失败|通知接口不可用/);
    assert.match(result.logs.at(-1), /任务结束/);
  }
});

test("logs reward reconciliation without retrying a lost claim POST", async () => {
  const result = await run({ responses: [ok(checked({ currentDay: 7, canClaim: true })),
    new Error("lost response " + AUTH["x-token"]),
    ok(checked({ currentDay: 7, roundStatus: "CLAIMED_WAITING" }))] });
  assert.equal(result.posts.length, 1);
  assertNotice(result, /领奖已确认/);
  assertLogOrder(result, [/\[4\/5\].*开始领取/, /领奖核验.*不重发/, /核验结果.*7\/7/, /领奖已确认/, /任务结束/]);
});
