/**
 * validate_qx_syntax.js — Quantumult X 语法合规校验
 *
 * 依据官方 sample.conf（https://raw.githubusercontent.com/crossutility/Quantumult-X/master/sample.conf）
 *
 * 核心规则（这次踩的坑）：
 *   [rewrite_local] 里 script-request-body / script-response-body 的参数
 *   期望是【本地文件名】（"./x.js" 或 "x.js"），官方原文：
 *     "The scripts for script-request-body, ... should be saved in local
 *      'On My iPhone - Quantumult X - Scripts'"
 *   写成 https:// 远程地址 → 部分 QX 版本解析失败报错。
 *
 *   远程脚本的正确位置是：
 *     [rewrite_remote]  引用 .snippet / .conf 文件（内含规则+URL）
 *     [task_local]      可直接写 http(s) URL
 *
 * 校验项：
 *   1. 各 section 名称合法
 *   2. [rewrite_local] 的脚本参数必须是裸文件名（无路径、无 URL）
 *   3. [rewrite_remote] / [task_local] 的 URL 合法且可推导出本地文件
 *   4. rewrite 正则可编译
 *   5. snippet 文件的规则格式正确
 *   6. reject 系列参数在白名单内
 *
 * 用法：node validate_qx_syntax.js
 */

const fs = require("fs");
const path = require("path");

const DIR = __dirname;

let pass = 0, fail = 0, warn = 0;
const log = [];
const ok = (n, d) => { log.push("PASS  " + n + (d ? "   [" + d + "]" : "")); pass++; };
const bad = (n, d) => { log.push("FAIL  " + n + (d ? "   [" + d + "]" : "")); fail++; };
const wrn = (n, d) => { log.push("WARN  " + n + (d ? "   [" + d + "]" : "")); warn++; };

// ------------------------------------------------------------ QX 规范常量

const SECTIONS = new Set([
  "general", "dns", "policy", "server_remote", "server_local",
  "filter_remote", "filter_local", "rewrite_remote", "rewrite_local",
  "task_local", "http_backend", "mitm"
]);

// rewrite 动作白名单（来自官方 sample.conf 注释）
const REWRITE_ACTIONS = new Set([
  "reject", "reject-200", "reject-img", "reject-dict", "reject-array",
  "302", "307",
  "script-request-header", "script-request-body",
  "script-response-header", "script-response-body",
  "script-echo-response", "script-analyze-echo-response",
  "jsonjq-request-body", "jsonjq-response-body",
  "request-header", "response-body", "request-body",
  "echo-response", "url-and-header"
]);

// 要求参数是本地文件名（不允许 URL / 绝对路径）的 action
const LOCAL_SCRIPT_ACTIONS = new Set([
  "script-request-header", "script-request-body",
  "script-response-header", "script-response-body",
  "script-echo-response", "script-analyze-echo-response"
]);

function isUrl(s) { return /^https?:\/\//i.test(s); }
function isBareFilename(s) { return /^[A-Za-z0-9_.\-]+\.js$/.test(s); }

// ------------------------------------------------------------ 解析 conf

function parseConf(file) {
  const src = fs.readFileSync(path.join(DIR, file), "utf8");
  const out = [];       // { section, line, text, no }
  let section = null;
  src.split("\n").forEach((raw, i) => {
    const t = raw.trim();
    if (!t || t.startsWith("#") || t.startsWith(";") || t.startsWith("//")) return;
    const m = t.match(/^\[([a-z_]+)\]$/);
    if (m) { section = m[1]; return; }
    out.push({ section, text: t, no: i + 1 });
  });
  return out;
}

// ------------------------------------------------------------ 1. section 名

function checkSections(file) {
  const src = fs.readFileSync(path.join(DIR, file), "utf8");
  const found = [];
  src.split("\n").forEach((raw, i) => {
    const m = raw.trim().match(/^\[([^\]]+)\]$/);
    if (m) found.push(m[1]);
  });
  const badSecs = found.filter(s => !SECTIONS.has(s));
  if (badSecs.length) bad(file + " section 名合法", "未知: " + badSecs.join(", "));
  else ok(file + " section 名合法", found.join(", ") || "无");
}

// ------------------------------------------------------------ 2. rewrite_local 脚本参数

function checkRewriteLocal(file) {
  const entries = parseConf(file).filter(e => e.section === "rewrite_local");
  if (!entries.length) { ok(file + " rewrite_local 无规则（用 rewrite_remote）"); return; }

  let n = 0, problems = [];
  entries.forEach(e => {
    // 格式：<regex> url <action> [args...]  或  <regex> url-and-header <action>
    const parts = e.text.split(/\s+/);
    if (parts.length < 3) { problems.push(`L${e.no} 字段不足`); return; }
    const action = parts[2];
    n++;
    if (!REWRITE_ACTIONS.has(action)) {
      problems.push(`L${e.no} 未知 action: ${action}`);
      return;
    }
    if (LOCAL_SCRIPT_ACTIONS.has(action)) {
      const arg = parts[3];
      if (!arg) { problems.push(`L${e.no} ${action} 缺脚本参数`); return; }
      if (isUrl(arg)) {
        problems.push(`L${e.no} ${action} 用了远程 URL（QX 要求本地文件名）→ 改用 rewrite_remote`);
      } else if (!isBareFilename(arg)) {
        problems.push(`L${e.no} ${action} 参数不是裸文件名: ${arg}`);
      }
    }
  });

  if (problems.length) bad(file + " rewrite_local 脚本参数", problems.join(" | "));
  else ok(file + " rewrite_local 合规", n + " 条");
}

