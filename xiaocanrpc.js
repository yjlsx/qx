/*

[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-request-header  https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/xiaocanrpc.js

[mitm]
hostname = gw.xiaocantech.com


*/


/**
 * 小蚕助手 - 实时签名同步重写版
 * 逻辑：
 * 1. 游客状态下刷新：脚本自动更新本地存储的“新鲜”游客三件套。
 * 2. 登录状态下刷新：脚本自动将当前请求伪装成刚刚抓到的游客请求。
 */

let headers = $request.headers;
let bodyObj = JSON.parse($request.body || "{}");
let mName = headers['methodname'] || headers['Methodname'] || "";

// 需要游客化的接口：列表、搜索、店铺搜索
const guestMethods = [
    "RecService.GetStorePromotionList",
    "RecService.SearchStorePromotionList",
    "SilkwormRcsService.MeituanShangjinGetPoiList"
];

if (guestMethods.some(m => mName.includes(m))) {
    const isGuestRequest = bodyObj.silk_id === 0 || !headers['X-Sivir'];

    if (isGuestRequest) {
        // --- 采集模式：保存最新游客参数 ---
        $prefs.setValueForKey(headers['X-Ashe'], "xc_sync_ashe");
        $prefs.setValueForKey(headers['X-Garen'], "xc_sync_garen");
        $prefs.setValueForKey(headers['X-Nami'], "xc_sync_nami");
        console.log(" 已同步最新游客签名：" + headers['X-Ashe']);
        $done({});
    } else {
        // --- 注入模式：利用最新游客参数欺骗服务器 ---
        const syncAshe = $prefs.valueForKey("xc_sync_ashe");
        const syncGaren = $prefs.valueForKey("xc_sync_garen");
        const syncNami = $prefs.valueForKey("xc_sync_nami");

        if (syncAshe) {
            console.log(" 正在注入新鲜游客签名，绕过账号限制...");
            headers['X-Ashe'] = syncAshe;
            headers['X-Garen'] = syncGaren;
            headers['X-Nami'] = syncNami;
            
            // 抹除身份
            delete headers['X-Sivir'];
            headers['X-Vayne'] = '0';
            headers['x-Teemo'] = '0';
            bodyObj['silk_id'] = 0;

            $done({
                headers: headers,
                body: JSON.stringify(bodyObj)
            });
        } else {
            console.log(" 尚未同步过游客签名，请先退出登录刷新一次");
            $done({});
        }
    }
} else {
    // 抢名额等接口不处理
    $done({});
}
