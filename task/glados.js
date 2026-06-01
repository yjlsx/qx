/*
【GLaDOS】

 - 2026 版
 - 支持 railgun.info / glados.network / glados.vip / glados.one / glados.space
 - 支持多账号、汇总通知、积分查询、积分满 500 自动兑换 plan500

⚠️【免责声明】
------------------------------------------
1、此脚本仅用于学习研究，不保证其合法性、准确性、有效性，请根据情况自行判断，本人对此不承担任何保证责任。
2、由于此脚本仅用于学习研究，您必须在下载后 24 小时内将所有内容从您的计算机或手机或任何存储设备中完全删除，若违反规定引起任何事件本人对此均不负责。
3、请勿将此脚本用于任何商业或非法目的，若违反规定请自行对此负责。
4、此脚本涉及应用与本人无关，本人对因此引起的任何隐私泄漏或其他后果不承担任何责任。
5、本人对任何脚本引发的问题概不负责，包括但不限于由脚本错误引起的任何损失和损害。
6、如果任何单位或个人认为此脚本可能涉嫌侵犯其权利，应及时通知并提供身份证明，所有权证明，我们将在收到认证文件确认后删除此脚本。
7、所有直接或间接使用、查看此脚本的人均应该仔细阅读此声明。本人保留随时更改或补充此声明的权利。一旦您使用或复制了此脚本，即视为您已接受此免责声明。

登陆链接：https://railgun.info/ 或其它 GLaDOS 域名，登陆即可获取Cookie。
注册地址：https://github.com/glados-network/GLaDOS

【Surge】
-----------------
[Script]
GLaDOS签到 = type=cron,cronexp=5 0 * * *,wake-system=1,timeout=20,script-path=https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js


获取GLaDOS_Cookie = type=http-request, pattern=https:\/\/(railgun\.info|glados\.network|glados\.vip|glados\.one|glados\.space)\/(console\/account|api\/user\/checkin), script-path=https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js

【Loon】
-----------------
[Script]
cron "5 0 * * *" tag=GLaDOS签到, script-path=https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js

http-request https:\/\/(railgun\.info|glados\.network|glados\.vip|glados\.one|glados\.space)\/(console\/account|api\/user\/checkin) tag=获取GLaDOS_Cookie, script-path=https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js


【Quantumult X】
-----------------
[rewrite_local]
https:\/\/(railgun\.info|glados\.network|glados\.vip|glados\.one|glados\.space)\/(console\/account|api\/user\/checkin) url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js


[task_local]
1 0 * * * https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js


【All App MitM】
hostname = railgun.info, glados.network, glados.vip, glados.one, glados.space
*/




const $ = new Env("GLaDOS");
const SCRIPT_VERSION = "2026.06.02";
const DEFAULT_DOMAIN = "railgun.info";
const SUPPORTED_DOMAINS = ["railgun.info", "glados.network", "glados.vip", "glados.one", "glados.space"];
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const LEGACY_COOKIE_KEY = "evil_gladoscookie";
const LEGACY_AUTH_KEY = "evil_gladosauthorization";
const DOMAINS_KEY = "GLaDOS_Domains";
const ACCOUNTS_KEY_PREFIX = "GLaDOS_Accounts:";
const EXCHANGE_PLAN = "plan500";
const AUTO_EXCHANGE = true;

!(async () => {
  if (typeof $request !== "undefined") {
    captureAccount();
    return;
  }

  migrateLegacyAccount();
  const accounts = getAllAccounts();
  if (!accounts.length) {
    $.msg("GLaDOS", "未获取到账号", `请先访问 ${DEFAULT_DOMAIN} 或其它 GLaDOS 域名并抓取 Cookie`);
    return;
  }

  await $.wait(Math.floor(Math.random() * 11) * 1000);
  $.log(`🚀 GLaDOS 开始 | ${SCRIPT_VERSION} | 账号 ${accounts.length}`);
  $.log("------------------------------------");

  const results = [];
  for (let i = 0; i < accounts.length; i++) {
    const result = await runAccount(accounts[i], i + 1);
    results.push(result);
  }

  notifySummary(results);
})()
  .catch((e) => {
    $.log("", `❌失败! 原因: ${e && e.stack ? e.stack : e}`, "");
    $.msg("GLaDOS", "运行失败", String(e));
  })
  .finally(() => {
    $.done();
  });

