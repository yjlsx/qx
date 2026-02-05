/*
[rewrite_local]
^https?:\/\/.*meituan\.com\/.*order\/.*(list|status|detail) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js

[mitm]
hostname = i.waimai.meituan.com, wx-shangou.meituan.com
*/




let url = $request.url;
let body = $response.body;

if (body) {
   try {
       let obj = JSON.parse(body);

       // --- 1. 处理订单列表页 ---
       if (url.includes("order/list")) {
           if (obj.data && obj.data.orderList) {
               obj.data.orderList.forEach(order => {
                   if (order.orderStatus === 9 || order.orderStatusStr === "已取消") {
                       order.orderStatus = 8;
                       order.orderStatusStr = "已完成";
                       order.payStatus = 3;
                   }
               });
           }
       }

       // --- 2. 处理详情页/状态页 (v3/status, v3/detail) ---
       if (url.includes("status") || url.includes("detail")) {
           if (obj.data) {
               let d = obj.data;
               let common = d.order_common_info || {};
               let statusDesc = d.order_status_desc || {};
               let operate = d.order_operate_area || {};

               // 只要匹配到“已取消”的特征码
               if (d.status === 9 || common.order_status === 9 || common.status_code === 140) {
                   
                   // 修改核心状态码
                   if (d.status !== undefined) d.status = 8;
                   if (d.order_common_info) {
                       d.order_common_info.order_status = 8;
                       d.order_common_info.status_code = 130;
                       d.order_common_info.logistics_status = 40;
                   }

                   // 修改文字描述
                   if (d.order_status_desc) {
                       d.order_status_desc.status_desc = "订单已完成";
                       d.order_status_desc.subtitle = "感谢您对美团的信任，期待再次光临";
                   }

                   // 修改按钮区域
                   if (d.order_operate_area) {
                       d.order_operate_area.snd_desc = "订单已安全送达。";
                       d.order_operate_area.button_list = [
                           {
                               "title": "再来一单",
                               "code": 1001,
                               "highlight": 1,
                               "button_icon": "http://p0.meituan.net/scarlett/043781eaaa8b92e49171e9c788d67d171713.png"
                           },
                           {
                               "title": "评价",
                               "code": 2010,
                               "highlight": 1,
                               "button_icon": "http://p0.meituan.net/scarlett/5b7ca68f7df4a3a544bf6565dc84be6e2251.png"
                           }
                       ];
                   }

                   // 注入骑手信息 (防止页面因为找不到 rider 而报错或显示空白)
                   d.rider_info = {
                       "show_rider_icon": 1,
                       "rider_name": "美团众包(已送达)",
                       "rider_icon": "https://p0.meituan.net/travelcube/fd547c35a0d1479af3aec358656fcd085217.png",
                       "contact_way": [{ "phone": "13800138000", "type_text": "致电骑手", "type": 0 }]
                   };
               }
           }
       }

       $done({ body: JSON.stringify(obj) });
   } catch (e) {
       $done({ body });
   }
} else {
   $done({});
}
