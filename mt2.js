/*
[rewrite_local]
^https:\/\/i\.waimai\.meituan\.com\/openh5\/order\/(list|manager\/v3\/detail) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js
^https:\/\/wx-shangou\.meituan\.com\/quickbuy\/v1\/order\/detail url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js

[mitm]
hostname = i.waimai.meituan.com, wx-shangou.meituan.com
*/

// === 🧭 你只要改这里 ===
const CUSTOM_POI_NAME = "果然·水果农场（关上店)";      // 店铺名称
const CUSTOM_ORDER_TIME = "2026-01-18 11:03:12";    // 下单时间
const TARGET_ORDER_ID_STR = "601954784865721548";   // 订单号 (直接用字符串，避免精度丢失)
const TARGET_ARRIVAL_TIME = "01月18日 11:33-11:48"; // 送达时间
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
    if (!obj.data) $done({});

    // 1. 列表页逻辑
    if (url.includes("/order/list")) {
        let list = obj.data.orderList || obj.data.orders || [];
        list.forEach((order) => {
            if (order.wmPoiName) order.wmPoiName = CUSTOM_POI_NAME;
            if (order.poi_name) order.poi_name = CUSTOM_POI_NAME;
            order.orderTime = CUSTOM_ORDER_TIME.slice(5, 16); 
            order.orderTimeSec = TARGET_TIMESTAMP_SEC;
            // 列表页 ID 替换
            if (order.orderId) order.orderId = TARGET_ORDER_ID_STR;
            if (order.id) order.id = TARGET_ORDER_ID_STR;
            if (order.viewId) order.viewId = TARGET_ORDER_ID_STR;
            if (order.mtOrderViewId) order.mtOrderViewId = TARGET_ORDER_ID_STR;
        });
    } 
    // 2. 详情页逻辑 (包含外卖和闪购)
    else {
        let d = obj.data;
        // 修改店铺名
        if (d.poi_name) d.poi_name = CUSTOM_POI_NAME;
        if (d.wm_poi_name) d.wm_poi_name = CUSTOM_POI_NAME;

        // 修改核心 ID (强力替换所有可能的 ID 字段)
        const idFields = ["id", "id_view", "id_text", "order_id", "wm_order_id", "viewId"];
        idFields.forEach(key => {
            if (d[key] !== undefined) {
                // 自动判断：如果是数字类型则转换，否则保持字符串
                d[key] = (typeof d[key] === 'number') ? Number(TARGET_ORDER_ID_STR) : TARGET_ORDER_ID_STR;
            }
        });

        // 修改时间
        if (d.order_time) d.order_time = TARGET_TIMESTAMP_SEC;
        if (d.expected_arrival_time) d.expected_arrival_time = TARGET_ARRIVAL_TIME;
        
        // 修改送达文案
        if (d.order_delivery_content2) d.order_delivery_content2 = "送达时间：" + TARGET_ARRIVAL_TIME;
    }

    $done({ body: JSON.stringify(obj) });
} catch (e) {
    $done({});
}
