/*
 * lxian自动 OCR 签到
 *
 * [rewrite_local]
^https?:\/\/lixianla\.com\/ url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/lixianla.js

 * [mitm]
hostname = lixianla.com

 */


const COOKIE_KEY = 'lixianla_cookie';
const OCR_KEY_NAME = 'lixianla_ocr_key';

let OCR_KEY = readData(OCR_KEY_NAME) || '';

let currentCookie = readData(COOKIE_KEY) || '';

const MAX_RETRY = 10;

const mainReferer = 'https://lixianla.com/index-4-5.htm';

if (typeof $request !== 'undefined') {
    captureCookie();
} else {
    startSign();
}

async function startSign() {

    try {

        if (!currentCookie) {

            $notify("离线啦签到", "停止 ❌", "缺少 Cookie，请先开启重写访问 lixianla.com 自动抓取");

            $done();

            return;

        }

        if (!OCR_KEY) {

            $notify("离线啦签到", "停止 ❌", "缺少 OCR Key，请先在 BoxJS 填写 lixianla_ocr_key");

            $done();

            return;

        }

        const now = new Date();

        const hour = now.getHours();

        const minute = now.getMinutes();

        if (hour === 0 && minute === 0) {

            console.log(`⏰ 当前时间 ${hour}:${minute}，检测为凌晨准点启动，静默等待 18 秒...`);

            await new Promise(r => setTimeout(r, 18000));

        } else {

            console.log(`🚀 当前时间 ${hour}:${minute}，非凌晨准点，直接开始执行...`);

        }

        console.log("【1/4】探测动态签到接口...");

        let entry = await request('https://lixianla.com/sg_sign.htm', 'GET', 'https://lixianla.com/');

        let actionMatch = entry.body?.match(/sg_sign-lx-\d+\.htm/);

        if (!actionMatch && !entry.body?.includes("已经签到")) {

            console.log("⚠️ 接口仍未就绪，缓冲 5 秒后重试探测...");

            await new Promise(r => setTimeout(r, 5000));

            entry = await request('https://lixianla.com/sg_sign.htm', 'GET', 'https://lixianla.com/');

            actionMatch = entry.body?.match(/sg_sign-lx-\d+\.htm/);

        }

        if (!actionMatch) {

            if (entry.body?.includes("已经签到")) {

                console.log("检测到今日已签到，直接获取积分...");

                const info = await fetchCredits();

                $notify("离线啦", "成功 ✅", `今天已签过！\n${info}`);

                $done();

                return;

            }

            throw "Cookie失效或未找到接口";

        }

        const fullSignUrl = `https://lixianla.com/${actionMatch[0]}`;

        console.log(`✅ 接口地址: ${fullSignUrl}`);

        for (let i = 1; i <= MAX_RETRY; i++) {

            console.log(`\n--- [第 ${i} 次尝试] ---`);

            await request(fullSignUrl, 'GET', mainReferer);

            const vcodeUrl = `https://lixianla.com/vcode.htm?${Math.random()}`;

            console.log(`【2/4】正在获取验证码... \n🔗 地址: ${vcodeUrl}`);

            const vcodeRes = await request(vcodeUrl, 'GET', mainReferer, null, true);

            console.log(`验证码状态码: ${vcodeRes.statusCode}`);

            console.log(`bodyBytes: ${vcodeRes.bodyBytes ? vcodeRes.bodyBytes.byteLength : "无"}`);

            if (!vcodeRes.bodyBytes || vcodeRes.bodyBytes.byteLength < 100) {

                console.log("⚠️ 验证码图片获取失败，准备重试...");

                await new Promise(r => setTimeout(r, 1000));

                continue;

            }

            const code = await doOCR(iArrayBufferToBase64(vcodeRes.bodyBytes));

            console.log(`OCR识别结果: [${code}]`);

            if (!code || code.length < 3) {

                console.log("⚠️ 识别结果异常，准备重试...");

                await new Promise(r => setTimeout(r, 1000));

                continue;

            }

            console.log("【3/4】提交签到请求...");

            const postRes = await request(

                fullSignUrl,

                'POST',

                mainReferer,

                `vcode=${encodeURIComponent(code)}`

            );

            let resMsg = String(postRes.body || "");

            try {

                const parsed = JSON.parse(postRes.body);

                resMsg = String(parsed.message || postRes.body || "");

            } catch (e) {}

            console.log(`📩 响应: ${resMsg}`);

            if (resMsg.includes("成功") || resMsg.includes("恭喜") || resMsg.includes("已经签过")) {

                const info = await fetchCredits();

                $notify("离线啦签到", "🎉成功 ✅", `${resMsg}\n${info}`);

                $done();

                return;

            }

            if (!resMsg.includes("验证码错误")) {

                throw resMsg;

            }

            await new Promise(r => setTimeout(r, 1000));

        }

        $notify("离线啦签到", "停止 ❌", "重试次数已达上限");

    } catch (e) {

        console.log(`❌ 程序出错: ${e}`);

        $notify("离线啦签到", "停止 ❌", String(e).substring(0, 50));

    }

    $done();

}

