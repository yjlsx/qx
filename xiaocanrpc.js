/*

[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/xiaocanrpc.js

#script-request-header 
[mitm]
hostname = gw.xiaocantech.com


*/


/**
 * 小蚕助手 - 登录态显示游客内容 (响应劫持版)
 * 作用：拦截登录回包，异步替换为游客数据
 */

const isRequest = typeof $request !== "undefined";

if (isRequest) {
    // 1. 请求阶段：不做修改，保证大号签名 100% 通过服务器校验
    $done({});
} else {
    // 2. 响应阶段：拦截服务器返回给大号的数据
    const headers = $request.headers;
    const mName = headers['methodname'] || headers['Methodname'] || "";

    // 锁定首页列表和搜索这两个接口
    if (mName.indexOf("PromotionList") > -1 || mName.indexOf("GetPoiList") > -1) {
        console.log(" 正在异步同步游客数据: " + mName);

        // 构造纯净游客请求体
        let guestBody = JSON.parse($request.body);
        guestBody.silk_id = 0; // 强制变为游客 ID

        const request = {
            url: $request.url,
            method: "POST",
            headers: {
                ...headers,
                'X-Sivir': '', // 抹除 Token
                'x-Teemo': '0',
                'X-Vayne': '0'
            },
            body: JSON.stringify(guestBody)
        };

        // 在后台以游客身份发一次真请求
        $task.fetch(request).then(response => {
            console.log(" 游客数据获取成功，正在注入 App 界面");
            // 将游客的真实数据替换掉大号的空响应体
            $done({ body: response.body });
        }, reason => {
            console.log(" 游客请求失败: " + reason.error);
            $done({});
        });
    } else {
        $done({});
    }
}
