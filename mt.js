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
* 🧩 美团外卖重写脚本（简洁版）
* 功能：
*   ✅ 列表页：只改时间
*   ✅ 详情页：改时间 + 改订单号
*/

// === 🧭 可修改区 ===
const TARGET_ORDER_TIME = "2025-11-07 9:01"; // 目标完整时间
const TARGET_ORDER_ID_NUM = 60185182325984621; // 新订单号（数字）
const TARGET_ARRIVAL_TIME = "11月7日 8:50-9:10"; // 详情页期望送达时间
// ==================

const TARGET_ORDER_ID_STR = TARGET_ORDER_ID_NUM.toString();
const TARGET_TIMESTAMP_SEC = Math.floor(
 new Date(`${TARGET_ORDER_TIME}:00`).getTime() / 1000
);

const url = $request.url;
let body = $response.body;

if (!body) $done({});

try {
 const obj = JSON.parse(body);
 if (!obj?.data) {
   $done({});
   return;
 }

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
   order.orderTime = TARGET_ORDER_TIME;      // 改显示时间
   order.orderTimeSec = TARGET_TIMESTAMP_SEC; // 改时间戳
 });

 console.log(`[MT列表页] 统一时间修改为 ${TARGET_ORDER_TIME}`);
}

/**
* 📦 详情页：改时间 + 订单号
*/
function modifyOrderDetail(data) {
 const oldId = data.id || data.id_view || "unknown";

 // 1️⃣ 改订单号
 ["id", "id_view", "id_text"].forEach((k) => {
   if (data[k] !== undefined)
     data[k] = k === "id" ? TARGET_ORDER_ID_NUM : TARGET_ORDER_ID_STR;
 });

 // 2️⃣ 改时间字段
 if (data.order_time) data.order_time = TARGET_TIMESTAMP_SEC;
 if (data.expected_arrival_time)
   data.expected_arrival_time = TARGET_ARRIVAL_TIME;

 // 评论相关
 if (data.comment) {
   if (data.comment.comment_time)
     data.comment.comment_time = TARGET_TIMESTAMP_SEC + 600;
   if (Array.isArray(data.comment.add_comment_list))
     data.comment.add_comment_list.forEach((r) => {
       if (r.time) r.time = TARGET_TIMESTAMP_SEC + 1200;
     });
 }

 // 3️⃣ 修正内部含旧ID的URL
 if (data.scheme)
   data.scheme = data.scheme.replace(new RegExp(oldId, "g"), TARGET_ORDER_ID_STR);

 if (data.insurance?.insurance_detail_url)
   data.insurance.insurance_detail_url = data.insurance.insurance_detail_url.replace(
     new RegExp(oldId, "g"),
     TARGET_ORDER_ID_STR
   );

 console.log(`[MT详情页] 已修改订单号(${TARGET_ORDER_ID_STR})与时间(${TARGET_ORDER_TIME})`);
}