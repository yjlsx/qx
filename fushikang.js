
/*
####################################################################
# 配置区
####################################################################

[rewrite_local]
# 匹配课程搜索接口
^https?:\/\/ieduapi\.foxconn\.com\/v1\/v3\/myservlet4\/CourseSearch2 url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/fushikang.js




[mitm]
hostname = ieduapi.foxconn.com

*/



/**
 * FuLearn 课程权限解锁脚本
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);

    // 检查是否为数组列表
    if (Array.isArray(obj)) {
        obj.forEach(item => {
            item.isPermit = "Y";         // 强制改为有权限
            item.PermitLevel = "A";      // 强制改为最高等级
            item.Price = 0;              // 确保价格显示为0
            // 如果有特定的提示文字，也可以清空
            if (item.PopSignText) item.PopSignText = ""; 
        });
        body = JSON.stringify(obj);
    }
} catch (e) {
    console.log("FuLearn脚本解析错误: " + e);
}

$done({ body });
