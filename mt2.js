
/*
[rewrite_local]
# 美团外卖订单
^https?:\/\/wx-shangou\.meituan\.com\/quickbuy\/v1\/order\/detail\?.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js

[mitm]
# 确保包含 wx-shangou.meituan.com 才能解密！
hostname = i.waimai.meituan.com, *.meituan.com, wx-shangou.meituan.com

*/


// ----------------------------------------------------------------------
// 【用户配置区 - 只需修改以下两个变量】
// ----------------------------------------------------------------------

// 1. **自定义订单号 (id):** //    请设置为数字字符串，以避免 JavaScript Number 精度丢失。
const CUSTOM_ORDER_ID = "601867382174057863";

// 2. **自定义订单时间 (order_time):** //    格式必须为 YYYY-MM-DD HH:MM:SS。
const CUSTOM_ORDER_DATETIME = "2025-11-17 19:04:12"; 

// ----------------------------------------------------------------------
// 【脚本逻辑区】
// ----------------------------------------------------------------------

/**
 * 将 YYYY-MM-DD HH:MM:SS 格式的字符串转换为秒级 Unix 时间戳。
 */
function dateToUnixTimestamp(datetimeStr) {
    // 替换 '-' 为 '/' 以确保在大多数 JS 环境中正确解析
    const date = new Date(datetimeStr.replace(/-/g, '/'));
    
    if (isNaN(date.getTime())) {
        console.error(`[OrderDetailModify] 日期解析失败，请检查格式: ${datetimeStr}`);
        return 0;
    }
    
    // 返回秒级 Unix 时间戳
    return Math.floor(date.getTime() / 1000);
}

const NEW_ORDER_TIME = dateToUnixTimestamp(CUSTOM_ORDER_DATETIME);

let body = $response.body;

try {
    let obj = JSON.parse(body);
    
    if (obj && obj.code === 0 && obj.data) {
        
        // 1. 修改 data.id (订单号)
        // 关键：直接赋值字符串，避免大数精度丢失
        obj.data.id = CUSTOM_ORDER_ID; 
        
        // 2. 修改 data.order_time (订单时间戳)
        obj.data.order_time = NEW_ORDER_TIME;
        
        console.log(`[OrderDetailModify] 订单号: ${CUSTOM_ORDER_ID}, 时间: ${CUSTOM_ORDER_DATETIME} 已修改成功。`);

        body = JSON.stringify(obj, null, 2);
        $done({body});
        
    } else {
        console.log('[OrderDetailModify] 响应结构不符合预期或代码非0，未修改。');
        $done({});
    }

} catch (e) {
    console.error(`[OrderDetailModify] 发生JS运行时异常: ${e.name} - ${e.message}`);
    $done({});
}
