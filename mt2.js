/*
[rewrite_local]
^https?:\/\/i\.waimai\.meituan\.com\/openh5\/order\/(list|manager\/v3\/detail|manager\/v3\/status) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js

[mitm]
hostname = i.waimai.meituan.com, wx-shangou.meituan.com
*/






let url = $request.url;
let body = $response.body;

if (body) {
    try {
        let obj = JSON.parse(body);

        // --- 通用逻辑：无论是列表还是详情，只要有 status=9 就处理 ---
        if (url.includes("order/list") || url.includes("status") || url.includes("detail")) {
            
            // 1. 处理列表页 (orderList 数组)
            if (obj.data && obj.data.orderList) {
                obj.data.orderList.forEach(order => {
                    if (order.orderStatus === 9 || order.orderStatusStr === "已取消") {
                        order.orderStatus = 8;
                        order.orderStatusStr = "已完成";
                        order.payStatus = 3;
                    }
                });
            }

            // 2. 处理详情/状态页 (data 根节点)
            if (obj.data) {
                let d = obj.data;
                let common = d.order_common_info || {};

                // 强制识别取消特征
                if (d.status === 9 || common.order_status === 9 || common.status_code === 140) {
                    
                    // A. 修改核心逻辑码
                    if (d.status !== undefined) d.status = 8;
                    if (common) {
                        common.order_status = 8;      // 强制完成
                        common.status_code = 130;     // 强制完成
                        common.pay_status = 3;        // 强制已支付
                        common.logistics_status = 40; // 强制送达
                        common.actual_delivery_type = 4;
                    }

                    // B. 修改顶部文案
                    if (d.order_status_desc) {
                        d.order_status_desc.status_desc = "订单已完成";
                        d.order_status_desc.subtitle = "感谢您对美团外卖的信任，期待再次光临。";
                    }

                    // C. 强行插入/修正按钮 (申请退款, 再来一单, 致电商家, 致电骑手)
                    if (d.order_operate_area) {
                        d.order_operate_area.snd_desc = "感谢您对美团外卖的信任，期待再次光临。";
                        d.order_operate_area.button_list = [
                            { "title": "申请退款", "code": 2027, "highlight": 0, "action": 0, "change_icon_with_code": true, "button_icon": "http://p1.meituan.net/scarlett/d963e924f3a0947f056a97572c2aa1e13192.png" },
                            { "title": "再来一单", "code": 1001, "highlight": 1, "action": 0, "change_icon_with_code": true, "button_icon": "http://p0.meituan.net/scarlett/043781eaaa8b92e49171e9c788d67d171713.png" },
                            { "title": "致电商家", "code": 2006, "highlight": 0, "action": 0, "change_icon_with_code": true, "button_icon": "http://p1.meituan.net/scarlett/0215b074ed74edb14298615f1997ee0f2761.png" },
                            { "title": "致电骑手", "code": 2025, "highlight": 0, "action": 0, "change_icon_with_code": true, "button_icon": "http://p0.meituan.net/scarlett/a076ee400b63eaa89435b751f839c7ec2893.png" }
                        ];
                    }

                    // D. 清理可能导致状态回跳的 Mach 数据或变量
                    if (d.globalVariables && d.globalVariables.vars) {
                        d.globalVariables.vars = {}; 
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
