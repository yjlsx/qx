
/*
####################################################################
# 配置区
####################################################################

[rewrite_local]
# ============== SayHi 翻译 Pro 解锁 & 去广告 ==============
^https:\/\/firebaseremoteconfig\.googleapis\.com\/v1\/projects\/all-in-one-translator-337ac\/namespaces\/firebase:fetch.*$ url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/sayhi.js

[mitm]
hostname = firebaseremoteconfig.googleapis.com



*/

/*
 * SayHi 翻译 —— Pro 解锁 + 去广告
 */

let obj = {};
try {
    obj = JSON.parse($response.body);
} catch (e) {
    // 出错就直接构造一个
    obj = {};
}

obj.entries = obj.entries || {};

// —— 解锁 Pro ——  
obj.entries["is_pro"] = { "value": "true" };
obj.entries["vip"] = { "value": "1" };
obj.entries["pro_active"] = { "value": "true" };
obj.entries["pro_valid"] = { "value": "true" };
obj.entries["pro_expired_time"] = { "value": "2099-12-31" };

// —— 去广告 ——  
obj.entries["ads_enabled"] = { "value": "false" };
obj.entries["ad_enabled"] = { "value": "false" };
obj.entries["remove_ads"] = { "value": "true" };
obj.entries["show_ad"] = { "value": "false" };
obj.entries["admob_enabled"] = { "value": "false" };
obj.entries["facebook_ads_enabled"] = { "value": "false" };

// —— 必要结构保持 ——  
obj.status = 1;
obj.app_id = obj.app_id || "ca-app-pub-0000000000000000~0000000000";
obj.auto_collect_location = false;

$done({
    body: JSON.stringify(obj)
});
