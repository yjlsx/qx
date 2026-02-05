/*
[rewrite_local]
^https?:\/\/i\.waimai\.meituan\.com\/openh5\/order\/(list|manager\/v3\/detail|manager\/v3\/status) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js

[mitm]
hostname = i.waimai.meituan.com, wx-shangou.meituan.com
*/




let url = $request.url;
let body = $response.body;

if (body) {
    let obj = JSON.parse(body);
    // --- 1. 处理订单列表页 (order/list) ---
    if (url.includes("order/list")) {
        if (obj.data && obj.data.orderList) {
            obj.data.orderList.forEach(order => {
                // 强制将所有“已取消”文字改为“已完成”
                if (order.orderStatusStr === "已取消") {
                    order.orderStatusStr = "已完成";
                    order.payStatus = 3; // 支付状态改为已支付
                    
                    // 补全评价按钮（如果列表中没有评价按钮则加上）
                    let hasCommentBtn = order.buttonList.some(b => b.type === 2010);
                    if (!hasCommentBtn) {
                        order.buttonList.push({
                            "title": "  评价  ",
                            "type": 2010,
                            "isHighlight": 1
                        });
                    }
                }
            });
        }
    }

  // --- 2. 处理订单详情页 (order/manager/v3/detail & status) ---
    if (url.includes("v3/detail") || url.includes("v3/status")) {
        if (obj.data) {
            // 判断是否为取消状态 (9)
            let isCancel = (obj.data.status === 9 || (obj.data.order_common_info && obj.data.order_common_info.order_status === 9));

    if (isCancel) {
                // 修改核心状态码
                if (obj.data.status) obj.data.status = 8;
                if (obj.data.order_common_info) {
                    obj.data.order_common_info.order_status = 8;
                    obj.data.order_common_info.status_code = 130;
                    obj.data.order_common_info.logistics_status = 40;
                }
// 修改状态栏描述
                if (obj.data.order_status_desc) {
                    obj.data.order_status_desc.status_desc = "订单已完成";
                }

                // 注入虚拟骑手 (解决无骑手信息问题)
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
 // 重写操作区按钮、文案、准时宝
                if (obj.data.order_operate_area) {
                    obj.data.order_operate_area.snd_desc = "感谢您对美团外卖的信任，期待再次光临。";
                    obj.data.order_operate_area.button_list = [
                        { "title": "申请退款", "code": 2027, "highlight": 0, "button_icon": "http://p1.meituan.net/scarlett/d963e924f3a0947f056a97572c2aa1e13192.png" },
                        { "title": "再来一单", "code": 1001, "highlight": 1, "button_icon": "http://p0.meituan.net/scarlett/043781eaaa8b92e49171e9c788d67d171713.png" },
                        { "title": "  评价  ", "code": 2010, "highlight": 1, "button_icon": "http://p0.meituan.net/scarlett/5b7ca68f7df4a3a544bf6565dc84be6e2251.png" },
                        { "title": "致电商家", "code": 2006, "highlight": 0, "button_icon": "http://p1.meituan.net/scarlett/0215b074ed74edb14298615f1997ee0f2761.png" },
                        { "title": "致电骑手", "code": 2025, "highlight": 0, "button_icon": "http://p0.meituan.net/scarlett/a076ee400b63eaa89435b751f839c7ec2893.png" }
                    ];
                    obj.data.order_operate_area.insurance = {
                        "show": 1,
                        "insurance_name": "准时宝",
                        "tips": "保障已结束",
                        "insurance_icon": "http://p0.meituan.net/aichequan/ea8cced0d6158ed2b7b71f9cf6e66ee92128.png"
                    };
                }
            }
        }
    }