@ -0,0 +1,119 @@
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

// 1. **自定义订单号 (id):** //    请设置为一个数字字符串或大整数，以替换响应体中的 "id" 字段。
const CUSTOM_ORDER_ID = "601867382174057863";

// 2. **自定义订单时间 (order_time):**
//    请设置为您想要的订单日期和时间。格式必须为 YYYY-MM-DD HH:MM:SS。
//    脚本会根据此设置自动计算出 Unix 时间戳（秒）。
//    注意：请使用本地时区。
const CUSTOM_ORDER_DATETIME = "2025-11-17 19:04:12"; 

// ----------------------------------------------------------------------
// 【脚本逻辑区 - 一般无需修改】
// ----------------------------------------------------------------------

function dateToUnixTimestamp(datetimeStr) {
    // 将 YYYY-MM-DD HH:MM:SS 格式的字符串转换为 Date 对象
    // 注意：Date.parse() 默认按照本地时区解析
    const date = new Date(datetimeStr.replace(/-/g, '/'));
    
    // 返回秒级 Unix 时间戳
    return Math.floor(date.getTime() / 1000);
}

// 转换时间配置为 Unix 时间戳（秒）
const NEW_ORDER_TIME = dateToUnixTimestamp(CUSTOM_ORDER_DATETIME);

// 获取当前响应体
let body = $response.body;

try {
    // 将响应体解析为 JSON 对象
    let obj = JSON.parse(body);
    
    // 检查响应状态码和数据结构
    if (obj && obj.code === 0 && obj.data) {
        
        // 1. 修改 data.id (订单号)
        obj.data.id = parseInt(CUSTOM_ORDER_ID, 10);
        console.log(`[OrderDetailModify] 订单号(id)已修改为: ${CUSTOM_ORDER_ID}`);
        
        // 2. 修改 data.order_time (订单时间戳)
        obj.data.order_time = NEW_ORDER_TIME;
        console.log(`[OrderDetailModify] 订单时间已修改为: ${CUSTOM_ORDER_DATETIME} (时间戳: ${NEW_ORDER_TIME})`);
        
        // 重新将修改后的 JSON 对象转换为字符串
        body = JSON.stringify(obj, null, 2);
        
        // 返回修改后的响应体
        $done({body});
        
    } else {
        // 非预期响应结构，不做修改
        console.log('[OrderDetailModify] 响应结构不符合预期，未修改。');
        $done({});
    }

} catch (e) {
    // 解析 JSON 失败，不做修改
    console.log(`[OrderDetailModify] JSON 解析失败: ${e.message}`);
    $done({});
}