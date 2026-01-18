/*
[rewrite_local]
^https:\/\/i\.waimai\.meituan\.com\/openh5\/order\/(list|manager\/v3\/detail) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js
^https:\/\/wx-shangou\.meituan\.com\/quickbuy\/v1\/order\/detail url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js

[mitm]
hostname = i.waimai.meituan.com, wx-shangou.meituan.com
*/

// === 🧭 你只要改这里 ===
const CUSTOM_POI_NAME = "果然·水果农场（关上店)";      //  店铺名称
const CUSTOM_ORDER_TIME = "2026-01-18 11:03:12";    //  下单时间
const TARGET_ORDER_ID_NUM = "601954784865721548";   //  订单号
const TARGET_ARRIVAL_TIME = "01月18日 11:33-11:48"; //  送达时间
// =====================

const TARGET_ORDER_ID_STR = TARGET_ORDER_ID_NUM.toString();

function getTimestamp(timeStr) {
    try {
        const ts = Math.floor(new Date(timeStr.replace(/-/g, "/")).getTime() / 1000);
        return isNaN(ts) ? Math.floor(Date.now() / 1000) : ts;
    } catch {
        return Math.floor(Date.now() / 1000);
    }
}
const TARGET_TIMESTAMP_SEC = getTimestamp(CUSTOM_ORDER_TIME);

const url = $request.url;
let body = $response.body;
if (!body) $done({});

try {
    let obj = JSON.parse(body);
    if (!obj.data) $done({});

    // 判断是列表页还是详情页
    if (url.includes("/order/list")) {
        modifyOrderList(obj.data.orderList || obj.data.orders);
    } else {
        modifyOrderDetail(obj.data);
    }

    $done({ body: JSON.stringify(obj) });
} catch (e) {
    $done({});
}

/**
 *  列表页修改逻辑
 */
function modifyOrderList(orderList) {
    if (!Array.isArray(orderList)) return;
    orderList.forEach((order) => {
        // 修改店铺名
        if (order.wmPoiName) order.wmPoiName = CUSTOM_POI_NAME;
        if (order.poi_name) order.poi_name = CUSTOM_POI_NAME;

        // 修改时间 (列表通常显示 MM-DD HH:mm)
        order.orderTime = CUSTOM_ORDER_TIME.slice(5, 16); 
        order.orderTimeSec = TARGET_TIMESTAMP_SEC;

        // 修改订单号 (确保点击列表能对应上)
        if (order.orderId) order.orderId = TARGET_ORDER_ID_NUM;
        if (order.viewId) order.viewId = TARGET_ORDER_ID_STR;
        if (order.mtOrderViewId) order.mtOrderViewId = TARGET_ORDER_ID_STR;

        // 修正 Scheme 里的 ID
        if (order.scheme) {
            order.scheme = order.scheme.replace(/order_id=\d+/g, `order_id=${TARGET_ORDER_ID_STR}`);
        }
    });
}

/**
 *  详情页修改逻辑
 */
function modifyOrderDetail(data) {
    // 1. 店铺名
    if (data.poi_name) data.poi_name = CUSTOM_POI_NAME;
    if (data.wm_poi_name) data.wm_poi_name = CUSTOM_POI_NAME;

    // 2. 订单号
    const fields = ["id", "id_view", "id_text", "order_id", "wm_order_id"];
    fields.forEach(key => {
        if (data[key] !== undefined) {
            data[key] = (typeof data[key] === 'number') ? Number(TARGET_ORDER_ID_NUM) : TARGET_ORDER_ID_STR;
        }
    });

    // 3. 时间
    if (data.order_time) data.order_time = TARGET_TIMESTAMP_SEC;
    if (data.expected_arrival_time) data.expected_arrival_time = TARGET_ARRIVAL_TIME;

    // 4. 其它细节 (备注/配送)
    if (data.order_delivery_content2) {
        data.order_delivery_content2 = "送达时间：" + TARGET_ARRIVAL_TIME;
    }
}
