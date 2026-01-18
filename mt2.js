/*
[rewrite_local]
# 包含列表、详情、状态三个接口
^https?:\/\/(i\.waimai|wx-shangou)\.meituan\.com\/(openh5\/order\/(list|manager\/v3\/detail)|quickbuy\/v[1-3]\/order\/(detail|status)) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js

[mitm]
hostname = i.waimai.meituan.com, wx-shangou.meituan.com
*/

// === 🧭 你只要改这里 ===
const CUSTOM_POI_NAME = "果然·水果农场（关上店)";      
const CUSTOM_ORDER_TIME = "2026-01-18 11:03:12";    
const TARGET_ORDER_ID_STR = "601954784865721548";   
const TARGET_ARRIVAL_TIME = "01月18日 11:33-11:48"; 
const LIST_ARRIVAL_TIME = "01月18日 11:45"; // 状态页显示的单一送达时间点
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

    // --- 1. 处理订单状态页 (order/status) ---
    if (url.includes("/order/status")) {
        let d = obj.data;
        if (d.order_common_info) {
            let info = d.order_common_info;
            info.order_time = TARGET_TIMESTAMP_SEC; // 下单时间
            info.status_time = TARGET_TIMESTAMP_SEC + 300; // 状态更新时间
            info.pay_success_time = TARGET_TIMESTAMP_SEC + 10; // 支付时间
            info.order_push_time = TARGET_TIMESTAMP_SEC + 10;
            info.formatted_delivery_time = LIST_ARRIVAL_TIME; // 页面显示的送达时间
        }
        if (d.poi_info) {
            d.poi_info.poi_name = CUSTOM_POI_NAME; // 修改店名
        }
    } 
    // --- 2. 处理订单列表页 (order/list) ---
    else if (url.includes("/order/list")) {
        let list = obj.data.orderList || obj.data.orders || [];
        list.forEach((order) => {
            order.wmPoiName = CUSTOM_POI_NAME;
            order.orderTime = CUSTOM_ORDER_TIME.slice(5, 16); 
            order.orderTimeSec = TARGET_TIMESTAMP_SEC;
            order.orderId = TARGET_ORDER_ID_STR;
            order.viewId = TARGET_ORDER_ID_STR;
        });
    } 
    // --- 3. 处理订单详情页 (order/detail) ---
    else if (url.includes("/order/detail")) {
        let d = obj.data;
        d.poi_name = CUSTOM_POI_NAME;
        d.wm_poi_name = CUSTOM_POI_NAME;
        
        // 强力替换 ID
        ["id", "id_view", "id_text", "order_id", "wm_order_id"].forEach(key => {
            if (d[key] !== undefined) {
                d[key] = (typeof d[key] === 'number') ? Number(TARGET_ORDER_ID_STR) : TARGET_ORDER_ID_STR;
            }
        });
        
        d.order_time = TARGET_TIMESTAMP_SEC;
        d.expected_arrival_time = TARGET_ARRIVAL_TIME;
        if (d.order_delivery_content2) d.order_delivery_content2 = "送达时间：" + TARGET_ARRIVAL_TIME;
    }

    $done({ body: JSON.stringify(obj) });
} catch (e) {
    console.log("脚本错误: " + e);
    $done({});
}
