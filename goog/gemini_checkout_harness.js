/**
 * gemini_checkout_harness.js — 离线验证工装（Node.js，非 QX 脚本）
 *
 * 用途：不依赖真机，用 HAR 或手写 fixture 跑通整条链路，
 *      确认 proto 编解码、JWS 解析、appAccountToken 提取、请求体构造都正确。
 *
 * 用法：
 *   node gemini_checkout_harness.js <har路径>
 *   node gemini_checkout_harness.js --build g1.ios.2tb.ai.a USA   # 只构造请求体并自解
 *
 * 输出：结构化 JSON + 人工可读摘要，全部为 Observed 证据。
 */

const fs = require("fs");
const path = require("path");

const C = require("./gemini_common.js");

// ----------------------------- 工具 -----------------------------

function log(title, obj) {
  console.log("\n=== " + title + " ===");
  if (typeof obj === "string") { console.log(obj); return; }
  console.log(JSON.stringify(obj, null, 2));
}

function findEntries(har, hostPattern) {
  const entries = (har && har.log && har.log.entries) || [];
  return entries.filter(e => hostPattern.test(new URL(e.request.url).host));
}

function entryBody(entry, side) {
  const c = entry[side].content || {};
  if (!c.text) return null;
  if (c.encoding === "base64") return Buffer.from(c.text, "base64");
  return Buffer.from(c.text, "binary");
}

// ----------------------------- 场景 1：离线构造并自检 -----------------------------

function buildAndVerify(sku, storefront) {
  const out = C.buildPrepareBody({ sku, storefront });
  log("构造 prepare 请求", {
    txId: out.txId,
    sku,
    storefront,
    bytes: out.bytes.length,
    b64Len: out.b64.length
  });

  // f5 是嵌套子消息，pbParse 会当字节数组返回，要再解一层
  const decoded = C.pbParse(out.bytes);
  const f5Bytes = Array.isArray(decoded[5]) ? decoded[5] : (decoded["_5_raw"] || []);
  const f5 = C.pbParse(f5Bytes);
  const skuBack = f5[1] || null;
  const storeBack = f5[3] || null;

  // f2 同理（bundle）
  const bundle = decoded[2] || null;

  // f4 子消息：iapVersion / iOS 版本
  const f4Bytes = Array.isArray(decoded[4]) ? decoded[4] : (decoded["_4_raw"] || []);
  const f4 = C.pbParse(f4Bytes);

  log("回读校验", {
    txId: decoded[1],
    bundle,
    sku提取: skuBack,
    storefront提取: storeBack,
    iapVersion: f4[1],
    iosVersion: f4[2],
    sku一致: skuBack === sku,
    store一致: storeBack === storefront,
    bundle正确: bundle === "com.google.gemini.generic"
  });

  const listBody = C.buildListProductsBody({ storefront });
  const listDecoded = C.pbParse(C.b64ToBytes(listBody));
  log("构造 ListProducts 请求", {
    bytes: C.b64ToBytes(listBody).length,
    field1: String(listDecoded[1] || "").slice(0, 80),
    field2: listDecoded[2],
    field3: listDecoded[3],
    field9: listDecoded[9]
  });

  return {
    skuOk: skuBack === sku,
    storeOk: storeBack === storefront,
    bundleOk: bundle === "com.google.gemini.generic"
  };
}

// ----------------------------- 场景 2：HAR 回放验证 -----------------------------

