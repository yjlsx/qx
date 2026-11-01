
/*
####################################################################
# 配置区
####################################################################

[rewrite_local]
# 1. 订单详情接口
^https:\/\/i\.waimai\.meituan\.com\/openh5\/order\/manager\/v3\/detail\?.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/main/mt.js


# 2. 订单列表接口 
^https?:\/\/i\.waimai\.meituan\.com\/openh5\/order\/list\?.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/main/mt.js


[mitm]
hostname = i.waimai.meituan.com, *.meituan.com, wx-shangou.meituan.com

*/



// === 🧭 你只要改这里 ===
const CUSTOM_ORDER_TIME = "2026-01-22 00:14:52";    // 🕐 下单时间（精确到秒）
const TARGET_ORDER_ID_NUM = "601958610329582616"; // 订单号（详情页显示）
const TARGET_ARRIVAL_TIME = "01月22日 00:56-01:11"; // 送达时间
// =====================

// 自动生成字符串ID
const TARGET_ORDER_ID_STR = TARGET_ORDER_ID_NUM.toString();

/**
 * 🕐 转换时间字符串为 Unix 秒时间戳（支持手动输入格式）
 */
function getTimestamp(timeStr) {
    try {
        const ts = Math.floor(new Date(timeStr.replace(/-/g, "/")).getTime() / 1000);
        if (isNaN(ts) || ts <= 0) throw new Error("时间无效");
        return ts;
    } catch {
        return Math.floor(Date.now() / 1000);
    }
}
const TARGET_TIMESTAMP_SEC = getTimestamp(CUSTOM_ORDER_TIME);

const url = $request.url;
let body = $response.body;
if (!body) $done({});

try {
    const obj = JSON.parse(body);
    if (!obj?.data) return $done({});

    if (url.includes("/openh5/order/list")) {
        modifyOrderList(obj.data.orderList);
    } else if (url.includes("/openh5/order/manager/v3/detail")) {
        modifyOrderDetail(obj.data);
    }

    $done({ body: JSON.stringify(obj) });

} catch (e) {
    console.log(`[MT重写错误] ${e.message}`);
    $done({});
}

/**
 * 📃 列表页：只改时间 和 scheme (ID保持不变)
 */
function modifyOrderList(orderList) {
    if (!Array.isArray(orderList)) return;

    orderList.forEach((order) => {
        // --- 1. 修改时间 ---
        order.orderTime = CUSTOM_ORDER_TIME.slice(0, 16); // 只显示到分钟
        order.orderTimeSec = TARGET_TIMESTAMP_SEC;
        
        // ❗ 已移除 ID 修改：mtOrderViewId 和 orderId 保持原始值 ❗

        // --- 2. Scheme 重定向 ---
        if (order.scheme && order.scheme.includes("cactivityapi-sc.waimai.meituan.com")) {
            const targetHost = "h5.waimai.meituan.com";
            const targetPath = "waimai/mindex/menu";

            // 使用订单对象中已有的 mtWmPoiId 和 poi_id_str 构造旧版 Scheme
            if (order.poi_id_str) {
                const newScheme = `https://${targetHost}/${targetPath}?mtShopId=${order.mtWmPoiId}&poi_id_str=${order.poi_id_str}`;
                order.scheme = newScheme;
            }
        }
    });

    console.log(`[MT列表页] 时间已设为最新值，Scheme已重定向，订单ID保持不变。`);
}

/**
 * 📦 详情页：改时间 + 订单号
 */
function modifyOrderDetail(data) {
    const oldId = data.id || data.id_view || "unknown";

    // 修改订单号
    ["id", "id_view", "id_text"].forEach((key) => {
        if (data[key] !== undefined)
            data[key] = key === "id" ? TARGET_ORDER_ID_NUM : TARGET_ORDER_ID_STR;
    });

    // 修改下单时间
    if (data.order_time) data.order_time = TARGET_TIMESTAMP_SEC;

    // 修改期望送达时间
    if (data.expected_arrival_time)
        data.expected_arrival_time = TARGET_ARRIVAL_TIME;

    // 评论时间
    if (data.comment) {
        if (data.comment.comment_time)
            data.comment.comment_time = TARGET_TIMESTAMP_SEC + 600;
        if (Array.isArray(data.comment.add_comment_list))
            data.comment.add_comment_list.forEach((reply) => {
                if (reply.time) reply.time = TARGET_TIMESTAMP_SEC + 1200;
            });
    }

    // 替换旧订单号（针对详情页中嵌入旧订单号的URL）
    if (data.scheme)
        data.scheme = data.scheme.replace(new RegExp(oldId, "g"), TARGET_ORDER_ID_STR);

    if (data.insurance?.insurance_detail_url)
        data.insurance.insurance_detail_url = data.insurance.insurance_detail_url.replace(
            new RegExp(oldId, "g"),
            TARGET_ORDER_ID_STR
        );

    console.log(`[MT详情页] 新订单号 ${TARGET_ORDER_ID_STR} | 时间 ${CUSTOM_ORDER_TIME}`);
}