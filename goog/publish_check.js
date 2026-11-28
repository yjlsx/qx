/**
 * publish_check.js — 上传 GitHub 前的发布前检查
 *
 * 校验项：
 *   1. QX 脚本完全自包含（无 require / import / fs / 外部 script-path）
 *   2. 所有 QX 脚本语法正确
 *   3. 配置里的脚本名与实际文件名一一对应
 *   4. README 里引用的文件名都存在
 *   5. 没有本地绝对路径（D:\ E:\ C:\）
 *   6. 没有把带脱敏占位符的原文残留进最终脚本
 *   7. 生成一份可直接用的 remote snippet（全部指向 GitHub raw）
 *
 * 用法：
 *   node publish_check.js
 *   node publish_check.js --snippet     # 追加输出可直接粘贴的 remote 配置
 */

const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const RAW = "https://raw.githubusercontent.com/yjlsx/qx/main/goog/";

let pass = 0, fail = 0, warn = 0;
const lines = [];

function ok(name, detail) { lines.push("PASS  " + name + (detail ? "   [" + detail + "]" : "")); pass++; }
function bad(name, detail) { lines.push("FAIL  " + name + (detail ? "   [" + detail + "]" : "")); fail++; }
function wrn(name, detail) { lines.push("WARN  " + name + (detail ? "   [" + detail + "]" : "")); warn++; }

// ---------------------------------------------------------------- 1. 自包含检查

const QX_SCRIPTS = [
  "g1-acq.qx.js",
  "g1-sku-report.qx.js",
  "g1-sku-scan.qx.js",
  "g1-pro-annual-test.qx.js",
  "gemini_prepare_capture.js",
  "gemini_prepare_response.js",
  "gemini_sku_probe.js",
  "gemini_activate_capture.js",
  "gemini_adv_replay.js"
];

/**
 * 精确检测外部依赖，不误伤 $prefs 之类的变量名。
 * 关键：用词边界，且 fs 只在 require/import/方法调用上下文里才算。
 */
