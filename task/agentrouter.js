// AgentRouter daily login check-in (Quantumult X).
// Credentials are managed by BoxJS keys declared in boxjs/boxjs.json:
//   ar_name_N / ar_enabled_N / ar_username_N / ar_password_N  (N = 1, 2),  ar_hosts (可选, 逗号/空格分隔)
// Add the following line to Quantumult X [task_local] after pushing this file:
// 0 9 * * * https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/agentrouter.js, tag=AgentRouter签到, enabled=true
//
// ===== 原理 (与 agentrouter_checkin.py 保持一致) =====
// 本站"签到" = 每日完成一次账号密码登录:
//   POST /api/user/login {username: 邮箱, password: 密码}
//   -> 服务端下发 session cookie, data.checked_in=true 时发放当日额度
//   -> 登录响应 data 里直接带 quota(余额); 若没有则回退 GET /api/user/self 查询
// 登录成功后读取 /api/log/self 核验是否真的落了 type=4 / "签到成功" 的日志。
//
// ===== 日志格式 (控制台) =====
//   [YYYY-MM-DD HH:MM:SS] [账号名] ✅ 成功 | 消息 | 余额: $x.xx
//   状态图标: ✅ 成功 / 🟡 今日已签到 / ❌ 失败 / ⏸️ 跳过
// ===== 通知格式 (Quantumult X $notify 三参) =====
//   标题:   [AgentRouter] 签到汇总
//           [AgentRouter] 签到失败   (尝试过且全部失败)
//           [AgentRouter] 未执行     (BoxJS 里没有启用的账号)
//           [AgentRouter] 未配置账号 (启用了但一个都没填凭证)
//   副标题: 成功 2/2 | 失败 1 | 跳过 1   (失败/跳过为零时不显示)
//   正文每行: ✅ 账号名(用户名)：消息 | 余额 $x.xx

const DEFAULT_HOSTS = [
  "https://agentrouter.org",
  "https://ps.air-outer.com",
];

const QUOTA_PER_USD = 500000; // 站点内部额度单位 -> 美元
const CHECKIN_LOG_TYPE = 4; // 每日签到日志的 type 字段值
const RECENT_CHECKIN_SECONDS = 300;
const TODAY_SECONDS = 86400;
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const STATUS_TAG = { success: "✅ 成功", already: "🟡 已签到", fail: "❌ 失败", skip: "⏸️ 跳过" };
const STATUS_ICON = { success: "✅", already: "🟡", fail: "❌", skip: "⏸️" };

// ---------- 日志 ----------
function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

function nowText() {
  const d = new Date();
  return (
    d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
    " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds())
  );
}

function log(msg) {
  console.log("[" + nowText() + "] " + msg);
}

// ---------- BoxJS 配置读取 ----------
function readStoredValue(key) {
  try {
    if (typeof $prefs !== "undefined" && $prefs.valueForKey) {
      return $prefs.valueForKey(key);
    }
    if (typeof $persistentStore !== "undefined" && $persistentStore.read) {
      return $persistentStore.read(key);
    }
  } catch (_) {
    // An unavailable persistence API falls through to the empty default.
  }
  return "";
}

function textValue(key, fallback) {
  const value = readStoredValue(key);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback || "";
}

function boolValue(key, fallback) {
  const value = readStoredValue(key);
  if (value === true) return true;
  // BoxJS 开关可能以真布尔 false 存下来; 必须当成"显式停用", 不能回退到默认值。
  if (value === false) return false;
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on", "启用", "开启"].indexOf(normalized) >= 0) return true;
  if (["false", "0", "no", "off", "停用", "关闭"].indexOf(normalized) >= 0) return false;
  return fallback;
}

function configuredHosts() {
  const custom = textValue("ar_hosts", "");
  const hosts = custom
    ? custom.split(/[\s,]+/).map(function (item) {
        return item.replace(/\/+$/, "");
      })
    : DEFAULT_HOSTS;
  return hosts.filter(function (item) {
    return /^https?:\/\//i.test(item);
  });
}

function configuredAccounts() {
  return [1, 2].map(function (slot) {
    return {
      name: textValue("ar_name_" + slot, "账号" + slot),
      enabled: boolValue("ar_enabled_" + slot, true),
      username: textValue("ar_username_" + slot, ""),
      password: textValue("ar_password_" + slot, ""),
    };
  });
}

