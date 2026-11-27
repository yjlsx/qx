/**
 * qx_parity_test.js — QX 脚本与 Node 公共库的一致性回归测试
 *
 * 目的：QX 脚本里各自内联了 proto 编解码（因为 QX 无 import）。
 *      本测试从这些脚本里抽取纯函数段，在 Node 里执行，
 *      与 gemini_common.js 的输出做逐字节比对，防止两边实现漂移。
 *
 * 用法：node qx_parity_test.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const C = require("./gemini_common.js");

const DIR = __dirname;

// ---- 从真实 HAR 里取出的三条 prepare 请求体（base64），作为黄金样本 ----
const GOLDEN = [
  {
    sku: "g1.ios.20tb.m.v2",
    storefront: "USA",
    txId: "C471BCB8-76BA-4A73-B5A1-E1310E318293",
    b64: "CiRDNDcxQkNCOC03NkJBLTRBNzMtQjVBMS1FMTMxMEUzMTgyOTMSGWNvbS5nb29nbGUuZ2VtaW5pLmdlbmVyaWMajgEKTHR5cGUuZ29vZ2xlYXBpcy5jb20vc3Vic2NyaXB0aW9ucy5jb21tb24ucHJvdG8uU3Vic2NyaXB0aW9uc0RldmVsb3BlclBheWxvYWQSPgo8CBwQ6AcYAyofMS4yMDI2LjE4NzAwMTAuMS4yMDI2LjE4NzAwMTAuMDoOL2R5bmFtaWMtcGxhbnNYS2AIIioKHzEuMjAyNi4xODcwMDEwLjEuMjAyNi4xODcwMDEwLjASBDE3LjAaAQEqFwoQZzEuaW9zLjIwdGIubS52MhoDVVNB"
  },
  {
    sku: "g1.ios.30tb.ai.pro.m",
    storefront: "USA",
    txId: "C471BCB8-76BA-4A73-B5A1-E1310E318293",
    b64: "CiRDNDcxQkNCOC03NkJBLTRBNzMtQjVBMS1FMTMxMEUzMTgyOTMSGWNvbS5nb29nbGUuZ2VtaW5pLmdlbmVyaWMajgEKTHR5cGUuZ29vZ2xlYXBpcy5jb20vc3Vic2NyaXB0aW9ucy5jb21tb24ucHJvdG8uU3Vic2NyaXB0aW9uc0RldmVsb3BlclBheWxvYWQSPgo8CBwQ6AcYAyofMS4yMDI2LjE4NzAwMTAuMS4yMDI2LjE4NzAwMTAuMDoOL2R5bmFtaWMtcGxhbnNYS2AIIioKHzEuMjAyNi4xODcwMDEwLjEuMjAyNi4xODcwMDEwLjASBDE3LjAaAQEqGwoUZzEuaW9zLjMwdGIuYWkucHJvLm0aA1VTQQ=="
  },
  {
    sku: "g1.ios.2tb.ai.a",
    storefront: "USA",
    txId: "C471BCB8-76BA-4A73-B5A1-E1310E318293",
    b64: "CiRDNDcxQkNCOC03NkJBLTRBNzMtQjVBMS1FMTMxMEUzMTgyOTMSGWNvbS5nb29nbGUuZ2VtaW5pLmdlbmVyaWMajgEKTHR5cGUuZ29vZ2xlYXBpcy5jb20vc3Vic2NyaXB0aW9ucy5jb21tb24ucHJvdG8uU3Vic2NyaXB0aW9uc0RldmVsb3BlclBheWxvYWQSPgo8CBwQ6AcYAyofMS4yMDI2LjE4NzAwMTAuMS4yMDI2LjE4NzAwMTAuMDoOL2R5bmFtaWMtcGxhbnNYS2AIIioKHzEuMjAyNi4xODcwMDEwLjEuMjAyNi4xODcwMDEwLjASBDE3LjAaAQEqFgoPZzEuaW9zLjJ0Yi5haS5hGgNVU0E="
  }
];

// ---- 从脚本源码里抽出纯函数段（从第一个 const B64_STD 到函数定义结束）----
function extractPrelude(src, stopMarker) {
  const start = src.indexOf("const B64_STD");
  if (start < 0) throw new Error("找不到 B64_STD 起点");
  const stop = src.indexOf(stopMarker);
  if (stop < 0 || stop <= start) throw new Error("找不到终点标记: " + stopMarker);
  return src.slice(start, stop);
}

// ---- 在隔离 vm 里执行抽取出的代码，返回导出的函数 ----
function loadFromScript(file, stopMarker, exports) {
  const src = fs.readFileSync(path.join(DIR, file), "utf8");
  const code = extractPrelude(src, stopMarker);
  const sandbox = { Math, Date, JSON, String, Array, Object, console };
  vm.createContext(sandbox);
  vm.runInContext(code + "\n;(" + JSON.stringify(exports) + ").forEach(n => { this[n] = typeof " + "eval(n) === 'function' ? eval(n) : undefined; });", sandbox);
  // 上面的动态导出不靠谱，改为显式 return 表达式
  const sandbox2 = { Math, Date, JSON, String, Array, Object, console };
  vm.createContext(sandbox2);
  const ret = exports.map(n => n + ": " + n).join(", ");
  vm.runInContext(code + "\n;({ " + ret + " });", sandbox2);
  return vm.runInContext("({ " + ret + " })", sandbox2);
}

function loadReplayBuilder() {
  const src = fs.readFileSync(path.join(DIR, "gemini_adv_replay.js"), "utf8");
  const start = src.indexOf("const B64_STD");
  const stop = src.indexOf("// ---------- 存储 ----------");
  const helpers = src.slice(start, stop);

  const fnStart = src.indexOf("function buildPrepareBody");
  const fnEnd = src.indexOf("// ---------- 单个目标 × 单条票据 ----------");
  const builder = src.slice(fnStart, fnEnd);

  const sandbox = { Math, Date, JSON, String, Array, Object, console, $prefs: null, $task: null, $notify: () => {}, $done: () => {} };
  vm.createContext(sandbox);
  vm.runInContext(helpers + "\n" + builder + "\n;globalThis.__build = buildPrepareBody;", sandbox);
  return sandbox.__build;
}

// ---- 执行比对 ----
function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function run() {
  const results = [];
  let pass = 0, fail = 0;

  // 测试 1：gemini_common.js 的 builder
  GOLDEN.forEach(g => {
    const real = C.b64ToBytes(g.b64);
    const built = C.buildPrepareBody({ sku: g.sku, storefront: g.storefront, txId: g.txId }).bytes;
    const ok = bytesEqual(real, built);
    results.push({ case: "common.js / " + g.sku, len: real.length + "/" + built.length, ok });
    ok ? pass++ : fail++;
  });

  // 测试 2：gemini_adv_replay.js 内联 builder
  let build;
  try {
    build = loadReplayBuilder();
  } catch (e) {
    results.push({ case: "加载 gemini_adv_replay.js 失败", err: String(e).slice(0, 200), ok: false });
    fail++;
    build = null;
  }
  if (build) {
    GOLDEN.forEach(g => {
      const real = C.b64ToBytes(g.b64);
      let built;
      try {
        built = build(g.sku, { txId: g.txId, storefront: g.storefront }).bytes;
      } catch (e) {
        results.push({ case: "replay.js / " + g.sku, err: String(e).slice(0, 160), ok: false });
        fail++;
        return;
      }
      const ok = bytesEqual(real, built);
      results.push({ case: "replay.js / " + g.sku, len: real.length + "/" + built.length, ok });
      ok ? pass++ : fail++;
    });
  }

  // 测试 3：ListProducts builder 结构健全
  try {
    const lp = C.buildListProductsBody({ storefront: "USA" });
    const dec = C.pbParse(C.b64ToBytes(lp));
    const ok = dec[2] === "1.2026.1870010.1.2026.1870010.0" && dec[3] === "USA" && dec[9] === "1.202618.05";
    results.push({ case: "ListProducts builder", len: C.b64ToBytes(lp).length, ok });
    ok ? pass++ : fail++;
  } catch (e) {
    results.push({ case: "ListProducts builder", err: String(e).slice(0, 160), ok: false });
    fail++;
  }

  // 测试 4：JWS 解析往返
  try {
    const C2 = C;
    const p = C2.parseJws("eyJraWQiOiJYSzUzNFdWR0MzIiwiYWxnIjoiRVMyNTYiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOiJhZHZhbmNlZC1jb21tZXJjZS1hcGkifQ.c2ln");
    const ok = p && p.header && p.header.kid === "XK534WVGC3" && p.payload && p.payload.aud === "advanced-commerce-api";
    results.push({ case: "JWS 解析", kid: p && p.header && p.header.kid, ok: !!ok });
    ok ? pass++ : fail++;
  } catch (e) {
    results.push({ case: "JWS 解析", err: String(e).slice(0, 160), ok: false });
    fail++;
  }

  // 输出
  console.log("\n=== QX / Node 一致性回归 ===\n");
  results.forEach(r => {
    const tag = r.ok ? "PASS" : "FAIL";
    console.log(`${tag}  ${r.case.padEnd(38)} ${r.len || ""} ${r.err || ""}`);
  });
  console.log(`\n合计: ${pass} 通过, ${fail} 失败`);

  return fail === 0;
}

process.exit(run() ? 0 : 1);
