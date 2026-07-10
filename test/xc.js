/*
[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/test/xc.js
[mitm]
hostname = gw.xiaocantech.com

*/



/*
 * Quantumult X Response Script
 * 针对特定 methodname 修改返回状态
 */

const reqHeaders = $request.headers;
let responseBody = $response.body;

// 辅助函数：安全获取 Header 值（Quantumult X 有时会将 Header 的键名转为全小写，这里做忽略大小写处理）
function getHeaderValue(headers, targetKey) {
    const lowerTargetKey = targetKey.toLowerCase();
    for (let key in headers) {
        if (key.toLowerCase() === lowerTargetKey) {
            return headers[key];
        }
    }
    return null;
}

const methodName = getHeaderValue(reqHeaders, 'methodname');

// 仅拦截特定的 methodname 接口
if (methodName === 'SilkwormRcsService.Suo') {
    try {
        let obj = JSON.parse(responseBody);

        // 只有当存在 status 对象，且原封不动是设备异常的 code 10 时，才执行替换，防止误杀正常响应
        if (obj.status && obj.status.code === 10) {
            obj.status.code = 0;
            obj.status.msg = "success";
            obj.status.if_relogin = false;
            
            $done({ body: JSON.stringify(obj) });
        } else {
            // 如果已经是成功状态或其他不匹配的状态，直接放行
            $done({});
        }

    } catch (e) {
        console.log("JSON Parse Error: " + e);
        $done({});
    }
} else {
    // 非目标请求，直接跳过处理，不消耗性能
    $done({});
}