const FORBIDDEN = [
  { name: "require()", re: /(^|[^.\w$])require\s*\(/m },
  { name: "ES import", re: /^\s*import\s+[\w{*]/m },
  { name: "ES export", re: /^\s*export\s+(default|const|function|class|\{)/m },
  { name: "fs 模块", re: /(^|[^.\w$])fs\s*\.\s*(readFile|writeFile|readdir|existsSync|statSync)/ },
  { name: "$httpClient", re: /\$httpClient\s*\./ },
  { name: "Buffer", re: /(^|[^.\w$])Buffer\s*[.[(]/ },
  { name: "process.", re: /(^|[^.\w$])process\s*\./ },
  { name: "child_process", re: /child_process/ },
  { name: "动态加载", re: /(loadScript|evalFile|importScripts)\s*\(/ },
  { name: "__dirname", re: /__dirname/ },
  { name: "__filename", re: /__filename/ }
];

function checkSelfContained() {
  QX_SCRIPTS.forEach(f => {
    const p = path.join(DIR, f);
    if (!fs.existsSync(p)) { bad(f + " 存在", "文件缺失"); return; }
    const src = fs.readFileSync(p, "utf8");
    const hits = FORBIDDEN.filter(r => r.re.test(src)).map(r => r.name);
    if (hits.length) bad(f + " 自包含", "含 " + hits.join(", "));
    else ok(f + " 自包含");
  });
}

// ---------------------------------------------------------------- 2. 语法检查

function checkSyntax() {
  QX_SCRIPTS.forEach(f => {
    const p = path.join(DIR, f);
    if (!fs.existsSync(p)) return;
    const src = fs.readFileSync(p, "utf8");
    try {
      // 包在函数里避免顶层 return 报错
      new Function(src);
      ok(f + " 语法");
    } catch (e) {
      bad(f + " 语法", e.message.slice(0, 120));
    }
  });
}

// ---------------------------------------------------------------- 3. 配置与脚本对应

function checkConfReferences() {
  const confs = fs.readdirSync(DIR).filter(f => f.endsWith(".conf"));
  if (!confs.length) { wrn("配置检查", "未找到 .conf"); return; }

  confs.forEach(conf => {
    const src = fs.readFileSync(path.join(DIR, conf), "utf8");
    // 抓 url script-xxx-body <filename>.js 里的文件名
    const re = /url\s+script-[a-z-]*body\s+([A-Za-z0-9_.-]+\.js)/g;
    const refs = new Set();
    let m;
    while ((m = re.exec(src)) !== null) refs.add(m[1]);

    // 抓 task_local 里的脚本名
    const re2 = /[\d*,/\s]+([A-Za-z0-9_.-]+\.js)\s*,\s*tag=/g;
    while ((m = re2.exec(src)) !== null) refs.add(m[1]);

    if (!refs.size) { wrn(conf + " 引用", "未解析到脚本名"); return; }

    const missing = [...refs].filter(f => !fs.existsSync(path.join(DIR, f)));
    if (missing.length) bad(conf + " 引用", "缺失: " + missing.join(", "));
    else ok(conf + " 引用 " + refs.size + " 个脚本", [...refs].join(", "));
  });
}

// ---------------------------------------------------------------- 4. README 文件名

function checkReadmeLinks() {
  const p = path.join(DIR, "README.md");
  if (!fs.existsSync(p)) { wrn("README", "不存在"); return; }
  const src = fs.readFileSync(p, "utf8");

  // 只检查 markdown 链接语法 [label](path) 与 `path` 代码块里出现的完整文件名
  // 正文里当简称用的 "common.js" / "replay.js" 不参与检查，避免误报
  const names = new Set();

  // [x](D:\...\file.js) 或 [x](file.js)
  const linkRe = /\]\(([^)]+\.(?:js|conf|md))\)/g;
  let m;
  while ((m = linkRe.exec(src)) !== null) {
    const raw = m[1].replace(/\\/g, "/").split("/").pop();
    if (raw) names.add(raw);
  }

  // 代码块/行内代码里 `xxx.js` 形式
  const codeRe = /`([A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:js|conf|md))`/g;
  while ((m = codeRe.exec(src)) !== null) names.add(m[1]);

  if (!names.size) { ok("README 文件名（未引用具体文件）"); return; }

  const missing = [...names].filter(n => !fs.existsSync(path.join(DIR, n)));
  if (missing.length) bad("README 文件名", "不存在: " + missing.join(", "));
  else ok("README 文件名 " + names.size + " 个全部存在", [...names].join(", "));
}

// ---------------------------------------------------------------- 5. 本地绝对路径

function checkLocalPaths() {
  const files = fs.readdirSync(DIR).filter(f => /\.(js|conf|md)$/.test(f));
  const offenders = [];
  files.forEach(f => {
    const src = fs.readFileSync(path.join(DIR, f), "utf8");
    // 排除注释里的示例和检查器自己的正则
    const re = /\b([A-Z]):\\(?!GitHub\\qx)([^\s"'`)]+)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const line = src.slice(Math.max(0, m.index - 60), m.index).split("\n").pop();
      if (/^\s*(?:\/\/|\*|#)/.test(line)) continue;          // 注释行跳过
      if (/publish_check|FORBIDDEN|正则/.test(line)) continue;
      offenders.push(f + ":" + m[0].slice(0, 40));
    }
  });
  if (offenders.length) wrn("本地绝对路径", offenders.slice(0, 5).join(" | ") + (offenders.length > 5 ? " …" : ""));
  else ok("无本地绝对路径");
}

// ---------------------------------------------------------------- 6. 脱敏占位符残留

function checkPlaceholders() {
  // 转换器本身必须保留映射表（它的工作就是把占位符换成可读 key），排除它
  const EXEMPT = new Set(["convert_sgmodule.js", "publish_check.js"]);
  // 只有会被 QX 直接加载的脚本才不允许残留
  const files = QX_SCRIPTS;

  const offenders = [];
  files.forEach(f => {
    if (EXEMPT.has(f)) return;
    const p = path.join(DIR, f);
    if (!fs.existsSync(p)) return;
    const src = fs.readFileSync(p, "utf8");
    const m = src.match(/\{\{(?:SECRET|TOKEN|EMAIL)_[a-z0-9]+\}\}/g);
    if (m) offenders.push(f + " (" + [...new Set(m)].join(",") + ")");
  });
  if (offenders.length) bad("脱敏占位符残留", offenders.join(" | "));
  else ok("7 个 QX 脚本无脱敏占位符残留");

  // 配置里也不该出现
  const confBad = [];
  fs.readdirSync(DIR).filter(f => f.endsWith(".conf")).forEach(f => {
    const src = fs.readFileSync(path.join(DIR, f), "utf8");
    if (/\{\{(?:SECRET|TOKEN)_[a-z0-9]+\}\}/.test(src)) confBad.push(f);
  });
  if (confBad.length) bad("配置含脱敏占位符", confBad.join(", "));
  else ok("配置文件无脱敏占位符残留");
}

// ---------------------------------------------------------------- 7. 生成 remote snippet

function buildSnippet() {
  const rewriteLines = [
    "# G1 ACQ Plus（QX 版，远程脚本）",
    "^https:\\/\\/one\\.google\\.com\\/g1-sku-report\\/?(\\?.*)?$ url script-request-body " + RAW + "g1-sku-report.qx.js reject",
    "^https:\\/\\/one\\.google\\.com\\/ url script-response-body " + RAW + "g1-acq.qx.js",
    "",
    "# 高级商务交易链抓取（可选）",
    "^https:\\/\\/applecommerce-pa\\.googleapis\\.com\\/v1\\/transactions:prepare url script-request-body " + RAW + "gemini_prepare_capture.js reject-200",
    "^https:\\/\\/applecommerce-pa\\.googleapis\\.com\\/\\$rpc\\/google\\.subscriptions\\.apple\\.commerce\\.v1\\.AppleCommerceService\\/ListProducts url script-response-body " + RAW + "gemini_sku_probe.js",
    "^https:\\/\\/one\\.google\\.com\\/_\\/SubscriptionsManagementUi\\/data\\/batchexecute url script-request-body " + RAW + "gemini_activate_capture.js"
  ];

  const taskLines = [
    "*/6 * * * * " + RAW + "gemini_adv_replay.js, tag=Gemini高级商务重放, enabled=false"
  ];

  const mitmLine = "hostname = %APPEND% one.google.com, applecommerce-pa.googleapis.com, play.googleapis.com, accounts.google.com, www.googleapis.com, ogads-pa.clients6.google.com";

  return [
    "# ============================================================",
    "# Quantumult X 远程脚本配置（脚本托管在 GitHub raw）",
    "# 仓库: https://github.com/yjlsx/qx  →  goog/",
    "# ============================================================",
    "",
    "[mitm]",
    mitmLine,
    "",
    "[rewrite_local]",
    ...rewriteLines,
    "",
    "[task_local]",
    ...taskLines
  ].join("\n");
}

// ---------------------------------------------------------------- 主流程

console.log("=== 发布前检查 ===\n");

checkSelfContained();
checkSyntax();
checkConfReferences();
checkReadmeLinks();
checkLocalPaths();
checkPlaceholders();

lines.forEach(l => console.log(l));
console.log(`\n合计: ${pass} 通过, ${warn} 警告, ${fail} 失败`);

if (process.argv.includes("--snippet")) {
  const snip = buildSnippet();
  const out = path.join(DIR, "quantumultx-remote.conf");
  fs.writeFileSync(out, snip + "\n", "utf8");
  console.log("\n=== 已生成 quantumultx-remote.conf ===\n");
  console.log(snip);
}

process.exit(fail === 0 ? 0 : 1);
