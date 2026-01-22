/*
[rewrite_local]
^https?:\/\/i\.waimai\.meituan\.com\/openh5\/order\/manager\/v3\/(detail|status) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js

[mitm]
hostname = i.waimai.meituan.com, wx-shangou.meituan.com
*/


let body = $response.body;
if (body) {
    let obj = JSON.parse(body);

    if (obj.data) {
        // 1. 处理 v3/detail 接口逻辑
        if (obj.data.status === 9) {
            obj.data.status = 8;
            obj.data.order_delivery_content1 = "订单已送达";
            obj.data.order_delivery_content2 = "感谢您对美团外卖的信任，期待再次光临。";
            if (obj.data.button_list) {
                obj.data.button_list = [
                    { "code": 1001, "title": "再来一单", "highlight": 1 }
                ];
            }
        }

        // 2. 处理 v3/status 接口逻辑
        if (obj.data.order_common_info && obj.data.order_common_info.order_status === 9) {
            // 核心状态码
            obj.data.order_common_info.order_status = 8;
            obj.data.order_common_info.status_code = 130;
            
            // 文案修改
            if (obj.data.order_status_desc) {
                obj.data.order_status_desc.status_desc = "订单已完成";
            }
            if (obj.data.order_operate_area) {
                obj.data.order_operate_area.snd_desc = "感谢您对美团外卖的信任，期待再次光临。";
            }
        }
    }
    
    $done({ body: JSON.stringify(obj) });
} else {
    $done({});
}
