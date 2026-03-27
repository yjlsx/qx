/*
[rewrite_local]
# 美团外卖订单列表（改时间 + 店铺名）
^https?:\/\/i\.waimai\.meituan\.com\/openh5\/order\/(list|manager\/v3\/detail|manager\/v3\/status) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt1.js


[mitm]
hostname = i.waimai.meituan.com, wx-shangou.meituan.com, api.waimai.meituan.com
*/

/**
* - 列表页：修改 orderTime / orderTimeSec
* - 详情页：修改 order_time / 评论时间 / 订单号 
*/

// === 统一配置区域 ===
const CUSTOM_ORDER_TIME = "2026-03-23 10:02:26";  
const TARGET_ORDER_ID_NUM = "602048282627103956";
const TARGET_ARRIVAL_TIME = "03月23日 11:07-11:22";
const CUSTOM_POI_NAME = "鮨念.精致料理.刺身.寿司.生腌（正义坊店）";
// ======================

const TARGET_ORDER_ID_STR = TARGET_ORDER_ID_NUM.toString();

/**
* 时间戳转换
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
 let obj = JSON.parse(body);
 if (!obj?.data) return $done({});

 // 1. 处理列表页
 if (url.includes("/openh5/order/list")) {
   let list = null;
   if (Array.isArray(obj.data.orderList)) list = obj.data.orderList;
   else if (Array.isArray(obj.data.orders)) list = obj.data.orders;
   else if (Array.isArray(obj.data.order_list)) list = obj.data.order_list;
   
   if (list) {
     modifyOrderList(list);
   }
 }
 // 2. 处理详情页与状态页
 else if (url.includes("/openh5/order/manager/v3/detail") || url.includes("status")) {
   modifyOrderDetail(obj.data);
 }

 $done({ body: JSON.stringify(obj) });
} catch (e) {
 console.log(`[MT合并脚本错误] ${e.message}`);
 $done({ body });
}

/**
* 列表页逻辑：修改店铺、时间、状态
*/
function modifyOrderList(orderList) {
 const poiContainers = ["poi", "poi_info", "wm_poi_info", "poiInfo"];
 
 orderList.forEach((order) => {
   // A. 强制状态转换 (取消 -> 完成)
   if (order.orderStatus === 9 || order.orderStatusStr === "已取消") {
     order.orderStatus = 8;
     order.orderStatusStr = "已完成";
     if (order.payStatus !== undefined) order.payStatus = 3;
   }

   // B. 修改时间
   if (order.orderTime !== undefined) order.orderTime = CUSTOM_ORDER_TIME.slice(0, 16);
   if (order.orderTimeSec !== undefined) order.orderTimeSec = TARGET_TIMESTAMP_SEC;
   if (order.order_time !== undefined) order.order_time = TARGET_TIMESTAMP_SEC;

   // C. 修改店铺名 (多字段覆盖)
   const poiFields = ["wm_poi_name", "poiName", "wmPoiName", "poi_name", "shopName"];
   poiFields.forEach(f => { if (order[f] !== undefined) order[f] = CUSTOM_POI_NAME; });
   
   poiContainers.forEach(c => {
     if (order[c] && typeof order[c] === "object") {
       if (order[c].name !== undefined) order[c].name = CUSTOM_POI_NAME;
       if (order[c].poi_name !== undefined) order[c].poi_name = CUSTOM_POI_NAME;
     }
   });

   // 处理特殊的 name 字段
   if (order.name !== undefined && (order.name.includes("店") || order.name.length < 20)) {
     order.name = CUSTOM_POI_NAME;
   }
 });
}

/**
* 详情页逻辑：修改订单号、时间、店铺、状态、按钮
*/
function modifyOrderDetail(data) {
 if (!data) return;
 const oldId = data.id || data.id_view || "";

 // A. 修改订单核心信息
 ["id", "id_view", "id_text"].forEach(key => {
   if (data[key] !== undefined) data[key] = key === "id" ? TARGET_ORDER_ID_NUM : TARGET_ORDER_ID_STR;
 });
 if (data.order_time !== undefined) data.order_time = TARGET_TIMESTAMP_SEC;
 if (data.expected_arrival_time !== undefined) data.expected_arrival_time = TARGET_ARRIVAL_TIME;

 // B. 修改店铺名
 if (data.poi_name !== undefined) data.poi_name = CUSTOM_POI_NAME;
 if (data.wm_poi_name !== undefined) data.wm_poi_name = CUSTOM_POI_NAME;
 if (data.poi && typeof data.poi === "object") {
   ["name", "poi_name"].forEach(k => { if (data.poi[k] !== undefined) data.poi[k] = CUSTOM_POI_NAME; });
 }

 // C. 强制状态转换逻辑
 let common = data.order_common_info || {};
 if (data.status === 9 || common.order_status === 9 || common.status_code === 140) {
   if (data.status !== undefined) data.status = 8;
   common.order_status = 8;
   common.status_code = 130;
   common.pay_status = 3;
   common.logistics_status = 40;

   // 修改状态文案
   if (data.order_status_desc) {
     data.order_status_desc.status_desc = "订单已完成";
     data.order_status_desc.subtitle = "感谢您对美团外卖的信任，期待再次光临。";
   }

   // 修正按钮区域
   if (data.order_operate_area) {
     data.order_operate_area.snd_desc = "感谢您对美团外卖的信任，期待再次光临。";
     data.order_operate_area.button_list = [
       { "title": "申请退款", "code": 2027, "highlight": 0, "action": 0 },
       { "title": "再来一单", "code": 1001, "highlight": 1, "action": 0 },
       { "title": "致电商家", "code": 2006, "highlight": 0, "action": 0 },
       { "title": "致电骑手", "code": 2025, "highlight": 0, "action": 0 }
     ];
   }
 }

 // D. 评论时间同步
 if (data.comment) {
   if (data.comment.comment_time !== undefined) data.comment.comment_time = TARGET_TIMESTAMP_SEC + 600;
 }

 // E. 链接替换
 const idRegex = new RegExp(oldId, "g");
 if (data.scheme) data.scheme = data.scheme.replace(idRegex, TARGET_ORDER_ID_STR);
 if (data.insurance?.insurance_detail_url) {
     data.insurance.insurance_detail_url = data.insurance.insurance_detail_url.replace(idRegex, TARGET_ORDER_ID_STR);
 }
 
 // 清理全局变量干扰
 if (data.globalVariables) data.globalVariables.vars = {};
}