/*
 * 离线啦论坛自动签到
 *
 * [使用说明]
 * 1. 开启 Quantumult X 重写功能，访问 https://lixianla.com/ 自动抓取 Cookie
 * 2. 抓取到 Cookie 后会自动通知，之后每天自动签到并通知结果
 *
 * [BoxJS 配置]
 * lixianla_cookie: 存储网站 Cookie，自动抓取，也可手动填写
 *
 * [rewrite_local]
 * ^https?:\/\/lixianla\.com\/ url script-request-header https://raw.githubusercontent.com/yjlsx/qx/main/task/lixianla.js
 *
 * [task_local]
 * 0 9 * * * https://raw.githubusercontent.com/yjlsx/qx/main/task/lixianla.js, tag=离线啦签到, img-url=https://raw.githubusercontent.com/yjlsx/qx/main/icon/lixianla.png, enabled=true
 *
 * [mitm]
 * hostname = lixianla.com
 */

const BASE_URL = "https://lixianla.com";
const ENTRY_URL = BASE_URL + "/sg_sign.htm";
const COOKIE_KEY = 'lixianla_cookie';
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

let currentCookie = readData(COOKIE_KEY) || "";

if (typeof $request !== "undefined") {
  captureCookie();
} else {
  startSign();
}

async function startSign() {
  try {
    if (!currentCookie) {
      log("❌ 缺少 Cookie");
      safeNotify("离线啦签到", "停止 ❌", "缺少 Cookie，请先开启重写访问 lixianla.com 自动抓取");
      return;
    }

    log("🚀 开始执行离线啦签到任务");
    log("【1/3】读取签到页面并探测动态接口...");

    let entry = await request(ENTRY_URL, "GET", BASE_URL + "/");
    ensureResponse(entry, "读取签到页面");

    let entryState = classifyText(entry.body);
    if (entryState === "login") {
      throw new Error("Cookie 已失效，请重新开启重写访问 lixianla.com");
    }
    if (entryState === "already") {
      await finishAlreadySigned();
      return;
    }

    let signPath = extractSignPath(entry.body);
    if (!signPath) {
      log("⚠️ 首次未找到签到接口，等待 5 秒后重试...");
      await sleep(5000);
      entry = await request(ENTRY_URL, "GET", BASE_URL + "/");
      ensureResponse(entry, "重试读取签到页面");
      entryState = classifyText(entry.body);
      if (entryState === "login") {
        throw new Error("Cookie 已失效，请重新开启重写访问 lixianla.com");
      }
      if (entryState === "already") {
        await finishAlreadySigned();
        return;
      }
      signPath = extractSignPath(entry.body);
    }

    if (!signPath) {
      throw new Error(
        "未找到签到接口 | 状态:" + getStatus(entry) + " | 响应前200字符:" + compactPreview(entry.body)
      );
    }

    const signUrl = toAbsoluteUrl(signPath);
    log("✅ 动态接口: " + signUrl);
    log("【2/3】提交签到请求...");

    const signRes = await request(signUrl, "GET", ENTRY_URL);
    ensureResponse(signRes, "提交签到请求");
    const result = classifyText(signRes.body);

    if (result === "login") {
      throw new Error("Cookie 已失效，请重新开启重写访问 lixianla.com");
    }
    if (result === "already") {
      await finishAlreadySigned();
      return;
    }
    if (result !== "success") {
      const message = parseSignMessage(signRes.body);
      throw new Error(message || "签到接口未返回成功结果");
    }

    log("✅ 签到响应: " + parseSignMessage(signRes.body));
    log("【3/3】获取积分信息...");
    const credits = await fetchCredits();
    const message = parseSignMessage(signRes.body);
    safeNotify("离线啦签到", "签到成功 ✅", message + "\n" + credits);
  } catch (error) {
    const message = describeError(error);
    log("❌ 程序出错: " + message);
    safeNotify("离线啦签到", "停止 ❌", message);
  } finally {
    $done();
  }
}

