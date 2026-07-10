/*
[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/test/xc.js
[mitm]
hostname = gw.xiaocantech.com

*/



/*
 * Quantumult X Response Script
 * 修改返回状态
 */

let body = $response.body;

try {
    let obj = JSON.parse(body);

    if (obj.status) {
        obj.status.code = 0;
        obj.status.msg = "success";
        obj.status.if_relogin = false;
    }

    $done({
        body: JSON.stringify(obj)
    });

} catch (e) {
    console.log("JSON Parse Error: " + e);
    $done({});
}

