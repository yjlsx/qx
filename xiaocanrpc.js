/*

[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-response-body  https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/xiaocanrpc.js

[mitm]
hostname = gw.xiaocantech.com


*/



/**
 * 小蚕助手 - 双线程响应注入版 (最终 Rewrite 方案)
 * 逻辑：登录请求照常发，但回包时强行替换为实时获取的游客数据
 */

const isRequest = typeof $request !== "undefined";
const queryUrl = `https://gw.xiaocantech.com/rpc`;

if (isRequest) {
    // 1. 请求阶段：记录当前大号的合法签名，作为“采集模板”
    const headers = $request.headers;
    const mName = headers['methodname'] || headers['Methodname'] || "";
    
    // 只记录列表和搜索接口
    if (mName.indexOf("PromotionList") > -1 || mName.indexOf("GetPoiList") > -1) {
        $prefs.setValueForKey(headers['X-Ashe'], "xc_tmp_ashe");
        $prefs.setValueForKey(headers['X-Garen'], "xc_tmp_garen");
        $prefs.setValueForKey(headers['X-Nami'], "xc_tmp_nami");
        console.log(" 已捕获查询模板，准备执行异步劫持...");
    }
    $done({});
} else {
    // 2. 响应阶段：拦截服务器的回包
    const headers = $request.headers;
    const mName = headers['methodname'] || headers['Methodname'] || "";

    if (mName.indexOf("PromotionList") > -1 || mName.indexOf("GetPoiList") > -1) {
        // 关键逻辑：如果是登录状态，则发起一个异步游客请求并替换结果
        const isLogin = headers['X-Sivir'] && headers['X-Sivir'].length > 10;

        if (isLogin) {
            console.log(" 正在实时拉取游客数据...");
            const bodyObj = JSON.parse($request.body);
            bodyObj.silk_id = 0; // 强制变游客

            const guestReq = {
                url: queryUrl,
                method: "POST",
                headers: {
                    ...headers,
                    'X-Sivir': '', // 清空 Token
                    'X-Vayne': '0',
                    'x-Teemo': '0'
                },
                body: JSON.stringify(bodyObj)
            };

            $task.fetch(guestReq).then(response => {
                console.log(" 游客数据拉取成功，正在注入界面...");
                $done({ body: response.body });
            }, reason => {
                console.log(" 异步拉取失败: " + reason.error);
                $done({});
            });
        } else {
            $done({});
        }
    } else {
        $done({});
    }
}
