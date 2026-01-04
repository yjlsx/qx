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
const expiredDate = "1990-01-01 00:00:00"; // 彻底过期时间
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
    listen_end_time: vipDate,
    su_vip_clearday: vipDate,
    roam_type: 1,
    is_first: 0,
    svip_level: 9,
    svip_score: 999999,
    bookvip_valid: 0, // 强制关闭
    bookvip_end_time: expiredDate, // 强制过期
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
    listen_begin_time: beginDate,
    m_is_old: 0,
    h_type: 0,
    listen_type: 0,
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
        // 1. 核心状态：排除听书相关的 key
        if (["is_vip", "vip_type", "m_type", "y_type", "user_type", "is_special_vip", "vip_switch"].includes(key)) {
            if (key === "vip_type") obj[key] = 6;
            else if (key === "user_type") obj[key] = 29;
            else obj[key] = 1;
        }
        // 2. 听书彻底隐藏逻辑
        else if (key === "bookvip_valid" || key === "book_vip_status") {
            obj[key] = 0;
        }
        else if (key === "bookvip_end_time") {
            obj[key] = expiredDate;
        }
        // 3. 其他 VIP 常规逻辑
        else if (["vip_token", "auth_token"].includes(key)) {
            obj[key] = vipToken;
        }
        else if (key.endsWith("_end_time") || key.endsWith("_endtime") || ["su_vip_clearday", "m_reset_time"].includes(key)) {
            obj[key] = vipDate;
        }
        else if (key.endsWith("_begin_time") || ["reg_time", "upgrade_time"].includes(key)) {
            obj[key] = beginDate;
        }
        else if (["privilege", "raw_privilege", "audio_privilege"].includes(key)) {
            obj[key] = 10;
        }
        else if (["pay_type", "price", "pkg_price"].includes(key)) {
            obj[key] = 0;
        }
        
        traverse(obj[key]);
    }
}

function main() {
    if (!body) return null;
    try {
        let data = JSON.parse(body);

        // 屏蔽福利列表中的听书会员
        if (url.includes('v2/super/welfarelist')) {
            if (data.data && data.data.book) {
                data.data.book.status = 0;
                data.data.book.is_vip = 0;
            }
        }

        // 正常的 VIP 深度覆盖
        if (url.includes('login_by_token') || url.includes('v1/userinfo') || url.includes('fusion/userinfo')) {
            traverse(data);
            if (data.data) Object.assign(data.data, vipFields);
        }

        traverse(data);

        let result = JSON.stringify(data);

        // 全局替换：只针对明确不是听书会员的 key 进行替换
        // 修正：避免把 bookvip_valid 的 0 替换成 1
        result = result.replace(/"is_vip"\s*:\s*0/g, (match, offset, str) => {
            // 如果前面紧跟着 book 字样，保持 0
            return str.substring(offset - 10, offset).includes("book") ? '"is_vip":0' : '"is_vip":1';
        });

        result = result.replace(/"vip_type"\s*:\s*0/g, '"vip_type":6')
                      .replace(/"user_type"\s*:\s*0/g, '"user_type":29')
                      .replace(/"svip_level"\s*:\s*\d+/g, '"svip_level":9')
                      .replace(/"privilege"\s*:\s*[08]/g, '"privilege":10');

        return {body: result};
    } catch (e) {
        return null;
    }
}

let res = main();
res ? $done(res) : $done({});
