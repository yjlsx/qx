/*
[rewrite_local]
^https?:\/\/.*meituan\.com\/.*order\/(list|manager\/v3\/detail|status) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js


[mitm]
hostname = i.waimai.meituan.com, wx-shangou.meituan.com
*/




let url = $request.url;
let body = $response.body;

if (body) {
   try {
       let obj = JSON.parse(body);

       // --- 1. 处理订单列表页 (重点修复) ---
       if (url.includes("order/list")) {
           if (obj.data && obj.data.orderList) {
               obj.data.orderList.forEach(order => {
                   // 只要匹配到取消状态 (9) 或 取消文字
                   if (order.orderStatus === 9 || order.orderStatusStr === "已取消") {
                       // 1. 修改核心状态码
                       order.orderStatus = 8;         // 完成态
                       order.orderStatusStr = "已完成"; // 状态文字
                       order.payStatus = 3;           // 支付状态改为已支付
                       
                       // 2. 修改列表页显示的二级描述 (比如原本显示：支付超时，订单已取消)
                       if (order.statusDesc) {
                           order.statusDesc = "订单已安全送达";
                       }
                       
                       // 3. 重塑列表页按钮 (列表页通常只留“再来一单”和“评价”)
                       order.buttonList = [
                           {
                               "title": "再来一单",
                               "type": 1001,
                               "isHighlight": 1
                           },
                           {
                               "title": "评价",
                               "type": 2010,
                               "isHighlight": 0
                           }
                       ];
                   }
               });
           }
       }

       // --- 2. 处理详情页/状态页 (v3/status & v3/detail) ---
       if (url.includes("status") || url.includes("detail")) {
           if (obj.data) {
               let d = obj.data;
               let common = d.order_common_info || {};
               
               // 兼容逻辑：处理原始取消态或已被修改过的完成态
               if (d.status === 9 || common.order_status === 9 || common.status_code === 140 || common.status_code === 130) {
                   
                   if (d.status !== undefined) d.status = 8;
                   if (common) {
                       common.order_status = 8;
                       common.status_code = 130;
                       common.logistics_status = 40;
                       common.pay_status = 3;
                   }

                   if (d.order_status_desc) {
                       d.order_status_desc.status_desc = "订单已完成";
                       d.order_status_desc.subtitle = "感谢您对美团外卖的信任，期待再次光临。";
                   }

                   if (d.order_operate_area) {
                       d.order_operate_area.snd_desc = "感谢您对美团外卖的信任，期待再次光临。";
                       d.order_operate_area.button_list = [
                           {
                               "title": "申请退款", "code": 2027, "highlight": 0, "action": 0, "change_icon_with_code": true,
                               "button_icon": "http://p1.meituan.net/scarlett/d963e924f3a0947f056a97572c2aa1e13192.png"
                           },
                           {
                               "title": "再来一单", "code": 1001, "highlight": 1, "action": 0, "change_icon_with_code": true,
                               "button_icon": "http://p0.meituan.net/scarlett/043781eaaa8b92e49171e9c788d67d171713.png"
                           },
                           {
                               "title": "致电商家", "code": 2006, "highlight": 0, "action": 0, "change_icon_with_code": true,
                               "button_icon": "http://p1.meituan.net/scarlett/0215b074ed74edb14298615f1997ee0f2761.png"
                           },
                           {
                               "title": "致电骑手", "code": 2025, "highlight": 0, "action": 0, "change_icon_with_code": true,
                               "button_icon": "http://p0.meituan.net/scarlett/a076ee400b63eaa89435b751f839c7ec2893.png"
                           }
                       ];
                   }
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
