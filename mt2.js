/*
[rewrite_local]
^https?:\/\/(i\.waimai|wx-shangou)\.meituan\.com\/(openh5\/order|quickbuy\/v3\/order)\/(list|manager\/v3\/detail|status) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js

[mitm]
hostname = i.waimai.meituan.com, wx-shangou.meituan.com
*/




let url = $request.url;
let body = $response.body;

if (body) {
   try {
       let obj = JSON.parse(body);

       // --- 1. 处理订单列表页 (order/list) ---
       if (url.indexOf("order/list") !== -1) {
           if (obj.data && obj.data.orderList) {
               obj.data.orderList.forEach(order => {
                   if (order.orderStatusStr === "已取消" || order.orderStatus === 9) {
                       order.orderStatusStr = "已完成";
                       order.orderStatus = 8;
                       order.payStatus = 3;
                       
                       // 补全评价按钮
                       if (order.buttonList) {
                           let hasCommentBtn = order.buttonList.some(b => b.type === 2010 || b.code === 2010);
                           if (!hasCommentBtn) {
                               order.buttonList.push({
                                   "title": "评价",
                                   "type": 2010,
                                   "isHighlight": 1
                               });
                           }
                       }
                   }
               });
           }
       }

       // --- 2. 处理订单详情页/状态页 (detail & status) ---
       if (url.indexOf("status") !== -1 || url.indexOf("detail") !== -1) {
           if (obj.data) {
               let commonInfo = obj.data.order_common_info;
               let statusDesc = obj.data.order_status_desc;
               let operateArea = obj.data.order_operate_area;

               // 判断是否为“已取消”状态 (通常 status 为 9 或 status_code 为 140)
               let isCancel = (
                   obj.data.status === 9 ||
                   (commonInfo && (commonInfo.order_status === 9 || commonInfo.status_code === 140)) ||
                   (statusDesc && statusDesc.status_desc === "订单已取消")
               );

               if (isCancel) {
                   // A. 修改核心状态码为“已完成” (8)
                   if (obj.data.status !== undefined) obj.data.status = 8;
                   if (commonInfo) {
                       commonInfo.order_status = 8;
                       commonInfo.status_code = 130; // 已完成状态码
                       commonInfo.logistics_status = 40; // 模拟已送达
                   }

                   // B. 修改顶部文案
                   if (statusDesc) {
                       statusDesc.status_desc = "订单已完成";
                       statusDesc.subtitle = "感谢您对美团的信任，期待再次光临";
                   }

                   // C. 注入虚拟骑手信息
                   obj.data.rider_info = {
                       "show_rider_icon": 1,
                       "rider_name": "美团众包(已送达)",
                       "rider_icon": "https://p0.meituan.net/travelcube/fd547c35a0d1479af3aec358656fcd085217.png",
                       "contact_way": [{
                           "phone": "13800138000",
                           "type_text": "致电骑手",
                           "type": 0,
                           "icon": "http://p0.meituan.net/scarlett/a076ee400b63eaa89435b751f839c7ec2893.png"
                       }]
                   };

                   // D. 重写操作区按钮 (增加评价、再来一单)
                   if (operateArea) {
                       operateArea.snd_desc = "订单已安全送达。";
                       operateArea.button_list = [
                           { "title": "再来一单", "code": 1001, "highlight": 1, "button_icon": "http://p0.meituan.net/scarlett/043781eaaa8b92e49171e9c788d67d171713.png" },
                           { "title": "评价", "code": 2010, "highlight": 1, "button_icon": "http://p0.meituan.net/scarlett/5b7ca68f7df4a3a544bf6565dc84be6e2251.png" },
                           { "title": "致电商家", "code": 2006, "highlight": 0, "button_icon": "http://p1.meituan.net/scarlett/0215b074ed74edb14298615f1997ee0f2761.png" }
                       ];
                   }
               }
           }
       }

       $done({ body: JSON.stringify(obj) });
   } catch (e) {
       console.log("脚本出错: " + e);
       $done({ body });
   }
} else {
   $done({});
}
