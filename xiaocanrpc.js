/*

[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-request-header  https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/xiaocanrpc.js

[mitm]
hostname = gw.xiaocantech.com


*/



const headers = $request.headers;
let bodyObj = JSON.parse($request.body || "{}");
const mName = headers['methodname'] || headers['Methodname'] || "";

// 目标接口：列表和搜索
const targetMethods = [
    "RecService.GetStorePromotionList", 
    "RecService.SearchStorePromotionList",
    "SilkwormRcsService.MeituanShangjinGetPoiList"
];

if (targetMethods.some(m => mName.indexOf(m) > -1)) {
    // 1. 获取最新采集的“游客套装”
    const guestAshe = $prefs.valueForKey("xc_guest_ashe");
    const guestGaren = $prefs.valueForKey("xc_guest_garen");
    const guestNami = $prefs.valueForKey("xc_guest_nami");

    if (guestAshe) {
        console.log(" 执行全量游客克隆: " + mName);

        // --- 核心：全套替换，保证签名校验必过 ---
        headers['X-Ashe'] = guestAshe;
        headers['X-Garen'] = guestGaren;
        headers['X-Nami'] = guestNami;
        
        // 抹除大号身份，变成纯游客
        delete headers['X-Sivir'];
        headers['X-Vayne'] = '0';
        headers['x-Teemo'] = '0';
        
        bodyObj["silk_id"] = 0;
        if (bodyObj.user_id) bodyObj["user_id"] = 0;
        // 如果是搜索，确保关键词也符合签名生成时的内容
        // 注意：搜索词必须和采集签名时一致，否则服务器会报签名错误
        
        $done({
            headers: headers,
            body: JSON.stringify(bodyObj)
        });
    } else {
        console.log(" 尚未同步游客套装，跳过重写");
        $done({});
    }
} else {
    $done({});
}