// ---------- 通知 ----------
// Quantumult X 的 $notify 是 (title, subtitle, body) 三参; subtitle 会显示在通知横幅上,
// 所以汇总数量放 subtitle, 逐账号明细放 body。
function safeNotify(title, subtitle, content) {
  if (typeof $notify === "function") {
    try {
      $notify(title, subtitle || "", content);
    } catch (e) {
      log("通知发送失败(不影响签到): " + describeError(e));
    }
  } else {
    log("[通知] " + title + (subtitle ? " | " + subtitle : "") + "\n" + content);
  }
}

// ---------- HTTP ----------
function describeError(error) {
  if (!error) return "未知错误";
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  if (error.error) return String(error.error);
  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
}

function request(options) {
  return new Promise(function (resolve, reject) {
    $task.fetch(options).then(
      function (response) {
        resolve(response);
      },
      function (error) {
        reject({ retry: true, message: describeError(error) });
      }
    );
  });
}

function parseBody(response) {
  const text = response && response.body ? response.body : "";
  try {
    return { ok: true, data: JSON.parse(text), text: text };
  } catch (_) {
    return { ok: false, data: null, text: text };
  }
}

function getHeaderValue(response, wantedName) {
  const headers = (response && response.headers) || {};
  const names = Object.keys(headers);
  for (let i = 0; i < names.length; i++) {
    if (names[i].toLowerCase() === wantedName.toLowerCase()) {
      return headers[names[i]];
    }
  }
  return "";
}

function extractSessionCookie(response) {
  const value = getHeaderValue(response, "set-cookie");
  let items;
  if (Array.isArray(value)) {
    items = value;
  } else {
    const text = String(value || "");
    // 多个 Set-Cookie 可能被换行或逗号合并; 逗号后紧跟 name= 才视为分隔(避免切断 Expires 日期)
    items = text.indexOf("\n") >= 0 ? text.split("\n") : text.split(/,(?=\s*[A-Za-z0-9_\-]+=)/);
  }

  const cookies = [];
  for (let i = 0; i < items.length; i++) {
    const pair = String(items[i]).split(";", 1)[0].trim();
    if (pair && pair.indexOf("=") > 0) cookies.push(pair);
  }
  return cookies.join("; ");
}

function authenticatedHeaders(result, user, refererPath) {
  const cookie = extractSessionCookie(result.response);
  if (!user.id || !cookie) return null;

  return {
    "Accept": "application/json, text/plain, */*",
    "Cookie": cookie,
    "New-API-User": String(user.id),
    "Referer": result.host + refererPath,
    "User-Agent": USER_AGENT,
  };
}

// ---------- 余额 ----------
function extractQuota(payload) {
  if (!payload || typeof payload !== "object") return null;
  const keys = ["quota", "remainder_quota", "balance"];
  for (let i = 0; i < keys.length; i++) {
    const v = payload[keys[i]];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function quotaText(quota) {
  if (quota === null || quota === undefined || quota === "") return "未知";
  const value = Number(quota);
  if (!isFinite(value)) return String(quota);
  return "$" + (value / QUOTA_PER_USD).toFixed(2);
}

// 登录响应里没有 quota 时, 回退查询 /api/user/self
function fetchSelfQuota(result, user) {
  const headers = authenticatedHeaders(result, user, "/console/personal");
  if (!headers) {
    log("余额回退查询跳过: 缺少 uid 或会话 Cookie");
    return Promise.resolve(null);
  }

  return request({
    url: result.host + "/api/user/self",
    method: "GET",
    headers: headers,
  }).then(function (response) {
    const parsed = parseBody(response);
    if (!parsed.ok || !parsed.data || !parsed.data.success) {
      log("余额回退查询失败: /api/user/self 返回异常 (HTTP " + response.statusCode + ")");
      return null;
    }
    return extractQuota(parsed.data.data || {});
  }).catch(function (error) {
    log("余额回退查询异常: " + describeError(error));
    return null;
  });
}

// ---------- 签到日志核验 ----------
function ageText(seconds) {
  const age = Math.max(0, seconds);
  if (age < 60) return age + " 秒前";
  if (age < 3600) return Math.floor(age / 60) + " 分钟前";
  if (age < TODAY_SECONDS) return Math.floor(age / 3600) + " 小时前";
  return Math.floor(age / TODAY_SECONDS) + " 天前";
}

// 返回 {level, detail}:
//   new   本次运行刚生成了签到日志
//   today 近 1 天内有签到日志(多半是今日更早已完成)
//   none  找不到签到日志 / 日志过旧
//   error 日志接口异常(不影响登录结论)
function verifyCheckin(result, user) {
  const headers = authenticatedHeaders(result, user, "/console/log");
  if (!headers) {
    return Promise.resolve({ level: "error", detail: "缺少 uid 或会话 Cookie, 跳过日志核验" });
  }

  return request({
    url: result.host + "/api/log/self/?p=1&page_size=20",
    method: "GET",
    headers: headers,
  }).then(function (response) {
    if (response.statusCode !== 200) {
      return { level: "error", detail: "日志接口返回 HTTP " + response.statusCode };
    }

    const parsed = parseBody(response);
    if (!parsed.ok || !parsed.data || !parsed.data.success) {
      return { level: "error", detail: "日志接口返回异常" };
    }

    const data = parsed.data.data || {};
    const items = Array.isArray(data.items) ? data.items : [];
    let newestTimestamp = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i] || {};
      const content = String(item.content || "");
      const timestamp = Number(item.created_at);
      const isCheckin = content.indexOf("签到成功") >= 0 || Number(item.type) === CHECKIN_LOG_TYPE;
      if (isCheckin && isFinite(timestamp) && timestamp > 0) {
        if (newestTimestamp === null || timestamp > newestTimestamp) {
          newestTimestamp = timestamp;
        }
      }
    }

    if (newestTimestamp === null) {
      return { level: "none", detail: "日志中未找到任何签到记录" };
    }

    const age = Math.max(0, Math.floor(Date.now() / 1000) - newestTimestamp);
    if (age <= RECENT_CHECKIN_SECONDS) {
      return { level: "new", detail: "本次运行已生成签到日志（" + ageText(age) + "）" };
    }
    if (age <= TODAY_SECONDS) {
      return { level: "today", detail: "近 1 天内有签到记录（" + ageText(age) + "），本次未新增" };
    }
    return { level: "none", detail: "最近一条签到日志较旧（" + ageText(age) + "）" };
  }).catch(function (error) {
    return { level: "error", detail: "日志查询异常: " + describeError(error) };
  });
}

