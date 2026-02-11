/*
[rewrite_local]

^https:\/\/en\.mobilecleverapps\.com\/app-portal\/userConfiguration url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/english.js

[mitm]
hostname = rtvt-cn-app.ilivedata.com, en.mobilecleverapps.com, firebase-settings.crashlytics.com
*/



/**
 * CleverApps (RTVT / English) 综合解锁脚本
 * 包含接口: 
 * 1. 用户信息解锁 (isVip)
 * 2. 用户配置解锁 (Paywall/Features)
 */

const url = $request.url;
if (!$response.body) $done({});

let obj = JSON.parse($response.body);

// --- 1. RTVT 用户信息接口 ---
if (url.indexOf("/service/account/get_user_info") !== -1) {
    if (obj.data) {
        obj.data.isVip = true;
        obj.data.vipExpireAt = 4102329600; // 2099-12-31
        obj.data.freeDuration = 999999;
        obj.data.isdonated = true;
        obj.data.nickname = "Premium Member";
    }
}

// --- 2. CleverApps 用户配置接口 (功能开关) ---
else if (url.indexOf("/app-portal/userConfiguration") !== -1) {
    // 强制开启关键功能并关闭支付墙限制
    obj.noTrialProductEnabled = true;       // 无试用产品开启 (通常指向直接订阅)
    obj.paywallOneMonthEnabled = true;
    obj.isPaywallGroupBEnabled = true;
    obj.improvedSTTEnabled = true;         // 增强语音转文字
    obj.similaritySTTEnabled = true;       // 语音相似度校验
    obj.newRepetitionEnabled = true;       // 新复习功能
    obj.responsiveEnabled = true;
    
    // 某些 App 逻辑中，关闭某些“限制性”开关即可跳过订阅检查
    console.log("CleverApps 配置已重写");
}

$done({ body: JSON.stringify(obj) });
