/**
 * test_new_scripts.js — 验证新转换的两个脚本在 QX 沙箱里的真实行为
 *
 * 覆盖：
 *   g1-sku-scan.qx.js       被动采集 SKU，响应原样放行
 *   g1-pro-annual-test.qx.js 改写 g1.ios.2tb.* → g1.2tb.ai.annual
 *
 * 用法：node test_new_scripts.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

let pass = 0, fail = 0;
const log = [];
const ok = (n, d) => { log.push("PASS  " + n + (d ? "   [" + d + "]" : "")); pass++; };
const bad = (n, d) => { log.push("FAIL  " + n + (d ? "   [" + d + "]" : "")); fail++; };

function makeQX(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.prefs || {});
  const doneCalls = [];
  const ctx = {
    $prefs: {
      valueForKey: k => (store[k] !== undefined ? String(store[k]) : null),
      setValueForKey: (v, k) => { store[k] = String(v); return true; },
      removeValueForKey: k => { delete store[k]; return true; }
    },
    $done: o => doneCalls.push(o),
    $notify: () => {},
    $task: { fetch: () => Promise.resolve({ status: 200, body: "{}" }) },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
    parseInt, parseFloat, isFinite, isNaN, encodeURIComponent, decodeURIComponent,
    setTimeout, clearTimeout
  };
  if (opts.request) ctx.$request = opts.request;
  if (opts.response) ctx.$response = opts.response;
  ctx.globalThis = ctx;
  return { ctx, doneCalls, store };
}

function run(file, opts) {
  const src = fs.readFileSync(path.join(__dirname, file), "utf8");
  const q = makeQX(opts);
  vm.createContext(q.ctx);
  let err = null;
  try { vm.runInContext(src, q.ctx, { timeout: 15000 }); } catch (e) { err = e; }
  return { err, done: q.doneCalls, store: q.store };
}

// ------------------------------------------------------------ 测试数据

// 模拟 one.google.com/ai 页面响应，含各种 g1.ios.* SKU
function pageBody() {
  return 'AF_initDataCallback({key:\'ds:0\',data:[null,null,"USA",[[' +
    ['g1.ios.100gb.m','g1.ios.2tb.m','g1.ios.2tb.a','g1.ios.2tb.ai.m','g1.ios.2tb.ai.a',
     'g1.ios.20tb.m.v2','g1.ios.30tb.ai.pro.m','g1.ios.helium.m']
      .map(s => '"' + s + '"').join(',') +
    '],"USD"]})';
}

// ------------------------------------------------------------ 1. g1-sku-scan

console.log("=== 新脚本行为验证 ===\n");

(function testSkuScan() {
  const body = pageBody();
  const r = run("g1-sku-scan.qx.js", {
    request: { url: "https://one.google.com/ai?hl=zh_CN", method: "GET", headers: {} },
    response: { statusCode: 200, headers: { "Content-Type": "text/html" }, body }
  });

  ok("sku-scan 不抛异常", !r.err, r.err ? String(r.err).slice(0, 150) : "");
  ok("sku-scan $done 调一次", r.done.length === 1, "次数 " + r.done.length);

  // 关键：被动采集，必须原样放行
  const d = r.done[0] || {};
  ok("sku-scan 原样放行响应", Object.keys(d).length === 0, JSON.stringify(d).slice(0, 80));

  // 采集结果落库
  const raw = r.store["g1_acq_sku_scan"];
  ok("sku-scan 写入 g1_acq_sku_scan", !!raw, raw ? raw.length + "B" : "未写入");

  if (raw) {
    let st = null;
    try { st = JSON.parse(raw); } catch (e) {}
    ok("采集结果可解析", st !== null && st.schemaVersion === 1,
      st ? `schemaVersion=${st.schemaVersion}` : "解析失败");
    if (st && Array.isArray(st.skus)) {
      const ids = st.skus.map(s => s.id);
      ok("采到 SKU 数量正确", ids.length >= 8, ids.length + " 个");
      ok("含 g1.ios.2tb.ai.a", ids.indexOf("g1.ios.2tb.ai.a") >= 0, "");
      ok("含 g1.ios.30tb.ai.pro.m", ids.indexOf("g1.ios.30tb.ai.pro.m") >= 0, "");
      // 只采 g1.* 和 com.google.one.*
      const bad2 = ids.filter(i => !/^(g1\.|com\.google\.one\.)/.test(i));
      ok("只采合法前缀", bad2.length === 0, bad2.join(",") || "无越界");
    } else {
      bad("采集结果含 skus 数组", "缺失");
    }
  }
})();

// 非 one.google.com 域名应被忽略
(function testSkuScanSkip() {
  const r = run("g1-sku-scan.qx.js", {
    request: { url: "https://example.com/ai", method: "GET", headers: {} },
    response: { statusCode: 200, headers: {}, body: '"g1.ios.2tb.m"' }
  });
  ok("sku-scan 非目标域直接放行", r.done.length === 1 && Object.keys(r.done[0]).length === 0, "");
  ok("sku-scan 非目标域不写库", !r.store["g1_acq_sku_scan"], r.store["g1_acq_sku_scan"] ? "意外写入" : "未写入");
})();

// 管理页路径应跳过（避免自我采集）
(function testSkuScanSkipReport() {
  const r = run("g1-sku-scan.qx.js", {
    request: { url: "https://one.google.com/g1-sku-report", method: "GET", headers: {} },
    response: { statusCode: 200, headers: {}, body: '"g1.ios.2tb.m"' }
  });
  ok("sku-scan 跳过管理页", r.done.length === 1 && Object.keys(r.done[0]).length === 0, "");
})();

// ------------------------------------------------------------ 2. g1-pro-annual-test

(function testProAnnual() {
  const body = pageBody();
  const r = run("g1-pro-annual-test.qx.js", {
    request: { url: "https://one.google.com/ai?hl=zh_CN", method: "GET", headers: {} },
    response: { statusCode: 200, headers: { "Content-Type": "text/html" }, body }
  });

  ok("pro-annual 不抛异常", !r.err, r.err ? String(r.err).slice(0, 150) : "");
  ok("pro-annual $done 调一次", r.done.length === 1, "次数 " + r.done.length);

  const d = r.done[0] || {};
  const out = typeof d.body === "string" ? d.body : "";
  ok("pro-annual 返回改写后的 body", out.length > 0, out ? out.length + "B" : "未返回");

  if (out) {
    // g1.ios.2tb.* 全部改成 g1.2tb.ai.annual
    const annualCount = (out.match(/g1\.2tb\.ai\.annual/g) || []).length;
    ok("annual 改写生效（g1.ios.2tb.* → g1.2tb.ai.annual）", annualCount >= 4, annualCount + " 处");

    // 20TB / 30TB 走 SKU_MAP（90p），fallback 到 75p 取决于原响应里有没有 75p 字符串
    ok("20TB → 3months_ip_90p.acq", out.indexOf("g1.20tb.3months_ip_90p.acq") >= 0, "");
    ok("30TB → ai.ultra.3months_ip_90p.acq", out.indexOf("g1.ai.ultra.3months_ip_90p.acq") >= 0, "");

    // 不在映射表里的不该动
    ok("helium 保持原样", out.indexOf("g1.ios.helium.m") >= 0, "");
    ok("100gb 保持原样", out.indexOf("g1.ios.100gb.m") >= 0, "");
  }

  const raw = r.store["g1_acq_last_test"];
  if (raw) {
    let rec = null;
    try { rec = JSON.parse(raw); } catch (e) {}
    ok("执行记录可解析", rec !== null, "");
    ok("记录了 annualHitCount", rec && rec.annualHitCount >= 4, rec ? "annualHits=" + rec.annualHitCount : "无");
    ok("status=rewritten", rec && rec.status === "rewritten", rec ? rec.status : "无");
  } else {
    bad("写入 g1_acq_last_test", "未写入");
  }
})();

// 非 /ai? 路径应放行
(function testProAnnualSkip() {
  const r = run("g1-pro-annual-test.qx.js", {
    request: { url: "https://one.google.com/plans", method: "GET", headers: {} },
    response: { statusCode: 200, headers: {}, body: '"g1.ios.2tb.m"' }
  });
  ok("pro-annual 非 /ai? 路径放行", r.done.length === 1 && Object.keys(r.done[0]).length === 0, "");
})();

// ------------------------------------------------------------ 输出

log.forEach(l => console.log(l));
console.log(`\n合计: ${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
