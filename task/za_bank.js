/*
ZA Bank签到

[rewrite_local]
^https:\/\/bankappgw\.za\.group\/dmb\/nsjkd\/week\/sign\/list url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/za_bank.js
^https:\/\/bankappgw\.za\.group\/dmb\/t95n10\/signIn\/tips url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/za_bank.js
^https:\/\/bankappgw\.za\.group\/dmb\/nsjkgu\/user\/quest\/(?:list|group\/list|popup\/grouping\/list) url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/za_bank.js
^https:\/\/bankappgw\.za\.group\/dmb\/ns3gf\/user\/collection\/count url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/za_bank.js
^https:\/\/bankappgw\.za\.group\/dmb\/nvpexa\/collection\/exchange\/status\/prizeId url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/za_bank.js

[task_local]
10 9 * * * https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/za_bank.js
, tag=ZA Bank 签到, enabled=true

[mitm]
hostname = bankappgw.za.group

*/

const TITLE = "ZA Bank 签到";

const KEYS = {
  auth: "ZA_SIGN_AUTH_REQ",
  list: "ZA_SIGN_LIST_REQ",
  tips: "ZA_SIGN_TIPS_REQ",
  claim: "ZA_SIGN_CLAIM_REQ",
  last: "ZA_SIGN_LAST_REQ",
};

const READ_PATHS = [
  "/dmb/nsjkd/week/sign/list",
  "/dmb/t95n10/signIn/tips",
  "/dmb/nsjkgu/user/quest/list",
  "/dmb/nsjkgu/user/quest/group/list",
  "/dmb/nsjkgu/user/quest/popup/grouping/list",
  "/dmb/ns3gf/user/collection/count",
  "/dmb/nvpexa/collection/exchange/status/prizeId",
  "/activity/n9zq66/activity/list",
];

function log(msg) {
  console.log(`[${TITLE}] ${msg}`);
}

function notify(subtitle, msg) {
  $notify(TITLE, subtitle, msg || "");
}

function now() {
  return new Date().toISOString();
}

function getPath(url) {
  try { return new URL(url).pathname; } catch (_) { return url || ""; }
}

function lowerHeaders(headers) {
  const out = {};
  for (const key in headers || {}) out[key.toLowerCase()] = headers[key];
  return out;
}

function cleanHeaders(headers) {
  const h = lowerHeaders(headers);
  const drop = new Set(["host", "content-length", "accept-encoding", "connection", "proxy-connection"]);
  const out = {};
  for (const key in h) {
    if (!drop.has(key)) out[key] = h[key];
  }
  return out;
}

function redactHeaders(headers) {
  const out = {};
  for (const key in headers || {}) {
    out[key] = /authorization|cookie|token|session|secret|sign/i.test(key) ? "[已隐藏]" : headers[key];
  }
  return out;
}

function saveJson(key, value) {
  return $prefs.setValueForKey(JSON.stringify(value), key);
}