// ------------------------------------------------------------ 3. rewrite_remote / task_local URL

function checkRemoteUrls(file) {
  const entries = parseConf(file);

  const rr = entries.filter(e => e.section === "rewrite_remote");
  if (rr.length) {
    const probs = [];
    rr.forEach(e => {
      const url = e.text.split(",")[0].trim();
      if (!isUrl(url)) { probs.push(`L${e.no} 非 URL: ${url}`); return; }
      const name = url.slice(url.lastIndexOf("/") + 1);
      const local = path.join(DIR, name);
      if (!fs.existsSync(local)) probs.push(`L${e.no} 本地无对应文件: ${name}`);
      // remote snippet 必须带 opt-parser 或 tag
      if (!/tag=/.test(e.text)) probs.push(`L${e.no} 缺 tag=`);
    });
    if (probs.length) bad(file + " rewrite_remote", probs.join(" | "));
    else ok(file + " rewrite_remote 合规", rr.length + " 条");
  } else ok(file + " rewrite_remote 未使用");

  const tl = entries.filter(e => e.section === "task_local");
  if (tl.length) {
    const probs = [];
    tl.forEach(e => {
      // cron(5~6) 或 event-* + 脚本
      const m = e.text.match(/^([\d*,/\-\s]+|event-(?:network|interaction))\s+(\S+)/);
      if (!m) { probs.push(`L${e.no} 格式不符: ${e.text.slice(0, 40)}`); return; }
      const cron = m[1].trim();
      if (!/^event-/.test(cron)) {
        const f = cron.split(/\s+/);
        if (f.length < 5 || f.length > 6) probs.push(`L${e.no} cron 字段数 ${f.length}`);
      }
      const target = m[2].replace(/,$/, "");
      if (isUrl(target)) {
        const name = target.slice(target.lastIndexOf("/") + 1);
        if (!fs.existsSync(path.join(DIR, name))) probs.push(`L${e.no} 本地无对应脚本: ${name}`);
      } else if (!isBareFilename(target)) {
        probs.push(`L${e.no} 脚本名非法: ${target}`);
      }
    });
    if (probs.length) bad(file + " task_local", probs.join(" | "));
    else ok(file + " task_local 合规", tl.length + " 条");
  } else ok(file + " task_local 未使用");
}

// ------------------------------------------------------------ 4. 正则可编译

function checkRegex(file) {
  const entries = parseConf(file).filter(e => e.section === "rewrite_local" || e.section === "rewrite_remote");
  let n = 0, probs = [];
  entries.forEach(e => {
    const first = e.text.split(/\s+/)[0];
    if (!first || first.startsWith("^") === false) return;
    n++;
    try { new RegExp(first); } catch (err) { probs.push(`L${e.no} ${err.message.slice(0, 50)}`); }
  });
  if (!n) { ok(file + " 正则可编译（无规则）"); return; }
  if (probs.length) bad(file + " 正则可编译", probs.join(" | "));
  else ok(file + " 正则可编译", n + " 条");
}

// ------------------------------------------------------------ 5. snippet 文件

function checkSnippet() {
  const snippet = path.join(DIR, "gemini-rewrite.snippet");
  if (!fs.existsSync(snippet)) { wrn("snippet", "不存在"); return; }

  const src = fs.readFileSync(snippet, "utf8");
  const lines = src.split("\n");

  // snippet 里不能有 section 头
  const hasSection = lines.some(l => /^\s*\[[a-z_]+\]\s*$/.test(l) && !l.trim().startsWith("#"));
  if (hasSection) bad("gemini-rewrite.snippet 无 section 头", "snippet 不应包含 [xxx]");
  else ok("gemini-rewrite.snippet 无 section 头");

  // 规则格式
  const rules = lines.map((l, i) => ({ t: l.trim(), no: i + 1 }))
    .filter(l => l.t && !l.t.startsWith("#") && !l.t.startsWith(";"));
  const probs = [];
  let count = 0;
  rules.forEach(r => {
    const parts = r.t.split(/\s+/);
    if (parts.length < 3 || parts[1] !== "url") { probs.push(`L${r.no} 格式不符`); return; }
    const action = parts[2];
    count++;
    if (!REWRITE_ACTIONS.has(action)) probs.push(`L${r.no} 未知 action: ${action}`);
    if (LOCAL_SCRIPT_ACTIONS.has(action)) {
      const arg = parts[3];
      // snippet 里允许远程 URL（这是 rewrite_remote 的用法）
      if (!arg) probs.push(`L${r.no} 缺脚本参数`);
      else if (isUrl(arg)) {
        const name = arg.slice(arg.lastIndexOf("/") + 1);
        if (!fs.existsSync(path.join(DIR, name))) probs.push(`L${r.no} 本地无对应脚本: ${name}`);
      }
    }
    try { new RegExp(parts[0]); } catch (err) { probs.push(`L${r.no} 正则错误`); }
  });
  if (probs.length) bad("gemini-rewrite.snippet 规则", probs.join(" | "));
  else ok("gemini-rewrite.snippet 规则合规", count + " 条");
}

// ------------------------------------------------------------ 6. 主流程

console.log("=== Quantumult X 语法合规校验 ===\n");

const confs = fs.readdirSync(DIR).filter(f => f.endsWith(".conf"));
if (!confs.length) bad("找到配置", "无 .conf");

confs.forEach(conf => {
  checkSections(conf);
  checkRewriteLocal(conf);
  checkRemoteUrls(conf);
  checkRegex(conf);
  log.push("");
});

checkSnippet();

log.forEach(l => console.log(l));
console.log(`合计: ${pass} 通过, ${warn} 警告, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
