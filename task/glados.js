/*
【GLaDOS】

⚠️【免责声明】
------------------------------------------
1、此脚本仅用于学习研究，不保证其合法性、准确性、有效性，请根据情况自行判断，本人对此不承担任何保证责任。
2、由于此脚本仅用于学习研究，您必须在下载后 24 小时内将所有内容从您的计算机或手机或任何存储设备中完全删除，若违反规定引起任何事件本人对此均不负责。
3、请勿将此脚本用于任何商业或非法目的，若违反规定请自行对此负责。
4、此脚本涉及应用与本人无关，本人对因此引起的任何隐私泄漏或其他后果不承担任何责任。
5、本人对任何脚本引发的问题概不负责，包括但不限于由脚本错误引起的任何损失和损害。
6、如果任何单位或个人认为此脚本可能涉嫌侵犯其权利，应及时通知并提供身份证明，所有权证明，我们将在收到认证文件确认后删除此脚本。
7、所有直接或间接使用、查看此脚本的人均应该仔细阅读此声明。本人保留随时更改或补充此声明的权利。一旦您使用或复制了此脚本，即视为您已接受此免责声明。

登陆链接：https://glados.rocks/，登陆即可获取Cookie。
注册地址：https://github.com/glados-network/GLaDOS

【Surge】
-----------------
[Script]
GLaDOS签到 = type=cron,cronexp=5 0 * * *,wake-system=1,timeout=20,script-path=https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js


获取GLaDOS_Cookie = type=http-request, pattern=https:\/\/glados\.rocks\/api\/user\/checkin, script-path=https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js

【Loon】
-----------------
[Script]
cron "5 0 * * *" tag=GLaDOS签到, script-path=https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js

http-request https:\/\/glados\.rocks\/api\/user\/checkin tag=获取GLaDOS_Cookie, script-path=https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js


【Quantumult X】
-----------------
[rewrite_local]
https:\/\/glados\.rocks\/api\/user\/checkin url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js


[task_local]
1 0 * * * https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/glados.js


【All App MitM】
hostname = glados.rocks
*/


const $ = new Env("GLaDOS");
const signcookie = "evil_gladoscookie";
const signauthorization = "evil_gladosauthorization"; // 修正拼写

var sicookie = $.getdata(signcookie);
var siauthorization = $.getdata(signauthorization); // 修正获取 key
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
   $.msg("GLaDOS", "【提示】", "❌ 未获取到 Cookie，请先在网页签到以抓取数据");
   $.done();
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
   const header = {
     Accept: `application/json, text/plain, */*`,
     Origin: `https://glados.rocks`,
     "Accept-Encoding": `gzip, deflate, br`,
     Cookie: sicookie,
     "Content-Type": `application/json;charset=utf-8`,
     Host: `glados.rocks`,
     Connection: `keep-alive`,
     "User-Agent": `Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1`,
     'Authorization': siauthorization,
     "Accept-Language": `zh-cn`,
   };
   const body = `{ "token": "glados.one" }`;
   const signinRequest = {
     url: "https://glados.rocks/api/user/checkin",
     headers: header,
     body: body,
   };
   $.post(signinRequest, (error, response, data) => {
     try {
       if (error) {
         $.log("签到接口请求失败");
       } else {
         var resBody = response.body;
         var obj = JSON.parse(resBody);
         if (obj.message != "oops, token error") {
           if (obj.message != "Please Try Tomorrow") {
             var date = new Date();
             var y = date.getFullYear();
             var m = date.getMonth() + 1;
             if (m < 10) m = "0" + m;
             var d = date.getDate();
             if (d < 10) d = "0" + d;
             var time = y + "-" + m + "-" + d;
             var business = obj.list[0].business;
             var sysdate = business.slice(-10);
             if (JSON.stringify(time) == JSON.stringify(sysdate)) {
               change = obj.list[0].change;
               changeday = parseInt(change);
               message += `今日签到获得${changeday}天`;
             } else {
               message += `今日签到获得0天`;
             }
           } else {
             message += "今日已签到";
           }
         } else {
           message += obj.message;
         }
       }
     } catch (e) {
       $.log("签到逻辑解析出错");
     }
     resolve(); // 确保逻辑在此闭合，防止转圈
   });
 });
}

function status() {
 return new Promise((resolve) => {
   const statusRequest = {
     url: "https://glados.rocks/api/user/status",
     headers: { Cookie: sicookie },
   };
   $.get(statusRequest, (error, response, data) => {
     try {
       if (error) {
         $.log("状态接口请求失败");
       } else {
         var resBody = response.body;
         var obj = JSON.parse(resBody);
         if (obj.code == 0) {
           account = obj.data.email;
           expday = obj.data.days;
           remain = obj.data.leftDays;
           remainday = parseInt(remain);
           message += `\n已用${expday}天,剩余${remainday}天`;
           $.msg("GLaDOS", `账户：${account}`, message);
         } else {
           $.msg("GLaDOS", "", "❌请重新登陆更新Cookie");
         }
       }
     } catch (e) {
       $.log("状态查询解析出错");
     }
     resolve(); // 确保逻辑在此闭合，防止转圈
   });
 });
}

