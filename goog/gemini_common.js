/**
 * gemini_common.js — Gemini / Google One「高级商务」(Advanced Commerce) 重放链公共库
 *
 * 依赖：Quantumult X 的 JS 运行时（无 Buffer / 无 TextDecoder 兜底，全部手写）
 * 引入方式：QX 不支持 import，请把本文件内容拼进脚本头部，
 *          或使用 build.js 生成合并后的单文件。
 *
 * 所有函数都是纯函数 + $prefs 读写，无全局副作用。
 */

// ============================ Base64 ============================

const B64_STD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** 字符串 → 字节数组（UTF-8，手写，不依赖 TextEncoder） */
function strToBytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c < 0xdc00) {
      // surrogate pair
      const c2 = str.charCodeAt(++i);
      const cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
}

/** 字节数组 → 字符串（UTF-8，非法字节替换为 U+FFFD 而不是抛异常） */
function bytesToStr(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    if (b < 0x80) { out += String.fromCharCode(b); i += 1; }
    else if ((b & 0xe0) === 0xc0) { out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
    else if ((b & 0xf0) === 0xe0) {
      out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3;
    } else if ((b & 0xf8) === 0xf0) {
      let cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff)); i += 4;
    } else { out += "\ufffd"; i += 1; }
  }
  return out;
}

/** 字节数组 → base64（标准字母表） */
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

/** base64 / base64url → 字节数组；容错：非法字符丢弃、补齐 padding */
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

/** base64url JWT 段 → JSON 对象 */
function jwsSegmentToJson(seg) {
  const bytes = b64ToBytes(seg);
  return JSON.parse(bytesToStr(bytes));
}

/** 拆分并解析 JWS：返回 { header, payload, signature, raw } */
function parseJws(jws) {
  const parts = String(jws).split(".");
  if (parts.length < 2) return null;
  let header = null, payload = null;
  try { header = jwsSegmentToJson(parts[0]); } catch (e) {}
  try { payload = jwsSegmentToJson(parts[1]); } catch (e) {}
  return { header, payload, signature: parts[2] || null, raw: jws };
}

// ============================ Varint & Protobuf ============================

/** 读 varint，返回 [值, 新偏移] */
function pbReadVarint(bytes, i) {
  let result = 0, shift = 0, x;
  do {
    if (i >= bytes.length) throw new Error("varint out of range");
    x = bytes[i++];
    // 用乘法实现 32 位以上精度
    result += (x & 0x7f) * Math.pow(2, shift);
    shift += 7;
  } while (x & 0x80);
  return [result, i];
}

/** 写 varint（支持到 2^53） */
function pbWriteVarint(n) {
  const out = [];
  while (n > 127) { out.push((n % 128) | 0x80); n = Math.floor(n / 128); }
  out.push(n & 0x7f);
  return out;
}

/**
 * 解析 protobuf 为扁平对象 { 字段号: 值 }
 * - varint → number
 * - length-delimited → 优先尝试 UTF-8 字符串；若含不可打印字节则保留字节数组
 * - 嵌套消息不递归（业务方自己决定），但会返回 bytes 供二次解析
 *
 * opts.decodeNested = true 时，对看起来像合法 UTF-8 的片段不递归；
 * 想要严格结构请用 pbParseDeep。
 */
function pbParse(bytes, opts) {
  const o = opts || {};
  const out = {};
  let i = 0;
  while (i < bytes.length) {
    let key;
    try { [key, i] = pbReadVarint(bytes, i); } catch (e) { break; }
    const field = Math.floor(key / 8);
    const wire = key % 8;
    if (wire === 0) {
      let v; [v, i] = pbReadVarint(bytes, i);
      out[field] = v;
    } else if (wire === 2) {
      let len; [len, i] = pbReadVarint(bytes, i);
      if (len < 0 || i + len > bytes.length) break;
      const seg = bytes.slice(i, i + len);
      i += len;
      const asStr = bytesToStr(seg);
      // 判断是否可安全当字符串：不含 U+FFFD 且不含控制字符
      const printable = asStr.indexOf("\ufffd") < 0 && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(asStr);
      out[field] = printable && !o.forceBytes ? asStr : seg;
      out["_" + field + "_raw"] = seg;
    } else if (wire === 5) { i += 4; }
    else if (wire === 1) { i += 8; }
    else break;
  }
  return out;
}

/** 递归解析，嵌套消息会被当作对象返回 */
function pbParseDeep(bytes, depth) {
  if ((depth || 0) > 8) return null;
  const flat = pbParse(bytes, { forceBytes: false });
  const out = {};
  Object.keys(flat).forEach(k => {
    if (k.startsWith("_")) return;
    const v = flat[k];
    if (typeof v === "string") {
      // 看起来像 base64 或含 'type.googleapis.com' 的，尝试再解一层
      if (/^[A-Za-z0-9+/=]{20,}$/.test(v) && /type\.googleapis\.com|[A-Za-z]{4,}\.[a-z]{2,}/.test(bytesToStr(b64ToBytes(v)).slice(0, 120))) {
        try { out[k] = pbParseDeep(b64ToBytes(v), (depth || 0) + 1); return; } catch (e) {}
      }
      out[k] = v;
    } else if (Array.isArray(v)) {
      try {
        const nested = pbParseDeep(v, (depth || 0) + 1);
        out[k] = Object.keys(nested).length > 0 ? nested : bytesToStr(v);
      } catch (e) { out[k] = v; }
    } else out[k] = v;
  });
  return out;
}

