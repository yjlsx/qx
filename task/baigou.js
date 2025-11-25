// ====== 配置 ======
const START = 1;
const END = 9999;
const CONCURRENCY = 10;  // 每批并发数量（建议 5~20）
const PLAN_ID = 1;  // 6是基础


// ====== 主逻辑（并发批处理） ======
(async () => {

    let validCodes = [];

    console.log("==== 并发优惠码扫描启动 ====");
    console.log(`范围：TB001 至 TB9999`);
    console.log(`plan_id: ${PLAN_ID}`);
    console.log(`每批并发：${CONCURRENCY} 条`);
    console.log("================================");

    // 批次处理
    for (let batchStart = START; batchStart <= END; batchStart += CONCURRENCY) {

        let tasks = [];

        for (let i = 0; i < CONCURRENCY; i++) {
            let index = batchStart + i;
            if (index > END) break;

            let code = generateCode(index);

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

            // 创建并发任务
            let task = $task.fetch(req).then(resp => {
                let text = resp.body || "";
                console.log(`优惠码 ${code} → 返回：${text}`);

                let obj = {};
                try { obj = JSON.parse(text); } catch (e) {}

                // 有效判断
                if (!(obj.message && obj.message.includes("无效"))) {
                    validCodes.push(code);
                }

            }).catch(err => {
                console.log(`优惠码 ${code} 请求失败：${err}`);
            });

            tasks.push(task);
        }

        // 等待这一批全部完成
        await Promise.all(tasks);
    }

    // ===== 全部结束后通知 =====
    console.log("==== 扫描完成 ====");

    if (validCodes.length === 0) {
        $notify("扫描完成", "未找到有效优惠码", "");
    } else {
        $notify(
            "扫描完成",
            `共找到 ${validCodes.length} 个有效优惠码`,
            validCodes.join(", ")
        );
    }

    $done();
})();
