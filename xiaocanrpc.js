/*

[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-request-header  https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/xiaocanrpc.js

[mitm]
hostname = gw.xiaocantech.com


*/



/**
 * 小蚕助手 - 终极重写模式 (Rewrite Only)
 * 逻辑：在请求发出的一瞬间进行“身份脱壳”，欺骗服务器下发全量数据。
 */

const headers = $request.headers;
let bodyObj = JSON.parse($request.body || "{}");
const mName = headers['methodname'] || headers['Methodname'] || "";

// 定义需要伪装的查询接口
const targetMethods = [
    "RecService.GetStorePromotionList", 
    "RecService.SearchStorePromotionList",
    "SilkwormRcsService.MeituanShangjinGetPoiList"
];

if (targetMethods.some(m => mName.indexOf(m) > -1)) {
    console.log(" 正在执行身份脱壳重写: " + mName);

    // --- 核心操作：将当前合法请求瞬间“游客化” ---
    // 这样做能保证 X-Ashe 和 X-Garen 是新鲜且匹配的
    
    // 1. 抹除身份 Token，变身为游客
    delete headers['X-Sivir'];
    delete headers['x-sivir'];
    headers['X-Vayne'] = '0';
    headers['x-Teemo'] = '0';
    
    // 2. 修正 Body 中的 silk_id
    if (bodyObj.hasOwnProperty("silk_id")) {
        bodyObj["silk_id"] = 0;
    }
    
    // 3. 这里的 Ashe 签名不需要改动
    // 只要服务器的 Ashe 算法没有把 Token 强行加进去计算，这个重写就会 100% 成功
    
    console.log(" 已伪装为游客发送请求，绕过账号黑名单");

    $done({
        headers: headers,
        body: JSON.stringify(bodyObj)
    });
} else {
    // 抢名额接口 (GrabPromotionQuota) 绝对不重写，确保能领到大号上
    $done({});
}
