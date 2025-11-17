
/*
####################################################################
# 配置区
####################################################################

[rewrite_local]
# 1. 订单详情接口 (用于展示订单ID和时间)
^https?:\/\/wx-shangou\.meituan\.com\/quickbuy\/v1\/order\/detail\?.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js


# 2. 订单列表接口 (用于修改列表中的订单ID和时间)
^https?:\/\/i\.waimai\.meituan\.com\/openh5\/order\/list\?.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js


[mitm]
# 确保所有涉及的主机名都包含在内
hostname = i.waimai.meituan.com, *.meituan.com, wx-shangou.meituan.com

*/


// 文件名: mt2.js (最高兼容性版本 - 列表页仅修改 mtOrderViewId)

// ----------------------------------------------------------------------
// 【用户配置区 - 请修改这里的三个变量的值】
// ----------------------------------------------------------------------

var CUSTOM_ORDER_ID = "601867382174057863"; 
var CUSTOM_ORDER_DATETIME = "2025-11-17 19:04:12"; 
var TARGET_OLD_ID = "601867372177026569"; 

// ----------------------------------------------------------------------
// 【工具函数】
// ----------------------------------------------------------------------

function dateToUnixTimestamp(datetimeStr) {
    // 将日期字符串转换为 Unix 时间戳 (秒)
    const date = new Date(datetimeStr.replace(/-/g, '/'));
    if (isNaN(date.getTime())) return 0;
    return Math.floor(date.getTime() / 1000);
}

var NEW_ORDER_TIME_SEC = dateToUnixTimestamp(CUSTOM_ORDER_DATETIME);
var NEW_ORDER_TIME_STR = CUSTOM_ORDER_DATETIME.substring(0, 16); 

var body = $response.body;
var url = $request.url;

try {
    var obj = JSON.parse(body);
    if (!obj || obj.code !== 0 || !obj.data) {
        $done({});
        return;
    }
    
    // --- 逻辑判断和执行 ---
    
    if (url.includes("order/detail")) {
        // 1. 订单详情页接口修改逻辑：用于解决“订单号未修改”的问题，同时修改所有可能的字段
        obj.data.id = CUSTOM_ORDER_ID;             
        obj.data.orderId = CUSTOM_ORDER_ID;        
        obj.data.orderViewId = CUSTOM_ORDER_ID;    
        obj.data.display_id = CUSTOM_ORDER_ID;     
        
        // 订单时间修改 (已确认生效)
        obj.data.order_time = NEW_ORDER_TIME_SEC;  
        
        console.log(`[MT] 详情页ID/时间已修改: ${CUSTOM_ORDER_ID}`);

    } else if (url.includes("order/list")) {
        // 2. 订单列表页接口修改逻辑 (i.waimai.meituan.com)
        if (obj.data.orderList) {
            for (let order of obj.data.orderList) {
                
                // 仅修改 TARGET_OLD_ID 的订单
                if (order.orderId === TARGET_OLD_ID) {
                    
                    // *** 关键：只修改用于显示的 mtOrderViewId ***
                    order.mtOrderViewId = CUSTOM_ORDER_ID; 
                    
                    // 修改时间
                    order.orderTimeSec = NEW_ORDER_TIME_SEC;
                    order.orderTime = NEW_ORDER_TIME_STR;
                    
                    console.log(`[MT] 列表ID (${TARGET_OLD_ID}) 视图ID/时间已成功替换`);
                }
            }
        }
    }
    
    // 重新打包 JSON 响应体
    body = JSON.stringify(obj, null, 2);
    $done({body});

} catch (e) {
    console.log(`[MT] 运行时异常: ${e.name} - ${e.message}`);
    $done({});
}
