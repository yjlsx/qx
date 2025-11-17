@ -0,0 +1,119 @@
/*
[rewrite_local]
# 美团外卖订单列表（只改时间）
^https:\/\/i\.waimai\.meituan\.com\/openh5\/order\/list\?.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt.js

# 美团外卖订单详情（改时间 + 订单号）
^https:\/\/i\.waimai\.meituan\.com\/openh5\/order\/manager\/v3\/detail\?.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt.js

[mitm]
hostname = i.waimai.meituan.com, *.meituan.com
*/

/**
* 🧩 美团外卖订单重写（手动设置时间版）
* 功能：
*   ✅ 列表页：改 orderTime / orderTimeSec
*   ✅ 详情页：改 order_time + 评论时间 + 订单号
*   ✅ 你手动设置具体时间
*/

// === 🧭 你只要改这里 ===
const CUSTOM_ORDER_TIME = "2025-11-11 20:20:21"; // 🕐 下单时间（精确到秒）
const TARGET_ORDER_ID_NUM = "601857320872998403";   // 新订单号6018四位
const TARGET_ARRIVAL_TIME = "11月11日 20:55-21:10"; // 期望送达时间
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
* 📃 列表页：只改时间
*/
function modifyOrderList(orderList) {
 if (!Array.isArray(orderList)) return;

 orderList.forEach((order) => {
   order.orderTime = CUSTOM_ORDER_TIME.slice(0, 16); // 去掉秒只显示到分钟
   order.orderTimeSec = TARGET_TIMESTAMP_SEC;
 });

 console.log(`[MT列表页] 时间已设为：${CUSTOM_ORDER_TIME}`);
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

 // 替换旧订单号
 if (data.scheme)
   data.scheme = data.scheme.replace(new RegExp(oldId, "g"), TARGET_ORDER_ID_STR);

 if (data.insurance?.insurance_detail_url)
   data.insurance.insurance_detail_url = data.insurance.insurance_detail_url.replace(
     new RegExp(oldId, "g"),
     TARGET_ORDER_ID_STR
   );

 console.log(`[MT详情页] 新订单号 ${TARGET_ORDER_ID_STR} | 时间 ${CUSTOM_ORDER_TIME}`);
}