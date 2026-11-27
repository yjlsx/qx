/**
 * gemini_activate_capture.js — 抓 one.google.com 的激活写入 RPC
 *
 * 用法（Quantumult X）：
 *   [rewrite_local]
 *   ^https:\/\/one\.google\.com\/_\/SubscriptionsManagementUi\/data\/batchexecute url script-request-body gemini_activate_capture.js
 *
 * 背景（HAR 实测）：
 *   本次抓包里 batchexecute 只出现两个只读 rpcid：
 *     AW88xc  → 拉 /ai 页面配置，f.req = [["AW88xc","[\"/ai\"]",null,"1"]]
 *     GI6Jdd  → 拉订阅列表，  f.req = [["GI6Jdd","[]",null,"generic"]]
 *   真正的「写入权益」rpcid 只在付款成功后出现，本脚本负责把它揪出来：
 *   凡是 rpcid 不在白名单内的一律记录 + 通知。
 *
 * 抓到之后要做的两件事：
 *   1. 把 rpcid 加进 gemini_adv_cfg.knownWriteRpcs
 *   2. 看 f.req 里是否有 purchaseToken / transactionId / jws 字段
 *      有 → 这就是「收据搬运」的落点，可带任意 Cookie 重放
 */

const STORE = {
  ACTIVATIONS: "gemini_activate_rpcs",
  CFG: "gemini_adv_cfg",
  LOG: "gemini_adv_log"
};

function storeGet(k, d) { try { const r = $prefs.valueForKey(k); if (!r) return d; return JSON.parse(r); } catch (e) { return d; } }
function storeSet(k, v) { try { $prefs.setValueForKey(JSON.stringify(v), k); return true; } catch (e) { return false; } }

/** 已知的只读 rpcid，不记录 */
const READ_ONLY_RPCS = ["AW88xc", "GI6Jdd", "browserinfo", "idv"];
/** 常见的 Google 写操作/权限类 rpcid 前缀特征（用于提前标记可疑项） */
const WRITE_HINTS = /(create|update|purchase|redeem|activate|verify|subscribe|provision|claim|grant|enroll|checkout)/i;

function extractRpcId(url, body) {
  const fromQuery = url.match(/rpcids=([A-Za-z0-9_]+)/);
  if (fromQuery) return fromQuery[1];
  // f.req 里第一个元素就是 rpcid，形如 [["GI6Jdd","[]",null,"generic"]]
  const fromBody = body.match(/%22([A-Za-z0-9_]{5,10})%22/) || body.match(/"([A-Za-z0-9_]{5,10})"/);
  return fromBody ? fromBody[1] : null;
}

/** 解 urlencoded 的 f.req，返回可读 JSON */
function decodeFReq(body) {
  try {
    const m = String(body).match(/f\.req=([^&]+)/);
    if (!m) return null;
    const decoded = decodeURIComponent(m[1]);
    return JSON.parse(decoded);
  } catch (e) { return null; }
}

/** 在 f.req / body 里找可能的票据字段 */
function findTicketFields(text) {
  const hits = [];
  const patterns = [
    ["purchaseToken", /purchase_?token/i],
    ["transactionId", /transaction_?id/i],
    ["appAccountToken", /app_?account_?token/i],
    ["jws", /\beyJ[A-Za-z0-9_-]{10,}\./],
    ["receipt", /receipt/i],
    ["sku", /g1\.ios\.[a-z0-9.]+/i],
    ["orderId", /order_?id|GPA\.\d+/i]
  ];
  patterns.forEach(([name, re]) => { if (re.test(text)) hits.push(name); });
  return hits;
}

(async () => {
  const url = $request.url || "";
  const body = $request.body || "";
  const rpcid = extractRpcId(url, body);

  if (!rpcid) return $done({});
  if (READ_ONLY_RPCS.indexOf(rpcid) >= 0) return $done({});

  const cfg = storeGet(STORE.CFG, { knownWriteRpcs: [] });
  const fReq = decodeFReq(body);
  const tickets = findTicketFields(body);

  const hit = {
    t: Date.now(),
    rpcid,
    url,
    body: String(body).slice(0, 8000),
    fReq: fReq,
    tickets,
    method: $request.method,
    cookiePrefix: (($request.headers && $request.headers.Cookie) || "").slice(0, 60),
    suspicious: WRITE_HINTS.test(body) || tickets.length > 0 || true // 非白名单本身就值得记
  };

  const arr = storeGet(STORE.ACTIVATIONS, []);
  arr.unshift(hit);
  while (arr.length > 40) arr.pop();
  storeSet(STORE.ACTIVATIONS, arr);

  if (cfg.knownWriteRpcs.indexOf(rpcid) < 0) {
    $notify(
      "发现非只读 RPC",
      rpcid + (tickets.length ? " · 含票据字段" : ""),
      `字段: ${tickets.join(",") || "无"}\n${String(body).slice(0, 100)}`
    );
  }

  // 不拦截，让它正常走完
  $done({});
})();
