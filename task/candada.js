/*
[rewrite_local]
^https:\/\/app\.candashi\.cn\/api\/api\/v2\/user\/api_user_info_one url script-request-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/candada.js

[mitm]
hostname = app.candashi.cn


*/


/*
 * 餐大大 - 抓取字段 + 自动签到（单文件）
 * 打开 APP 即自动抓取（包含通知）
 * 定时任务即自动签到并显示时间戳和北京时间
 */

const KEY = "cdd_sign_data";

// 判断是抓包还是运行任务
if (typeof $request !== "undefined") {
    grab();
} else {
    sign();
}

/* ==========  抓取模式  ========== */
function grab() {
    let headers = $request.headers || {};
    let body = $request.body || "";

    let save = {
        timestamp: headers["timestamp"] || "",
        nonce: headers["nonce"] || "",
        traceid: headers["traceid"] || "",
        sign: headers["sign"] || "",
        token: headers["token"] || "",
        body: body || ""
    };

    $prefs.setValueForKey(JSON.stringify(save), KEY);

    let msg = `timestamp: ${save.timestamp}
nonce: ${save.nonce}
traceid: ${save.traceid}
sign: ${save.sign}
token: ${save.token}
body: ${save.body.substring(0, 40)}...`;

    // 【重点】通知一定弹出
    $notify("餐大大", "已抓取最新动态字段", msg);

    console.log("【餐大大】已抓取字段：\n" + JSON.stringify(save, null, 2));
    $done({});
}

/* ==========  签到模式  ========== */
function sign() {
    let data = JSON.parse($prefs.valueForKey(KEY) || "{}");

    if (!data.token || !data.body) {
        $notify("餐大大", "签到失败", "未找到抓包数据，请先打开 APP 抓取！");
        console.log(" 未抓取到数据，请先打开 APP！");
        return $done();
    }

    const nowTs = Date.now();
    const nowStr = new Date(nowTs).toLocaleString("zh-CN", { hour12: false });

    console.log(`【餐大大 · 签到】
当前时间戳: ${nowTs}
对应北京时间: ${nowStr}
-----------------------------`);

    const url = "https://app.candashi.cn/api/api/v2/user/api_user_sign_in";

    const headers = {
        "content-type": "application/json;charset=UTF-8",
        "system": "iOS",
        "timestamp": data.timestamp,
        "nonce": data.nonce,
        "traceid": data.traceid,
        "sign": data.sign,
        "token": data.token,
        "appversion": "4.0.30",
        "application": "cdd-app",
        "accept-encoding": "gzip",
        "host": "app.candashi.cn",
        "apiversion": "1",
        "user-agent": "Dart/3.6 (dart:io)",
        "appchannel": "App Store"
    };

    const req = {
        url: url,
        method: "POST",
        headers: headers,
        body: data.body
    };

    $task.fetch(req).then(response => {
        console.log(" 状态码：" + response.statusCode);
        console.log(" 响应内容：" + response.body);

        $notify("餐大大签到", `北京时间：${nowStr}`, response.body);
        $done();

    }, reason => {
        console.log(" 请求失败：" + reason.error);
        $notify("餐大大签到失败", "", reason.error);
        $done();
    });
}