function analyzeHar(harPath) {
  const raw = fs.readFileSync(harPath, "utf8");
  const har = JSON.parse(raw);

  const commerce = findEntries(har, /applecommerce-pa\.googleapis\.com/);
  log("HAR 概览", {
    文件: path.basename(harPath),
    总请求: har.log.entries.length,
    applecommerce请求: commerce.length,
    oneGoogle请求: findEntries(har, /(^|\.)one\.google\.com$/).length
  });

  const results = [];

  commerce.forEach(e => {
    const url = e.request.url;
    const isPrepare = /transactions:prepare/.test(url);
    const isList = /ListProducts/.test(url);

    const rec = {
      方法: e.request.method,
      端点: isPrepare ? "transactions:prepare" : isList ? "ListProducts" : url.split("/").pop().slice(0, 40),
      状态: e.response.status
    };

    // ---- 请求侧 ----
    const reqText = e.request.postData && e.request.postData.text;
    if (reqText) {
      let reqBytes;
      try { reqBytes = Buffer.from(reqText, "base64"); } catch (err) { reqBytes = Buffer.from(reqText, "binary"); }
      const pb = C.pbParse(Array.from(reqBytes));
      if (isPrepare) {
        const f5 = String(pb[5] || "");
        rec.请求 = {
          交易UUID: pb[1],
          bundle: pb[2],
          SKU: (f5.match(/(g1\.ios\.[a-z0-9.]+)/) || [])[1],
          storefront: (f5.match(/\b(USA|TUR|IND|JPN|GBR|EGY)\b/) || [])[1],
          长度: reqBytes.length
        };
      } else if (isList) {
        rec.请求 = {
          optionsType: String(pb[1] || "").split("/").pop(),
          版本: pb[2],
          storefront: pb[3],
          长度: reqBytes.length
        };
      }
    }

    // ---- 响应侧 ----
    const respBytes = entryBody(e, "response");
    if (respBytes && respBytes.length) {
      const text = respBytes.toString("binary");
      const jwsList = text.match(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g) || [];

      if (jwsList.length) {
        rec.JWS条数 = jwsList.length;
        rec.JWS = jwsList.map(j => {
          const p = C.parseJws(j);
          let inner = null;
          if (p && p.payload && p.payload.request) {
            try { inner = JSON.parse(Buffer.from(p.payload.request, "base64").toString("utf8")); } catch (err) {}
          }
          return {
            kid: p && p.header && p.header.kid,
            alg: p && p.header && p.header.alg,
            iss: p && p.payload && p.payload.iss,
            aud: p && p.payload && p.payload.aud,
            bid: p && p.payload && p.payload.bid,
            price: p && p.payload && p.payload.price,
            productId: p && p.payload && p.payload.productId,
            nonce: p && p.payload && p.payload.nonce,
            appAccountToken: inner && inner.requestInfo && inner.requestInfo.appAccountToken,
            requestReferenceId: inner && inner.requestInfo && inner.requestInfo.requestReferenceId,
            operation: inner && inner.operation,
            period: inner && inner.period,
            storefront: inner && inner.storefront,
            currency: inner && inner.currency
          };
        });
      }

      if (isList) {
        // 产品清单
        const multi = [];
        let i = 0;
        const b = Array.from(respBytes);
        while (i < b.length) {
          try {
            const r = C.pbReadVarint(b, i);
            const key = r[0]; i = r[1];
            const field = Math.floor(key / 8), wire = key % 8;
            if (wire === 2) {
              const r2 = C.pbReadVarint(b, i);
              const len = r2[0]; i = r2[1];
              const seg = b.slice(i, i + len); i += len;
              if (field === 1) multi.push(Buffer.from(seg).toString("binary"));
            } else if (wire === 0) { const r3 = C.pbReadVarint(b, i); i = r3[1]; }
            else if (wire === 5) i += 4;
            else if (wire === 1) i += 8;
            else break;
          } catch (err) { break; }
        }
        rec.产品清单 = multi.map(s => ({
          SKU: (s.match(/(g1\.ios\.[a-z0-9.]+)/) || [])[1],
          名称: ((s.match(/Google (?:One|AI)[\x20-\x7e\u4e00-\u9fa5()]*/) || [])[0] || "").trim(),
          容量: ((s.match(/(\d+(?:\.\d+)?\s?(?:GB|TB))/) || [])[1] || ""),
          币种: ((s.match(/\b(USD|TRY|INR|JPY|GBP|EGY)\b/) || [])[1] || "")
        })).filter(x => x.SKU);
      }
    }

    results.push(rec);
  });

  log("逐条解析结果", results);
  return results;
}

