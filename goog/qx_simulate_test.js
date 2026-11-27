/**
 * qx_simulate_test.js — 在模拟的 Quantumult X 运行时里执行转换后的脚本
 *
 * 目的：转换器只检查了语法，但 QX 的坑在运行时——
 *      $done 的调用形态、$prefs 的读写语义、$request/$response 的字段名。
 *      本测试构造一个最小 QX 沙箱，真实跑一遍转换后的脚本，
 *      验证：① 不会抛异常 ② $done 参数符合 QX 结构 ③ 改写逻辑真的生效。
 *
 * 用法：node qx_simulate_test.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const DIR = __dirname;

let pass = 0, fail = 0;
const results = [];

function check(name, cond, detail) {
  results.push({ name, ok: !!cond, detail: detail || "" });
  cond ? pass++ : fail++;
}

// ------------------------------------------------------------ QX 沙箱

/**
 * 构造 Quantumult X 运行时沙箱。
 * opts:
 *   prefs   —— 预置的 $prefs 存储（对象）
 *   request —— $request 对象
 *   response—— $response 对象
 * 返回 { sandbox, doneCalls }
 */
function makeQX(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.prefs || {});
  const doneCalls = [];

  const $prefs = {
    valueForKey: k => (Object.prototype.hasOwnProperty.call(store, k) ? String(store[k]) : null),
    setValueForKey: (v, k) => { store[k] = String(v); return true; },
    removeValueForKey: k => { delete store[k]; return true; }
  };

  const $notify = (title, subtitle, body) => {
    (opts.notifications || []).push({ title, subtitle, body });
  };

  const $done = obj => { doneCalls.push(obj); };

  const sandbox = {
    $prefs, $done, $notify,
    $task: { fetch: () => Promise.resolve({ status: 200, body: "{}" }) },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
    parseInt, parseFloat, isFinite, isNaN, encodeURIComponent, decodeURIComponent,
    setTimeout, clearTimeout,
    // QX 不提供这些，验证脚本没有偷偷依赖
    Buffer: undefined,
    require: undefined,
    process: undefined
  };
  if (opts.request) sandbox.$request = opts.request;
  if (opts.response) sandbox.$response = opts.response;

  sandbox.globalThis = sandbox;
  return { sandbox, doneCalls, store };
}

function runScript(file, opts) {
  const src = fs.readFileSync(path.join(DIR, file), "utf8");
  const ctx = makeQX(opts);
  vm.createContext(ctx.sandbox);
  let err = null;
  try {
    vm.runInContext(src, ctx.sandbox, { timeout: 15000 });
  } catch (e) {
    err = e;
  }
  return { err, doneCalls: ctx.doneCalls, store: ctx.store };
}

// ------------------------------------------------------------ 测试数据

// 取自真实 HAR 的 /ai 首屏响应片段（含 g1.ios.* SKU），用于验证映射改写
function buildAiPageBody() {
  const skus = [
    "g1.ios.100gb.m", "g1.ios.100gb.a",
    "g1.ios.helium.m", "g1.ios.helium.a",
    "g1.ios.2tb.m", "g1.ios.2tb.a",
    "g1.ios.2tb.ai.m", "g1.ios.2tb.ai.a",
    "g1.ios.20tb.m.v2", "g1.ios.30tb.ai.pro.m"
  ];
  // 模拟 WIZ_global_data 里的形态：JSON 字符串转义 + 逗号分隔
  return 'AF_initDataCallback({key: \'ds:0\', data:[null,null,"USA",[["g1.ios.100gb.m"],[' +
    skus.map(s => '\\"' + s + '\\"').join(",") +
    '],"USD"],sideChannel: {}})';
}

// 上游默认规则的源 SKU 与目标 SKU（来自 g1-acq.js defaults()）
const DEFAULT_FROM = "g1.ios.20tb.m.v2";
const DEFAULT_TO = "com.google.gemini.2tb.ai.m.3month_ip_99p";

// ------------------------------------------------------------ 用例

