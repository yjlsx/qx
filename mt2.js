/**
 * @name Meituan Order Detail Modifier
[rewrite_local]
^https:\/\/wx-shangou\.meituan\.com\/quickbuy\/v1\/order\/detail url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt2.js

[mitm]
hostname = wx-shangou.meituan.com
 */

// --- 配置区域：在此修改你想要显示的内容 ---
const CONFIG = {
    poiName: "果然·水果农场（关上店)",          // 店铺名称
    orderId: "601954784865721548",     // 订单号 (建议保留数字位长)
    orderTime: "2026-01-18 11:03:12",  // 下单时间 (格式: YYYY-MM-DD HH:mm:ss)
    arrivalText: "预计 11:35 送达"       // 配送状态/预计到达时间
};

// --- 逻辑处理 ---
let obj = JSON.parse($response.body);

if (obj.data) {
    // 1. 修改店铺名称
    if (obj.data.poi_name) {
        obj.data.poi_name = CONFIG.poiName;
    }
    
    // 2. 修改订单 ID
    if (obj.data.id) {
        obj.data.id = CONFIG.orderId;
    }

    // 3. 修改下单时间 (需要将日期转为 Unix 时间戳)
    if (obj.data.order_time) {
        let unixTimestamp = Math.floor(new Date(CONFIG.orderTime).getTime() / 1000);
        if (!isNaN(unixTimestamp)) {
            obj.data.order_time = unixTimestamp;
        }
    }

    // 4. 修改期望送达时间文本
    if (obj.data.expected_arrival_time) {
        obj.data.expected_arrival_time = CONFIG.arrivalText;
    }
}

$done({ body: JSON.stringify(obj) });