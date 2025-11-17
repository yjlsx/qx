
/*
[rewrite_local]
# 美团外卖订单
^https?:\/\/wx-shangou\.meituan\.com\/quickbuy\/v1\/order\/detail\?.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js

[mitm]
# 确保包含 wx-shangou.meituan.com 才能解密！
hostname = i.waimai.meituan.com, *.meituan.com, wx-shangou.meituan.com

*/


// 
// 注意：此文件不应包含 [rewrite_local] 或 [mitm] 配置段。
// 那些配置段应该放在您的 Quantumult X 主配置文件中。

// ----------------------------------------------------------------------
// 【用户配置区 - 只需修改以下两个变量】
// ----------------------------------------------------------------------

// 1. **自定义订单号 (id):** //    请设置为一个数字字符串。直接赋值字符串是为了避免 JavaScript Number 类型的精度丢失。

const CUSTOM_ORDER_ID = "601867382174057863";

// 2. **自定义订单时间 (order_time):**
//    请设置为您想要的订单日期和时间。格式必须为 YYYY-MM-DD HH:MM:SS。

const CUSTOM_ORDER_DATETIME = "2025-11-17 19:04:12"; 

// ----------------------------------------------------------------------
// 【脚本逻辑区 - 一般无需修改】
// ----------------------------------------------------------------------

/**
 * 将 YYYY-MM-DD HH:MM:SS 格式的字符串转换为秒级 Unix 时间戳。
 * * @param {string} datetimeStr - 格式为 YYYY-MM-DD HH:MM:SS 的日期时间字符串。
 * @returns {number} 秒级 Unix 时间戳。
 */
function dateToUnixTimestamp(datetimeStr) {
    // 替换 '-' 为 '/' 以确保在大多数 JS 环境中正确解析
    const date = new Date(datetimeStr.replace(/-/g, '/'));
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
        console.error(`[OrderDetailModify] 日期解析失败，请检查格式: ${datetimeStr}`);
        return 0; // 返回 0 或原始时间，避免程序崩溃
    }
    
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
        // 关键修复：直接赋值字符串，避免大数精度丢失
        // 理论上，美团 API 期望的是数字，但直接赋值字符串能避免 JavaScript 精度问题
        obj.data.id = CUSTOM_ORDER_ID; 
        console.log(`[OrderDetailModify] 订单号(id)已修改为: ${CUSTOM_ORDER_ID} (保留精度)`);
        
        // 2. 修改 data.order_time (订单时间戳)
        obj.data.order_time = NEW_ORDER_TIME;
        console.log(`[OrderDetailModify] 订单时间已修改为: ${CUSTOM_ORDER_DATETIME} (时间戳: ${NEW_ORDER_TIME})`);
        
        // 重新将修改后的 JSON 对象转换为字符串
        // 使用 null, 2 进行格式化输出，方便调试
        body = JSON.stringify(obj, null, 2);
        
        // 返回修改后的响应体
        $done({body});
        
    } else {
        // 非预期响应结构，不做修改
        console.log('[OrderDetailModify] 响应结构不符合预期或代码非0，未修改。');
        $done({});
    }

} catch (e) {
    // 捕获 JSON 解析或其他 JS 运行时错误
    console.error(`[OrderDetailModify] 发生JS运行时异常: ${e.name} - ${e.message}`);
    $done({});
}