async function finishAlreadySigned() {
  log("🟡 今日已经签到，正在获取积分信息...");
  log("【3/3】获取积分信息...");
  const credits = await fetchCredits();
  safeNotify("离线啦签到", "今日已签到 🟡", credits);
}

function extractSignPath(body) {
  const text = String(body || "");
  const match = text.match(/(?:https?:\/\/lixianla\.com\/)?([^"'\s<>]*sg_sign-lx-\d+\.htm)/i);
  return match ? match[1] : "";
}

function toAbsoluteUrl(path) {
  const value = String(path || "").trim();
  if (/^https?:\/\//i.test(value)) return value;
  return BASE_URL + "/" + value.replace(/^\/+/, "");
}

function classifyText(body) {
  const text = plainText(body);
  if (!text) return "unknown";
  if (/(请登录|登录后(?:再)?签到|尚未登录|未登录)/i.test(text)) return "login";
  if (/(已经签到|今日已签到|今天已签到|已签过|签到过)/i.test(text)) return "already";

  const payload = parseJson(body);
  if (payload && payload.code !== undefined && String(payload.code) === "0") return "success";
  if (/(签到成功|签到完成|恭喜|获得\s*\d+\s*(?:经验|金币))/i.test(text)) return "success";
  if (/(验证码错误|签到失败|操作失败|请求失败|错误|禁止|无权|非法)/i.test(text)) return "failure";
  return "unknown";
}

function parseSignMessage(body) {
  const text = String(body || "").trim();
  if (!text) return "签到接口未返回内容";

  const payload = parseJson(text);
  if (payload) {
    const candidates = [
      payload.message,
      payload.msg,
      payload.data && payload.data.message,
      payload.data && payload.data.msg,
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i] !== undefined && candidates[i] !== null && String(candidates[i]).trim()) {
        return plainText(String(candidates[i])).trim();
      }
    }
    if (payload.code !== undefined && String(payload.code) === "0") return "签到成功";
  }

  const messageMatch = text.match(/<(?:div|p|span)[^>]*(?:message|alert|tips)[^>]*>([\s\S]*?)<\//i);
  if (messageMatch) return plainText(messageMatch[1]).trim() || "签到完成";
  const cleaned = plainText(text).replace(/\s+/g, " ").trim();
  if (cleaned.length <= 120) return cleaned;
  if (/(成功|恭喜)/.test(cleaned)) return "签到成功";
  return "签到完成";
}

function parseJson(text) {
  try {
    return JSON.parse(String(text || ""));
  } catch (_) {
    return null;
  }
}

function plainText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchCredits() {
  try {
    const response = await request(BASE_URL + "/my-credits.htm", "GET", BASE_URL + "/my.htm");
    ensureResponse(response, "读取积分页面");
    const body = String(response.body || "");
    if (classifyText(body) === "login") throw new Error("Cookie 已失效");

    const exp = extractCredit(body, "经验");
    const coin = extractCredit(body, "金币");
    const result = "经验: " + exp + " | 金币: " + coin;
    log("✅ 积分信息: " + result);
    return result;
  } catch (error) {
    log("⚠️ 积分信息获取失败: " + describeError(error));
    return "积分信息获取失败";
  }
}

function extractCredit(body, label) {
  const text = String(body || "");
  const patterns = [
    new RegExp(label + "[\\s\\S]{0,160}?value=[\\\"'](\\d+)", "i"),
    new RegExp(label + "[\\s\\S]{0,100}?>(\\d+)<", "i"),
    new RegExp(label + "[^0-9]{0,80}(\\d+)", "i"),
  ];
  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);
    if (match) return match[1];
  }
  return "未知";
}

async function request(url, method, referer, body, responseType) {
  const headers = {
    Cookie: currentCookie,
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
    "X-Requested-With": "XMLHttpRequest",
    Referer: referer || BASE_URL + "/",
  };
  if (method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";

  const options = {
    url: url,
    method: method,
    headers: headers,
    opts: { policy: "DIRECT", "insecure-skip-verify": true },
  };
  if (body !== undefined && body !== null) options.body = body;
  if (responseType) options.opts.responseType = responseType;

  const response = await $task.fetch(options);
  const setCookie = getHeader(response, "set-cookie");
  if (setCookie) updateCookie(setCookie);
  return response;
}

function ensureResponse(response, action) {
  if (!response) throw new Error(action + "无响应");
  const status = getStatus(response);
  if (status >= 400) throw new Error(action + "失败，HTTP " + status);
}

function getStatus(response) {
  const value = response && (response.statusCode || response.status);
  return value ? Number(value) : 0;
}

function getHeader(response, wantedName) {
  const headers = (response && response.headers) || {};
  const names = Object.keys(headers);
  for (let i = 0; i < names.length; i++) {
    if (names[i].toLowerCase() === wantedName.toLowerCase()) return headers[names[i]];
  }
  return "";
}

function updateCookie(setCookie) {
  const jar = {};
  String(currentCookie || "").split(";").forEach(function (part) {
    const index = part.indexOf("=");
    if (index > 0) jar[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  });

  const values = Array.isArray(setCookie) ? setCookie : [setCookie];
  values.forEach(function (value) {
    String(value || "")
      .split(/,(?=\s*[^;,=\s]+=[^;,]+)/)
      .forEach(function (item) {
        const cookie = item.split(";")[0].trim();
        const index = cookie.indexOf("=");
        if (index > 0) jar[cookie.slice(0, index).trim()] = cookie.slice(index + 1).trim();
      });
  });

  currentCookie = Object.keys(jar)
    .filter(function (key) { return jar[key] !== ""; })
    .map(function (key) { return key + "=" + jar[key]; })
    .join("; ");
  if (currentCookie) writeData(currentCookie, COOKIE_KEY);
}

function captureCookie() {
  const headers = ($request && $request.headers) || {};
  const cookie = headers.Cookie || headers.cookie || "";
  if (cookie && /(?:^|;)\s*bbs_(?:token|sid)=[^;\s]+/i.test(cookie)) {
    const oldCookie = readData(COOKIE_KEY) || "";
    if (oldCookie !== cookie) {
      writeData(cookie, COOKIE_KEY);
      log("✅ Cookie 已更新");
      safeNotify("离线啦", "Cookie 已抓取 ✅", "Cookie 已写入 lixianla_cookie");
    } else {
      log("Cookie 未变化，跳过写入");
    }
  } else {
    log("未找到离线啦 Cookie");
  }
  $done({});
}

function safeNotify(title, subtitle, body) {
  if (typeof $notify !== "function") return;
  try {
    $notify(title, subtitle || "", body || "", { "open-url": BASE_URL + "/" });
  } catch (_) {
    // 通知失败不应阻止签到流程结束。
  }
}

function readData(key) {
  try {
    if (typeof $prefs !== "undefined" && $prefs.valueForKey) return $prefs.valueForKey(key) || "";
    if (typeof $persistentStore !== "undefined" && $persistentStore.read) return $persistentStore.read(key) || "";
  } catch (_) {}
  return "";
}

function writeData(value, key) {
  try {
    if (typeof $prefs !== "undefined" && $prefs.setValueForKey) return $prefs.setValueForKey(value, key);
    if (typeof $persistentStore !== "undefined" && $persistentStore.write) return $persistentStore.write(value, key);
  } catch (_) {}
  return false;
}

function describeError(error) {
  if (!error) return "未知错误";
  if (typeof error === "string") return error;
  if (error.message) return String(error.message);
  return String(error);
}

function compactPreview(value) {
  const text = plainText(value).replace(/[\r\n]+/g, " ");
  return text.slice(0, 200) || "空响应";
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function log(message) {
  console.log("[" + formatTime() + "] " + message);
}

function formatTime(date) {
  const value = date || new Date();
  const pad = function (number) { return String(number).padStart(2, "0"); };
  return value.getFullYear() + "-" + pad(value.getMonth() + 1) + "-" + pad(value.getDate()) +
    " " + pad(value.getHours()) + ":" + pad(value.getMinutes()) + ":" + pad(value.getSeconds());
}
