
/*
####################################################################
# 配置区
####################################################################

[rewrite_local]
^https:\/\/wmapp-api\.waimaimingtang\.com\/fission\/account\/balance\/ url script-response-body wm_balance.js

[mitm]
hostname = wmapp-api.waimaimingtang.com


*/

/*
 * 修改外卖明堂账户余额为 0
 */

let body = $response.body;

try {
    let obj = JSON.parse(body);

    if (obj && obj.data && typeof obj.data.accountBalance !== "undefined") {
        obj.data.accountBalance = 0; // 修改余额
    }

    $done({ body: JSON.stringify(obj) });

} catch (e) {
    console.log("解析响应失败：" + e);
    $done({ body });
}