function loadJson(key) {
  const raw = $prefs.valueForKey(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function classify(url) {
  const path = getPath(url);
  if (/\/dmb\/nsjkd\/week\/sign\/list/i.test(path)) return "list";
  if (/\/dmb\/t95n10\/signIn\/tips/i.test(path)) return "tips";

  const related = /sign|quest|collection|activity/i.test(path);
  const readOnly = /\/(?:list|query|get|status|tips|popup|grouping|adverts|contentV2|count|prizeId)$/i.test(path);
  if (related && !readOnly) return "claim";
  return "auth";
}

function captureRequest() {
  const type = classify($request.url);
  const req = {
    url: $request.url,
    method: $request.method || "POST",
    headers: cleanHeaders($request.headers || {}),
    body: typeof $request.body === "string" ? $request.body : "",
    path: getPath($request.url),
    capturedAt: now(),
  };

  saveJson(KEYS.auth, req);
  saveJson(KEYS.last, req);
  if (KEYS[type]) saveJson(KEYS[type], req);

  log(`捕获类型=${type}`);
  log(`捕获路径=${req.path}`);
  log(`Method=${req.method}, BodyLength=${req.body.length}`);
  log(`Headers=${JSON.stringify(redactHeaders(req.headers), null, 2)}`);

  const name = type === "claim" ? "签到/领取请求" : type === "list" ? "签到列表请求" : type === "tips" ? "签到提示请求" : "账号凭证请求";
  notify("账号信息已更新", `${name}\n${req.path}`);
  $done({});
}

function buildReq(baseReq, urlOverride) {
  const headers = Object.assign({}, baseReq.headers || {});
  delete headers["host"];
  delete headers["content-length"];
  delete headers["accept-encoding"];
  delete headers["connection"];

  const opts = {
    url: urlOverride || baseReq.url,
    method: baseReq.method || "POST",
    headers,
  };
  if (baseReq.body) opts.body = baseReq.body;
  return opts;
}

function cloneForPath(baseReq, path) {
  const url = `https://bankappgw.za.group${path}`;
  const req = Object.assign({}, baseReq, { url, path });
  return req;
}

function tryJson(text) {
  try { return JSON.parse(text); } catch (_) { return null; }
}

function collectImportant(obj) {
  const hits = [];
  const re = /^(code|msg|message|desc|description|success|status|result|reward|point|points|coin|coins|amount|day|days|signed|signInStatus|checkInStatus|taskName|title|name)$/i;

  function walk(node, depth) {
    if (!node || depth > 5) return;
    if (Array.isArray(node)) {
      node.slice(0, 8).forEach((x) => walk(x, depth + 1));
      return;
    }
    if (typeof node !== "object") return;
    for (const key in node) {
      const val = node[key];
      if (re.test(key) && val !== null && typeof val !== "object") hits.push(`${key}=${String(val)}`);
      if (val && typeof val === "object") walk(val, depth + 1);
    }
  }

  walk(obj, 0);
  return Array.from(new Set(hits)).slice(0, 12);
}

async function doReq(label, req) {
  if (!req) {
    log(`${label}：无请求信息，跳过`);
    return { label, ok: false, skipped: true };
  }

  log(`${label}：请求 ${req.method || "POST"} ${req.path || getPath(req.url)}`);
  log(`${label}：凭证捕获时间 ${req.capturedAt || "未知"}，BodyLength=${(req.body || "").length}`);

  const started = Date.now();
  const resp = await $task.fetch(buildReq(req));
  const cost = Date.now() - started;
  const status = resp.statusCode || resp.status || 0;
  const body = resp.body || "";
  const json = tryJson(body);
  const important = json ? collectImportant(json) : [];

  log(`${label}：HTTP ${status}，耗时 ${cost}ms，响应长度 ${body.length}`);
  if (json) log(`${label}：关键信息 ${important.length ? important.join(" | ") : "JSON 无明显结果字段"}`);
  else log(`${label}：非 JSON 响应前 300 字符：${body.slice(0, 300)}`);

  return { label, ok: status >= 200 && status < 300, status, body, json, important };
}

async function taskMain() {
  log("任务开始");

  const authReq = loadJson(KEYS.auth) || loadJson(KEYS.list) || loadJson(KEYS.tips) || loadJson(KEYS.last);
  const listReq = loadJson(KEYS.list) || (authReq ? cloneForPath(authReq, "/dmb/nsjkd/week/sign/list") : null);
  const tipsReq = loadJson(KEYS.tips) || (authReq ? cloneForPath(authReq, "/dmb/t95n10/signIn/tips") : null);
  const claimReq = loadJson(KEYS.claim);

  if (!authReq) {
    log("未找到账号凭证。请先开启 rewrite，进入签到/任务页面抓取。");
    notify("缺少账号信息", "请先进入签到/任务页面，让脚本自动抓取请求");
    $done();
    return;
  }

  log(`账号凭证路径=${authReq.path || getPath(authReq.url)}`);
  log(`账号凭证时间=${authReq.capturedAt || "未知"}`);

  const results = [];
  results.push(await doReq("查询签到列表", listReq));
  results.push(await doReq("查询签到提示", tipsReq));

  if (claimReq) {
    results.push(await doReq("执行签到/领取", claimReq));
  } else {
    log("未捕获到真实签到/领取接口。本次只完成查询；如果查询结果显示未签到，请手动点一次签到以捕获领取接口。");
  }

  const info = results
    .filter((r) => r && r.important && r.important.length)
    .map((r) => `${r.label}: ${r.important.slice(0, 5).join(", ")}`)
    .join("\n");

  const claim = results.find((r) => r.label === "执行签到/领取");
  if (claimReq && claim && claim.ok) {
    notify("签到请求已执行", info || `HTTP ${claim.status}`);
  } else if (!claimReq) {
    notify("已查询签到状态", info || "未捕获领取接口，查看日志确认状态");
  } else {
    notify("签到可能失败", info || "查看日志获取详情");
  }

  log("任务结束");
  $done();
}

if (typeof $request !== "undefined" && $request.url) {
  captureRequest();
} else {
  taskMain().catch((e) => {
    log(`任务异常：${e.stack || e.message || e}`);
    notify("任务异常", String(e.message || e));
    $done();
  });
}
