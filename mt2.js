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

       if (url.includes("status") || url.includes("detail") || url.includes("list")) {
           if (obj.data) {
               let d = obj.data;
               let common = d.order_common_info || {};
               
               // 判断是否需要处理（取消态 9/140 或 已经处理过的完成态 8/130）
               if (d.status === 9 || common.order_status === 9 || common.status_code === 140 || common.status_code === 130) {
                   
                   // 1. 强制数据转义为“已完成”
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

                   // 2. 核心：精准重组四个按钮
                   if (d.order_operate_area) {
                       d.order_operate_area.snd_desc = "感谢您对美团外卖的信任，期待再次光临。";
                       d.order_operate_area.button_list = [
                           {
                               "title": "申请退款",
                               "code": 2027,
                               "highlight": 0,
                               "action": 0,
                               "change_icon_with_code": true,
                               "button_icon": "http://p1.meituan.net/scarlett/d963e924f3a0947f056a97572c2aa1e13192.png"
                           },
                           {
                               "title": "再来一单",
                               "code": 1001,
                               "highlight": 1,
                               "action": 0,
                               "change_icon_with_code": true,
                               "button_icon": "http://p0.meituan.net/scarlett/043781eaaa8b92e49171e9c788d67d171713.png"
                           },
                           {
                               "title": "致电商家",
                               "code": 2006,
                               "highlight": 0,
                               "action": 0,
                               "change_icon_with_code": true,
                               "button_icon": "http://p1.meituan.net/scarlett/0215b074ed74edb14298615f1997ee0f2761.png"
                           },
                           {
                               "title": "致电骑手",
                               "code": 2025,
                               "highlight": 0,
                               "action": 0,
                               "change_icon_with_code": true,
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
