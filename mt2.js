/*
[rewrite_local]
# 美团外卖订单列表（改时间 + 店铺名）
^https:\/\/i\.waimai\.meituan\.com\/openh5\/order\/list\?.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js

# 美团外卖订单详情（改时间 + 订单号 + 店铺名）
^https:\/\/i\.waimai\.meituan\.com\/openh5\/order\/manager\/v3\/detail\?.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js

[mitm]
hostname = i.waimai.meituan.com, *.meituan.com
*/

/**
* 强化版：美团外卖订单重写（列表+详情）
* - 列表页：修改 orderTime / orderTimeSec / 多种店铺名字段位置
* - 详情页：修改 order_time / 评论时间 / 订单号 / poi_name / expected_arrival_time
*/

/*
####################################################################
# 配置区
####################################################################
*/

// === 🧭 你只要改这里 ===
const CUSTOM_ORDER_TIME = "2025-12-18 10:04:21";    // 🕐 下单时间
const TARGET_ORDER_ID_NUM = "601907517452641739";   // 新订单号
const TARGET_ARRIVAL_TIME = "12月18日 10:37-10:52"; // 送达时间
const TARGET_PAY_AMOUNT = 28.2;                    // 💰 目标实付金额
// =====================

const TARGET_ORDER_ID_STR = TARGET_ORDER_ID_NUM.toString();

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
 * 📃 列表页修改
 */
function modifyOrderList(orderList) {
    if (!Array.isArray(orderList)) return;
    orderList.forEach((order) => {
        order.orderTime = CUSTOM_ORDER_TIME.slice(0, 16);
        order.orderTimeSec = TARGET_TIMESTAMP_SEC;
        
        if (order.scheme && order.scheme.includes("cactivityapi-sc.waimai.meituan.com")) {
            const targetHost = "h5.waimai.meituan.com";
            const targetPath = "waimai/mindex/menu";
            if (order.poi_id_str) {
                order.scheme = `https://${targetHost}/${targetPath}?mtShopId=${order.mtWmPoiId}&poi_id_str=${order.poi_id_str}`;
            }
        }
    });
}

/**
 * 📦 详情页修改（含金额、时间、ID）
 */
function modifyOrderDetail(data) {
    const oldId = data.id || data.id_view || "unknown";

    // 1. 修改订单号
    ["id", "id_view", "id_text"].forEach((key) => {
        if (data[key] !== undefined)
            data[key] = key === "id" ? TARGET_ORDER_ID_NUM : TARGET_ORDER_ID_STR;
    });

    // 2. 修改时间 (保留原有逻辑)
    if (data.order_time) data.order_time = TARGET_TIMESTAMP_SEC;
    if (data.expected_arrival_time) data.expected_arrival_time = TARGET_ARRIVAL_TIME;

    // 3. 修改红包金额 & 实付总额 (新增逻辑)
    if (data.discounts && Array.isArray(data.discounts)) {
        let currentPay = data.actual_pay_total || 0;
        let diff = TARGET_PAY_AMOUNT - currentPay; // 28 - 24.2 = 3.8

        // 寻找红包项 (type 9 为美团红包)
        let redPacket = data.discounts.find(item => item.type === 9);
        if (redPacket) {
            // 红包减去差额，实付就会上升
            redPacket.reduce_fee = Math.max(0, redPacket.reduce_fee - diff);
            redPacket.info = `-¥${redPacket.reduce_fee}`;
            
            // 同步修改订单数值
            data.actual_pay_total = TARGET_PAY_AMOUNT;
            data.total = TARGET_PAY_AMOUNT;
            // 重新计算总优惠金额
            data.discount_total = data.discounts.reduce((sum, item) => sum + (item.reduce_fee || 0), 0);
        }
    }

    // 4. 评论时间
    if (data.comment) {
        if (data.comment.comment_time) data.comment.comment_time = TARGET_TIMESTAMP_SEC + 600;
        if (Array.isArray(data.comment.add_comment_list))
            data.comment.add_comment_list.forEach((reply) => {
                if (reply.time) reply.time = TARGET_TIMESTAMP_SEC + 1200;
            });
    }

    // 5. 替换链接中的旧 ID
    if (data.scheme)
        data.scheme = data.scheme.replace(new RegExp(oldId, "g"), TARGET_ORDER_ID_STR);

    if (data.insurance?.insurance_detail_url)
        data.insurance.insurance_detail_url = data.insurance.insurance_detail_url.replace(
            new RegExp(oldId, "g"),
            TARGET_ORDER_ID_STR
        );

    console.log(`[MT详情页] 时间/ID已改 | 实付已调至: ${TARGET_PAY_AMOUNT}`);
}