function getCookie() {
 if (
   $request &&
   $request.method != "OPTIONS" &&
   $request.url.match(/checkin/)
 ) {
   const captured_cookie = $request.headers["Cookie"];
   $.setdata(captured_cookie, signcookie);
   const captured_auth = $request.headers["Authorization"];
   $.setdata(captured_auth, signauthorization);
   $.log("已抓取 Cookie: " + captured_cookie);
   $.log("已抓取 Auth: " + captured_auth);
   $.msg("GLaDOS", "", "获取签到Cookie成功🎉");
 }
}

// --- From chavyleung's Env.js ---
function Env(name, opts) {
 class Http {
   constructor(env) {
     this.env = env;
   }
   send(opts, method = "GET") {
     opts = typeof opts === "string" ? { url: opts } : opts;
     let sender = this.get;
     if (method === "POST") sender = this.post;
     return new Promise((resolve, reject) => {
       sender.call(this, opts, (err, resp, body) => {
         if (err) reject(err);
         else resolve(resp);
       });
     });
   }
   get(opts) { return this.send.call(this.env, opts); }
   post(opts) { return this.send.call(this.env, opts, "POST"); }
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
   isNode() { return "undefined" !== typeof module && !!module.exports; }
   isQuanX() { return "undefined" !== typeof $task; }
   isSurge() { return "undefined" !== typeof $httpClient && "undefined" === typeof $loon; }
   isLoon() { return "undefined" !== typeof $loon; }
   getdata(key) {
     let val = this.getval(key);
     if (/^@/.test(key)) {
       const [, objkey, paths] = /^@(.*?)\.(.*?)$/.exec(key);
       const objval = objkey ? this.getval(objkey) : "";
       if (objval) {
         try {
           const objedval = JSON.parse(objval);
           val = objedval ? this.lodash_get(objedval, paths, "") : val;
         } catch (e) { val = ""; }
       }
     }
     return val;
   }
   setdata(val, key) {
     let issuc = false;
     if (/^@/.test(key)) {
       const [, objkey, paths] = /^@(.*?)\.(.*?)$/.exec(key);
       const objdat = this.getval(objkey);
       const objval = objkey ? (objdat === "null" ? null : objdat || "{}") : "{}";
       try {
         const objedval = JSON.parse(objval);
         this.lodash_set(objedval, paths, val);
         issuc = this.setval(JSON.stringify(objedval), objkey);
       } catch (e) {
         const objedval = {};
         this.lodash_set(objedval, paths, val);
         issuc = this.setval(JSON.stringify(objedval), objkey);
       }
     } else { issuc = this.setval(val, key); }
     return issuc;
   }
   getval(key) {
     if (this.isSurge() || this.isLoon()) return $persistentStore.read(key);
     else if (this.isQuanX()) return $prefs.valueForKey(key);
     else if (this.isNode()) { this.data = this.loaddata(); return this.data[key]; }
     else return (this.data && this.data[key]) || null;
   }
   setval(val, key) {
     if (this.isSurge() || this.isLoon()) return $persistentStore.write(val, key);
     else if (this.isQuanX()) return $prefs.setValueForKey(val, key);
     else if (this.isNode()) { this.data = this.loaddata(); this.data[key] = val; this.writedata(); return true; }
     else return (this.data && this.data[key]) || null;
   }
   lodash_get(source, path, defaultValue = undefined) {
     const paths = path.replace(/\[(\d+)\]/g, ".$1").split(".");
     let result = source;
     for (const p of paths) { result = Object(result)[p]; if (result === undefined) return defaultValue; }
     return result;
   }
   lodash_set(obj, path, value) {
     if (Object(obj) !== obj) return obj;
     if (!Array.isArray(path)) path = path.toString().match(/[^.[\]]+/g) || [];
     path.slice(0, -1).reduce((a, c, i) => Object(a[c]) === a[c] ? a[c] : (a[c] = Math.abs(path[i + 1]) >> 0 === +path[i + 1] ? [] : {}), obj)[path[path.length - 1]] = value;
     return obj;
   }
   get(opts, callback = () => {}) {
     if (this.isQuanX()) {
       if (this.isNeedRewrite) { opts.opts = opts.opts || {}; Object.assign(opts.opts, { hints: false }); }
       $task.fetch(opts).then(resp => { const { statusCode: status, statusCode, headers, body } = resp; callback(null, { status, statusCode, headers, body }, body); }, err => callback(err));
     } else { /* 兼容其他环境代码已简化 */ }
   }
   post(opts, callback = () => {}) {
     if (this.isQuanX()) {
       opts.method = "POST";
       if (this.isNeedRewrite) { opts.opts = opts.opts || {}; Object.assign(opts.opts, { hints: false }); }
       $task.fetch(opts).then(resp => { const { statusCode: status, statusCode, headers, body } = resp; callback(null, { status, statusCode, headers, body }, body); }, err => callback(err));
     } else { /* 兼容其他环境代码已简化 */ }
   }
   log(...logs) { if (logs.length > 0) this.logs = [...this.logs, ...logs]; console.log(logs.join(this.logSeparator)); }
   msg(title = name, subt = "", desc = "", opts) {
     if (this.isQuanX()) $notify(title, subt, desc, {"open-url": opts});
     else if (this.isSurge() || this.isLoon()) $notification.post(title, subt, desc, {url: opts});
   }
   done(val = {}) { const endTime = new Date().getTime(); const costTime = (endTime - this.startTime) / 1000; this.log("", `🔔${this.name}, 结束! 🕛 ${costTime} 秒`); $done(val); }
 })(name, opts);
}
