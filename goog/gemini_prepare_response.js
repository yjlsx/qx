/**
 * gemini_prepare_response.js — 解析 transactions:prepare 响应，回填 JWS
 *
 * 用法（Quantumult X）：
 *   [rewrite_local]
 *   ^https:\/\/applecommerce-pa\.googleapis\.com\/v1\/transactions:prepare url script-response-body gemini_prepare_response.js
 *
 * 注意：QX 同一 URL 只能生效一条 rewrite。想「既抓请求又抓响应」，
 *       请用 script-echo-response 版本（gemini_prepare_echo.js），
 *       或者分两次挂载（先关拦截跑一遍抓响应，再开拦截抓请求）。
 *
 * 响应结构（HAR #77/#81/#127 实测）：
 *   外层 protobuf
 *     f1 = Apple 交易 UUID（a2b78455-b849-41e0-86ba-1b591d50ae58）
 *     f2 = ES256 JWS
 *            header  {"kid":"XK534WVGC3","alg":"ES256","typ":"JWT"}
 *            payload {"iss":"69a6de6e-...","aud":"advanced-commerce-api","bid":"com.google.gemini",
 *                     "nonce":"...","request":"<base64 JSON>","price":"99990","productId":"g1.ios.20tb.m.v2"}
 *            request 解出来含 requestInfo.appAccountToken ← 关键字段
 */

const B64_STD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

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

const STORE = { VAULT: "gemini_adv_vault", LOG: "gemini_adv_log" };
function storeGet(k, d) { try { const r = $prefs.valueForKey(k); if (!r) return d; return JSON.parse(r); } catch (e) { return d; } }
function storeSet(k, v) { try { $prefs.setValueForKey(JSON.stringify(v), k); return true; } catch (e) { return false; } }

/** 从响应里抽出全部 JWS（可能有多条）*/
function extractJwsList(bytes) {
  const text = bytesToStr(bytes);
  // JWS 由 base64url 段 + '.' 组成，长度通常 > 500
  const re = /[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g;
  const found = text.match(re) || [];
  const uniq = [];
  found.forEach(j => { if (uniq.indexOf(j) < 0) uniq.push(j); });
  return uniq;
}

(async () => {
  const body = $response.body;
  if (!body) return $done({});

  let bytes = null;
  if (typeof body === "string" && /^[A-Za-z0-9+/=\s]+$/.test(body) && body.length > 32) {
    bytes = b64ToBytes(body.replace(/\s/g, ""));
  } else if (typeof body === "object" && body.byteLength !== undefined) {
    bytes = Array.from(new Uint8Array(body));
  } else {
    bytes = b64ToBytes(String(body));
  }

  const pb = pbParse(bytes);
  const txId = typeof pb[1] === "string" ? pb[1] : null;
  const jwsList = extractJwsList(bytes);

  if (!jwsList.length) {
    $notify("Gemini 响应", "未找到 JWS", `txId ${String(txId).slice(0, 8)}… len=${bytes.length}`);
    return $done({});
  }

  const parsed = jwsList.map(raw => {
    const parts = raw.split(".");
    let header = null, payload = null, inner = null;
    try { header = JSON.parse(bytesToStr(b64ToBytes(parts[0]))); } catch (e) {}
    try { payload = JSON.parse(bytesToStr(b64ToBytes(parts[1]))); } catch (e) {}
    if (payload && payload.request) {
      try { inner = JSON.parse(bytesToStr(b64ToBytes(payload.request))); } catch (e) {}
    }
    return { raw, header, payload, inner };
  });

  const best = parsed[0];
  const vault = storeGet(STORE.VAULT, []);

  // 优先按 txId 匹配已存在的请求记录（请求侧先入库），否则新建
  let rec = txId ? vault.find(v => v.txId === txId) : null;
  if (!rec) {
    rec = { t: Date.now(), usedTargets: [], dead: false };
    vault.unshift(rec);
    while (vault.length > 64) vault.pop();
  }

  rec.txId = rec.txId || txId;
  rec.responseTxId = txId;
  rec.jws = best.raw;
  rec.jwsHeader = best.header;
  rec.jwsPayload = best.payload;
  rec.innerRequest = best.inner;
  rec.sku = rec.sku || (best.payload && best.payload.productId) || (best.inner && best.inner.items && best.inner.items[0] && best.inner.items[0].SKU) || null;
  rec.storefront = rec.storefront || (best.inner && best.inner.storefront) || null;
  rec.appAccountToken = (best.inner && best.inner.requestInfo && best.inner.requestInfo.appAccountToken) || rec.appAccountToken || null;
  rec.requestReferenceId = (best.inner && best.inner.requestInfo && best.inner.requestInfo.requestReferenceId) || null;
  rec.price = (best.payload && best.payload.price) || null;
  rec.nonce = (best.payload && best.payload.nonce) || null;
  rec.jwsCount = parsed.length;

  storeSet(STORE.VAULT, vault);
  $notify(
    "Gemini JWS 已回填",
    `${rec.sku || "?"} · tx ${String(txId).slice(0, 8)}…`,
    `aat ${String(rec.appAccountToken).slice(0, 8)}… | JWS ${best.raw.length} 字节 | 本响应含 ${parsed.length} 条`
  );

  $done({});
})();
