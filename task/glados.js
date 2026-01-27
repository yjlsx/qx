/*
【GLaDOS】

 - 2026 版

⚠️【免责声明】
------------------------------------------
1、此脚本仅用于学习研究，不保证其合法性、准确性、有效性，请根据情况自行判断，本人对此不承担任何保证责任。
2、由于此脚本仅用于学习研究，您必须在下载后 24 小时内将所有内容从您的计算机或手机或任何存储设备中完全删除，若违反规定引起任何事件本人对此均不负责。
3、请勿将此脚本用于任何商业或非法目的，若违反规定请自行对此负责。
4、此脚本涉及应用与本人无关，本人对因此引起的任何隐私泄漏或其他后果不承担任何责任。
5、本人对任何脚本引发的问题概不负责，包括但不限于由脚本错误引起的任何损失和损害。
6、如果任何单位或个人认为此脚本可能涉嫌侵犯其权利，应及时通知并提供身份证明，所有权证明，我们将在收到认证文件确认后删除此脚本。
7、所有直接或间接使用、查看此脚本的人均应该仔细阅读此声明。本人保留随时更改或补充此声明的权利。一旦您使用或复制了此脚本，即视为您已接受此免责声明。

登陆链接：https://glados.cloud/，登陆即可获取Cookie。
注册地址：https://github.com/glados-network/GLaDOS

【Surge】
-----------------
[Script]
GLaDOS签到 = type=cron,cronexp=5 0 * * *,wake-system=1,timeout=20,script-path=https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js


获取GLaDOS_Cookie = type=http-request, pattern=https:\/\/glados\.cloud\/api\/user\/checkin, script-path=https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js

【Loon】
-----------------
[Script]
cron "5 0 * * *" tag=GLaDOS签到, script-path=https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js

http-request https:\/\/glados\.cloud\/api\/user\/checkin tag=获取GLaDOS_Cookie, script-path=https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js


【Quantumult X】
-----------------
[rewrite_local]
https:\/\/glados\.cloud\/api\/user\/checkin url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js


[task_local]
1 0 * * * https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js


【All App MitM】
hostname = glados.rocks
*/




const $ = new Env("GLaDOS");
const signcookie = "evil_gladoscookie";
const signauthorization = "evil_gladosauthorization";

var sicookie = $.getdata(signcookie);
var siauthorization = $.getdata(signauthorization);
var account;
var expday;
var remain;
var remainday;
var change;
var changeday;
var msge;
var message = "";

!(async () => {
 if (typeof $request != "undefined") {
   getCookie();
   return;
 }
 if (!sicookie) {
   $.msg("GLaDOS", "【提示】", "❌ 未获取到数据，请先手动登录 glados.cloud 抓取");
   return;
 }
 await signin();
 await status();
})()
 .catch((e) => {
   $.log("", `❌失败! 原因: ${e}!`, "");
 })
 .finally(() => {
   $.done();
 });

function signin() {
 return new Promise((resolve) => {
   // 使用你提供的最新 glados.cloud 参数
   const header = {
     'Sec-Fetch-Dest' : `empty`,
     'Connection' : `keep-alive`,
     'Accept-Encoding' : `gzip, deflate, br`,
     'Content-Type' : `application/json;charset=utf-8`,
     'Sec-Fetch-Site' : `same-origin`,
     'Origin' : `https://glados.cloud`,
     'User-Agent' : `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1`,
     'Sec-Fetch-Mode' : `cors`,
     'Cookie' : sicookie,
     'Host' : `glados.cloud`,
     'Authorization': siauthorization || "",
     'Accept-Language' : `zh-CN,zh-Hans;q=0.9`,
     'Accept' : `application/json, text/plain, */*`
   };
   const body = JSON.stringify({ "token": "glados.cloud" });
   const signinRequest = {
     url: "https://glados.cloud/api/user/checkin",
     headers: header,
     body: body,
   };
   $.post(signinRequest, (error, response, data) => {
     try {
       if (error) {
         $.log("签到请求错误: " + error);
       } else {
         var obj = JSON.parse(response.body);
         if (obj.code === 0 || obj.code === 1) {
           if (obj.message.includes("Please Try Tomorrow") || obj.code === 1) {
             message += "今日已签到";
           } else {
             change = obj.list[0].change;
             message += `今日签到获得${parseInt(change)}天`;
           }
         } else {
           message += obj.message;
         }
       }
     } catch (e) {
       $.log("签到解析异常: " + e);
     }
     resolve(); // 确保 resolve 运行，防止转圈
   });
 });
}

function status() {
 return new Promise((resolve) => {
   const statusRequest = {
     url: "https://glados.cloud/api/user/status",
     headers: {
       'Cookie': sicookie,
       'User-Agent' : `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1`,
     },
   };
   $.get(statusRequest, (error, response, data) => {
     try {
       if (error) {
         $.log("状态请求错误");
       } else {
         var obj = JSON.parse(response.body);
         if (obj.code == 0) {
           account = obj.data.email;
           remainday = parseInt(obj.data.leftDays);
           message += `\n账户：${account}\n剩余：${remainday}天`;
           $.msg("GLaDOS", "", message);
         }
       }
     } catch (e) {
       $.log("状态解析异常");
     }
     resolve();
   });
 });
}

function getCookie() {
 if ($request && $request.method != "OPTIONS" && $request.url.match(/checkin/)) {
   const sicookie_val = $request.headers["Cookie"] || $request.headers["cookie"];
   $.setdata(sicookie_val, signcookie);
   const siauthorization_val = $request.headers["Authorization"] || $request.headers["authorization"];
   $.setdata(siauthorization_val, signauthorization);
   $.log("抓取到 Cookie: " + sicookie_val);
   $.msg("GLaDOS", "", "获取 glados.cloud 数据成功🎉");
 }
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