function runAccount(account, index) {
  let beforeStatus;
  let checkinResult;
  let pointsResult;
  let exchangeResult = "跳过";
  let afterStatus;

  return getStatus(account)
    .then((status) => {
      beforeStatus = status;
      logAccountHeader(index, account.domain, status.email);
      return checkin(account);
    })
    .then((result) => {
      checkinResult = result;
      return getPoints(account);
    })
    .then((result) => {
      pointsResult = result;
      if (AUTO_EXCHANGE && pointsResult.pointsNum >= 500) {
        return exchange(account, EXCHANGE_PLAN);
      }
      return pointsResult.pointsNum >= 500 ? "未开启自动兑换" : "积分不足";
    })
    .then((result) => {
      exchangeResult = result;
      return getStatus(account);
    })
    .then((status) => {
      afterStatus = status;
      const icon = checkinResult.code === 0 ? "✅" : checkinResult.code === 1 ? "🔁" : "❌";
      $.log(`状态          : ${icon} ${checkinResult.status}`);
      if (checkinResult.points !== "0") $.log(`本次积分      : +${checkinResult.points}`);
      $.log(`剩余天数      : ${beforeStatus.leftDays} -> ${afterStatus.leftDays}`);
      $.log(`当前积分      : ${pointsResult.points}`);
      $.log(`兑换          : ${exchangeResult}`);
      if (checkinResult.message) $.log(`消息          : ${checkinResult.message}`);
      $.log("------------------------------------");
      return {
        index,
        domain: account.domain,
        email: beforeStatus.email || afterStatus.email || `Account #${index}`,
        code: checkinResult.code,
        status: checkinResult.status,
        message: checkinResult.message,
        earnedPoints: checkinResult.points,
        totalPoints: pointsResult.points,
        daysBefore: beforeStatus.leftDays,
        daysAfter: afterStatus.leftDays,
        exchange: exchangeResult
      };
    });
}

function requestApi(account, path, method = "GET", body) {
  const domain = account.domain || DEFAULT_DOMAIN;
  const headers = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh-Hans;q=0.9",
    "Content-Type": "application/json;charset=utf-8",
    "Origin": `https://${domain}`,
    "Referer": `https://${domain}/console/current`,
    "User-Agent": UA,
    "Cookie": account.cookie || ""
  };
  if (account.authorization) headers.Authorization = account.authorization;
  const options = {
    url: `https://${domain}${path}`,
    headers
  };
  if (body !== undefined) options.body = typeof body === "string" ? body : JSON.stringify(body);

  return new Promise((resolve) => {
    const callback = (error, response, data) => {
      if (error) {
        resolve({ error: String(error), statusCode: 0, data: null, raw: "" });
        return;
      }
      const raw = data || (response && response.body) || "";
      resolve({
        error: "",
        statusCode: (response && (response.statusCode || response.status)) || 0,
        data: safeJsonParse(raw),
        raw
      });
    };
    if (method === "POST") $.post(options, callback);
    else $.get(options, callback);
  });
}

function checkin(account) {
  return requestApi(account, "/api/user/checkin", "POST", { token: account.domain }).then((resp) => {
    if (resp.error) return { status: "签到失败", code: -2, message: resp.error, points: "0" };
    if (!resp.data) return { status: "签到失败", code: -2, message: previewBody(resp.raw), points: "0" };
    const data = resp.data;
    const code = data.code !== undefined ? data.code : -2;
    const msg = data.message || "";
    const points = formatPoints(data.points || (data.list && data.list[0] && data.list[0].change) || 0);
    if (code === 0) return { status: "签到成功", code, message: msg, points: String(points) };
    if (code === 1 || /Please Try Tomorrow/i.test(msg)) return { status: "重复签到", code: 1, message: msg, points: "0" };
    return { status: "签到失败", code, message: msg || `HTTP ${resp.statusCode}`, points: "0" };
  });
}