function buildOutcome(checkedIn, verification) {
  const confirmed = verification.level === "new" || verification.level === "today";
  if (checkedIn) {
    if (confirmed) {
      return { status: "success", message: "签到成功，日志已确认（" + verification.detail + "）" };
    }
    return { status: "success", message: "登录成功且服务端返回已签到，但日志未确认: " + verification.detail };
  }
  if (confirmed) {
    return { status: "already", message: "今日已有签到记录（" + verification.detail + "）" };
  }
  return { status: "success", message: "登录成功，但 checked_in=false(可能今日额度已发或接口变化)" };
}

// ---------- 登录 ----------
function loginOnHost(host, account) {
  return request({
    url: host + "/api/user/login?turnstile=",
    method: "POST",
    headers: {
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json;charset=UTF-8",
      "New-API-User": "0",
      "Origin": host,
      "Referer": host + "/login",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      username: account.username,
      password: account.password,
    }),
  }).then(function (response) {
    const contentType = String(getHeaderValue(response, "content-type") || "");
    if (contentType.indexOf("text/html") >= 0) {
      throw { retry: true, message: "登录接口返回 HTML(可能被 WAF 拦截或路径变化)" };
    }
    if (response.statusCode >= 400) {
      const parsed = parseBody(response);
      const message = parsed.ok && parsed.data
        ? parsed.data.message || parsed.text
        : parsed.text;
      throw {
        retry: response.statusCode >= 500 || response.statusCode === 429,
        message: "HTTP " + response.statusCode + ": " + String(message || "请求失败").slice(0, 120),
      };
    }
    return { host: host, response: response };
  });
}

function loginWithFallback(account, index, hosts) {
  if (index >= hosts.length) {
    return Promise.reject(new Error("所有域名均不可用"));
  }

  return loginOnHost(hosts[index], account).catch(function (error) {
    if (index + 1 < hosts.length && error && error.retry) {
      log("[" + account.name + "] " + hosts[index] + " 不可用(" + describeError(error) + "), 切换到 " + hosts[index + 1]);
      return loginWithFallback(account, index + 1, hosts);
    }
    throw error;
  });
}

// ---------- 结果 ----------
function makeResult(name, status, message, username, quota) {
  const res = {
    name: name,
    status: status,
    message: message,
    username: username || "",
    quota: quota,
    time: nowText(),
  };
  log("[" + name + "] " + STATUS_TAG[status] + " | " + message + " | 余额: " + quotaText(quota));
  return res;
}

