/**
 * gemini_sku_probe.js — 解析 ListProducts 响应，落成 SKU 目录
 *
 * 用法（Quantumult X）：
 *   [rewrite_local]
 *   ^https:\/\/applecommerce-pa\.googleapis\.com\/\$rpc\/google\.subscriptions\.apple\.commerce\.v1\.AppleCommerceService\/ListProducts url script-response-body gemini_sku_probe.js
 *
 * 响应结构（HAR #13/#90 实测）：
 *   f1（重复 N 次，每条是一个 Any 包裹的 ProductMetadata）
 *     "g1.ios.20tb.m.v2"                          SKU
 *     "type.googleapis.com/subscriptions.apple.proto.product.adapter.googleone.ProductMetadata"
 *     "Google One 存储空间" / "Google AI Ultra"    description / displayName
 *     "SKU_20_TB" / "GEN_AI_2_TB" / "HELIUM"      内部商品族
 *     "20 TB" / "5 TB"                            容量
 *     "USD" ... "99990"                           币种与价格（分）
 *     "com.google.gemini.generic"                 bundle
 *   f2（一条）ListProductsResponseMetadata，含当前账号的 15 GB 基础额度
 *
 * 产物写进 $prefs.gemini_sku_catalog，并支持导出成 JSON。
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

/** 解析为「字段号 → 值数组」，保留重复字段 */
function pbParseMulti(bytes, maxLen) {
  const out = {};
  let i = 0;
  const limit = Math.min(bytes.length, maxLen || bytes.length);
  while (i < limit) {
    let key;
    try { const r = pbReadVarint(bytes, i); key = r[0]; i = r[1]; } catch (e) { break; }
    const field = Math.floor(key / 8);
    const wire = key % 8;
    if (wire === 0) {
      const r = pbReadVarint(bytes, i); i = r[1];
      (out[field] = out[field] || []).push(r[0]);
    } else if (wire === 2) {
      const r = pbReadVarint(bytes, i);
      const len = r[0]; i = r[1];
      if (len < 0 || i + len > bytes.length) break;
      const seg = bytes.slice(i, i + len);
      i += len;
      const asStr = bytesToStr(seg);
      const printable = asStr.indexOf("\ufffd") < 0 && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(asStr);
      (out[field] = out[field] || []).push(printable ? asStr : seg);
    } else if (wire === 5) i += 4;
    else if (wire === 1) i += 8;
    else break;
  }
  return out;
}

const STORE = { SKUS: "gemini_sku_catalog", LOG: "gemini_adv_log", CFG: "gemini_adv_cfg" };
function storeGet(k, d) { try { const r = $prefs.valueForKey(k); if (!r) return d; return JSON.parse(r); } catch (e) { return d; } }
function storeSet(k, v) { try { $prefs.setValueForKey(JSON.stringify(v), k); return true; } catch (e) { return false; } }

/**
 * 从一条 ProductMetadata 的扁平字符串里抽字段
 * 实测一条长这样（按出现顺序）：
 *   g1.ios.20tb.m.v2 | type.googleapis.com/...ProductMetadata | Google One 存储空间 | SKU_20_TB | 20 TB | USD | 99990 | com.google.gemini.generic
 */
function parseProductChunk(chunk) {
  const str = typeof chunk === "string" ? chunk : bytesToStr(chunk);
  const sku = (str.match(/(g1\.ios\.[a-z0-9.]+)/) || [])[1] || null;
  if (!sku) return null;

  const strings = (str.match(/[\x20-\x7e\u4e00-\u9fa5]{3,}/g) || []).map(s => s.trim()).filter(Boolean);
  const currency = (str.match(/\b(USD|TRY|INR|JPY|GBP|EGP|BRL|MXN|ARS|IDR|VND|PHP|THB|MYR|EUR|CNY)\b/) || [])[1] || null;

  // 价格：紧跟在 currency 之后的一串数字（分）
  let price = null;
  const priceMatch = str.match(/(USD|TRY|INR|JPY|GBP|EGP|BRL|MXN|ARS|IDR|VND|PHP|THB|MYR|EUR|CNY)[\x00-\x1f\s]{0,4}(\d{2,8})/);
  if (priceMatch) price = parseInt(priceMatch[2], 10);

  const period = /\.a$/.test(sku) ? "P1Y" : (/\.m(\.|$)/.test(sku) ? "P1M" : null);
  const tier = /ai\.pro/.test(sku) ? "ai-ultra"
    : /2tb\.ai/.test(sku) ? "ai-pro"
    : /helium/.test(sku) ? "ai-plus"
    : "one";
  const capacity = (str.match(/(\d+(?:\.\d+)?\s?(?:GB|TB))/i) || [])[1] || null;
  const family = (str.match(/\b(SKU_\d+_\w+|HELIUM|GEN_AI_2_TB|GEN_AI_\w+)\b/) || [])[1] || null;
  const displayName = strings.find(s => /Google (One|AI)/i.test(s)) || null;

  return { sku, tier, period, capacity, family, currency, price, displayName, raw: str.slice(0, 300) };
}

(async () => {
  const body = $response.body;
  if (!body) return $done({});

  let bytes;
  if (typeof body === "string" && /^[A-Za-z0-9+/=\s]+$/.test(body) && body.length > 32) {
    bytes = b64ToBytes(body.replace(/\s/g, ""));
  } else if (typeof body === "object" && body.byteLength !== undefined) {
    bytes = Array.from(new Uint8Array(body));
  } else {
    bytes = b64ToBytes(String(body));
  }

  const multi = pbParseMulti(bytes);
  const chunks = multi[1] || [];
  const catalog = [];
  chunks.forEach(c => {
    const p = parseProductChunk(c);
    if (p) catalog.push(p);
  });

  // f2 = 当前账号基础额度（15 GB 之类）
  let accountMeta = null;
  if (multi[2] && multi[2][0]) {
    const s = typeof multi[2][0] === "string" ? multi[2][0] : bytesToStr(multi[2][0]);
    const cap = (s.match(/(\d+(?:\.\d+)?\s?(?:GB|TB))/i) || [])[1] || null;
    accountMeta = { baseCapacity: cap, raw: s.slice(0, 200) };
  }

  const prev = storeGet(STORE.SKUS, null);
  const merged = {};
  if (prev && prev.catalog) prev.catalog.forEach(p => { merged[p.sku] = p; });
  catalog.forEach(p => { merged[p.sku] = p; });

  storeSet(STORE.SKUS, {
    updatedAt: Date.now(),
    accountMeta,
    catalog: Object.keys(merged).map(k => merged[k]).sort((a, b) => a.sku.localeCompare(b.sku))
  });

  $notify(
    "Gemini SKU 目录已更新",
    `本次 ${catalog.length} 条 / 累计 ${Object.keys(merged).length} 条`,
    catalog.slice(0, 4).map(p => `${p.sku} ${p.capacity || ""} ${p.price || ""}`).join("\n")
  );

  $done({});
})();
