/*
[rewrite_local]
^https:\/\/app\.candashi\.cn\/api\/api\/v2\/user\/api_user_info_one url script-request-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/candada.js

[mitm]
hostname = app.candashi.cn


*/


/*
 * 餐大大 - 抓取 + 自动签到合并脚本
 * 只要触发请求自动抓取；定时任务执行签到
 */

const KEY = "cdd_sign_data";

// 判断模式：抓包 or 定时任务
if (typeof $request !== "undefined") {
    // ========== 抓取模式 ==========
    captureData();
} else {
    // ========== 签到模式 ==========
    sign();
}

// ---------- 抓取 ----------
function captureData() {
    let headers = $request.headers || {};
    let body = $request.body || "";

    let save = {
        timestamp: headers["timestamp"],
        nonce: headers["nonce"],
        traceid: headers["traceid"],
        sign: headers["sign"],
        token: headers["token"],
        body: body
    };

    $prefs.setValueForKey(JSON.stringify(save), KEY);

    console.log("【餐大大】已抓取字段：\n" + JSON.stringify(save, null, 2));
    $done({});
}

// ---------- 签到 ----------
function sign() {
    let data = JSON.parse($prefs.valueForKey(KEY) || "{}");

    if (!data.token || !data.body) {
        console.log("【餐大大】未找到抓取的数据，请先打开 App 触发一次请求！");
        $done();
        return;
    }

    // 生成当前时间
    const nowTs = Date.now();
    const nowStr = new Date(nowTs).toLocaleString("zh-CN", { hour12: false });

    console.log(`【餐大大 · 签到】
当前时间戳: ${nowTs}
北京时间:   ${nowStr}
-----------------------------`);

    const url = "https://app.candashi.cn/api/api/v2/user/api_user_sign_in";

    const headers = {
        "content-type": "application/json;charset=UTF-8",
        "system": "iOS",

        // 动态字段：使用抓取到的
        "timestamp": data.timestamp,
        "nonce": data.nonce,
        "traceid": data.traceid,
        "sign": data.sign,
        "token": data.token,

        // 固定字段
        "appversion": "4.0.30",
        "application": "cdd-app",
        "accept-encoding": "gzip",
        "host": "app.candashi.cn",
        "apiversion": "1",
        "user-agent": "Dart/3.6 (dart:io)",
        "appchannel": "App Store"
    };

    const req = {
        url,
        method: "POST",
        headers,
        body: data.body
    };

    $task.fetch(req).then(resp => {
        console.log(" 状态码: " + resp.statusCode);
        console.log(" 响应内容:\n" + resp.body);
        console.log("【餐大大 · 签到结束】");
        $done();
    }, err => {
        console.log(" 请求失败：" + err.error);
        $done();
    });
}