// === 用例 1：g1-acq.qx.js 对 /ai 页面的改写 ===
function testAcqRewrite() {
  const body = buildAiPageBody();
  const r = runScript("g1-acq.qx.js", {
    request: { url: "https://one.google.com/ai?utm_source=gemini&hl=zh_CN", method: "GET", headers: {} },
    response: { statusCode: 200, headers: { "Content-Type": "text/html; charset=utf-8" }, body }
  });

  check("g1-acq 执行不抛异常", !r.err, r.err ? String(r.err).slice(0, 200) : "");
  check("g1-acq 调用了 $done", r.doneCalls.length >= 1, `done 调用 ${r.doneCalls.length} 次`);

  const done = r.doneCalls[r.doneCalls.length - 1];
  check("g1-acq $done 返回对象", done && typeof done === "object",
    JSON.stringify(done || null).slice(0, 120));

  // 有命中时应当返回 body
  const outBody = done && typeof done.body === "string" ? done.body : null;
  check("g1-acq 返回了改写后的 body", outBody !== null, outBody ? `长度 ${outBody.length}` : "未返回 body");

  if (outBody) {
    check("默认规则命中：源 SKU 被替换为目标 SKU",
      outBody.indexOf(DEFAULT_TO) >= 0 && outBody.indexOf(DEFAULT_FROM) < 0,
      `含 ${DEFAULT_TO} = ${outBody.indexOf(DEFAULT_TO) >= 0}, 含 ${DEFAULT_FROM} = ${outBody.indexOf(DEFAULT_FROM) >= 0}`);

    // 其余 SKU 不应被动
    const untouched = ["g1.ios.2tb.ai.a", "g1.ios.helium.m", "g1.ios.100gb.m"];
    const allKept = untouched.every(s => outBody.indexOf(s) >= 0);
    check("未匹配的 SKU 保持原样", allKept, untouched.join(", "));

    // $done 结构必须符合 QX：只有 status/headers/body，不能有 response 包层
    check("$done 无 SG 的 response 包层", !("response" in done), JSON.stringify(Object.keys(done)));
  }

  // 状态记录应当写入 QX prefs
  check("执行记录写入 g1_acq_last_test", !!r.store["g1_acq_last_test"],
    r.store["g1_acq_last_test"] ? r.store["g1_acq_last_test"].slice(0, 100) : "未写入");
  check("调试日志写入 g1_acq_debug_log", !!r.store["g1_acq_debug_log"],
    r.store["g1_acq_debug_log"] ? `长度 ${r.store["g1_acq_debug_log"].length}` : "未写入");
  check("SKU 采集写入 g1_acq_sku_scan", !!r.store["g1_acq_sku_scan"],
    r.store["g1_acq_sku_scan"] ? `长度 ${r.store["g1_acq_sku_scan"].length}` : "未写入");
}

// === 用例 2：g1-acq.qx.js 对非目标端点直接放行 ===
function testAcqPassthrough() {
  const r = runScript("g1-acq.qx.js", {
    request: { url: "https://one.google.com/_/SubscriptionsManagementUi/data/batchexecute?rpcids=GI6Jdd", method: "POST", headers: {}, body: "f.req=%5B%5D" },
    response: { statusCode: 200, headers: { "Content-Type": "application/json" }, body: '{"ok":true}' }
  });
  check("非目标端点执行不抛异常", !r.err, r.err ? String(r.err).slice(0, 160) : "");
  const done = r.doneCalls[r.doneCalls.length - 1];
  check("非目标端点 $done 返回空对象（放行原响应）",
    done && Object.keys(done).length === 0,
    JSON.stringify(done || null).slice(0, 120));
}

// === 用例 3：g1-acq.qx.js 处理 report 路径时直接放行 ===
function testAcqSkipsReport() {
  const r = runScript("g1-acq.qx.js", {
    request: { url: "https://one.google.com/g1-sku-report", method: "GET", headers: {} },
    response: { statusCode: 200, headers: {}, body: "x" }
  });
  check("report 路径被 g1-acq 放行", !r.err && r.doneCalls.length === 1 &&
    Object.keys(r.doneCalls[0]).length === 0,
    r.err ? String(r.err).slice(0, 160) : JSON.stringify(r.doneCalls[0]));
}

// === 用例 4：g1-sku-report.qx.js 渲染管理页 ===
function testReportPage() {
  const r = runScript("g1-sku-report.qx.js", {
    request: { url: "https://one.google.com/g1-sku-report", method: "GET", headers: {} }
  });

  check("g1-sku-report 执行不抛异常", !r.err, r.err ? String(r.err).slice(0, 200) : "");
  check("g1-sku-report 调用了 $done", r.doneCalls.length === 1, `done ${r.doneCalls.length} 次`);

  const done = r.doneCalls[0] || {};
  check("g1-sku-report 返回扁平结构（有 status）", typeof done.status === "number", "status=" + done.status);
  check("g1-sku-report 返回 text/html", typeof done.body === "string" && done.body.indexOf("<html") >= 0,
    done.body ? `body 长度 ${done.body.length}` : "无 body");
  check("g1-sku-report 声明的 Content-Type 正确",
    done.headers && /text\/html/.test(done.headers["Content-Type"] || ""),
    JSON.stringify(done.headers || {}).slice(0, 160));
  check("页面含映射配置表单", typeof done.body === "string" && /<form/i.test(done.body), "");
  check("页面含默认规则目标 SKU", typeof done.body === "string" && done.body.indexOf(DEFAULT_TO) >= 0, "");
}

