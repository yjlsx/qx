/*
 * 离线啦全能助手 (Cookie 抓取 + 自动 OCR 签到)
 * * [rewrite_local]
 * ^https?:\/\/lixianla\.com\/(index\.php|sg_sign\.htm|$) url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/lixianla.js
 * * [task_local]
 * 10 0 * * * https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/lixianla.js, tag=离线啦签到, enabled=true

 * [mitm]
hostname = lixianla.com

 */

const OCR_KEY = 'K81085631088957'; 
const COOKIE_KEY = "lixianla_cookie";

// --- 自动判断运行模式 ---
if (typeof $request !== 'undefined') {
    getCookie();
} else {
    startSign();
}

/**
 * 逻辑 A: 自动抓取 Cookie (精准匹配模式)
 */
function getCookie() {
    if ($request.headers && $request.headers["Cookie"]) {
        const ck = $request.headers["Cookie"];
        if (ck.indexOf("bbs_token") > -1 && ck.indexOf("bbs_sid") > -1) {
            let oldCk = $prefs.valueForKey(COOKIE_KEY);
            if (ck !== oldCk) {
                if ($prefs.setValue(ck, COOKIE_KEY)) {
                    $notify("离线啦助手", "Cookie 抓取成功 ✅", "已自动存储关键凭证");
                }
            }
        }
    }
    // 立即放行请求，不加参数，防止网页加载卡死
    $done({});
}

/**
 * 逻辑 B: 自动化签到逻辑
 */
async function startSign() {
    const savedCookie = $prefs.valueForKey(COOKIE_KEY);
    if (!savedCookie) {
        $notify("离线啦签到", "失败 ❌", "本地无 Cookie，请先在浏览器登录网站");
        $done(); return;
    }

    try {
        console.log("[1/4] 获取动态 Action ID...");
        const entryRes = await $task.fetch({
            url: `https://lixianla.com/sg_sign.htm`,
            headers: { 'Cookie': savedCookie, 'X-Requested-With': 'XMLHttpRequest' }
        });

        const actionMatch = entryRes.body.match(/action="(sg_sign-lx-\d+\.htm)"/);
        if (!actionMatch) throw "未能提取到动态 ID，可能已签到/过期";
        const signPath = actionMatch[1];

        console.log("[2/4] 获取验证码...");
        const vcodeRes = await $task.fetch({
            url: `https://lixianla.com/vcode.htm?${Math.random()}`,
            headers: { 'Cookie': savedCookie, 'Referer': 'https://lixianla.com/' }
        });
        const base64Img = iArrayBufferToBase64(vcodeRes.bodyBytes);

        console.log("[3/4] OCR 识别中...");
        const code = await doOCR(base64Img);
        console.log(`[离线啦] 识别文字: ${code}`);

        console.log("[4/4] 提交签到...");
        const signRes = await $task.fetch({
            url: `https://lixianla.com/${signPath}`,
            method: 'POST',
            headers: {
                'Cookie': savedCookie,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://lixianla.com',
                'Referer': 'https://lixianla.com/',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
            },
            body: `vcode=${code}`
        });

        if (signRes.body.includes("成功") || signRes.body.includes("恭喜") || signRes.body.includes("已经签到")) {
            $notify("离线啦签到", "签到完成 ✅", `识别码: ${code}\n${signRes.body.includes("已经") ? "今日已签到" : "签到成功"}`);
        } else {
            console.log("详细回复：" + signRes.body);
            $notify("离线啦签到", "状态待确认 ⚠️", "请在日志中查看详细返回");
        }

    } catch (e) {
        $notify("离线啦签到", "脚本异常 ❌", e);
    }
    $done();
}

/**
 * --- 辅助库 ---
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
    throw "OCR 识别失败";
}

function iArrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    for (var i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}