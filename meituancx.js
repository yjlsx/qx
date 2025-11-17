/*
[rewrite_local]
^https:\/\/wx-shangou\.meituan\.com\/quickbuy\/v1\/order\/detail url script-request-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/meituancx.js



[mitm]
hostname = wx-shangou.meituan.com

*/



// Quantumult X - 新接口自动转旧接口
const url = $request.url;

if (url.includes("/quickbuy/v1/order/detail")) {
    // 解析 Body 中的订单 id
    const bodyStr = $request.body || "";
    const orderMatch = bodyStr.match(/id=(\d+)/);
    const order_view_id = orderMatch ? orderMatch[1] : "";

    if (!order_view_id) {
        $done({body: "未找到订单 ID"});
    } else {
        // 构造旧接口请求
        const oldUrl = `https://i.waimai.meituan.com/openh5/order/manager/v3/detail?_=` + Date.now() + `&yodaReady=h5&csecplatform=4&csecversion=4.1.1`;

        const oldHeaders = {
            'mtgsig': '{"a1":"1.2","a2":'+Date.now()+',"a3":"xxx","a5":"xxx","a6":"xxx","a8":"xxx","a9":"4.1.1,7,203","a10":"88","x0":4,"d1":"xxx"}',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'User-Agent': $request.headers['User-Agent'] || '',
            'Origin': 'https://h5.waimai.meituan.com',
            'Referer': 'https://h5.waimai.meituan.com/'
        };

        const oldBody = `optimus_code=10&optimus_risk_level=71&order_view_id=${order_view_id}&switch_version=1&wm_latitude=25004542&wm_longitude=102734686&wm_actual_latitude=25006364&wm_actual_longitude=102734353&wmUuidDeregistration=0&wmUserIdDeregistration=0&openh5_uuid=197df528c7ec8-0019ebd34e6b4a-286f4f35-505c8-197df528c7ec8&uuid=197df528c7ec8-0019ebd34e6b4a-286f4f35-505c8-197df528c7ec8&_token=xxx`;

        $task.fetch({
            url: oldUrl,
            method: 'POST',
            headers: oldHeaders,
            body: oldBody
        }).then(response => {
            // 返回旧接口 JSON 响应
            $done({response: response});
        }, reason => {
            $done({body: "请求旧接口失败: " + reason.error});
        });
    }
} else {
    // 非目标接口直接放行
    $done({});
}
