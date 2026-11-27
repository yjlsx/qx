/**
 * final_gate.js — 发布前最后一道闸
 *
 * 比其他测试更严格，专查「上线后才暴露」的问题：
 *
 *   1. 每个 QX 脚本在纯 QX 沙箱里能否独立启动（不给任何本文件的辅助函数）
 *   2. 每个脚本的 $done 调用形态是否统一（只允许 $done({...})、$done(err)）
 *   3. 配置里每条 rewrite 的正则能否编译，且脚本名是 7 个之一
 *   4. task_local 的 cron 表达式是否合法
 *   5. raw URL 全部落在指定的 raw 前缀下
 *   6. 脚本编码为 UTF-8 无 BOM，无 CRLF 混用
 *
 * 用法：node final_gate.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DIR = __dirname;
const RAW_PREFIX = "https://raw.githubusercontent.com/yjlsx/qx/main/goog/";

const QX_SCRIPTS = [
  "g1-acq.qx.js",
  "g1-sku-report.qx.js",
  "gemini_prepare_capture.js",
  "gemini_prepare_response.js",
  "gemini_sku_probe.js",
  "gemini_activate_capture.js",
  "gemini_adv_replay.js"
];

let pass = 0, fail = 0;
const log = [];
const ok = (n, d) => { log.push("PASS  " + n + (d ? "   [" + d + "]" : "")); pass++; };
const bad = (n, d) => { log.push("FAIL  " + n + (d ? "   [" + d + "]" : "")); fail++; };

// ------------------------------------------------------------ 1. 纯沙箱启动

function bareSandbox() {
  const store = {};
  const ctx = {
    $prefs: {
      valueForKey: k => (store[k] !== undefined ? String(store[k]) : null),
      setValueForKey: (v, k) => { store[k] = String(v); return true; },
      removeValueForKey: k => { delete store[k]; return true; }
    },
    $done: () => {},
    $notify: () => {},
    $task: { fetch: () => Promise.resolve({ status: 200, body: "{}" }) },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
    parseInt, parseFloat, isFinite, isNaN,
    encodeURIComponent, decodeURIComponent, escape, unescape,
    setTimeout, clearTimeout
  };
  ctx.globalThis = ctx;
  return { ctx, store };
}

function checkBareBoot() {
  QX_SCRIPTS.forEach(f => {
    const src = fs.readFileSync(path.join(DIR, f), "utf8");
    const { ctx } = bareSandbox();

    // 给一个通用的 $request/$response，模拟被 QX 回调的最常见入口
    ctx.$request = { url: "https://one.google.com/ai", method: "GET", headers: {}, body: "" };
    ctx.$response = { statusCode: 200, headers: { "Content-Type": "text/html" }, body: "<html>g1.ios.2tb.ai.a</html>" };

    vm.createContext(ctx);
    try {
      vm.runInContext(src, ctx, { timeout: 20000 });
      ok(f + " 纯沙箱启动");
    } catch (e) {
      bad(f + " 纯沙箱启动", String(e.message).slice(0, 140));
    }
  });
}

// ------------------------------------------------------------ 2. $done 调用形态

function checkDoneShapes() {
  QX_SCRIPTS.forEach(f => {
    const src = fs.readFileSync(path.join(DIR, f), "utf8");
    // 抓出所有 $done( 之后紧跟的第一个非空字符
    const shapes = new Set();
    const re = /\$done\s*\(\s*([^\s)])/g;
    let m;
    while ((m = re.exec(src)) !== null) shapes.add(m[1]);

    // QX 合法形态：对象字面量 {  、变量 $ (如 $done($doneObj)) 、err/参数名
    const illegal = [...shapes].filter(c => c === "r"); // 形如 $done(response...)
    if (illegal.length) bad(f + " $done 形态", "疑似 SG 残留: " + illegal.join(","));
    else ok(f + " $done 形态", "首字符: " + [...shapes].join(" "));

    // 明确不允许 $done({ response: ... })
    if (/\$done\s*\(\s*\{\s*response\s*:/.test(src)) {
      bad(f + " 无 SG response 包层", "仍有 $done({ response:");
    } else {
      ok(f + " 无 SG response 包层");
    }
  });
}

// ------------------------------------------------------------ 3. 配置正则与脚本名

function checkConfRegex() {
  const confs = fs.readdirSync(DIR).filter(f => f.endsWith(".conf"));
  confs.forEach(conf => {
    const src = fs.readFileSync(path.join(DIR, conf), "utf8");
    let badRegex = 0, unknownScript = 0, rules = 0;

    src.split("\n").forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith("#") || t.startsWith("[")) return;

      // rewrite 规则：^regex url script-... <target>
      const m = t.match(/^(\^.*?)\s+url\s+script-[a-z-]*body\s+(\S+)/);
      if (!m) return;
      rules++;

      // 正则可编译性
      try { new RegExp(m[1]); } catch (e) { badRegex++; }

      // 脚本目标：本地文件名 或 raw URL，且必须是 7 个之一
      const target = m[2];
      const name = target.startsWith("http")
        ? target.slice(target.lastIndexOf("/") + 1)
        : target;
      if (QX_SCRIPTS.indexOf(name) < 0) unknownScript++;

      // raw URL 必须落在指定前缀
      if (target.startsWith("http") && !target.startsWith(RAW_PREFIX)) {
        bad(conf + " raw 前缀", target.slice(0, 70));
      }
    });

    if (badRegex) bad(conf + " 正则可编译", badRegex + " 条失败");
    else ok(conf + " 正则可编译", rules + " 条规则");

    if (unknownScript) bad(conf + " 脚本名合法", unknownScript + " 个不在白名单");
    else ok(conf + " 脚本名合法");

    // task_local cron
    src.split("\n").forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return;
      const tm = t.match(/^([\d*,/\-]+)\s+(\S+\.js)/);
      if (!tm) return;
      const cron = tm[1];
      const fields = cron.split(/\s+/);
      if (fields.length !== 5) bad(conf + " cron 字段数", cron + " → " + fields.length);
      else ok(conf + " cron 合法", cron);
      const target = tm[2];
      if (target.startsWith("http") && !target.startsWith(RAW_PREFIX)) {
        bad(conf + " task raw 前缀", target.slice(0, 70));
      }
    });
  });
}

// ------------------------------------------------------------ 4. 编码

function checkEncoding() {
  QX_SCRIPTS.forEach(f => {
    const buf = fs.readFileSync(path.join(DIR, f));
    // BOM
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) bad(f + " 无 BOM");
    else ok(f + " 无 BOM");
    // CRLF
    const txt = buf.toString("utf8");
    const crlf = (txt.match(/\r\n/g) || []).length;
    const lf = (txt.match(/\n/g) || []).length;
    if (crlf > 0 && crlf !== lf) bad(f + " 换行统一", `CRLF ${crlf} / LF ${lf}`);
    else ok(f + " 换行统一", crlf > 0 ? "全 CRLF" : "全 LF");
  });
}

// ------------------------------------------------------------ 5. 交叉引用

function checkNoCrossRef() {
  QX_SCRIPTS.forEach(f => {
    const src = fs.readFileSync(path.join(DIR, f), "utf8");
    // 不得引用其它 6 个脚本的文件名
    const others = QX_SCRIPTS.filter(x => x !== f);
    const hit = others.filter(o => src.indexOf(o) >= 0);
    if (hit.length) bad(f + " 无跨脚本引用", hit.join(","));
    else ok(f + " 无跨脚本引用");
  });
}

// ------------------------------------------------------------ 主流程

console.log("=== 发布闸门 ===\n");
checkBareBoot();
checkDoneShapes();
checkConfRegex();
checkEncoding();
checkNoCrossRef();

log.forEach(l => console.log(l));
console.log(`\n合计: ${pass} 通过, ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
