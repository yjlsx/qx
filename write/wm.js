
/*
####################################################################
# 配置区
####################################################################

[rewrite_local]
^https:\/\/wmapp-api\.waimaimingtang\.com\/fission\/account\/balance\/ url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/write/wm.js
^https:\/\/wmapp-api\.waimaimingtang\.com\/api\/api\/v2\/user\/cancelAccount$ url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/write/wm.js

[mitm]
hostname = wmapp-api.waimaimingtang.com


*/

/*
 * 外卖明堂余额 + 注销修改脚本
 */

let url = $request.url;
let body = $response.body;

try {
    let obj = JSON.parse(body);

    // 修改余额接口
    if (/\/fission\/account\/balance\//.test(url)) {
        if (obj && obj.data) {
            obj.data.accountBalance = 0;
            obj.data.totalBalance = 0;
        }
    }

    // 修改注销接口
    if (/\/user\/cancelAccount$/.test(url)) {
        obj.code = 1;
        obj.success = true;
        obj.message = "注销成功";
        obj.data = null;
    }

    $done({ body: JSON.stringify(obj) });

} catch (e) {
    console.log("解析响应失败：" + e);
    $done({ body });
}
