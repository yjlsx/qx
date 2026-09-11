// AgentRouter daily login check-in.
// Credentials are managed by BoxJS keys declared in boxjs/boxjs.json.
// Add the following line to Quantumult X [task_local] after pushing this file:
// 0 9 * * * https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/agentrouter.js, tag=AgentRouter签到, enabled=true

const DEFAULT_HOSTS = [
  "https://agentrouter.org",
  "https://ps.air-outer.com",
];

const QUOTA_PER_USD = 500000;
const CHECKIN_LOG_TYPE = 4;
const RECENT_CHECKIN_SECONDS = 300;
const TODAY_SECONDS = 86400;
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

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
  if (value === false || value === null || value === undefined || value === "") {
    return fallback;
  }
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

function notify(title, subtitle, body) {
  if (typeof $notify === "function") {
    $notify(title, subtitle, body);
  }
}

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
  const items = Array.isArray(value) ? value : String(value || "").split("\n");
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

function fetchSelfBalance(result, user) {
  const headers = authenticatedHeaders(result, user, "/console/personal");
  if (!headers) return Promise.resolve("");

  return request({
    url: result.host + "/api/user/self",
    method: "GET",
    headers: headers,
  }).then(function (response) {
    const parsed = parseBody(response);
    if (!parsed.ok || !parsed.data || !parsed.data.success) return "";
    return formatQuota((parsed.data.data || {}).quota);
  }).catch(function () {
    return "";
  });
}

function ageText(seconds) {
  const age = Math.max(0, seconds);
  if (age < 60) return age + " 秒前";
  if (age < 3600) return Math.floor(age / 60) + " 分钟前";
  if (age < TODAY_SECONDS) return Math.floor(age / 3600) + " 小时前";
  return Math.floor(age / TODAY_SECONDS) + " 天前";
}

function verifyCheckin(result, user) {
  const headers = authenticatedHeaders(result, user, "/console/log");
  if (!headers) {
    return Promise.resolve({ level: "error", detail: "缺少 uid 或会话 Cookie" });
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
      return { level: "none", detail: "日志中未找到签到记录" };
    }

    const age = Math.max(0, Math.floor(Date.now() / 1000) - newestTimestamp);
    if (age <= RECENT_CHECKIN_SECONDS) {
      return {
        level: "new",
        age: ageText(age),
        detail: "本次运行已生成签到日志，" + ageText(age),
      };
    }
    if (age <= TODAY_SECONDS) {
      return { level: "today", age: ageText(age), detail: "今日已有签到记录，" + ageText(age) };
    }
    return { level: "none", detail: "最近签到日志较旧，" + ageText(age) };
  }).catch(function (error) {
    return { level: "error", detail: "日志查询异常：" + describeError(error) };
  });
}

function checkinResultText(checkedIn, verification) {
  if (checkedIn) {
    if (verification.level === "new" || verification.level === "today") {
      return "签到成功，日志已确认（" + verification.detail + "）";
    }
    return "签到成功，但日志未确认（" + verification.detail + "）";
  }

  if (verification.level === "new" || verification.level === "today") {
    return "今日已有签到记录（" + verification.age + "）";
  }
  return "登录成功，但日志未确认（" + verification.detail + "）";
}

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
      return loginWithFallback(account, index + 1, hosts);
    }
    throw error;
  });
}

function formatQuota(quota) {
  if (quota === null || quota === undefined || quota === "") return "";
  const value = Number(quota);
  if (!isFinite(value)) return "";
  return "$" + (value / QUOTA_PER_USD).toFixed(2);
}

function checkAccount(account, hosts) {
  if (!account.enabled) {
    account.success = false;
    account.result = "已停用";
    return Promise.resolve();
  }

  if (!account.username || !account.password) {
    account.success = false;
    account.result = "跳过：BoxJS 中未填写完整凭证";
    return Promise.resolve();
  }

  return loginWithFallback(account, 0, hosts).then(
    function (result) {
      const parsed = parseBody(result.response);
      if (!parsed.ok || !parsed.data) {
        throw new Error("返回内容不是 JSON");
      }

      const payload = parsed.data || {};
      if (!payload.success) {
        throw new Error(payload.message || "登录失败");
      }

      const user = payload.data || {};
      account.success = true;
      return verifyCheckin(result, user).then(function (verification) {
        account.result = checkinResultText(Boolean(user.checked_in), verification);

        const balance = formatQuota(user.quota);
        if (balance) {
          account.result += "，余额约 " + balance;
          return;
        }

        return fetchSelfBalance(result, user).then(function (fallbackBalance) {
          if (fallbackBalance) {
            account.result += "，余额约 " + fallbackBalance;
          } else {
            account.result += "，余额未知";
          }
        });
      });
    },
    function (error) {
      throw new Error(describeError(error));
    }
  );
}

function run(accounts, hosts, index, done) {
  if (index >= accounts.length) {
    done();
    return;
  }

  const account = accounts[index];
  checkAccount(account, hosts).catch(function (error) {
    account.success = false;
    account.result = describeError(error);
  }).then(function () {
    run(accounts, hosts, index + 1, done);
  });
}

const HOSTS = configuredHosts();
const ACCOUNTS = configuredAccounts();

run(ACCOUNTS, HOSTS, 0, function () {
  const total = ACCOUNTS.length;
  const succeeded = ACCOUNTS.filter(function (item) {
    return item.success === true;
  }).length;

  notify(
    "AgentRouter 签到",
    "成功 " + succeeded + "/" + total,
    ACCOUNTS.map(function (account, index) {
      return (account.name || "账号" + (index + 1)) + "：" + (account.result || "无结果");
    }).join("\n")
  );

  if (typeof $done === "function") {
    $done({});
  }
});
