/*
 * 离线啦全能助手 (Cookie 抓取 + 自动 OCR 签到)
 * * [rewrite_local]
 * ^https?:\/\/lixianla\.com\/.* url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/lixianla.js
 * * [task_local]
 * 10 0 * * * https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/lixianla.js, tag=离线啦签到, enabled=true

[mitm]
hostname = lixianla.com


 */

const OCR_KEY = 'K81085631088957'; // <--- 填入你刚才获取到的密钥
const COOKIE_KEY = "lixianla_cookie";

// 检测环境：重写模式(抓Cookie) vs 定时任务模式(签到)
if (typeof $request !== 'undefined') {
    getCookie();
} else {
    startSign();
}

/**
 * 逻辑 A: 自动抓取 Cookie
 */
function getCookie() {
    if ($request.headers && $request.headers["Cookie"]) {
        const ck = $request.headers["Cookie"];
        // 必须包含这两个关键字段才保存
        if (ck.indexOf("bbs_token") > -1 && ck.indexOf("bbs_sid") > -1) {
            if ($prefs.setValue(ck, COOKIE_KEY)) {
                $notify("离线啦助手", "Cookie 抓取成功 ", "现在可以执行定时任务签到了");
            }
        }
    }
    $done({});
}

/**
 * 逻辑 B: 自动化签到流程
 */
async function startSign() {
    const savedCookie = $prefs.valueForKey(COOKIE_KEY);
    if (!savedCookie) {
        $notify("离线啦签到", "失败 ", "未找到 Cookie，请先在浏览器打开一次网站");
        $done(); return;
    }

    try {
        console.log("[1/4] 正在获取动态 Action ID...");
        const entryRes = await $task.fetch({
            url: `https://lixianla.com/sg_sign.htm`,
            headers: { 
                'Cookie': savedCookie, 
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        // 提取 action 中的动态文件名
        const actionMatch = entryRes.body.match(/action="(sg_sign-lx-\d+\.htm)"/);
        if (!actionMatch) throw "未能提取到动态 ID，可能已签到或页面结构改变";
        const signPath = actionMatch[1];
        console.log(`[离线啦] 匹配到接口: ${signPath}`);

        console.log("[2/4] 正在下载验证码...");
        const vcodeRes = await $task.fetch({
            url: `https://lixianla.com/vcode.htm?${Math.random()}`,
            headers: { 'Cookie': savedCookie, 'Referer': 'https://lixianla.com/' }
        });
        const base64Img = iArrayBufferToBase64(vcodeRes.bodyBytes);

        console.log("[3/4] 正在识别验证码 (OCR.space)...");
        const code = await doOCR(base64Img);
        console.log(`[离线啦] 识别文字: ${code}`);

        console.log("[4/4] 正在提交 POST 签到...");
        const signRes = await $task.fetch({
            url: `https://lixianla.com/${signPath}`,
            method: 'POST',
            headers: {
                'Cookie': savedCookie,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://lixianla.com',
                'Referer': 'https://lixianla.com/',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            body: `vcode=${code}`
        });

        // 处理结果判定
        if (signRes.body.includes("签到成功") || signRes.body.includes("恭喜")) {
            $notify("离线啦签到", "签到成功 ", `识别码: ${code}`);
        } else if (signRes.body.includes("已经签到")) {
            $notify("离线啦签到", "成功 ", "今日已签到 (重复执行)");
        } else if (signRes.body.includes("验证码错误")) {
            $notify("离线啦签到", "识别失败 ", "验证码不匹配，请重试");
        } else {
            console.log("响应详情：" + signRes.body);
            $notify("离线啦签到", "结果待确认 ", "请查阅 Console 日志");
        }

    } catch (e) {
        console.log("[离线啦] 错误详情: " + e);
        $notify("离线啦签到", "脚本异常 ", e);
    }
    $done();
}

/**
 * --- 工具库 ---
 */
async function doOCR(base64) {
    const res = await $task.fetch({
        url: "https://api.ocr.space/parse/image",
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `apikey=${OCR_KEY}&base64Image=data:image/jpeg;base64,${encodeURIComponent(base64)}&language=eng&OCREngine=2`
    });
    const data = JSON.parse(res.body);
    if (data.ParsedResults && data.ParsedResults[0]) {
        return data.ParsedResults[0].ParsedText.replace(/\s+/g, "");
    }
    throw "OCR 接口未返回结果";
}

function iArrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    for (var i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}
