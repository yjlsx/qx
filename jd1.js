/*
[rewrite_local]
# 1. 京东订单详情重写 (匹配 orderDetail 接口)
# 推荐使用 functionId 匹配，更加稳定
^https?:\/\/api\.m\.jd\.com\/client\.action\?functionId=orderDetail url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/jd1.js


# 2. 兼容旧的URL匹配方式 (如果需要)
^https?:\/\/api\.m\.jd\.com\/client\.action\?t=\d+&loginType=2&loginWQBiz=golden-trade&appid=m_core&client=iPhone&clientVersion=&build url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/jd1.js



[mitm]
hostname = api.m.jd.com
*/

// Quantumult X Script: jd_detail_time_id_only.js
// JD 订单详情页 (orderDetail) 仅修改时间和订单号

// ===================================
// ⚙️ 用户可配置项 (订单详情页)
// ===================================

const DETAIL_NEW_ORDER_ID = "3338705668140826"; // 详情页显示的新订单号

const DETAIL_NEW_DATE_BASE = "2026-01-20";  // 新的日期
const DETAIL_NEW_TIME_BASE = "00:18:42";   // 新的基本时间 (用于下单时间)
const DETAIL_NEW_PAY_TIME = "2026-01-20 00:19:23"; // 新的支付时间
const DETAIL_NEW_COMPLETE_TIME = "2026-01-20 00:54:18"; // 新的订单完成/送达时间
const DETAIL_NEW_EXPECTED_DELIVERY_TIME = "2026-01-20 00:50-01:05"; // 新的期望配送时间
const DETAIL_NEW_CURRENT_TIME = "2026-01-20 00:19:46"; // 模拟服务器返回的当前时间

// ===================================
// 🛠️ 脚本主体
// ===================================

let obj;
try {
    obj = JSON.parse($response.body);
} catch (e) {
    console.log("JSON parsing error: " + e);
    $done({});
    return;
}

// 检查是否为订单详情接口
const data = obj && obj.body;
const isOrderDetail = data && data.orderCommonVo;

if (!isOrderDetail) {
    // 不是订单详情接口，直接放行
    console.log("⚠️ [JD Detail Only] Response structure not recognized as OrderDetail. Exiting.");
    $done({});
    return;
}

console.log(`✅ [JD Detail Only] START: Modifying Order ID to ${DETAIL_NEW_ORDER_ID} and Date to ${DETAIL_NEW_DATE_BASE}.`);


// --- 1. 订单号和时间修改 ---

// A. 进度列表 ProgressList (物流/地址)
if (data.progressList && data.progressList.length > 0) {
    if (data.progressList[0] && data.progressList[0].tip) {
        data.progressList[0].tip = DETAIL_NEW_COMPLETE_TIME; // 修改第一个进度时间
    }
}

// B. 订单通用信息 orderCommonVo
if (data.orderCommonVo) {
    data.orderCommonVo.dateSubmit = `${DETAIL_NEW_DATE_BASE} ${DETAIL_NEW_TIME_BASE}`;
    data.orderCommonVo.orderCompleteTime = DETAIL_NEW_COMPLETE_TIME;
    console.log("-> orderCommonVo dateSubmit/orderCompleteTime modified.");
}

// C. 汇总信息 SummaryList (用户可见的订单信息汇总)
if (data.summaryList) {
    data.summaryList.forEach(item => {
        if (item.title === "订单编号：") {
            item.content = DETAIL_NEW_ORDER_ID;
        } else if (item.title === "下单时间：") {
            item.content = `${DETAIL_NEW_DATE_BASE} ${DETAIL_NEW_TIME_BASE}`;
        } else if (item.title === "支付时间：") {
            item.content = DETAIL_NEW_PAY_TIME;
        } else if (item.title === "期望配送时间：") {
            item.content = DETAIL_NEW_EXPECTED_DELIVERY_TIME;
        }
        // 保持门店名称不变，除非用户配置中需要修改
    });
    console.log("-> SummaryList Order ID and Times modified.");
}

// D. 基础信息 baseInfo (服务器当前时间)
if (data.baseInfo) {
    data.baseInfo.currentTime = DETAIL_NEW_CURRENT_TIME; 
    console.log("-> baseInfo currentTime modified.");
}

console.log("✨ [JD Detail Only] SCRIPT COMPLETED.");
$done({body: JSON.stringify(obj)});