// ----------------------------- 场景 3：重放可行性判定 -----------------------------

function feasibility(harPath) {
  const raw = fs.readFileSync(harPath, "utf8");
  const har = JSON.parse(raw);
  const preps = findEntries(har, /applecommerce-pa\.googleapis\.com/).filter(e => /transactions:prepare/.test(e.request.url));

  const facts = preps.map(e => {
    const reqBytes = Buffer.from(e.request.postData.text, "base64");
    const pb = C.pbParse(Array.from(reqBytes));
    const f5 = String(pb[5] || "");
    const respBytes = entryBody(e, "response") || Buffer.alloc(0);
    const jwsList = respBytes.toString("binary").match(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g) || [];
    let item = { txUUID: pb[1], sku: (f5.match(/(g1\.ios\.[a-z0-9.]+)/) || [])[1], jws: null, aat: null, ref: null };
    if (jwsList[0]) {
      const p = C.parseJws(jwsList[0]);
      if (p && p.payload && p.payload.request) {
        try {
          const inner = JSON.parse(Buffer.from(p.payload.request, "base64").toString("utf8"));
          item.aat = inner.requestInfo && inner.requestInfo.appAccountToken;
          item.ref = inner.requestInfo && inner.requestInfo.requestReferenceId;
        } catch (err) {}
      }
      item.jws = jwsList[0].slice(0, 40) + "…";
    }
    return item;
  });

  log("重放可行性（Observed）", facts);

  const txSet = new Set(facts.map(f => f.txUUID));
  const aatSet = new Set(facts.map(f => f.aat).filter(Boolean));

  const verdict = {
    交易UUID是否跨SKU复用: txSet.size === 1,
    不同UUID个数: txSet.size,
    appAccountToken是否跨SKU一致: aatSet.size <= 1,
    不同aat个数: aatSet.size,
    结论: ""
  };

  if (verdict['交易UUID是否跨SKU复用'] && verdict['appAccountToken是否跨SKU一致']) {
    verdict.结论 = "同一设备的 txUUID 与 appAccountToken 恒定 → 归属标识由客户端决定，服务端无法区分「谁买的」与「谁在用」。路径A（会话重放）成立。";
  } else if (!verdict['appAccountToken是否跨SKU一致']) {
    verdict.结论 = "每个 SKU 的 aat 不同 → 服务端可能按 SKU 维度隔离，需逐 SKU 单独取票。";
  } else {
    verdict.结论 = "交易 UUID 每次不同但 aat 一致 → 交易身份可重建，重放需复用 aat。";
  }

  log("判定", verdict);
  return verdict;
}

// ----------------------------- 入口 -----------------------------

const args = process.argv.slice(2);

if (args[0] === "--build") {
  const sku = args[1] || "g1.ios.2tb.ai.a";
  const store = args[2] || "USA";
  const r = buildAndVerify(sku, store);
  process.exit(r.skuOk && r.storeOk ? 0 : 1);
} else if (args[0]) {
  const p = path.resolve(args[0]);
  if (!fs.existsSync(p)) {
    console.error("文件不存在: " + p);
    process.exit(2);
  }
  analyzeHar(p);
  feasibility(p);
} else {
  console.log([
    "用法:",
    "  node gemini_checkout_harness.js <har路径>        # 离线解析 HAR 并判定重放可行性",
    "  node gemini_checkout_harness.js --build <SKU> <storefront>  # 构造请求体并自检",
    "",
    "可用 SKU:",
    Object.keys(C.SKU_TABLE).map(k => "  " + k + "  " + C.SKU_TABLE[k].name + " (" + C.SKU_TABLE[k].period + ")").join("\n")
  ].join("\n"));
}
