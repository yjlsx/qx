/**
 * convert_sgmodule.js — Shadowrocket/Surge sgmodule → Quantumult X 转换器
 *
 * 用法：
 *   node convert_sgmodule.js                  # 转换 _upstream/ 下的两个脚本
 *   node convert_sgmodule.js --check          # 只做静态检查，不写文件
 *
 * 处理的 API 差异：
 *
 *   功能               SG / Surge                    Quantumult X
 *   ------------------ ----------------------------- -----------------------------
 *   持久化读           $persistentStore.read(k)      $prefs.valueForKey(k)
 *   持久化写           $persistentStore.write(v,k)   $prefs.setValueForKey(v,k)
 *   存储接口对象       可以为 undefined              不存在，必须直接调用
 *   返回伪造响应        $done({response:{...}})       $done({status, headers, body})
 *   返回 body          $done({body})                 $done({body})
 *   请求体             $request.body (string)        $request.body (string)
 *   响应体             $response.body                $response.body
 *   状态码             $response.status              $response.statusCode
 *
 * 转换策略：功能 API 调用直接替换；保存接口 `store` 的抽象保留，
 *          只是把 `$persistentStore` 换成 QX 适配对象 `QXStore`。
 */

const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const UP = path.join(DIR, "_upstream");
const CHECK_ONLY = process.argv.includes("--check");

// ---------------------------------------------------------------- 统计与记录

const report = {
  file: "",
  rules: []
};

function note(rule, count, detail) {
  if (count > 0) report.rules.push({ rule, count, detail: detail || "" });
}

// ---------------------------------------------------------------- 预处理

/**
 * 上游所有持久化 key 都被模板脱敏成 {{SECRET_xxx}}。
 * 在 QX 里这些会原样变成 $prefs 的 key（能跑，但可读性差、也无法和我们的脚本共享）。
 * 这里把它们映射成人名可读且稳定的 key。
 *
 * 注意：脱敏值在源码里是以字符串字面量形式出现的：
 *   var KEY = "g1.sku.mappings.v1";
 * 所以替换时必须只替换引号内部的内容，不能连引号一起替换。
 */
const KEY_MAP = {
  "g1.sku.mappings.v1": "g1_acq_mapping_cfg",     // 映射配置
  "g1.sku.scan.v1": "g1_acq_sku_scan",        // SKU 采集
  "g1.pro.annual.test.v1": "g1_acq_last_test",       // 最近一次执行
  "g1.debug.logs.v1": "g1_acq_debug_log"        // 调试日志
};

function normalizeKeys(src) {
  let n = 0;
  Object.keys(KEY_MAP).forEach(k => {
    // 只匹配花括号内容本身，保留外层引号不动
    const re = new RegExp(k.replace(/[{}]/g, "\\$&"), "g");
    const hits = (src.match(re) || []).length;
    src = src.replace(re, KEY_MAP[k]);
    n += hits;
  });
  note("脱敏 key → 可读 key", n, Object.keys(KEY_MAP).join(", "));
  return src;
}

// ---------------------------------------------------------------- 转换规则

/**
 * 注入 QX 存储适配层。
 * 上游大量使用 `typeof $persistentStore === "undefined"` 做可用性判断，
 * QX 里这个全局不存在，直接替换成 QXStore 后判断依然成立，且读写成对。
 */
const QX_ADAPTER = `
// ===== Quantumult X 存储适配层（由 convert_sgmodule.js 注入）=====
var QXStore = {
  read: function (key) {
    try { var v = $prefs.valueForKey(key); return (v === null || v === undefined) ? null : String(v); }
    catch (e) { return null; }
  },
  write: function (value, key) {
    try { return $prefs.setValueForKey(String(value), key) === true; }
    catch (e) { return false; }
  }
};
var $persistentStore = QXStore;
// ==================================================================
`;

