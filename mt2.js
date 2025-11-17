
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

var CUSTOM_ORDER_ID = "601867382174057863"; // 新订单ID
var CUSTOM_ORDER_DATETIME = "2025-11-17 19:04:12"; // 新订单时间

// ----------------------------------------------------------------------
// 【工具函数】
// ----------------------------------------------------------------------

function dateToUnixTimestamp(datetimeStr) {
    const date = new Date(datetimeStr.replace(/-/g, '/'));
    if (isNaN(date.getTime())) return 0;
    return Math.floor(date.getTime() / 1000);
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
    
    // --- 统一修改逻辑 ---
    
    if (url.includes("order/detail") || url.includes("order/list")) {
        // 1. 统一修改订单ID字段
        obj.data.id = CUSTOM_ORDER_ID;             
        obj.data.orderId = CUSTOM_ORDER_ID;        
        obj.data.orderViewId = CUSTOM_ORDER_ID;    
        obj.data.display_id = CUSTOM_ORDER_ID;     

        // 2. 统一修改订单时间
        obj.data.order_time = NEW_ORDER_TIME_SEC;  

        // 3. 如果是列表页，统一修改所有列表里的订单时间
        if (obj.data.orderList) {
            for (let order of obj.data.orderList) {
                order.orderId = CUSTOM_ORDER_ID;       // 列表页显示ID
                order.orderViewId = CUSTOM_ORDER_ID;   // 列表页显示ID
                order.orderTimeSec = NEW_ORDER_TIME_SEC;
                order.orderTime = NEW_ORDER_TIME_STR;
            }
        }

        console.log(`[MT] 所有订单ID和时间已统一修改为 ${CUSTOM_ORDER_ID} / ${CUSTOM_ORDER_DATETIME}`);
    }

    body = JSON.stringify(obj, null, 2);
    $done({body});

} catch (e) {
    console.log(`[MT] 运行时异常: ${e.name} - ${e.message}`);
    $done({});
}
