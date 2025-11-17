
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
// 【用户配置区】
var CUSTOM_ORDER_ID = "601867382174057863"; // 只用于详情页 data.id
var CUSTOM_ORDER_DATETIME = "2025-11-17 19:04:12"; // 列表页和详情页显示时间

// ----------------------------------------------------------------------
// 【工具函数】将时间字符串转换为 Unix 时间戳
function dateToUnixTimestamp(datetimeStr) {
    const date = new Date(datetimeStr.replace(/-/g, '/'));
    if (isNaN(date.getTime())) return 0;
    return Math.floor(date.getTime() / 1000);
}

var NEW_ORDER_TIME_SEC = dateToUnixTimestamp(CUSTOM_ORDER_DATETIME);
var NEW_ORDER_TIME_STR = CUSTOM_ORDER_DATETIME.substring(0, 16); // "YYYY-MM-DD HH:MM"

var body = $response.body;
var url = $request.url;

try {
    var obj = JSON.parse(body);
    if (!obj || obj.code !== 0 || !obj.data) {
        $done({});
        return;
    }

    // --------------------- 详情页 ---------------------
    if (url.includes("/order/detail")) {
        // 修改最顶层订单号
        if (obj.data.id) obj.data.id = CUSTOM_ORDER_ID;

        // 修改时间字段（Unix 时间戳）
        if (obj.data.order_time) obj.data.order_time = NEW_ORDER_TIME_SEC;

        console.log(`[MT] 详情页已修改 data.id 和 order_time`);
    }

    // --------------------- 列表页 ---------------------
    if (url.includes("/order/list")) {
        // 只修改时间，不改订单号
        if (obj.data.orderList) {
            for (let order of obj.data.orderList) {
                if (order.orderTimeSec) order.orderTimeSec = NEW_ORDER_TIME_SEC;
                if (order.orderTime) order.orderTime = NEW_ORDER_TIME_STR;
            }
        }
        console.log(`[MT] 列表页已修改时间`);
    }

    body = JSON.stringify(obj, null, 2);
    $done({body});

} catch (e) {
    console.log(`[MT] 运行时异常: ${e.name} - ${e.message}`);
    $done({});
}
