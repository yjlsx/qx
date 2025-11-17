
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



// ----------------------------------------------------------------------
// 【用户配置区 - 请根据您的需求修改这里的三个变量】
// ----------------------------------------------------------------------

// 确保使用 var 关键字，以避免在某些脚本环境中的作用域 (ReferenceError) 问题
var CUSTOM_ORDER_ID = "601867382174057863"; 

// 2. **新的自定义订单时间 (用于显示):** 格式必须为 YYYY-MM-DD HH:MM:SS
var CUSTOM_ORDER_DATETIME = "2025-11-17 19:04:12"; 

// 3. **要被替换的原始订单ID (列表中的):** var TARGET_OLD_ID = "601867372177026569"; 

// ----------------------------------------------------------------------
// 【脚本逻辑区 - 无需修改】
// ----------------------------------------------------------------------

function dateToUnixTimestamp(datetimeStr) {
    // 将日期字符串转换为 Unix 时间戳 (秒)
    const date = new Date(datetimeStr.replace(/-/g, '/'));
    if (isNaN(date.getTime())) return 0;
    return Math.floor(date.getTime() / 1000);
}

// 注意：这里使用 var 是因为配置变量已改为 var
var NEW_ORDER_TIME_SEC = dateToUnixTimestamp(CUSTOM_ORDER_DATETIME);
// 提取到分钟的字符串，例如 "2025-11-17 19:04"
var NEW_ORDER_TIME_STR = CUSTOM_ORDER_DATETIME.substring(0, 16); 

var body = $response.body;
var url = $request.url;

try {
    var obj = JSON.parse(body);
    // 检查响应数据是否有效
    if (!obj || obj.code !== 0 || !obj.data) {
        $done({});
        return;
    }
    
    // --- 逻辑判断和执行 ---
    
    if (url.includes("order/detail")) {
        // 1. 订单详情页接口修改逻辑 (wx-shangou.meituan.com)
        obj.data.id = CUSTOM_ORDER_ID;             // 订单号修改
        obj.data.order_time = NEW_ORDER_TIME_SEC;  // 订单时间修改
        console.log(`[MT] 详情页ID/时间已修改: ${CUSTOM_ORDER_ID}`);

    } else if (url.includes("order/list")) {
        // 2. 订单列表页接口修改逻辑 (i.waimai.meituan.com)
        if (obj.data.orderList) {
            for (let order of obj.data.orderList) {
                
                // 仅修改目标旧 ID 的订单
                if (order.orderId === TARGET_OLD_ID) {
                    
                    // 关键：只修改 mtOrderViewId (用于列表显示)
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
    // *** 修复了 console.error 异常：使用 console.log 代替 ***
    console.log(`[MT] 运行时异常: ${e.name} - ${e.message}`);
    $done({});
}
