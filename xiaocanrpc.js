/*

[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-request-header  https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/xiaocanrpc.js

[mitm]
hostname = gw.xiaocantech.com


*/


/**
 * 小蚕助手 - 动态重写克隆版 (V5)
 * 作用：解决登录后看不见列表的问题
 */

let headers = $request.headers;
let bodyObj = JSON.parse($request.body || "{}");
let mName = headers['methodname'] || headers['Methodname'] || "";

const targetMethods = [
    "RecService.SearchStorePromotionList",
    "SilkwormRcsService.MeituanShangjinGetPoiList"
];

if (targetMethods.some(m => mName.indexOf(m) > -1)) {
    const isGuest = bodyObj.silk_id === 0 || !headers['X-Sivir'];

    if (isGuest) {
        // --- 1. 采集模式 (退出登录时运行) ---
        $prefs.setValueForKey(headers['X-Ashe'], "guest_ashe");
        $prefs.setValueForKey(headers['X-Garen'], "guest_garen");
        $prefs.setValueForKey(headers['X-Nami'], "guest_nami");
        console.log(" 成功采集游客套装，现在请去登录大号");
        $done({});
    } else {
        // --- 2. 注入模式 (登录大号时运行) ---
        const gAshe = $prefs.valueForKey("guest_ashe");
        const gGaren = $prefs.valueForKey("guest_garen");
        const gNami = $prefs.valueForKey("guest_nami");

        if (gAshe) {
            console.log(" 正在克隆游客身份重写请求...");
            // 全套替换，保证签名校验能过
            headers['X-Ashe'] = gAshe;
            headers['X-Garen'] = gGaren;
            headers['X-Nami'] = gNami;
            delete headers['X-Sivir'];
            headers['X-Vayne'] = '0';
            headers['x-Teemo'] = '0';
            bodyObj["silk_id"] = 0;
            
            $done({ headers: headers, body: JSON.stringify(bodyObj) });
        } else {
            console.log(" 未发现可用的游客套装");
            $done({});
        }
    }
} else {
    $done({});
}
