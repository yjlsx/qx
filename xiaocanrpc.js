/*

[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/xiaocanrpc.js

#script-request-header 
[mitm]
hostname = gw.xiaocantech.com


*/


/**
 * 小蚕助手 - 登录态显示游客内容 (响应体异步劫持版)
 * 逻辑：不修改发出的请求（保签名），只在回包时把游客数据塞进去
 */

const isRequest = typeof $request !== "undefined";

if (isRequest) {
    // 请求阶段：不做任何修改，确保签名校验 100% 通过
    $done({});
} else {
    // 响应阶段：开始偷梁换柱
    const headers = $request.headers;
    const mName = headers['methodname'] || headers['Methodname'] || "";

    // 锁定列表和搜索接口
    if (mName.indexOf("PromotionList") > -1 || mName.indexOf("GetPoiList") > -1) {
        console.log(" 检测到登录回包，正在同步拉取游客数据...");

        // 构造一个完全纯净的游客请求体
        let guestBody = JSON.parse($request.body);
        guestBody.silk_id = 0;

        const request = {
            url: $request.url,
            method: "POST",
            headers: {
                ...headers,
                'X-Sivir': '', // 抹除身份
                'X-Vayne': '0',
                'x-Teemo': '0'
            },
            body: JSON.stringify(guestBody)
        };

        // 在后台以游客身份发一起一次真请求
        $task.fetch(request).then(response => {
            console.log(" 游客数据获取成功，正在注入 App 界面");
            // 将游客的数据内容直接替换掉大号的空响应
            $done({ body: response.body });
        }, reason => {
            console.log(" 游客请求失败: " + reason.error);
            $done({});
        });
    } else {
        $done({});
    }
}

