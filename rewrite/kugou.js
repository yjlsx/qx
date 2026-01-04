/**
[rewrite_local]
# --- 下载接口 ---
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js
^https?:\/\/kg\.zzxu\.de\/api\/v5url\? url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugou.js
^https?:\/\/openapicdn\.kugou\.com\/v\d\/audio\/client_bg url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugou.js

# --- 核心权限分流---
^https?:\/\/gateway\.kugou\.com\/vip\/v1\/fusion\/userinfo url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugou1.js
^https?:\/\/gateway\.kugou\.com\/(?!(vip\/))v\d\/fusion\/userinfo url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugou.js

# --- 皮肤、唱机、名牌等装扮类 ---
^https?:\/\/.*\.kugou\.com\/.*(record_rack|model\/list|album\/check_buy|nameplate|pendant|popup\/v1\/info|ocean\/v6\/theme|tools\.mobile\/v2\/theme\/info|dress_sales|authority\/get_dress_authority_list|check_user_dress|favor\/list|search\/mixed|vip_level\/welfare_list|playerPreview) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugou1.js

# --- 基础信息、资产、余额类 ---
^https?:\/\/.*\.kugou\.com\/.*(login_by_token|get_my_info|vipinfoV2|get_login_extend_info|user\/vipinfo|userinfo|get_dev_user|follow_list|get_res_privilege|get_remain_quota|get_b_info|get_buy_info|consumption|coupon_package|userbalance|audio\/get_buy_info|getSongInfo|get_kg_bg_pics|vip_center_user_info|welfare\/diy\/v1) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugou.js

# --- K歌与订单修正 ---
^https?:\/\/gateway\.kugou\.com\/vipcenter\/ios url script-request-header https://raw.githubusercontent.com/yjlsx/quantumult-x/master/ceshi/111/kg1.js
^https?:\/\/gateway\.kugou\.com\/v3\/external\/order\/query_latest url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kg.js
^https?:\/\/(nacsing|acsing|vipos|gateway|gamecenter)\.kugou\.com\/.*(sing7|ktv_room|member\/info|member_game|kroom_tab) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugousong.js

# --- 广告与报错拦截  ---
^https?:\/\/(sentry|nbcollect)\.kugou\.com\/api url reject
^https?:\/\/.*\.kugou\.com\/.*(report_unexpose|report_simple|aterouter) url reject

[mitm]
hostname = gateway.kugou.com, vip.kugou.com, gatewayretry.kugou.com, sentry.kugou.com, vipdress.kugou.com, welfare.kugou.com, m.kugou.com, nbcollect.kugou.com, mediastoreretry.kugou.com, h5.kugou.com, kg.zzxu.de, openapicdn.kugou.com
*/

const url = $request.url;
let body = $response.body;

const vipDate = "2099-12-31 23:59:59";
const beginDate = "2024-07-26 15:14:09";
const vipToken = "1234567890abcdef";

const vipFields = {
    is_vip: 1,
    vip_type: 6,
    y_type: 1,
    user_type: 29,
    m_type: 1,
    vip_token: vipToken,
    auth_token: vipToken,
    vip_end_time: vipDate,
    vip_begin_time: beginDate,
    m_end_time: vipDate,
    m_begin_time: beginDate,
    su_vip_end_time: vipDate,
    su_vip_begin_time: beginDate,
    su_vip_y_endtime: vipDate,
    roam_end_time: vipDate,
    su_vip_clearday: vipDate,
    roam_type: 1,
    is_first: 0,
    svip_level: 9,
    svip_score: 999999,
    m_reset_time: vipDate,
    vip_clearday: beginDate,
    m_clearday: beginDate,
    upgrade_time: beginDate,
    annual_fee_begin_time: beginDate,
    annual_fee_end_time: vipDate,
    svip_begin_time: beginDate,
    svip_end_time: vipDate,
    dual_su_vip_begin_time: beginDate,
    dual_su_vip_end_time: vipDate,
    roam_begin_time: beginDate,
    h_begin_time: beginDate,
    h_end_time: vipDate,
    m_is_old: 0,
    h_type: 0,
    user_y_type: 0,
    autotype: 0,
    autoChargeType: 0,
    producttype: 0,
    autostatus: 0,
    autoVipType: 0,
    lottery_status: 0,
    first_svip: 0,
    signed_svip_before: 0,
    promotion_tag: 0,
    ios_products_sub_tag: 0,
    promotion_offer_tag: 0,
    su_vip_upgrade_days: 999,
    super_vip_upgrade_month: 999
};

