/*

[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-request-header  https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/xiaocanrpc.js

[mitm]
hostname = gw.xiaocantech.com


*/

/**
 * 小蚕助手 - 游客查询模式 (仅对列表和搜索生效)
 * 作用：在登录状态下，以游客身份看活动，不影响大号抢名额。
 */

let headers = $request.headers;
let bodyObj = JSON.parse($request.body || "{}");
// 获取接口方法名
let mName = headers['methodname'] || headers['Methodname'] || "";

// 定义需要“游客化”的特定接口
const guestMethods = [
    "RecService.GetStorePromotionList",        // 首页及分类列表
    "SilkwormRcsService.MeituanShangjinGetPoiList" // 关键词搜索
];

// 检查当前请求是否属于上述两个接口
const shouldRewrite = guestMethods.some(m => mName === m);

if (shouldRewrite) {
    console.log(" 正在转换游客查询身份: " + mName);

    // 1. 抹除 Headers 里的身份 Token 和 UID
    delete headers['X-Sivir'];
    delete headers['x-sivir'];
    headers['X-Vayne'] = '0';
    headers['x-Teemo'] = '0';
    
    // 2. 修正 Body 里的 ID 为游客 ID (0)
    if (bodyObj.hasOwnProperty("silk_id")) {
        bodyObj["silk_id"] = 0;
    }
    if (bodyObj.hasOwnProperty("user_id")) {
        bodyObj["user_id"] = 0;
    }

    // 3. 搜索接口特殊打印 (可选)
    if (mName.includes("MeituanShangjinGetPoiList")) {
        console.log(" 游客模式搜索关键词: " + (bodyObj.search_word || "未识别"));
    }

    $done({
        headers: headers,
        body: JSON.stringify(bodyObj)
    });
} else {
    // --- 关键保障：非查询/搜索接口（如抢名额）直接透传，不做任何修改 ---
    // console.log(" 正常接口，跳过重写: " + mName);
    $done({});
}
