/**
 * verify_remote_manifest.js — 验证 remote 配置里的每个 URL 都能对应到真实文件
 *
 * 做法：模拟 GitHub 仓库布局（仓库根 → goog/ 子目录），
 *      按 raw URL 反解出文件名，检查 ① 文件存在 ② 内容与本地一致 ③ 是 QX 可执行的
 *
 * 同时输出仓库清单，标注哪些文件该推、哪些该忽略。
 *
 * 用法：node verify_remote_manifest.js
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = __dirname;
const REPO_ROOT = path.resolve(DIR, "..");          // D:\GitHub\qx
const SUBDIR = path.basename(DIR);                    // goog
const RAW_PREFIX = "https://raw.githubusercontent.com/yjlsx/qx/main/" + SUBDIR + "/";

let pass = 0, fail = 0;
const out = [];
function ok(n, d) { out.push("PASS  " + n + (d ? "   [" + d + "]" : "")); pass++; }
function bad(n, d) { out.push("FAIL  " + n + (d ? "   [" + d + "]" : "")); fail++; }

// ---------------------------------------------------------------- 1. raw URL → 本地文件映射

function urlToLocal(url) {
  if (!url.startsWith(RAW_PREFIX)) return null;
  const name = url.slice(RAW_PREFIX.length);
  if (name.includes("/")) return null;   // 只支持单层
  return path.join(DIR, name);
}

// ---------------------------------------------------------------- 2. 解析 conf 里所有脚本 URL

function collectScriptUrls() {
  const urls = [];
  fs.readdirSync(DIR).filter(f => f.endsWith(".conf")).forEach(conf => {
    const src = fs.readFileSync(path.join(DIR, conf), "utf8");
    src.split("\n").forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || !trimmed) return;
      const m = trimmed.match(/https:\/\/raw\.githubusercontent\.com\/[^\s,]+/g);
      if (m) m.forEach(u => urls.push({ conf, url: u.replace(/[,)]$/, "") }));
    });
  });
  return urls;
}

// ---------------------------------------------------------------- 3. 校验

function verifyUrls() {
  const urls = collectScriptUrls();
  const seen = new Set();

  if (!urls.length) { bad("conf 中的 raw URL", "一条都没找到"); return; }

  urls.forEach(({ conf, url }) => {
    if (seen.has(url)) return;
    seen.add(url);

    if (!url.startsWith(RAW_PREFIX)) {
      bad("URL 前缀正确: " + url.slice(-40), "不是 " + RAW_PREFIX);
      return;
    }
    const local = urlToLocal(url);
    if (!local) { bad("URL 可解析: " + url.slice(-40), "含子目录或非法字符"); return; }
    if (!fs.existsSync(local)) { bad("文件存在: " + path.basename(local), "缺失于 " + DIR); return; }

    const src = fs.readFileSync(local, "utf8");
    const hash = crypto.createHash("sha256").update(src).digest("hex").slice(0, 12);
    const size = Buffer.byteLength(src, "utf8");

    // QX 可执行性粗检：必须调用 $done
    const hasDone = /\$done\s*\(/.test(src);
    ok("URL 有效: " + path.basename(local), `${size}B sha ${hash} ${hasDone ? "$done ✓" : "无 $done ✗"}`);
    if (!hasDone) bad("  ↑ 可执行性", path.basename(local) + " 缺 $done");
  });
}

// ---------------------------------------------------------------- 4. 仓库布局模拟

function verifyLayout() {
  if (!fs.existsSync(REPO_ROOT)) { bad("仓库根", REPO_ROOT + " 不存在"); return; }
  const gitDir = path.join(REPO_ROOT, ".git");
  if (!fs.existsSync(gitDir)) { bad("git 仓库", "未找到 .git"); return; }
  ok("仓库根", REPO_ROOT);

  // goog/ 必须是仓库的直接子目录，否则 raw URL 不成立
  const rel = path.relative(REPO_ROOT, DIR).replace(/\\/g, "/");
  if (rel === SUBDIR) ok("子目录位置", "仓库根/" + rel);
  else bad("子目录位置", "实际 " + rel + "，与 RAW_PREFIX 里的 " + SUBDIR + " 不符");
}

// ---------------------------------------------------------------- 5. 推送清单

const PUSH = [
  // QX 运行时必需
  "g1-acq.qx.js",
  "g1-sku-report.qx.js",
  "gemini_prepare_capture.js",
  "gemini_prepare_response.js",
  "gemini_sku_probe.js",
  "gemini_activate_capture.js",
  "gemini_adv_replay.js",
  // 配置
  "gemini-remote.conf",
  "quantumultx.conf",
  "quantumultx-g1acq.conf",
  // 文档与工具（可选，建议一并推）
  "README.md",
  "convert_sgmodule.js",
  "gemini_common.js",
  "gemini_checkout_harness.js",
  "qx_parity_test.js",
  "qx_simulate_test.js",
  "final_gate.js",
  "publish_check.js",
  "verify_remote_manifest.js"
];

const IGNORE = [
  "_upstream/",   // 上游原件（含脱敏占位符），体积大，仅本地保留
  "_diag.js"
];

function printManifest() {
  out.push("");
  out.push("=== 推送清单 ===");
  PUSH.forEach(f => {
    const p = path.join(DIR, f);
    const exists = fs.existsSync(p);
    const size = exists ? Buffer.byteLength(fs.readFileSync(p, "utf8"), "utf8") : 0;
    const required = /^g1-|^gemini_(prepare|sku|activate|adv)/.test(f) && f.endsWith(".js");
    out.push(`  ${exists ? "✓" : "✗"} ${f.padEnd(32)} ${String(size).padStart(7)} B${required ? "  ← QX 运行时必需" : ""}`);
    if (!exists) fail++;
  });

  out.push("");
  out.push("=== 不推送 ===");
  IGNORE.forEach(f => out.push("  ✗ " + f));

  // 目录里有没有漏掉的文件
  const listed = new Set(PUSH.concat(IGNORE.map(i => i.replace(/\/$/, ""))));
  const unlisted = fs.readdirSync(DIR).filter(f => !listed.has(f) && f !== "gemini-remote.conf" && f !== ".gitignore");
  if (unlisted.length) {
    out.push("");
    out.push("=== 未在清单中 ===");
    unlisted.forEach(f => out.push("  ? " + f));
  }
}

// ---------------------------------------------------------------- 主流程

console.log("=== Remote 清单校验 ===\n");

verifyLayout();
verifyUrls();
printManifest();

out.forEach(l => console.log(l));
console.log(`\n合计: ${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