function getStatus(account) {
  return requestApi(account, "/api/user/status").then((resp) => {
    const data = resp.data && resp.data.data ? resp.data.data : {};
    const leftDays = data.leftDays;
    return {
      email: data.email || "unknown",
      leftDays: leftDays !== undefined && leftDays !== null ? `${parseInt(parseFloat(leftDays), 10)}天` : "N/A"
    };
  });
}

function getPoints(account) {
  return requestApi(account, "/api/user/points").then((resp) => {
    const rawPoints = resp.data && resp.data.points;
    const pointsNum = rawPoints !== undefined && rawPoints !== null ? parseInt(parseFloat(rawPoints), 10) : 0;
    return {
      points: rawPoints !== undefined && rawPoints !== null ? String(pointsNum) : "N/A",
      pointsNum: Number.isFinite(pointsNum) ? pointsNum : 0
    };
  });
}

function exchange(account, plan) {
  return requestApi(account, "/api/user/exchange", "POST", { planType: plan }).then((resp) => {
    if (resp.error || !resp.data) return "兑换失败";
    if (resp.data.code === 0) return `兑换成功(${plan})`;
    return `兑换失败: ${resp.data.message || resp.data.code}`;
  });
}

function captureAccount() {
  const headers = $request.headers || {};
  const cookie = headers.Cookie || headers.cookie || "";
  const authorization = headers.Authorization || headers.authorization || "";
  const domain = normalizeDomain(getHostFromRequest() || DEFAULT_DOMAIN);

  if (!cookie || !domain) {
    $.msg("GLaDOS", "抓取失败", "未获取到 Cookie 或 Host");
    return;
  }

  const result = saveAccount(domain, { cookie, authorization });
  $.log(`抓取到 ${domain} 账号 #${result.index + 1}`);
  $.msg("GLaDOS", result.isNew ? "新账号已保存" : "账号已更新", `${domain} #${result.index + 1}`);
}

function getHostFromRequest() {
  const headers = ($request && $request.headers) || {};
  if (headers.Host || headers.host) return headers.Host || headers.host;
  const url = ($request && $request.url) || "";
  const match = url.match(/^https?:\/\/([^/]+)/);
  return match ? match[1] : "";
}

function normalizeDomain(domain) {
  return String(domain || "").replace(/^https?:\/\//, "").split("/")[0].trim().toLowerCase();
}

function accountKey(domain) {
  return `${ACCOUNTS_KEY_PREFIX}${domain}`;
}

function getSavedDomains() {
  const raw = $.getdata(DOMAINS_KEY);
  const list = safeJsonParse(raw);
  return Array.isArray(list) ? list.filter(Boolean) : [];
}

function setSavedDomains(list) {
  $.setdata(JSON.stringify(Array.from(new Set(list.filter(Boolean)))), DOMAINS_KEY);
}

function addSavedDomain(domain) {
  const list = getSavedDomains();
  if (!list.includes(domain)) {
    list.push(domain);
    setSavedDomains(list);
  }
}

function getAccountsForDomain(domain) {
  const raw = $.getdata(accountKey(domain));
  const list = safeJsonParse(raw);
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => typeof item === "string" ? { cookie: item, authorization: "" } : item)
    .filter((item) => item && item.cookie)
    .map((item) => ({
      domain,
      cookie: item.cookie,
      authorization: item.authorization || "",
      createdAt: item.createdAt || "",
      updatedAt: item.updatedAt || ""
    }));
}

function saveAccount(domain, account) {
  const list = getAccountsForDomain(domain);
  const now = new Date().toISOString();
  const index = list.findIndex((item) => item.cookie === account.cookie);
  const saved = {
    domain,
    cookie: account.cookie,
    authorization: account.authorization || "",
    createdAt: index >= 0 ? list[index].createdAt : now,
    updatedAt: now
  };
  if (index >= 0) list[index] = saved;
  else list.push(saved);
  $.setdata(JSON.stringify(list.map((item) => ({
    cookie: item.cookie,
    authorization: item.authorization || "",
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || ""
  }))), accountKey(domain));
  addSavedDomain(domain);
  return { isNew: index < 0, index: index >= 0 ? index : list.length - 1 };
}