function convert(src, fileName) {
  report.file = fileName;
  report.rules = [];

  let out = src;

  // 1) 先把脱敏 key 换成可读 key
  out = normalizeKeys(out);

  // 2) $persistentStore → QXStore（含 typeof 判断）
  let n = 0;
  out = out.replace(/\$persistentStore/g, () => { n++; return "QXStore"; });
  note("$persistentStore → QXStore", n);

  // 3) 双保险：如果代码里直接用了 $prefs 之外的读法，统一成 valueForKey/setValueForKey
  let n2 = 0;
  const before2 = out;
  out = out.replace(/\$\$prefs\.read\s*\(/g, "$prefs.valueForKey(");
  out = out.replace(/\$\$prefs\.write\s*\(([^,]+),\s*([^)]+)\)/g, "$prefs.setValueForKey($1, $2)");
  n2 = (before2.length !== out.length) ? 1 : 0;
  note("$$prefs 写法归一", n2);

  // 4) $done({ response: { status, headers, body } }) → $done({ status, headers, body })
  //    QX 用扁平结构。这里做真正的「解包」而不是字符串替换：
  //    找到 $done({ response: {  ...  } }) 的完整调用，抽取内部对象，重写成扁平形式。
  out = unwrapDoneResponse(out);

  // 5) $response.status → $response.statusCode（QX 里状态码挂在 statusCode 上）
  let n4 = 0;
  out = out.replace(/\$response\.status\b(?=\s*[;,)\]}&|])/g, () => { n4++; return "$response.statusCode"; });
  note("$response.status → $response.statusCode", n4);

  // 6) 注入适配层：放在 "use strict" 之后、第一个 IIFE 之前
  out = injectAdapter(out);

  // 7) QX 的 $done 必须恰好调用一次且不能带 undefined body
  out = guardDone(out);

  return out;
}

/**
 * 把 SG 的 $done({ response: { status, headers, body } }) 重写成 QX 的
 * $done({ status, headers, body })。
 *
 * 做法：扫描源码，定位每一次 $done( 调用，判断其第一个参数是否 `{ response: {`，
 *      是则做括号配平，取出 response 内部对象体，拼成扁平字面量。
 * 这样不会破坏内部嵌套的 {} 与字符串里的括号。
 */
function unwrapDoneResponse(src) {
  const NEEDLE = "$done({";
  let count = 0;
  let out = "";
  let i = 0;

  while (i < src.length) {
    const at = src.indexOf(NEEDLE, i);
    if (at < 0) { out += src.slice(i); break; }

    // 检查 { 之后是否紧跟 response（允许空白与注释）
    const tail = src.slice(at + NEEDLE.length);
    const m = tail.match(/^\s*response\s*:\s*\{/);
    if (!m) {
      // 普通的 $done({...})，原样跳过这个 needle
      out += src.slice(i, at + NEEDLE.length);
      i = at + NEEDLE.length;
      continue;
    }

    // 定位 response 内部对象的起止
    const bodyStart = at + NEEDLE.length + m[0].length; // 指向 response 内部第一个字符
    let depth = 1;       // 已进入 response 的 {
    let j = bodyStart;
    while (j < src.length && depth > 0) {
      const c = src[j];
      if (c === "{" ) depth++;
      else if (c === "}") depth--;
      j++;
    }
    // j 现在紧跟 response 的闭合 } 之后，期待 "})" 收尾 $done 调用
    const innerBody = src.slice(bodyStart, j - 1); // 去掉最后的 }

    // 校验结尾形态：  } });
    const closer = src.slice(j).match(/^\s*\}\s*\)\s*;?/);
    if (!closer) {
      // 结构不符合预期，保守起见原样保留
      out += src.slice(i, j);
      i = j;
      continue;
    }

    out += src.slice(i, at);
    out += "$done({" + innerBody + "})" + (closer[0].trim().endsWith(";") ? ";" : "");
    i = j + closer[0].length;
    count++;
  }

  note("$done({response:{...}}) → $done({...}) 扁平化", count);
  return out;
}

/**
 * 旧的字符串替换方案，保留作参考（已被 unwrapDoneResponse 取代）。
 * 它会破坏括号配平，不要使用。
 */
function balanceDoneCalls(src) {
  return src;
}

function injectAdapter(src) {
  const strictMatch = src.match(/^(\s*(?:\/\*[\s\S]*?\*\/\s*)?)"use strict";\s*\n/);
  if (strictMatch) {
    const end = strictMatch[0].length;
    return src.slice(0, end) + QX_ADAPTER + "\n" + src.slice(end);
  }
  return QX_ADAPTER + "\n" + src;
}

/**
 * QX 里 $done 不带参数会让请求挂起，必须给 {}。
 * 上游已经都传了参数，这里只做兜底：纯粹的 `$done();` → `$done({});`
 */
function guardDone(src) {
  let n = 0;
  const out = src.replace(/\$done\(\s*\);/g, () => { n++; return "$done({});"; });
  note("$done() → $done({}) 兜底", n);
  return out;
}