function checkAccount(account, hosts) {
  const name = account.name;

  if (!account.enabled) {
    // 显式停用是用户的主动选择, 不是失败, 也不该拉低成功率。
    return Promise.resolve(makeResult(name, "skip", "账号已停用, 跳过", "", null));
  }
  if (!account.username || !account.password) {
    return Promise.resolve(makeResult(name, "skip", "BoxJS 未填写完整凭证, 跳过", "", null));
  }

  log("====== 开始处理账号(账号密码登录): " + name + " ======");

  return loginWithFallback(account, 0, hosts).then(function (result) {
    const parsed = parseBody(result.response);
    if (!parsed.ok || !parsed.data) {
      return makeResult(name, "fail", "登录响应非 JSON: " + String(parsed.text || "").slice(0, 120), "", null);
    }

    const payload = parsed.data || {};
    if (!payload.success) {
      return makeResult(name, "fail", "登录失败: " + (payload.message || "未知原因"), "", null);
    }

    const user = payload.data || {};
    const username = user.username || user.display_name || account.username;
    const checkedIn = Boolean(user.checked_in);
    let quota = extractQuota(user);

    log("[" + name + "] 登录成功, uid=" + (user.id || "?") + ", checked_in=" + checkedIn +
        ", 登录响应余额: " + quotaText(quota));

    const quotaPromise = quota !== null
      ? Promise.resolve(quota)
      : fetchSelfQuota(result, user).then(function (fallback) {
          if (fallback !== null) log("[" + name + "] 已通过 /api/user/self 获取余额: " + quotaText(fallback));
          return fallback;
        });

    return quotaPromise.then(function (finalQuota) {
      return verifyCheckin(result, user).then(function (verification) {
        const outcome = buildOutcome(checkedIn, verification);
        return makeResult(name, outcome.status, outcome.message, username, finalQuota);
      });
    });
  }).catch(function (error) {
    return makeResult(name, "fail", "登录请求异常: " + describeError(error), "", null);
  });
}

// ---------- 调度 ----------
function runAll(accounts, hosts, index, results, done) {
  if (index >= accounts.length) {
    done(results);
    return;
  }
  checkAccount(accounts[index], hosts).then(function (res) {
    results.push(res);
    runAll(accounts, hosts, index + 1, results, done);
  });
}

function main() {
  log("AgentRouter 自动签到启动 (账号密码登录即签到)");

  const hosts = configuredHosts();
  const slots = configuredAccounts();
  const enabled = slots.filter(function (a) {
    return a.enabled;
  });
  const disabled = slots.filter(function (a) {
    return !a.enabled;
  });

  // 显式停用的槽位只写日志, 不进通知; 启用但缺凭据的槽位会走成 skip, 在通知里点名提示。
  disabled.forEach(function (a) {
    log("[" + a.name + "] 已在 BoxJS 中停用, 本次跳过");
  });

  log(
    "已读取 BoxJS 配置: 启用 " + enabled.length + " 个, 停用 " + disabled.length +
    " 个; 域名顺序: " + hosts.join(" -> ")
  );

  if (enabled.length === 0) {
    const hint = '未检测到启用的账号: 请在 BoxJS 的 "AgentRouter签到" 中配置 ar_username_N / ar_password_N 并打开启用开关';
    log(hint);
    safeNotify("[AgentRouter] 未执行", "0/0", hint);
    if (typeof $done === "function") $done({});
    return;
  }

  runAll(enabled, hosts, 0, [], function (results) {
    const lines = results.map(function (r) {
      const who = r.username && r.username !== r.name
        ? r.name + "(" + r.username + ")"
        : r.name;
      return (STATUS_ICON[r.status] || "ℹ️") + " " + who + "：" + r.message + " | 余额 " + quotaText(r.quota);
    });

    const okCount = results.filter(function (r) {
      return r.status === "success" || r.status === "already";
    }).length;
    const failCount = results.filter(function (r) {
      return r.status === "fail";
    }).length;
    const skipCount = results.length - okCount - failCount;

    const subtitle =
      "成功 " + okCount + "/" + results.length +
      (failCount ? " | 失败 " + failCount : "") +
      (skipCount ? " | 跳过 " + skipCount : "");

    const noAttempt = okCount === 0 && failCount === 0;
    // 只有"确实尝试过且全部失败"才算签到失败; 一个都没尝试属于配置问题。
    const title = noAttempt
      ? "[AgentRouter] 未配置账号"
      : okCount === 0 && failCount > 0
        ? "[AgentRouter] 签到失败"
        : "[AgentRouter] 签到汇总";

    if (noAttempt) {
      lines.push("提示: 请在 BoxJS 的 \"AgentRouter签到\" 中填写 ar_username_N / ar_password_N");
    }

    safeNotify(title, subtitle, lines.join("\n"));
    log(
      "全部账号处理完毕: 成功 " + okCount + "/" + results.length +
      (failCount ? ", 失败 " + failCount : "") +
      (skipCount ? ", 跳过 " + skipCount : "")
    );

    if (typeof $done === "function") {
      $done({});
    }
  });
}

main();
