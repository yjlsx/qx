/*

[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-request-header  https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/xiaocanrpc.js

[mitm]
hostname = gw.xiaocantech.com


*/


let headers = $request.headers;
let body = $request.body;
let methodName = headers['methodname'] || headers['Methodname'] || "";

// 定义需要重写的两个目标接口
const targetMethods = [
    "RecService.GetStorePromotionList",        // 首页/分类列表
    "SilkwormRcsService.MeituanShangjinGetPoiList" // 关键词搜索
];

const isTarget = targetMethods.some(m => methodName.indexOf(m) > -1);

if (isTarget && body) {
    console.log(" 触发游客模式重写: " + methodName);

    try {
        let bodyObj = JSON.parse(body);

        // --- 1. 修改 Body：抹除个人 ID ---
        if (bodyObj.hasOwnProperty("silk_id")) bodyObj["silk_id"] = 0;
        if (bodyObj.hasOwnProperty("user_id")) bodyObj["user_id"] = 0;
        
        // --- 2. 修改 Headers：抹除登录 Token ---
        delete headers['X-Sivir'];
        delete headers['x-sivir'];
        headers['X-Vayne'] = '0';
        headers['x-Teemo'] = '0';

        /**
         *  注意：
         * 如果你刷新后 App 显示网络错误或签名错误，说明服务器校验了 Ashe 和 Body 的一致性。
         * 这种情况下，你必须在【未登录】状态下手动抓一组 Ashe/Garen/Nami 填到下面，
         * 强制覆盖掉你登录状态下的签名。
         */
        // headers['X-Ashe'] = '这里填入你抓到的游客Ashe';
        // headers['X-Garen'] = '这里填入你抓到的游客Garen';

        $done({
            headers: headers,
            body: JSON.stringify(bodyObj)
        });
    } catch (e) {
        console.log("解析 Body 出错: " + e);
        $done({});
    }
} else {
    // 抢名额接口 (GrabPromotionQuota) 等不处理，保留登录态
    $done({});
}
