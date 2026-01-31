/*

[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-request-header  https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/xiaocanrpc.js

[mitm]
hostname = gw.xiaocantech.com


*/



/**
 * 小蚕助手 - 登录转游客重写 (强制修正版)
 * 配置: script-request-header
 */

let headers = $request.headers;
let bodyObj = JSON.parse($request.body || "{}");
let mName = headers['methodname'] || headers['Methodname'] || "";

// 定义要伪装的查询和搜索接口
const targetMethods = [
    "RecService.GetStorePromotionList", 
    "RecService.SearchStorePromotionList",
    "SilkwormRcsService.MeituanShangjinGetPoiList"
];

if (targetMethods.some(m => mName.indexOf(m) > -1)) {
    console.log(" 正在转换游客查询身份: " + mName);

    // 1. 核心操作：抹除所有与你账号相关的标识
    // 很多时候，服务器发现 X-Sivir 为空，会回退到基础校验
    delete headers['X-Sivir'];
    delete headers['x-sivir'];
    headers['X-Vayne'] = '0';
    headers['x-Teemo'] = '0';
    
    // 2. 修正 Body
    if (bodyObj.hasOwnProperty("silk_id")) bodyObj["silk_id"] = 0;
    if (bodyObj.hasOwnProperty("user_id")) bodyObj["user_id"] = 0;

    // 3. 弹窗确认重写已触发
    $notify("小蚕重写", "身份已切换为游客", "正在请求全量活动列表...");

    $done({
        headers: headers,
        body: JSON.stringify(bodyObj)
    });
} else {
    // 抢名额接口严禁重写，否则领不到号上
    $done({});
}
