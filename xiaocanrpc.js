/*

[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-request-header  https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/xiaocanrpc.js

[mitm]
hostname = gw.xiaocantech.com


*/



const headers = $request.headers;
let bodyObj = JSON.parse($request.body || "{}");
const mName = headers['methodname'] || headers['Methodname'] || "";

// 目标接口定义
const isList = mName.indexOf("GetStorePromotionList") > -1;
const isSearch = mName.indexOf("SearchStorePromotionList") > -1;

if (isList || isSearch) {
    const type = isList ? "首页列表" : "关键词搜索";
    
    // 1. 执行参数重写 (利用你提供的合法静态签名)
    // 提示：如果此签名失效导致没数据，需手动抓新的 Ashe 替换此处
    headers['X-Garen'] = '1769828696477'; 
    headers['X-Ashe'] = isSearch ? '432f00a2399e05589857bcafd8a42247' : '1346238844208eece8754add1a65817c';
    headers['X-Nami'] = isSearch ? '43C839B344A4A344' : 'B851A63B7F4A2B5';

    // 2. 抹除身份信息
    delete headers['X-Sivir'];
    headers['X-Vayne'] = '0';
    headers['x-Teemo'] = '0';
    bodyObj["silk_id"] = 0;

    // 3. 发送实时通知
    const keyword = isSearch ? ` [${bodyObj.keyword || "未知"}]` : "";
    $notify("小蚕重写助手", `已成功劫持${type}${keyword}`, "身份已转为游客，正在破解账号限制...");

    console.log(` [${type}] 重写成功 | 接口: ${mName}`);

    $done({
        headers: headers,
        body: JSON.stringify(bodyObj)
    });
} else {
    // 抢名额等接口不通知，直接跳过
    $done({});
}
