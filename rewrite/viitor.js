/*
[rewrite_local]

^https:\/\/rtvt-cn-app\.ilivedata\.com\/service\/account\/get_user_info url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/viitor.js

[mitm]
hostname = rtvt-cn-app.ilivedata.com

*/



/*
 * RTVT App 会员重写脚本
 * 解锁 VIP 状态，过期时间至 2099-12-31
 */

const url = $request.url;
if (!$response.body) $done({});

let obj = JSON.parse($response.body);

// 匹配获取用户信息的接口
if (url.indexOf("/service/account/get_user_info") != -1) {
    if (obj.data) {
        // 修改为 VIP
        obj.data.isVip = true;
        // 过期时间设为 2099-12-31 00:00:00 的 Unix 时间戳
        obj.data.vipExpireAt = 4102329600;
        // 增加免费时长
        obj.data.freeDuration = 999999;
        // 修改昵称
        obj.data.nickname = "Premium Member";
        // 设置为已捐赠状态
        obj.data.isdonated = true;
        
        console.log("RTVT VIP 重写成功: 已授权至 2099 年");
    }
}

$done({ body: JSON.stringify(obj) });