function getAllAccounts() {
  const domains = Array.from(new Set([...SUPPORTED_DOMAINS, ...getSavedDomains()]));
  const accounts = [];
  domains.forEach((domain) => {
    getAccountsForDomain(domain).forEach((account) => accounts.push(account));
  });
  return accounts;
}

function migrateLegacyAccount() {
  const cookie = $.getdata(LEGACY_COOKIE_KEY);
  if (!cookie) return;
  const authorization = $.getdata(LEGACY_AUTH_KEY) || "";
  saveAccount(DEFAULT_DOMAIN, { cookie, authorization });
}

function notifySummary(results) {
  const ok = results.filter((item) => item.code === 0).length;
  const duplicate = results.filter((item) => item.code === 1).length;
  const failed = results.length - ok - duplicate;
  $.log("📊 Summary");
  $.log(`Total      : ${results.length}`);
  $.log(`Success    : ${ok}`);
  $.log(`Duplicate  : ${duplicate}`);
  $.log(`Failed     : ${failed}`);

  $.msg("GLaDOS", "签到完成", `账号 ${results.length} | ✅${ok} 🔁${duplicate} ❌${failed}`);
  results.forEach((item) => {
    const icon = item.code === 0 ? "✅" : item.code === 1 ? "🔁" : "❌";
    const pointsText = item.earnedPoints !== "0" ? ` | +${item.earnedPoints}积分` : "";
    $.msg(`${icon} ${item.email}`, `${item.status}${pointsText}`, `${item.domain} | 剩余 ${item.daysAfter} | 积分 ${item.totalPoints} | ${item.exchange}`);
  });
}

function logAccountHeader(index, domain, email) {
  $.log(`👤 Account #${index} | ${domain}`);
  $.log(`Email         : ${email || "unknown"}`);
}

function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function previewBody(body) {
  if (!body) return "";
  return typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300);
}

function formatPoints(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : value;
}