async function fetchCredits() {

    console.log("【4/4】正在抓取积分信息...");

    try {

        const res = await request(

            'https://lixianla.com/my-credits.htm',

            'GET',

            'https://lixianla.com/my.htm'

        );

        const exp = res.body.match(/经验.*?value="(\d+)"/)?.[1] || "未知";

        const coin = res.body.match(/金币.*?value="(\d+)"/)?.[1] || "未知";

        const result = `经验: ${exp} | 金币: ${coin}`;

        console.log(`✅ 获取成功: ${result}`);

        return result;

    } catch (e) {

        console.log("❌ 积分信息获取失败");

        return "积分信息获取失败";

    }

}

async function request(url, method, referer, body = null, isBinary = false) {

    const headers = {

        'Cookie': currentCookie,

        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',

        'X-Requested-With': 'XMLHttpRequest',

        'Referer': referer

    };

    if (method === 'POST') {

        headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';

    }

    const req = {

        url,

        method,

        headers

    };

    if (body !== null) {

        req.body = body;

    }

    if (isBinary) {

        req.opts = {

            responseType: 'arraybuffer'

        };

    }

    const response = await $task.fetch(req);

    const sc = response.headers?.['Set-Cookie'] || response.headers?.['set-cookie'];

    if (sc) updateCookie(sc);

    return response;

}

function updateCookie(setCookie) {

    const parts = setCookie.split(/,(?=[^;]+=[^;]+)/);

    parts.forEach(p => {

        const cookie = p.split(';')[0].trim();

        const [key] = cookie.split('=');

        if (key && currentCookie.includes(key + "=")) {

            currentCookie = currentCookie.replace(new RegExp(`${key}=[^;]+`), cookie);

        } else if (key) {

            currentCookie += `; ${cookie}`;

        }

    });

    writeData(currentCookie, COOKIE_KEY);

}

function captureCookie() {

    const cookie = $request.headers?.Cookie || $request.headers?.cookie || "";

    if (cookie && /bbs_(token|sid)=/.test(cookie)) {

        const oldCookie = readData(COOKIE_KEY) || "";

        if (oldCookie !== cookie) {

            writeData(cookie, COOKIE_KEY);

            $notify("离线啦", "Cookie 已写入 BoxJS ✅", "lixianla_cookie");

        } else {

            console.log("离线啦 Cookie 未变化，跳过写入");

        }

    } else {

        console.log("未找到离线啦 Cookie");

    }

    $done({});

}

async function doOCR(base64) {

    try {

        const res = await $task.fetch({

            url: "https://api.ocr.space/parse/image",

            method: "POST",

            headers: {

                "Content-Type": "application/x-www-form-urlencoded"

            },

            body: `apikey=${encodeURIComponent(OCR_KEY)}&base64Image=data:image/png;base64,${encodeURIComponent(base64)}&OCREngine=2&scale=true&isOverlayRequired=false`

        });

        const resJson = JSON.parse(res.body);

        const text = resJson.ParsedResults?.[0]?.ParsedText || "";

        return text.replace(/[^a-zA-Z0-9]/g, "").trim();

    } catch (e) {

        console.log(`❌ OCR请求失败: ${e}`);

        return "";

    }

}

function iArrayBufferToBase64(buffer) {

    let binary = '';

    const bytes = new Uint8Array(buffer);

    for (let i = 0; i < bytes.byteLength; i++) {

        binary += String.fromCharCode(bytes[i]);

    }

    return btoa(binary);

}

function readData(key) {

    return typeof $prefs !== 'undefined' ? $prefs.valueForKey(key) : "";

}

function writeData(value, key) {

    return typeof $prefs !== 'undefined' ? $prefs.setValueForKey(value, key) : false;

}