// === 用例 5：g1-sku-report.qx.js 的 TXT 导出 ===
function testReportTxt() {
  const r = runScript("g1-sku-report.qx.js", {
    request: { url: "https://one.google.com/g1-sku-report?format=txt", method: "GET", headers: {} }
  });
  const done = r.doneCalls[0] || {};
  check("TXT 导出不抛异常", !r.err, r.err ? String(r.err).slice(0, 160) : "");
  check("TXT 导出返回文本",
    typeof done.body === "string" && done.body.length > 0 && done.body.indexOf("<html") < 0,
    done.body ? `长度 ${done.body.length}, 首行: ${done.body.split("\n")[0].slice(0, 60)}` : "无 body");
  check("TXT Content-Type",
    done.headers && /text\/plain/.test(done.headers["Content-Type"] || ""),
    done.headers ? done.headers["Content-Type"] : "无");
}

// === 用例 6：JSON 导出 ===
function testReportJson() {
  const r = runScript("g1-sku-report.qx.js", {
    request: { url: "https://one.google.com/g1-sku-report?format=json", method: "GET", headers: {} }
  });
  const done = r.doneCalls[0] || {};
  let parsed = null;
  try { parsed = JSON.parse(done.body); } catch (e) {}
  check("JSON 导出可解析", parsed !== null, parsed ? Object.keys(parsed).join(",") : "解析失败");
  // 上游导出字段名是 mappingConfig，不是 mapping
  check("JSON 含 mappingConfig 配置段", !!(parsed && parsed.mappingConfig),
    parsed && parsed.mappingConfig ? Object.keys(parsed.mappingConfig).join(",") : "无");
  check("JSON 含 scan 段（SKU 采集）", !!(parsed && parsed.scan), "");
  check("JSON 含 test 段（执行记录）", !!(parsed && parsed.test), "");
}

// === 用例 7：预设切换（applyPreset）落库 ===
function testApplyPreset() {
  // 默认态下 revision 是常量字符串 "defaults-v9-99p"，且不写库（上游设计如此）
  const r1 = runScript("g1-sku-report.qx.js", {
    request: { url: "https://one.google.com/g1-sku-report?format=json", method: "GET", headers: {} }
  });
  let cfg1 = null;
  try { cfg1 = JSON.parse(r1.doneCalls[0].body).mappingConfig; } catch (e) {}
  check("默认态显示内置规则", cfg1 && cfg1.status === "default" && Array.isArray(cfg1.rules) && cfg1.rules.length === 1,
    cfg1 ? `status=${cfg1.status}, rules=${cfg1.rules ? cfg1.rules.length : 0}` : "无");
  check("默认态 revision 为约定常量", cfg1 && cfg1.revision === "defaults-v9-99p",
    cfg1 ? String(cfg1.revision) : "无");
  // 上游只在「自定义或恢复默认」时写库，默认态 store 为空是正确的
  check("默认态不写库（上游设计）", !r1.store["g1_acq_mapping_cfg"],
    r1.store["g1_acq_mapping_cfg"] ? "意外写入" : "未写入");

  if (!cfg1 || !cfg1.revision) return;

  // 用 POST 应用「土区 Ultra」预设
  const postBody = "action=preset&revision=" + encodeURIComponent(cfg1.revision) + "&preset=tr-ultra-legacy";
  const r2 = runScript("g1-sku-report.qx.js", {
    request: {
      url: "https://one.google.com/g1-sku-report",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: postBody
    }
  });
  const done = r2.doneCalls[0] || {};
  check("应用预设返回 303 重定向", done.status === 303, "status=" + done.status);
  check("应用预设设置 Location",
    done.headers && /notice=preset/.test(done.headers.Location || ""),
    done.headers ? done.headers.Location : "无");

  let cfg = null;
  try { cfg = JSON.parse(r2.store["g1_acq_mapping_cfg"]); } catch (e) {}
  check("预设已写入配置", cfg && Array.isArray(cfg.rules) && cfg.rules.length === 2,
    cfg ? `rules=${cfg.rules ? cfg.rules.length : 0}, customized=${cfg.customized}` : "未写入");
  if (cfg && cfg.rules) {
    const hasTr = cfg.rules.some(r => r.to === "g1.ios.30tb.m");
    check("预设内容正确（土区 30TB 老 SKU）", hasTr, JSON.stringify(cfg.rules).slice(0, 200));
  }
}

