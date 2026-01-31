/*

[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-request-header  https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/xiaocanrpc.js

[mitm]
hostname = gw.xiaocantech.com


*/



/**
 * 小蚕助手 - 游客模式全自动联动版 (V4)
 * 逻辑：未登录时存签名 -> 登录后换签名
 */

const headers = $request.headers;
let bodyObj = JSON.parse($request.body || "{}");
const mName = headers['methodname'] || headers['Methodname'] || "";

// 需要处理的接口
const targetMethods = [
    "RecService.GetStorePromotionList", 
    "RecService.SearchStorePromotionList",
    "SilkwormRcsService.MeituanShangjinGetPoiList"
];

const isTarget = targetMethods.some(m => mName.indexOf(m) > -1);

if (isTarget) {
    const isGuestReq = bodyObj.silk_id === 0 || !headers['X-Sivir'];

    if (isGuestReq) {
        // --- 1. 采集模式 (在未登录状态下刷新触发) ---
        $prefs.setValueForKey(headers['X-Ashe'], "xc_live_ashe");
        $prefs.setValueForKey(headers['X-Garen'], "xc_live_garen");
        $prefs.setValueForKey(headers['X-Nami'], "xc_live_nami");
        
        $notify(" 游客签名同步成功", "有效期约5分钟", "请立即登录大号刷新列表");
        console.log("已采集最新游客签名: " + headers['X-Ashe']);
        $done({});
    } else {
        // --- 2. 注入模式 (在登录状态下刷新触发) ---
        const liveAshe = $prefs.valueForKey("xc_live_ashe");
        const liveGaren = $prefs.valueForKey("xc_live_garen");
        const liveNami = $prefs.valueForKey("xc_live_nami");

        if (!liveAshe) {
            $notify(" 缺少游客签名", "请先退出登录刷新一次", "");
            $done({});
        } else {
            console.log(" 正在转换游客身份，当前接口: " + mName);
            
            // 强行替换为采集到的游客校验参数
            headers['X-Ashe'] = liveAshe;
            headers['X-Garen'] = liveGaren;
            headers['X-Nami'] = liveNami;

            // 抹除大号身份
            delete headers['X-Sivir'];
            headers['X-Vayne'] = '0';
            headers['x-Teemo'] = '0';
            bodyObj["silk_id"] = 0;
            if (bodyObj.user_id) bodyObj["user_id"] = 0;

            $done({
                headers: headers,
                body: JSON.stringify(bodyObj)
            });
        }
    }
} else {
    // 抢名额等接口透传，不影响正常登录操作
    $done({});
}