// ============================ Protobuf 编码（构造请求） ============================

/** 字段 = length-delimited 字符串 */
function pbEncStr(field, str) {
  const body = strToBytes(str);
  return [].concat(pbWriteVarint(field * 8 + 2), pbWriteVarint(body.length), body);
}

/** 字段 = length-delimited 原始字节 */
function pbEncBytes(field, bytes) {
  return [].concat(pbWriteVarint(field * 8 + 2), pbWriteVarint(bytes.length), bytes);
}

/** 字段 = varint */
function pbEncVarint(field, n) {
  return [].concat(pbWriteVarint(field * 8), pbWriteVarint(n));
}

// ============================ Cat ============================

/** 拼接字节数组 */
function catBytes() {
  let out = [];
  for (let i = 0; i < arguments.length; i++) out = out.concat(arguments[i] || []);
  return out;
}

// ============================ UUID & Misc ============================

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** 生成一个 Google 风格的 appAccountToken（UUID 形态，无校验位） */
function newAppAccountToken() {
  return uuidv4().toUpperCase();
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function randBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ============================ 存储层 ============================

const STORE = {
  VAULT: "gemini_adv_vault",          // 交易库：prepare 请求/响应 + JWS + appAccountToken
  TARGETS: "gemini_adv_targets",      // 待补单队列
  ACTIVATIONS: "gemini_activate_rpcs",
  SKUS: "gemini_sku_catalog",
  LOG: "gemini_adv_log",
  CFG: "gemini_adv_cfg"
};

function storeGet(key, fallback) {
  try {
    const raw = $prefs.valueForKey(key);
    if (raw === null || raw === undefined || raw === "") return fallback;
    return JSON.parse(raw);
  } catch (e) { return fallback; }
}

function storeSet(key, value) {
  try {
    $prefs.setValueForKey(JSON.stringify(value), key);
    return true;
  } catch (e) { return false; }
}

function storePush(key, item, maxLen) {
  const arr = storeGet(key, []);
  arr.unshift(item);
  while (arr.length > (maxLen || 64)) arr.pop();
  storeSet(key, arr);
  return arr.length;
}

function logLine(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  storePush(STORE.LOG, line, 200);
  return line;
}

// ============================ SKU 解析 ============================

/**
 * 从 prepare 请求的 f5 段里抠 SKU 与 storefront
 * 实测形态: "\x08\x00" + "g1.ios.20tb.m.v2" + "\x1a\x03USA"
 */
function extractSkuFromBlob(blob) {
  const s = typeof blob === "string" ? blob : bytesToStr(blob || []);
  const sku = (s.match(/(g1\.ios\.[a-z0-9.]+)/) || [])[1] || null;
  const store = (s.match(/\b(USA|TUR|IND|JPN|GBR|EGY|BRA|MEX|ARG|IDN|VNM|PHL|THA|MYS)\b/) || [])[1] || null;
  return { sku, storefront: store };
}

/** SKU → 人类可读信息（来自 ListProducts 实测） */
const SKU_TABLE = {
  "g1.ios.100gb.m": { name: "Google One 100 GB", tier: "one", period: "P1M" },
  "g1.ios.100gb.a": { name: "Google One 100 GB", tier: "one", period: "P1Y" },
  "g1.ios.helium.m": { name: "Google AI Plus (400 GB)", tier: "ai-plus", period: "P1M" },
  "g1.ios.helium.a": { name: "Google AI Plus (400 GB)", tier: "ai-plus", period: "P1Y" },
  "g1.ios.2tb.m": { name: "Google One 2 TB", tier: "one", period: "P1M" },
  "g1.ios.2tb.a": { name: "Google One 2 TB", tier: "one", period: "P1Y" },
  "g1.ios.2tb.ai.m": { name: "Google AI Pro (5 TB)", tier: "ai-pro", period: "P1M" },
  "g1.ios.2tb.ai.a": { name: "Google AI Pro (5 TB)", tier: "ai-pro", period: "P1Y" },
  "g1.ios.20tb.m.v2": { name: "Google One 20 TB", tier: "one", period: "P1M" },
  "g1.ios.30tb.ai.pro.m": { name: "Google AI Ultra", tier: "ai-ultra", period: "P1M" }
};

function describeSku(sku) {
  return SKU_TABLE[sku] || { name: sku || "unknown", tier: "unknown", period: null };
}

// ============================ 请求体构造 ============================

/**
 * 构造 transactions:prepare 请求体（protobuf 字节 → base64）
 *
 * 实测字节布局（HAR #77 完整 hexdump 反推，总长 279）：
 *
 *   0a 24 <36字节 txUUID>           f1 = 交易 UUID（大写，跨 SKU 复用同值）
 *   12 19 "com.google.gemini.generic"  f2 = bundle
 *   1a 8e 01                        f3 = Any 包裹的 SubscriptionsDeveloperPayload
 *       0a 4c "type.googleapis.com/subscriptions.common.proto.SubscriptionsDeveloperPayload"
 *       12 3e                        ← 内层 payload
 *            0a 3c                    ← 再内一层（真正的 payload 体）
 *                 08 1c               f1 = 0x1c
 *                 10 e8 07            f2 = 1000（varint，非定长）
 *                 18 03               f3 = 3
 *                 2a 1f <iapVersion>  f5 = IAP 版本串
 *                 3a 0e "/dynamic-plans"  f7
 *       58 4b                       f11 = 75
 *       60 08                       f12 = 8
 *   22 2a                          f4 = 版本子消息
 *       0a 1f <iapVersion>
 *       12 04 "17.0"                f2 = iOS 版本
 *       1a 01 01                    f3 = 1
 *   2a 17                          f5 = SKU 子消息
 *       0a 10 "g1.ios.20tb.m.v2"
 *       1a 03 "USA"
 *
 * 三个字段号都是「嵌套」的：f3 两层 Any，f5 一层。构造时必须逐层封包。
 */
function buildPrepareBody(opts) {
  const o = opts || {};
  const txId = o.txId || uuidv4().toUpperCase();
  const bundle = o.bundle || "com.google.gemini.generic";
  const sku = o.sku;
  const storefront = o.storefront || "USA";
  const iapVer = o.iapVersion || "1.2026.1870010.1.2026.1870010.0";
  const iosVer = o.iosVersion || "17.0";

  // 最内层 payload（实测 60 字节）：
  //   08 1c  |  10 e8 07  |  18 03  |  2a 1f <iapVer>  |  3a 0e /dynamic-plans  |  58 4b  |  60 08
  const inner = catBytes(
    pbEncVarint(1, 0x1c),
    pbEncVarint(2, 0x3e8),
    pbEncVarint(3, 3),
    pbEncStr(5, iapVer),
    pbEncStr(7, "/dynamic-plans"),
    pbEncVarint(11, 75),
    pbEncVarint(12, 8)
  );

  // 中间层（实测 62 字节）：0a 3c <inner>
  const mid = catBytes(pbEncBytes(1, inner));

  // 外层（实测 142 字节）：0a 4c <typeURL>  12 3e <mid>
  const devPayload = catBytes(
    pbEncStr(1, "type.googleapis.com/subscriptions.common.proto.SubscriptionsDeveloperPayload"),
    pbEncBytes(2, mid)
  );

  // f4：iapVer + iOS 版本 + 平台标记（实测 42 字节：10 1f ... 12 04 "17.0" 1a 01 01）
  const f4 = catBytes(
    pbEncStr(1, iapVer),
    pbEncStr(2, iosVer),
    pbEncBytes(3, [0x01])
  );

  // f5：SKU + storefront（实测：0a 10 <sku> 1a 03 "USA"）
  const f5 = catBytes(
    pbEncStr(1, sku),
    pbEncStr(3, storefront)
  );

  const body = catBytes(
    pbEncStr(1, txId),
    pbEncStr(2, bundle),
    pbEncBytes(3, devPayload),
    pbEncBytes(4, f4),
    pbEncBytes(5, f5)
  );

  return { b64: bytesToB64(body), bytes: body, txId };
}

/**
 * 构造 ListProducts 请求体
 * 实测 f1 是一个 Any 包裹的 ListProductsRequestOptions
 */
function buildListProductsBody(opts) {
  const o = opts || {};
  const iapVer = o.iapVersion || "1.2026.1870010.1.2026.1870010.0";
  const storefront = o.storefront || "USA";

  const options = catBytes(
    pbEncStr(1, "type.googleapis.com/subscriptions.apple.proto.product.adapter.googleone.ListProductsRequestOptions"),
    pbEncStr(2, iapVer),
    pbEncStr(3, storefront),
    pbEncVarint(4, 1),
    pbEncVarint(5, 1000),
    pbEncBytes(6, []),
    pbEncStr(9, "1.202618.05")
  );
  return bytesToB64(options);
}

// ============================ 输出到全局 ============================

// QX 脚本是独立作用域，这里把全部函数挂到 globalThis 便于合并脚本使用
const GEMINI_COMMON = {
  strToBytes, bytesToStr, bytesToB64, b64ToBytes,
  jwsSegmentToJson, parseJws,
  pbReadVarint, pbWriteVarint, pbParse, pbParseDeep,
  pbEncStr, pbEncBytes, pbEncVarint, catBytes,
  uuidv4, newAppAccountToken, sleep, randBetween,
  STORE, storeGet, storeSet, storePush, logLine,
  SKU_TABLE, describeSku, extractSkuFromBlob,
  buildPrepareBody, buildListProductsBody
};

if (typeof module !== "undefined" && module.exports) module.exports = GEMINI_COMMON;
