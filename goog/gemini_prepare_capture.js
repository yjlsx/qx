/**
 * gemini_prepare_capture.js — 截获 applecommerce-pa.googleapis.com/v1/transactions:prepare
 *
 * 用法（Quantumult X）：
 *   [rewrite_local]
 *   ^https:\/\/applecommerce-pa\.googleapis\.com\/v1\/transactions:prepare url script-request-body gemini_prepare_capture.js reject-200
 *
 * 作用：
 *   1. 解析 protobuf 请求体，抽出 txId / SKU / storefront / bundle
 *   2. 解析响应体里的 JWS（ES256），取出 appAccountToken 与 inner request JSON
 *   3. 全部落进 $prefs 的 gemini_adv_vault，供重放引擎使用
 *
 * 注意：
 *   - 请求体是 application/x-protobuf，QX 在某些版本里给的是 base64 字符串，某些是二进制。
 *     两种都处理。
 *   - 同时挂 script-request-body 与 reject 时，QX 先跑脚本再返回自定义响应，
 *     最终生效的是 $done() 里返回的 body。
 *   - 若只想抓不想拦，把 rewrite 里的 reject-200 去掉即可，脚本仍会记录。
 */

// ==== 以下为 gemini_common.js 的最小内联副本（QX 无 import） ====
const B64_STD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

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

function pbReadVarint(bytes, i) {
  let result = 0, shift = 0, x;
  do {
    if (i >= bytes.length) throw new Error("varint OOB");
    x = bytes[i++];
    result += (x & 0x7f) * Math.pow(2, shift);
    shift += 7;
  } while (x & 0x80);
  return [result, i];
}

function pbParse(bytes) {
  const out = {};
  let i = 0;
  while (i < bytes.length) {
    let key;
    try { const r = pbReadVarint(bytes, i); key = r[0]; i = r[1]; } catch (e) { break; }
    const field = Math.floor(key / 8);
    const wire = key % 8;
    if (wire === 0) {
      const r = pbReadVarint(bytes, i); out[field] = r[0]; i = r[1];
    } else if (wire === 2) {
      const r = pbReadVarint(bytes, i);
      const len = r[0]; i = r[1];
      if (len < 0 || i + len > bytes.length) break;
      const seg = bytes.slice(i, i + len);
      i += len;
      const asStr = bytesToStr(seg);
      const printable = asStr.indexOf("\ufffd") < 0 && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(asStr);
      out[field] = printable ? asStr : seg;
      out["_" + field + "_raw"] = seg;
    } else if (wire === 5) i += 4;
    else if (wire === 1) i += 8;
    else break;
  }
  return out;
}

function jwsSegmentToJson(seg) {
  let p = String(seg).replace(/-/g, "+").replace(/_/g, "/");
  while (p.length % 4 !== 0) p += "=";
  return JSON.parse(bytesToStr(b64ToBytes(p)));
}

const STORE = {
  VAULT: "gemini_adv_vault",
  TARGETS: "gemini_adv_targets",
  ACTIVATIONS: "gemini_activate_rpcs",
  SKUS: "gemini_sku_catalog",
  LOG: "gemini_adv_log",
  CFG: "gemini_adv_cfg"
};

function storeGet(k, d) {
  try {
    const raw = $prefs.valueForKey(k);
    if (!raw) return d;
    return JSON.parse(raw);
  } catch (e) { return d; }
}
function storeSet(k, v) { try { $prefs.setValueForKey(JSON.stringify(v), k); return true; } catch (e) { return false; } }

const SKU_TABLE = {
  "g1.ios.100gb.m": { name: "Google One 100 GB", period: "P1M" },
  "g1.ios.100gb.a": { name: "Google One 100 GB", period: "P1Y" },
  "g1.ios.helium.m": { name: "Google AI Plus (400 GB)", period: "P1M" },
  "g1.ios.helium.a": { name: "Google AI Plus (400 GB)", period: "P1Y" },
  "g1.ios.2tb.m": { name: "Google One 2 TB", period: "P1M" },
  "g1.ios.2tb.a": { name: "Google One 2 TB", period: "P1Y" },
  "g1.ios.2tb.ai.m": { name: "Google AI Pro (5 TB)", period: "P1M" },
  "g1.ios.2tb.ai.a": { name: "Google AI Pro (5 TB)", period: "P1Y" },
  "g1.ios.20tb.m.v2": { name: "Google One 20 TB", period: "P1M" },
  "g1.ios.30tb.ai.pro.m": { name: "Google AI Ultra", period: "P1M" }
};
// ==== 内联副本结束 ====

function normalizeBody(raw) {
  // QX 可能是 string(base64) / Uint8Array / ArrayBuffer
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "object" && raw.byteLength !== undefined) return Array.from(new Uint8Array(raw));
  const s = String(raw);
  if (/^[A-Za-z0-9+/=\s]+$/.test(s) && s.replace(/\s/g, "").length > 32) {
    return b64ToBytes(s.replace(/\s/g, ""));
  }
  return strToBytes(s);
}

(async () => {
  const bytes = normalizeBody($request.body);
  const rec = {
    t: Date.now(),
    url: $request.url,
    txId: null,
    bundle: null,
    sku: null,
    storefront: null,
    requestB64: null,
    jws: null,
    jwsHeader: null,
    jwsPayload: null,
    innerRequest: null,
    appAccountToken: null,
    requestReferenceId: null,
    usedTargets: [],
    dead: false
  };

  if (bytes && bytes.length) {
    rec.requestB64 = bytesToB64(bytes);
    const pb = pbParse(bytes);
    rec.txId = typeof pb[1] === "string" ? pb[1] : null;
    rec.bundle = typeof pb[2] === "string" ? pb[2] : null;
    const f5 = pb[5];
    if (f5) {
      const s = typeof f5 === "string" ? f5 : bytesToStr(f5);
      const m = s.match(/(g1\.ios\.[a-z0-9.]+)/);
      if (m) rec.sku = m[1];
      const st = s.match(/\b(USA|TUR|IND|JPN|GBR|EGY|BRA|MEX|ARG|IDN|VNM|PHL|THA|MYS)\b/);
      if (st) rec.storefront = st[1];
    }
    // f3 里也带一遍 SKU，作为兜底
    if (!rec.sku && typeof pb[3] === "string") {
      const m2 = pb[3].match(/(g1\.ios\.[a-z0-9.]+)/);
      if (m2) rec.sku = m2[1];
    }
  }

  // 响应侧已经回填过同 txId 的记录则合并，而不是新增
  const vault = storeGet(STORE.VAULT, []);
  const existing = vault.find(v => v.txId && rec.txId && v.txId === rec.txId);
  if (existing) {
    existing.sku = existing.sku || rec.sku;
    existing.storefront = existing.storefront || rec.storefront;
    existing.requestB64 = existing.requestB64 || rec.requestB64;
    storeSet(STORE.VAULT, vault);
  } else {
    vault.unshift(rec);
    while (vault.length > 64) vault.pop();
    storeSet(STORE.VAULT, vault);
  }

  const info = SKU_TABLE[rec.sku] || null;
  $notify(
    "Gemini prepare 已截获",
    `${info ? info.name : rec.sku || "unknown"} · ${rec.storefront || "?"} `,
    `txId ${String(rec.txId).slice(0, 8)}… | 库内 ${vault.length} 条`
  );

  // 返回空 protobuf，客户端拿不到 JWS / Apple 支付参数
  $done({
    status: 200,
    headers: { "Content-Type": "application/x-protobuf" },
    body: ""
  });
})();
