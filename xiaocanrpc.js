/*

[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-request-header  https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/xiaocanrpc.js

[mitm]
hostname = gw.xiaocantech.com


*/


/**
 * 小蚕助手 - 登录转游客重写 (静默修正版)
 * 逻辑：只改参数，不弹通知，防止死循环干扰
 */

let headers = $request.headers;
let bodyObj = JSON.parse($request.body || "{}");
let mName = headers['methodname'] || headers['Methodname'] || "";

// 精准锁定首页列表和搜索这两个关键接口
const isTarget = mName.indexOf("GetPoiList") > -1 || mName.indexOf("PromotionList") > -1;

if (isTarget) {
    console.log(" 正在静默重写身份: " + mName);

    // 1. 尝试“脱壳”：只抹除身份标识，保留签名所需的其他环境
    delete headers['X-Sivir'];
    delete headers['x-sivir'];
    headers['X-Vayne'] = '0';
    headers['x-Teemo'] = '0';
    
    // 2. 修正 Body 里的 ID
    if (bodyObj.hasOwnProperty("silk_id")) bodyObj["silk_id"] = 0;
    if (bodyObj.hasOwnProperty("user_id")) bodyObj["user_id"] = 0;

    $done({
        headers: headers,
        body: JSON.stringify(bodyObj)
    });
} else {
    // 其他接口（如抢名额、心跳、埋点）一律原样跳过，不弹通知
    $done({});
}
