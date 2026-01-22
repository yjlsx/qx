/*
[rewrite_local]
^https?:\/\/i\.waimai\.meituan\.com\/openh5\/order\/manager\/v3\/(detail|status) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js

[mitm]
hostname = i.waimai.meituan.com, wx-shangou.meituan.com
*/


/**
 * 美团订单全状态伪装脚本 (QX加强版)
 * 功能：状态伪装 + 虚拟骑手注入 + 评价/退款按钮强制显示
 */

let body = $response.body;
if (body) {
    let obj = JSON.parse(body);

    if (obj.data && (obj.data.status === 9 || (obj.data.order_common_info && obj.data.order_common_info.order_status === 9))) {
        
        // 1. 核心状态码：取消 -> 完成
        if (obj.data.status) obj.data.status = 8;
        if (obj.data.order_common_info) {
            obj.data.order_common_info.order_status = 8;
            obj.data.order_common_info.status_code = 130;
            obj.data.order_common_info.logistics_status = 40; // 设置为已送达状态
        }

        // 2. 注入虚拟骑手信息 (解决“没有致电骑手”的问题)
        obj.data.rider_info = {
            "show_rider_icon": 1,
            "rider_name": "配送员(已送达)",
            "rider_icon": "https://p0.meituan.net/travelcube/fd547c35a0d1479af3aec358656fcd085217.png",
            "contact_way": [{
                "phone": "13800000000",
                "type_text": "致电骑手",
                "type": 0,
                "icon": "http://p0.meituan.net/scarlett/a076ee400b63eaa89435b751f839c7ec2893.png"
            }]
        };

        // 3. 强制重写按钮区域 (解决“没有评价”的问题)
        if (obj.data.order_operate_area) {
            obj.data.order_status_desc.status_desc = "订单已完成";
            obj.data.order_operate_area.snd_desc = "感谢您对美团外卖的信任，期待再次光临。";
            
            // 构造完整的按钮列表
            obj.data.order_operate_area.button_list = [
                { "title": "申请退款", "code": 2027, "highlight": 0, "button_icon": "http://p1.meituan.net/scarlett/d963e924f3a0947f056a97572c2aa1e13192.png" },
                { "title": "再来一单", "code": 1001, "highlight": 1, "button_icon": "http://p0.meituan.net/scarlett/043781eaaa8b92e49171e9c788d67d171713.png" },
                { "title": "评价", "code": 2010, "highlight": 1, "button_icon": "http://p0.meituan.net/scarlett/5b7ca68f7df4a3a544bf6565dc84be6e2251.png" },
                { "title": "致电商家", "code": 2006, "highlight": 0, "button_icon": "http://p1.meituan.net/scarlett/0215b074ed74edb14298615f1997ee0f2761.png" },
                { "title": "致电骑手", "code": 2025, "highlight": 0, "button_icon": "http://p0.meituan.net/scarlett/a076ee400b63eaa89435b751f839c7ec2893.png" }
            ];

            // 补全准时宝
            obj.data.order_operate_area.insurance = {
                "show": 1,
                "insurance_name": "准时宝",
                "tips": "保障已结束",
                "insurance_icon": "http://p0.meituan.net/aichequan/ea8cced0d6158ed2b7b71f9cf6e66ee92128.png"
            };
        }

        // 4. 详情页底部的“再来一单”列表
        if (obj.data.button_list) {
            obj.data.button_list = [{ "code": 1001, "title": "再来一单", "highlight": 1 }];
        }
    }

    $done({ body: JSON.stringify(obj) });
} else {
    $done({});
}