function traverse(obj) {
    if (typeof obj !== "object" || obj === null) return;
    
    for (let key in obj) {
        // 核心VIP状态
        if (["is_vip", "vip_type", "m_type", "y_type", "user_type", "is_special_vip", "vip_switch"].includes(key)) {
            if (key === "vip_type") obj[key] = 6;
            else if (key === "user_type") obj[key] = 29;
            else obj[key] = 1;
        }
        else if (["vip_token", "auth_token"].includes(key)) {
            obj[key] = vipToken;
        }
        // 结束时间（排除听书相关）
        else if ((key.endsWith("_end_time") || key.endsWith("_endtime") || ["su_vip_clearday", "m_reset_time"].includes(key)) && !key.includes("book") && !key.includes("listen")) {
            obj[key] = vipDate;
        }
        // 开始时间（排除听书相关）
        else if ((key.endsWith("_begin_time") || ["reg_time", "vip_clearday", "m_clearday", "upgrade_time", "annual_fee_begin_time", "svip_begin_time", "dual_su_vip_begin_time", "roam_begin_time", "h_begin_time"].includes(key)) && !key.includes("listen")) {
            obj[key] = beginDate;
        }
        else if (["valid", "is_original"].includes(key)) {
            obj[key] = true;
        }
        else if (key === "privilege" || key === "raw_privilege") {
            obj[key] = 10;
        }
        else if (key === "pay_type" || key === "price") {
            obj[key] = 0;
        }
        else if (key === "svip_level") {
            obj[key] = 9;
        }
        // 广告处理
        else if ((key === "ads" && !url.includes("search_no_focus_word")) || ["ad_info", "mobile_link", "blindbox_list"].includes(key)) {
            obj[key] = [];
        }
        else if (key.includes("ad_value") || key.includes("audioad") || key.includes("expire_prompt")) {
            obj[key] = 0;
        }
        
        traverse(obj[key]);
    }
}

const processThemes = (themes) => {
    if (!themes) return;
    for (let theme of themes) {
        theme.vip_level = 6;
        theme.price = 0;
        if (theme.limit_free_info) {
            theme.limit_free_info.limit_free_status = 1;
            theme.limit_free_info.free_end_time = 4092599349;
        }
        if (theme.themes) processThemes(theme.themes);
    }
};

function main() {
    if (!body) return null;
    try {
        let data = JSON.parse(body);

        // 资源权限 (Lite)
        if (url.includes('get_res_privilege/lite')) {
            data.status = 1;
            data.vip_user_type = 3;
            if (data.userinfo) {
                data.userinfo.vip_type = 6;
                data.userinfo.m_type = 1;
            }
            if (data.data && Array.isArray(data.data)) {
                data.data.forEach(item => {
                    item.privilege = 10;
                    item.status = 1;
                    if (item.trans_param) {
                        item.trans_param.all_quality_free = 1;
                        item.trans_param.classmap = {attr0: 234881032};
                    }
                });
            }
        }
        // 超级福利 (去掉听书)
        else if (url.includes('v2/super/welfarelist')) {
            data.data.close_time = vipDate;
            if (data.data.qqksong) data.data.qqksong.status = 1;
            if (data.data.iot) {
                data.data.iot.status = 1;
                if (data.data.iot.iot_info) {
                    data.data.iot.iot_info.forEach(info => info.end_time = vipDate);
                }
            }
            // 已删除 data.data.book 逻辑
        }
        // 用户中心与登录
        else if (url.includes('fusion/userinfo') || url.includes('login_by_token') || url.includes('vipinfoV2')) {
            traverse(data);
            if (data.data && data.data.vipinfo) Object.assign(data.data.vipinfo, vipFields);
        }
        // 主题皮肤
        else if (url.includes('theme/category') || url.includes('theme/info')) {
            if (data.data) {
                if (data.data.info) data.data.info.forEach(item => { if(item.themes) processThemes(item.themes) });
                if (data.data.themes) processThemes(data.data.themes);
            }
        }
        else {
            traverse(data);
        }

        let result = JSON.stringify(data);
        
        // 全局字符串替换 (排除听书字段)
        result = result.replace(/"is_vip"\s*:\s*0/g, '"is_vip":1')
                      .replace(/"vip_type"\s*:\s*0/g, '"vip_type":6')
                      .replace(/"m_type"\s*:\s*0/g, '"m_type":1')
                      .replace(/"privilege"\s*:\s*[08]/g, '"privilege":10')
                      .replace(/"pay_type"\s*:\s*3/g, '"pay_type":0');

        return {body: result};
    } catch (e) {
        return null;
    }
}

let res = main();
res ? $done(res) : $done({});