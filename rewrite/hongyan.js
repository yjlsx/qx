/*
Hongyan epay callback checker for Quantumult X.

Scope: CTF sandbox only.
It only runs on:
  https://hongyanyanbaihuo.online/pay/zzaaw/<trade_no>/

Quantumult X example:

[rewrite_local]
^https:\/\/hongyanyanbaihuo\.online\/pay\/zzaaw\/\d+\/?.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/hongyan.js

[mitm]
hostname = hongyanyanbaihuo.online

Optional URL overrides for manual testing:
  ?money=200&pid=1053
  ?money=500&pid=1051
*/

const CONFIG = {
  allowedHost: "hongyanyanbaihuo.online",
  allowedPath: /^\/pay\/zzaaw\/\d+\/?$/,
  defaultPid: "1053",
  defaultMoney: "500",
  maxPolls: 3,
  pollDelayMs: 900,
  dedupeTtlMs: 5 * 60 * 1000,
};

const requestUrl = typeof $request !== "undefined" && $request.url ? $request.url : "";
const originalBody = typeof $response !== "undefined" && typeof $response.body === "string" ? $response.body : "";

function qxNotify(title, subtitle, message) {
  if (typeof $notify === "function") {
    $notify(title, subtitle || "", message || "");
  }
}

function finish(body) {
  if (typeof $done === "function") {
    $done({ body });
  }
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch (_) {
    return null;
  }
}

function getQuery(url, name) {
  const value = url.searchParams.get(name);
  return value && /^[\w.-]+$/.test(value) ? value : "";
}

function extractTrade(url, body) {
  const fromPath = url.pathname.match(/\/pay\/zzaaw\/(\d+)\/?/);
  if (fromPath) return fromPath[1];

  const patterns = [
    /trade_no['"]?\s*[:,]\s*['"]?(\d{10,})/i,
    /getshop\.php[^'"]*trade_no[=:]['"]?(\d{10,})/i,
    /\/pay\/zzaaw\/(\d{10,})\//i,
  ];
  for (const pattern of patterns) {
    const match = String(body || "").match(pattern);
    if (match) return match[1];
  }
  return "";
}

function extractMoney(url, body) {
  const override = getQuery(url, "money");
  if (override) return override;

  const amountNode = String(body || "").match(/id=["']amount["'][^>]*>\s*[¥￥]?\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (amountNode) return amountNode[1].replace(/\.00$/, "");

  const visibleAmount = String(body || "").match(/[¥￥]\s*([0-9]+(?:\.[0-9]+)?)/);
  if (visibleAmount) return visibleAmount[1].replace(/\.00$/, "");

  return CONFIG.defaultMoney;
}

function makeParams(params) {
  return Object.keys(params)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");
}

function fetchText(url, headers) {
  return $task.fetch({
    url,
    method: "GET",
    headers: Object.assign(
      {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        Accept: "text/html,application/json,*/*",
      },
      headers || {},
    ),
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readPref(key) {
  try {
    return typeof $prefs !== "undefined" && $prefs.valueForKey ? $prefs.valueForKey(key) : "";
  } catch (_) {
    return "";
  }
}

function writePref(key, value) {
  try {
    if (typeof $prefs !== "undefined" && $prefs.setValueForKey) {
      $prefs.setValueForKey(value, key);
    }
  } catch (_) {
    // Ignore preference failures; the callback flow can still run.
  }
}

function seenRecently(trade) {
  const key = `hongyan_epay_ctf_${trade}`;
  const last = Number(readPref(key) || "0");
  const now = Date.now();
  if (last && now - last < CONFIG.dedupeTtlMs) return true;
  writePref(key, String(now));
  return false;
}

function injectStatus(body, status, detail) {
  let patched = String(body || "");
  patched = patched.replace(/setTimeout\s*\(\s*jumpToAlipay\s*,\s*\d+\s*\)\s*;?/g, "/* QX CTF: disabled automatic Alipay launch */");

  const safeStatus = String(status || "unknown").replace(/[<>&"]/g, "");
  const safeDetail = String(detail || "").replace(/[<>&"]/g, "");
  const color = status === "success" ? "#10a34a" : status === "pending" ? "#a36a00" : status === "skipped" ? "#666" : "#b00020";
  const bar = `<div style="position:fixed;z-index:999999;top:0;left:0;right:0;padding:8px 10px;background:${color};color:#fff;font:13px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;text-align:center;">QX CTF callback: ${safeStatus}${safeDetail ? " - " + safeDetail : ""}</div>`;

  if (patched.includes("</body>")) return patched.replace("</body>", `${bar}</body>`);
  return `${bar}${patched}`;
}

async function runCallback(url, body) {
  const trade = extractTrade(url, body);
  if (!trade) return { status: "error", detail: "missing trade_no" };

  if (seenRecently(trade)) return { status: "skipped", detail: `duplicate ${trade}` };

  const money = extractMoney(url, body);
  const pid = getQuery(url, "pid") || CONFIG.defaultPid;
  const base = `${url.protocol}//${url.host}`;
  const referer = `${base}/pay/zzaaw/${trade}/`;

  await fetchText(`${base}/pay/yuxiadan/${trade}/`, {
    Referer: referer,
    "X-Requested-With": "XMLHttpRequest",
  });

  const notifyQuery = makeParams({
    pid,
    trade_no: trade,
    out_trade_no: trade,
    type: "alipay",
    name: "productName",
    money,
    trade_status: "TRADE_SUCCESS",
    sign: "bad",
    sign_type: "MD5",
  });

  const notify = await fetchText(`${base}/pay/notify/${trade}/?${notifyQuery}`, {
    Referer: referer,
  });

  const notifyBody = String(notify.body || "");
  if (!/success/i.test(notifyBody)) {
    return { status: "error", detail: `notify=${notify.statusCode || notify.status || "?"}` };
  }

  let lastMessage = "not paid";
  for (let i = 0; i < CONFIG.maxPolls; i += 1) {
    const result = await fetchText(`${base}/getshop.php?type=alipay&trade_no=${encodeURIComponent(trade)}`, {
      Referer: referer,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, text/javascript, */*; q=0.01",
    });

    try {
      const parsed = JSON.parse(result.body || "{}");
      lastMessage = parsed.msg || String(parsed.code);
      if (parsed.code === 1) return { status: "success", detail: `trade=${trade}, money=${money}, pid=${pid}` };
    } catch (_) {
      lastMessage = `poll=${result.statusCode || result.status || "?"}`;
    }

    if (i + 1 < CONFIG.maxPolls) await sleep(CONFIG.pollDelayMs);
  }

  return { status: "pending", detail: lastMessage };
}

(async () => {
  const url = parseUrl(requestUrl);
  if (!url || url.host !== CONFIG.allowedHost || !CONFIG.allowedPath.test(url.pathname)) {
    finish(originalBody);
    return;
  }

  if (typeof $task === "undefined" || !$task.fetch) {
    finish(injectStatus(originalBody, "error", "missing $task.fetch"));
    return;
  }

  try {
    const result = await runCallback(url, originalBody);
    qxNotify("Hongyan CTF", result.status, result.detail);
    finish(injectStatus(originalBody, result.status, result.detail));
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    qxNotify("Hongyan CTF", "error", message);
    finish(injectStatus(originalBody, "error", message));
  }
})();
