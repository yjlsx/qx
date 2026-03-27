/*
[rewrite_local]
# 美团外卖订单列表（改时间 + 店铺名）
^https?:\/\/i\.waimai\.meituan\.com\/openh5\/order\/(list|manager\/v3\/detail|manager\/v3\/status) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt1.js


[mitm]
hostname = i.waimai.meituan.com, wx-shangou.meituan.com, api.waimai.meituan.com
*/



// === 统一配置区域 ===
const CUSTOM_ORDER_TIME = "2026-03-22 10:26:26";   
const TARGET_ORDER_ID_NUM = 602048282627103956; 
const TARGET_ORDER_ID_STR = "602048282627103956"; 
const TARGET_ARRIVAL_TIME = "03月22日 11:00-11:15"; 
const CUSTOM_POI_NAME = "喜川.精致料理.刺身.寿司.生腌（正义坊店）";  //鮨念.精致料理.刺身.寿司.生腌（正义坊店）
// ==================================

function getTimestamp(timeStr) {
  try {
    return Math.floor(new Date(timeStr.replace(/-/g, "/")).getTime() / 1000);
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
  if (!obj.data) $done({ body });

  // --- 1. 处理 状态页 (v3/status) ---
  if (url.includes("manager/v3/status")) {
    let d = obj.data;
    
    // 修改顶部文案
    if (d.order_status_desc) {
      d.order_status_desc.status_desc = "订单已完成";
      d.order_status_desc.subtitle = "感谢您对美团外卖的信任，期待再次光临。";
    }

    // 核心状态转换 (取消 9 -> 完成 8)
    if (d.order_common_info) {
      let ci = d.order_common_info;
      ci.order_status = 8;      
      ci.status_code = 130;     
      ci.pay_status = 3;        
      ci.logistics_status = 40; 
      ci.order_time = TARGET_TIMESTAMP_SEC;
      ci.pay_success_time = TARGET_TIMESTAMP_SEC;
      ci.status_time = TARGET_TIMESTAMP_SEC + 1800;
      ci.formatted_delivery_time = TARGET_ARRIVAL_TIME.replace("03月", "3月");
    }

    // --- 强制四个按钮逻辑 ---
    if (d.order_operate_area) {
      d.order_operate_area.snd_desc = "感谢您对美团外卖的信任，期待再次光临。";
      d.order_operate_area.button_list = [
        { "title": "申请退款", "code": 2027, "highlight": 0, "action": 0, "change_icon_with_code": true, "button_icon": "http://p1.meituan.net/scarlett/d963e924f3a0947f056a97572c2aa1e13192.png" },
        { "title": "再来一单", "code": 1001, "highlight": 1, "action": 0, "change_icon_with_code": true, "button_icon": "http://p0.meituan.net/scarlett/043781eaaa8b92e49171e9c788d67d171713.png" },
        { "title": "致电商家", "code": 2006, "highlight": 0, "action": 0, "change_icon_with_code": true, "button_icon": "http://p1.meituan.net/scarlett/0215b074ed74edb14298615f1997ee0f2761.png" },
        { "title": "致电骑手", "code": 2025, "highlight": 0, "action": 0, "change_icon_with_code": true, "button_icon": "http://p0.meituan.net/scarlett/a076ee400b63eaa89435b751f839c7ec2893.png" }
      ];
    }

    if (d.poi_info) d.poi_info.poi_name = CUSTOM_POI_NAME;
  }

  // --- 2. 处理 详情页 (v3/detail) ---
  else if (url.includes("manager/v3/detail")) {
    let d = obj.data;
    const oldId = d.id || d.id_view || "";

    d.id = TARGET_ORDER_ID_NUM;
    d.id_view = TARGET_ORDER_ID_STR;
    d.id_text = TARGET_ORDER_ID_STR;
    d.order_time = TARGET_TIMESTAMP_SEC;
    d.expected_arrival_time = TARGET_ARRIVAL_TIME;
    d.poi_name = CUSTOM_POI_NAME;
    d.wm_poi_name = CUSTOM_POI_NAME;

    // 详情页也同步为这四个按钮
    if (d.status === 9 || d.status === 8) {
      d.status = 8;
      d.button_list = [
        { "title": "申请退款", "code": 2027, "highlight": 0 },
        { "title": "再来一单", "code": 1001, "highlight": 1 },
        { "title": "致电商家", "code": 2006, "highlight": 0 },
        { "title": "致电骑手", "code": 2025, "highlight": 0 }
      ];
    }
    
    const idRegex = new RegExp(oldId, "g");
    if (d.scheme) d.scheme = d.scheme.replace(idRegex, TARGET_ORDER_ID_STR);
  }

  // --- 3. 处理 列表页 (list) ---
  else if (url.includes("order/list")) {
    let list = obj.data.orderList || obj.data.orders || obj.data.order_list;
    if (Array.isArray(list)) {
      list.forEach(order => {
        if (order.orderStatus === 9 || order.orderStatusStr === "已取消") {
          order.orderStatus = 8;
          order.orderStatusStr = "已完成";
        }
        order.poiName = CUSTOM_POI_NAME;
        order.wm_poi_name = CUSTOM_POI_NAME;
        if (order.orderTime) order.orderTime = CUSTOM_ORDER_TIME.slice(0, 16);
      });
    }
  }

  $done({ body: JSON.stringify(obj) });
} catch (e) {
  $done({ body });
}