// === 用例 8：预设生效后，g1-acq 按新规则改写 ===
function testPresetAffectsRewrite() {
  const presetCfg = {
    schemaVersion: 1,
    revision: "a".repeat(48),
    updatedAt: new Date().toISOString(),
    customized: true,
    rules: [{ id: "r1", match: "exact", from: "g1.ios.30tb.ai.pro.m", to: "g1.ios.30tb.m", enabled: true }]
  };

  const body = buildAiPageBody();
  const r = runScript("g1-acq.qx.js", {
    prefs: { g1_acq_mapping_cfg: JSON.stringify(presetCfg) },
    request: { url: "https://one.google.com/ai", method: "GET", headers: {} },
    response: { statusCode: 200, headers: { "Content-Type": "text/html" }, body }
  });

  const done = r.doneCalls[r.doneCalls.length - 1] || {};
  const out = typeof done.body === "string" ? done.body : "";
  check("自定义规则生效：30TB→土区老 SKU",
    out.indexOf('"g1.ios.30tb.m"') >= 0 || out.indexOf("g1.ios.30tb.m\\") >= 0 || /g1\.ios\.30tb\.m(?![.\w])/.test(out),
    out ? out.slice(Math.max(0, out.indexOf("30tb") - 30), out.indexOf("30tb") + 60) : "无 body");
  check("自定义规则生效：默认规则不再生效（20tb.v2 保留）",
    out.indexOf(DEFAULT_FROM) >= 0,
    `含 ${DEFAULT_FROM} = ${out.indexOf(DEFAULT_FROM) >= 0}`);
}

// === 用例 9：QX prefs 语义验证——写后读一致 ===
function testPrefsRoundTrip() {
  const ctx = makeQX({});
  ctx.sandbox.$done = () => {};
  vm.createContext(ctx.sandbox);
  vm.runInContext(`
    var ok = $prefs.setValueForKey("hello", "k1");
    var v = $prefs.valueForKey("k1");
    var missing = $prefs.valueForKey("nope");
    globalThis.__r = { ok: ok, v: v, missing: missing, missingIsNull: missing === null };
  `, ctx.sandbox);
  const r = ctx.sandbox.__r;
  check("$prefs 写入返回 true", r.ok === true, String(r.ok));
  check("$prefs 读回一致", r.v === "hello", String(r.v));
  check("$prefs 缺失 key 返回 null", r.missingIsNull === true, String(r.missing));
}

// === 用例 10：脚本不依赖 Node/QX 没有的全局 ===
function testNoForbiddenGlobals() {
  ["g1-acq.qx.js", "g1-sku-report.qx.js"].forEach(f => {
    const src = fs.readFileSync(path.join(DIR, f), "utf8");
    check(f + " 不含 Buffer", !/\bBuffer\s*[.[]/.test(src), "");
    check(f + " 不含 require()", !/\brequire\s*\(/.test(src), "");
    check(f + " 不含可选链 ?.", !/\?\.\s*[A-Za-z_$]/.test(src), "");
    check(f + " 不含阶段 3 语法 ??=", !/\?\?=/.test(src), "");
  });
}

// === 用例 11：上游完整预置菜单可枚举（预设渲染在管理页 HTML 里，不在 JSON 导出里）===
function testPresetCatalog() {
  const r = runScript("g1-sku-report.qx.js", {
    request: { url: "https://one.google.com/g1-sku-report", method: "GET", headers: {} }
  });
  const done = r.doneCalls[0] || {};
  const html = typeof done.body === "string" ? done.body : "";

  // 从 HTML 里抓所有 preset 表单的 value，即可用预设清单
  const ids = [];
  const re = /name=["']?preset["']?\s+value=["']([a-z0-9-]+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) if (ids.indexOf(m[1]) < 0) ids.push(m[1]);

  check("管理页渲染了预设清单", ids.length >= 8, `${ids.length} 个: ${ids.slice(0, 6).join(",")}`);
  check("含 pro-1yuan 预设（0.05 折 Pro）", ids.indexOf("pro-1yuan") >= 0, "");
  check("含 tr-ultra-legacy 预设（土区 Ultra）", ids.indexOf("tr-ultra-legacy") >= 0, "");
  check("含批量探测包 A", ids.indexOf("probe-batch-1-gemini") >= 0, "");

  // 默认规则必须出现在页面上
  check("页面展示默认规则目标", html.indexOf(DEFAULT_TO) >= 0, "");
}

// ------------------------------------------------------------ 执行

console.log("=== Quantumult X 运行时模拟测试 ===\n");

testPrefsRoundTrip();
testAcqRewrite();
testAcqPassthrough();
testAcqSkipsReport();
testReportPage();
testReportTxt();
testReportJson();
testApplyPreset();
testPresetAffectsRewrite();
testNoForbiddenGlobals();
testPresetCatalog();

results.forEach(r => {
  console.log((r.ok ? "PASS  " : "FAIL  ") + r.name + (r.detail ? "   [" + r.detail + "]" : ""));
});
console.log(`\n合计: ${pass} 通过, ${fail} 失败`);

process.exit(fail === 0 ? 0 : 1);
