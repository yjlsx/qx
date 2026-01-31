/*

[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-request-header  https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/xiaocanrpc.js

[mitm]
hostname = gw.xiaocantech.com


*/


/**
 * 小蚕助手 - 登录转游客静默重写版
 * 作用：在不破坏 App 运行的前提下，强制将查询接口游客化
 */

let headers = $request.headers;
let bodyObj = JSON.parse($request.body || "{}");
let mName = headers['methodname'] || headers['Methodname'] || "";

// 仅锁定这两个关键查询接口
const targetMethods = [
    "RecService.GetStorePromotionList", 
    "RecService.SearchStorePromotionList"
];

if (targetMethods.some(m => mName.indexOf(m) > -1)) {
    console.log(" 执行重写 -> " + mName);

    // 1. 身份彻底脱壳：删掉所有可能关联你大号的 Header
    delete headers['X-Sivir'];
    delete headers['x-sivir'];
    headers['X-Vayne'] = '0';
    headers['x-Teemo'] = '0';
    
    // 2. Body 强制游客化
    bodyObj["silk_id"] = 0;
    if (bodyObj.user_id) bodyObj["user_id"] = 0;

    // 3. 关键：解决白屏/无内容
    // 如果这样改完还是没内容，说明 X-Ashe 必须匹配 silk_id:0 时的特定值
    // 这里我们尝试保持 X-Ashe 不动，看后端是否兼容“无 Token 情况下的签名”

    $done({
        headers: headers,
        body: JSON.stringify(bodyObj)
    });
} else {
    // 抢名额接口等其他流量直接放行，不干扰，不弹通知
    $done({});
}
