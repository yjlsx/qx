/*
[rewrite_local]
^https?:\/\/(i\.waimai|wx-shangou)\.meituan\.com\/(openh5\/order\/(list|manager\/v3\/detail)|quickbuy\/v[1-3]\/order\/(detail|status)) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js

[mitm]
hostname = i.waimai.meituan.com, wx-shangou.meituan.com
*/

// === 🧭 你只要改这里 ===
const CUSTOM_POI_NAME = "果然·水果农场（关上店)";      
const CUSTOM_ORDER_TIME = "2026-01-18 11:03:12";    
const TARGET_ORDER_ID_STR = "601954784865721548";   // 你想显示的新订单号
const TARGET_ARRIVAL_TIME = "01月18日 11:33-11:48"; 
const LIST_ARRIVAL_TIME = "01月18日 11:40"; 
// =====================

function getTimestamp(timeStr) {
    try {
        const ts = Math.floor(new Date(timeStr.replace(/-/g, "/")).getTime() / 1000);
        return isNaN(ts) ? Math.floor(Date.now() / 1000) : ts;
    } catch { return Math.floor(Date.now() / 1000); }
}
const TARGET_TIMESTAMP_SEC = getTimestamp(CUSTOM_ORDER_TIME);

const url = $request.url;
let body = $response.body;
if (!body) $done({});

try {
    let obj = JSON.parse(body);
    if (!obj.data) $done({ body });

    // --- 1. 针对你提供的 v1/order/detail 接口 ---
    if (url.includes("/order/detail")) {
        let d = obj.data;
        
        // 覆盖店铺名
        d.wm_poi_name = CUSTOM_POI_NAME;
        d.poi_name = CUSTOM_POI_NAME;

        // 覆盖订单号 (强制使用字符串，防止数字精度丢失)
        // 经测试，美团详情页会优先读取 id 和 id_view
        if (d.id !== undefined) d.id = TARGET_ORDER_ID_STR;
        if (d.id_view !== undefined) d.id_view = TARGET_ORDER_ID_STR;
        if (d.order_id !== undefined) d.order_id = TARGET_ORDER_ID_STR;
        if (d.wm_order_id !== undefined) d.wm_order_id = TARGET_ORDER_ID_STR;

        // 覆盖时间
        if (d.order_time !== undefined) d.order_time = TARGET_TIMESTAMP_SEC;
        if (d.expected_arrival_time !== undefined) d.expected_arrival_time = TARGET_ARRIVAL_TIME;
        
        // 修正配送文案
        if (d.order_delivery_content2) d.order_delivery_content2 = "送达时间：" + TARGET_ARRIVAL_TIME;
    } 
    // --- 2. 处理状态页 (order/status) ---
    else if (url.includes("/order/status")) {
        let d = obj.data;
        if (d.poi_info) d.poi_info.poi_name = CUSTOM_POI_NAME;
        if (d.order_common_info) {
            d.order_common_info.order_time = TARGET_TIMESTAMP_SEC;
            d.order_common_info.formatted_delivery_time = LIST_ARRIVAL_TIME;
            // 状态页也强制覆盖订单号字段
            d.order_common_info.order_id = TARGET_ORDER_ID_STR;
        }
    }
    // --- 3. 处理列表页 (order/list) ---
    else if (url.includes("/order/list")) {
        let list = obj.data.orderList || obj.data.orders || [];
        list.forEach((order) => {
            order.wmPoiName = CUSTOM_POI_NAME;
            order.orderTime = CUSTOM_ORDER_TIME.slice(5, 16); 
            order.orderTimeSec = TARGET_TIMESTAMP_SEC;
            order.orderId = TARGET_ORDER_ID_STR;
        });
    }

    $done({ body: JSON.stringify(obj) });
} catch (e) {
    // 如果解析出错，尝试使用正则进行最后一次暴力替换
    body = body.replace(/\"id\"\s*:\s*\d+/g, `\"id\":\"${TARGET_ORDER_ID_STR}\"`);
    $done({ body });
}
