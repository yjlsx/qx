
/*
####################################################################
# 配置区
####################################################################

[rewrite_local]
# 1. 订单详情接口 (用于展示订单ID和时间)
^https?:\/\/wx-shangou\.meituan\.com\/quickbuy\/v1\/order\/detail\?.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js


# 2. 订单列表接口 (用于修改列表中的订单ID和时间)
^https?:\/\/i\.waimai\.meituan\.com\/openh5\/order\/list\?.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js


[mitm]
hostname = i.waimai.meituan.com, *.meituan.com, wx-shangou.meituan.com

*/


// ----------------------------------------------------------------------
// 【用户配置区 - 请修改这里的两个变量的值】
// ----------------------------------------------------------------------

var CUSTOM_ORDER_ID = "601867382174057863";  // 新订单号（只用于详情页）
var CUSTOM_ORDER_DATETIME = "2025-11-17 19:04:12";  // 新订单时间

function dateToUnixTimestamp(datetimeStr) {
    const date = new Date(datetimeStr.replace(/-/g, '/'));
    return isNaN(date.getTime()) ? 0 : Math.floor(date.getTime() / 1000);
}

var NEW_ORDER_TIME_SEC = dateToUnixTimestamp(CUSTOM_ORDER_DATETIME);
var NEW_ORDER_TIME_STR = CUSTOM_ORDER_DATETIME.substring(0, 16);

var body = $response.body;
var url = $request.url;

try {
    var obj = JSON.parse(body);
    if (!obj || obj.code !== 0 || !obj.data) {
        $done({});
        return;
    }

    // 详情页：修改订单号 + 时间
    if (url.includes("order/detail")) {
        if (obj.data.id && obj.data.id.startsWith("6018")) obj.data.id = CUSTOM_ORDER_ID;
        if (obj.data.orderId && obj.data.orderId.startsWith("6018")) obj.data.orderId = CUSTOM_ORDER_ID;
        if (obj.data.orderViewId && obj.data.orderViewId.startsWith("6018")) obj.data.orderViewId = CUSTOM_ORDER_ID;
        if (obj.data.display_id && obj.data.display_id.startsWith("6018")) obj.data.display_id = CUSTOM_ORDER_ID;

        if (obj.data.order_time !== undefined) obj.data.order_time = NEW_ORDER_TIME_SEC;
    }

    // 列表页：只修改时间
    if (url.includes("order/list") && obj.data.orderList) {
        for (let order of obj.data.orderList) {
            if (order.orderTimeSec !== undefined) order.orderTimeSec = NEW_ORDER_TIME_SEC;
            if (order.orderTime !== undefined) order.orderTime = NEW_ORDER_TIME_STR;
        }
    }

    $done({body: JSON.stringify(obj)});
} catch (e) {
    console.log(`[MT] 异常: ${e.name} - ${e.message}`);
    $done({});
}