// ---------------------------------------------------------------- 静态检查

function lint(src, fileName) {
  const problems = [];
  // QX 不支持的可选链 / 空值合并（老版本引擎）
  if (/\?\./.test(src)) problems.push("含可选链 ?.（QX 旧版引擎不支持）");
  if (/\?\?/.test(src)) problems.push("含空值合并 ??（QX 旧版引擎不支持）");
  // QX 不支持 import/export
  if (/^\s*import\s/m.test(src)) problems.push("含 ES import");
  if (/^\s*export\s/m.test(src)) problems.push("含 ES export");
  // 需要 Buffer 的地方
  if (/\bBuffer\./.test(src)) problems.push("含 Node Buffer");
  if (/\brequire\s*\(/.test(src)) problems.push("含 require()");
  // $httpClient 差异
  if (/\$httpClient\.(get|post)/.test(src)) problems.push("含 $httpClient（QX 用 $task.fetch）");
  // 请求/响应体获取
  if (/\$request\.body/.test(src) && /\$response\.body/.test(src)) {
    problems.push("同时读写 request.body 与 response.body（QX 需分两条 rewrite）");
  }

  // 括号配平粗检
  let depth = 0;
  let inStr = null, inTmpl = false, inLine = false, inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i], p = src[i - 1];
    if (inLine) { if (c === "\n") inLine = false; continue; }
    if (inBlock) { if (p === "*" && c === "/") inBlock = false; continue; }
    if (inStr) { if (c === inStr && p !== "\\") inStr = null; continue; }
    if (inTmpl) { if (c === "`" && p !== "\\") inTmpl = false; continue; }
    if (c === "/" && src[i + 1] === "/") { inLine = true; i++; continue; }
    if (c === "/" && src[i + 1] === "*") { inBlock = true; i++; continue; }
    if (c === "'" || c === '"') { inStr = c; continue; }
    if (c === "`") { inTmpl = true; continue; }
    if (c === "{") depth++;
    if (c === "}") depth--;
  }
  if (depth !== 0) problems.push("花括号不配平：depth=" + depth);

  return problems;
}

// ---------------------------------------------------------------- 主流程

function main() {
  const files = fs.readdirSync(UP).filter(f => f.endsWith(".js"));
  if (!files.length) {
    console.error("_upstream/ 下没有 .js 文件");
    process.exit(1);
  }

  console.log("=== sgmodule → Quantumult X 转换 ===\n");

  files.forEach(f => {
    const src = fs.readFileSync(path.join(UP, f), "utf8");
    const converted = convert(src, f);

    console.log("################  " + f);
    report.rules.forEach(r => {
      console.log("  " + String(r.count).padStart(4) + "  " + r.rule + (r.detail ? "  (" + r.detail + ")" : ""));
    });

    const problems = lint(converted, f);
    if (problems.length) {
      console.log("\n  ⚠ 遗留问题:");
      problems.forEach(p => console.log("     - " + p));
    } else {
      console.log("\n  ✓ 无遗留问题");
    }

    // 语法检查
    try {
      new Function(converted.replace(/^\s*"use strict";/m, ""));
      console.log("  ✓ 语法检查通过");
    } catch (e) {
      console.log("  ✗ 语法错误: " + e.message);
    }

    const dest = path.join(DIR, f.replace(/\.js$/, ".qx.js"));
    if (!CHECK_ONLY) {
      writeClean(dest, converted);
      console.log("  → " + path.basename(dest) + "  (" + Buffer.byteLength(converted, "utf8") + " 字节)");
      console.log("");
    } else {
      console.log("");
    }
  });
}

/**
 * 写文件时强制 UTF-8 无 BOM + LF 换行。
 *
 * 为什么必须：Quantumult X 的脚本引擎遇到 UTF-8 BOM 会在首行报
 * "SyntaxError: Unexpected token"，导致脚本整个不执行；
 * 混用 CRLF 也可能让某些版本的行号解析出偏差。
 * 上游是从 Windows 侧下载的，天然可能带 BOM。
 */
function writeClean(dest, text) {
  const normalized = String(text)
    .replace(/^\uFEFF/, "")     // 去掉可能已存在的 BOM 字符
    .replace(/\r\n/g, "\n")     // CRLF → LF
    .replace(/\r/g, "\n");      // 孤立 CR → LF
  fs.writeFileSync(dest, normalized, { encoding: "utf8" });  // Node 默认不写 BOM
}

main();