// --- 此处开始是你原始脚本中完整的 Env.js 库 ---
function Env(name, opts) {
 class Http {
   constructor(env) {
     this.env = env;
   }

   send(opts, method = "GET") {
     opts = typeof opts === "string" ? { url: opts } : opts;
     let sender = this.get;
     if (method === "POST") {
       sender = this.post;
     }
     return new Promise((resolve, reject) => {
       sender.call(this, opts, (err, resp, body) => {
         if (err) reject(err);
         else resolve(resp);
       });
     });
   }

   get(opts) {
     return this.send.call(this.env, opts);
   }

   post(opts) {
     return this.send.call(this.env, opts, "POST");
   }
 }

 return new (class {
   constructor(name, opts) {
     this.name = name;
     this.http = new Http(this);
     this.data = null;
     this.dataFile = "box.dat";
     this.logs = [];
     this.isMute = false;
     this.isNeedRewrite = false;
     this.logSeparator = "\n";
     this.startTime = new Date().getTime();
     Object.assign(this, opts);
     this.log("", `🔔${this.name}, 开始!`);
   }

   isNode() {
     return "undefined" !== typeof module && !!module.exports;
   }

   isQuanX() {
     return "undefined" !== typeof $task;
   }

   isSurge() {
     return "undefined" !== typeof $httpClient && "undefined" === typeof $loon;
   }

   isLoon() {
     return "undefined" !== typeof $loon;
   }

   toObj(str, defaultValue = null) {
     try {
       return JSON.parse(str);
     } catch {
       return defaultValue;
     }
   }

   toStr(obj, defaultValue = null) {
     try {
       return JSON.stringify(obj);
     } catch {
       return defaultValue;
     }
   }

   getjson(key, defaultValue) {
     let json = defaultValue;
     const val = this.getdata(key);
     if (val) {
       try {
         json = JSON.parse(this.getdata(key));
       } catch { }
     }
     return json;
   }

   setjson(val, key) {
     try {
       return this.setdata(JSON.stringify(val), key);
     } catch {
       return false;
     }
   }

   getScript(url) {
     return new Promise((resolve) => {
       this.get({ url }, (err, resp, body) => resolve(body));
     });
   }

   runScript(script, runOpts) {
     return new Promise((resolve) => {
       let httpapi = this.getdata("@chavy_boxjs_userCfgs.httpapi");
       httpapi = httpapi ? httpapi.replace(/\n/g, "").trim() : httpapi;
       let httpapi_timeout = this.getdata(
         "@chavy_boxjs_userCfgs.httpapi_timeout"
       );
       httpapi_timeout = httpapi_timeout ? httpapi_timeout * 1 : 20;
       httpapi_timeout =
         runOpts && runOpts.timeout ? runOpts.timeout : httpapi_timeout;
       const [key, addr] = httpapi.split("@");
       const opts = {
         url: `http://${addr}/v1/scripting/evaluate`,
         body: {
           script_text: script,
           mock_type: "cron",
           timeout: httpapi_timeout,
         },
         headers: { "X-Key": key, Accept: "*/*" },
       };
       this.post(opts, (err, resp, body) => resolve(body));
     }).catch((e) => this.logErr(e));
   }

   loaddata() {
     if (this.isNode()) {
       this.fs = this.fs ? this.fs : require("fs");
       this.path = this.path ? this.path : require("path");
       const curDirDataFilePath = this.path.resolve(this.dataFile);
       const rootDirDataFilePath = this.path.resolve(
         process.cwd(),
         this.dataFile
       );
       const isCurDirDataFile = this.fs.existsSync(curDirDataFilePath);
       const isRootDirDataFile =
         !isCurDirDataFile && this.fs.existsSync(rootDirDataFilePath);
       if (isCurDirDataFile || isRootDirDataFile) {
         const datPath = isCurDirDataFile
           ? curDirDataFilePath
           : rootDirDataFilePath;
         try {
           return JSON.parse(this.fs.readFileSync(datPath));
         } catch (e) {
           return {};
         }
       } else return {};
     } else return {};
   }

   writedata() {
     if (this.isNode()) {
       this.fs = this.fs ? this.fs : require("fs");
       this.path = this.path ? this.path : require("path");
       const curDirDataFilePath = this.path.resolve(this.dataFile);
       const rootDirDataFilePath = this.path.resolve(
         process.cwd(),
         this.dataFile
       );
       const isCurDirDataFile = this.fs.existsSync(curDirDataFilePath);
       const isRootDirDataFile =
         !isCurDirDataFile && this.fs.existsSync(rootDirDataFilePath);
       const jsondata = JSON.stringify(this.data);
       if (isCurDirDataFile) {
         this.fs.writeFileSync(curDirDataFilePath, jsondata);
       } else if (isRootDirDataFile) {
         this.fs.writeFileSync(rootDirDataFilePath, jsondata);
       } else {
         this.fs.writeFileSync(curDirDataFilePath, jsondata);
       }
     }
   }

   lodash_get(source, path, defaultValue = undefined) {
     const paths = path.replace(/\[(\d+)\]/g, ".$1").split(".");
     let result = source;
     for (const p of paths) {
       result = Object(result)[p];
       if (result === undefined) {
         return defaultValue;
       }
     }
     return result;
   }

   lodash_set(obj, path, value) {
     if (Object(obj) !== obj) return obj;
     if (!Array.isArray(path)) path = path.toString().match(/[^.[\]]+/g) || [];
     path
       .slice(0, -1)
       .reduce(
         (a, c, i) =>
           Object(a[c]) === a[c]
             ? a[c]
             : (a[c] = Math.abs(path[i + 1]) >> 0 === +path[i + 1] ? [] : {}),
         obj
       )[path[path.length - 1]] = value;
     return obj;
   }

   getdata(key) {
     let val = this.getval(key);
     if (/^@/.test(key)) {
       const [, objkey, paths] = /^@(.*?)\.(.*?)$/.exec(key);
       const objval = objkey ? this.getval(objkey) : "";
       if (objval) {
         try {
           const objedval = JSON.parse(objval);
           val = objedval ? this.lodash_get(objedval, paths, "") : val;
         } catch (e) {
           val = "";
         }
       }
     }
     return val;
   }

   setdata(val, key) {
     let issuc = false;
     if (/^@/.test(key)) {
       const [, objkey, paths] = /^@(.*?)\.(.*?)$/.exec(key);
       const objdat = this.getval(objkey);
       const objval = objkey
         ? objdat === "null"
           ? null
           : objdat || "{}"
         : "{}";
       try {
         const objedval = JSON.parse(objval);
         this.lodash_set(objedval, paths, val);
         issuc = this.setval(JSON.stringify(objedval), objkey);
       } catch (e) {
         const objedval = {};
         this.lodash_set(objedval, paths, val);
         issuc = this.setval(JSON.stringify(objedval), objkey);
       }
     } else {
       issuc = this.setval(val, key);
     }
     return issuc;
   }

   getval(key) {
     if (this.isSurge() || this.isLoon()) {
       return $persistentStore.read(key);
     } else if (this.isQuanX()) {
       return $prefs.valueForKey(key);
     } else if (this.isNode()) {
       this.data = this.loaddata();
       return this.data[key];
     } else {
       return (this.data && this.data[key]) || null;
     }
   }

   setval(val, key) {
     if (this.isSurge() || this.isLoon()) {
       return $persistentStore.write(val, key);
     } else if (this.isQuanX()) {
       return $prefs.setValueForKey(val, key);
     } else if (this.isNode()) {
       this.data = this.loaddata();
       this.data[key] = val;
       this.writedata();
       return true;
     } else {
       return (this.data && this.data[key]) || null;
     }
   }

   initGotEnv(opts) {
     this.got = this.got ? this.got : require("got");
     this.cktough = this.cktough ? this.cktough : require("tough-cookie");
     this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar();
     if (opts) {
       opts.headers = opts.headers ? opts.headers : {};
       if (undefined === opts.headers.Cookie && undefined === opts.cookieJar) {
         opts.cookieJar = this.ckjar;
       }
     }
   }

   get(opts, callback = () => { }) {
     if (opts.headers) {
       delete opts.headers["Content-Type"];
       delete opts.headers["Content-Length"];
     }
     if (this.isSurge() || this.isLoon()) {
       if (this.isSurge() && this.isNeedRewrite) {
         opts.headers = opts.headers || {};
         Object.assign(opts.headers, { "X-Surge-Skip-Scripting": false });
       }
       $httpClient.get(opts, (err, resp, body) => {
         if (!err && resp) {
           resp.body = body;
           resp.statusCode = resp.status;
         }
         callback(err, resp, body);
       });
     } else if (this.isQuanX()) {
       if (this.isNeedRewrite) {
         opts.opts = opts.opts || {};
         Object.assign(opts.opts, { hints: false });
       }
       $task.fetch(opts).then(
         (resp) => {
           const { statusCode: status, statusCode, headers, body } = resp;
           callback(null, { status, statusCode, headers, body }, body);
         },
         (err) => callback(err)
       );
     } else if (this.isNode()) {
       this.initGotEnv(opts);
       this.got(opts)
         .on("redirect", (resp, nextOpts) => {
           try {
             if (resp.headers["set-cookie"]) {
               const ck = resp.headers["set-cookie"]
                 .map(this.cktough.Cookie.parse)
                 .toString();
               if (ck) {
                 this.ckjar.setCookieSync(ck, null);
               }
               nextOpts.cookieJar = this.ckjar;
             }
           } catch (e) {
             this.logErr(e);
           }
         })
         .then(
           (resp) => {
             const { statusCode: status, statusCode, headers, body } = resp;
             callback(null, { status, statusCode, headers, body }, body);
           },
           (err) => {
             const { message: error, response: resp } = err;
             callback(error, resp, resp && resp.body);
           }
         );
     }
   }

   post(opts, callback = () => { }) {
     if (opts.body && opts.headers && !opts.headers["Content-Type"]) {
       opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
     }
     if (opts.headers) delete opts.headers["Content-Length"];
     if (this.isSurge() || this.isLoon()) {
       if (this.isSurge() && this.isNeedRewrite) {
         opts.headers = opts.headers || {};
         Object.assign(opts.headers, { "X-Surge-Skip-Scripting": false });
       }
       $httpClient.post(opts, (err, resp, body) => {
         if (!err && resp) {
           resp.body = body;
           resp.statusCode = resp.status;
         }
         callback(err, resp, body);
       });
     } else if (this.isQuanX()) {
       opts.method = "POST";
       if (this.isNeedRewrite) {
         opts.opts = opts.opts || {};
         Object.assign(opts.opts, { hints: false });
       }
       $task.fetch(opts).then(
         (resp) => {
           const { statusCode: status, statusCode, headers, body } = resp;
           callback(null, { status, statusCode, headers, body }, body);
         },
         (err) => callback(err)
       );
     } else if (this.isNode()) {
       this.initGotEnv(opts);
       const { url, ..._opts } = opts;
       this.got.post(url, _opts).then(
         (resp) => {
           const { statusCode: status, statusCode, headers, body } = resp;
           callback(null, { status, statusCode, headers, body }, body);
         },
         (err) => {
           const { message: error, response: resp } = err;
           callback(error, resp, resp && resp.body);
         }
       );
     }
   }

   time(fmt, ts = null) {
     const date = ts ? new Date(ts) : new Date();
     let o = {
       "M+": date.getMonth() + 1,
       "d+": date.getDate(),
       "H+": date.getHours(),
       "m+": date.getMinutes(),
       "s+": date.getSeconds(),
       "q+": Math.floor((date.getMonth() + 3) / 3),
       S: date.getMilliseconds(),
     };
     if (/(y+)/.test(fmt))
       fmt = fmt.replace(
         RegExp.$1,
         (date.getFullYear() + "").substr(4 - RegExp.$1.length)
       );
     for (let k in o)
       if (new RegExp("(" + k + ")").test(fmt))
         fmt = fmt.replace(
           RegExp.$1,
           RegExp.$1.length == 1
             ? o[k]
             : ("00" + o[k]).substr(("" + o[k]).length)
         );
     return fmt;
   }

   msg(title = name, subt = "", desc = "", opts) {
     const toEnvOpts = (rawopts) => {
       if (!rawopts) return rawopts;
       if (typeof rawopts === "string") {
         if (this.isLoon()) return rawopts;
         else if (this.isQuanX()) return { "open-url": rawopts };
         else if (this.isSurge()) return { url: rawopts };
         else return undefined;
       } else if (typeof rawopts === "object") {
         if (this.isLoon()) {
           let openUrl = rawopts.openUrl || rawopts.url || rawopts["open-url"];
           let mediaUrl = rawopts.mediaUrl || rawopts["media-url"];
           return { openUrl, mediaUrl };
         } else if (this.isQuanX()) {
           let openUrl = rawopts["open-url"] || rawopts.url || rawopts.openUrl;
           let mediaUrl = rawopts["media-url"] || rawopts.mediaUrl;
           return { "open-url": openUrl, "media-url": mediaUrl };
         } else if (this.isSurge()) {
           let openUrl = rawopts.url || rawopts.openUrl || rawopts["open-url"];
           return { url: openUrl };
         }
       } else {
         return undefined;
       }
     };
     if (!this.isMute) {
       if (this.isSurge() || this.isLoon()) {
         $notification.post(title, subt, desc, toEnvOpts(opts));
       } else if (this.isQuanX()) {
         $notify(title, subt, desc, toEnvOpts(opts));
       }
     }
     if (!this.isMuteLog) {
       let logs = ["", "==============📣系统通知📣=============="];
       logs.push(title);
       subt ? logs.push(subt) : "";
       desc ? logs.push(desc) : "";
       console.log(logs.join("\n"));
       this.logs = this.logs.concat(logs);
     }
   }

   log(...logs) {
     if (logs.length > 0) {
       this.logs = [...this.logs, ...logs];
     }
     console.log(logs.join(this.logSeparator));
   }

   logErr(err, msg) {
     const isPrintSack = !this.isSurge() && !this.isQuanX() && !this.isLoon();
     if (!isPrintSack) {
       this.log("", `❗️${this.name}, 错误!`, err);
     } else {
       this.log("", `❗️${this.name}, 错误!`, err.stack);
     }
   }

   wait(time) {
     return new Promise((resolve) => setTimeout(resolve, time));
   }

   done(val = {}) {
     const endTime = new Date().getTime();
     const costTime = (endTime - this.startTime) / 1000;
     this.log("", `🔔${this.name}, 结束! 🕛 ${costTime} 秒`);
     this.log();
     if (this.isSurge() || this.isQuanX() || this.isLoon()) {
       $done(val);
     }
   }
 })(name, opts);
}

