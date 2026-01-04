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

const timestamp = Math.floor(Date.now() / 1000);
const url = $request.url;
const body = $response.body;
let obj = JSON.parse(body);

// --- 登录令牌处理 ---
if (url.includes('v5/login_by_token')) {
    obj.data.user_type = 29;
    obj.data.vip_end_time = "2099-12-31 15:14:48";
    obj.data.su_vip_end_time = "2099-12-31 15:14:48";
    obj.data.m_end_time = "2099-12-31 15:14:48";
    obj.data.su_vip_y_endtime = "2099-12-31 15:14:48";
    obj.data.su_vip_clearday = "2024-07-26 15:14:09";
    obj.data.vip_begin_time = "2024-07-26 15:14:09";
    obj.data.m_begin_time = "2024-07-26 15:14:09";
    obj.data.su_vip_begin_time = "2024-07-26 15:14:09";
    obj.data.is_vip = 1;
    obj.data.m_type = 1;
    obj.data.vip_type = 6;   
}

// --- 用户信息 V1 ---
if (url.includes('/v1/userinfo')) {
    obj.data.vip_type = 6;   
    obj.data.user_type = 29;
    obj.data.m_type = 1;
    obj.data.vip_end_time = "2099-12-31 15:14:48";
    obj.data.su_vip_y_endtime = "2099-12-31 15:14:48";
    obj.data.su_vip_end_time = "2099-12-31 15:14:48";
    obj.data.su_vip_begin_time = "2024-07-26 15:14:09";
    obj.data.svip_level = 9;
    obj.data.svip_score = 999999;
    obj.data.su_vip_clearday = "2024-07-26 15:14:09";
    obj.data.m_end_time = "2099-12-31 15:14:48";
}

// --- 扩展登录信息 (已移除听书字段) ---
if (url.includes('/v2/get_login_extend_info')) {
    obj.data.vipinfo.su_vip_end_time = "2099-12-31 23:59:59";
    obj.data.vipinfo.su_vip_y_endtime = "2099-12-31 23:59:59";
    obj.data.vipinfo.su_vip_begin_time = "2024-07-26 15:14:09";
    obj.data.vipinfo.su_vip_clearday = "2024-07-26 15:14:09";
    obj.data.vipinfo.user_type = 29;
    obj.data.vipinfo.svip_level = 9;
    obj.data.vipinfo.m_type = 1;
    obj.data.vipinfo.vip_type = 6;
    if(obj.data.vipinfo.svip_score) obj.data.vipinfo.svip_score = 999999;
}

// --- 移动端 VIP 详情列表 ---
if (url.includes('/mobile/vipinfoV2')) {
    if (obj.data) {
        // VIP, Music, HiFi 列表统一处理
        const lists = ['vip_list', 'm_list', 'h_list'];
        lists.forEach(listKey => {
            if (!Array.isArray(obj.data[listKey])) obj.data[listKey] = [];
            if (obj.data[listKey].length === 0) {
                obj.data[listKey].push({ end_time: "2099-12-31 23:59:59", type: 1, begin_time: "2024-07-26 15:14:09" });
            } else {
                obj.data[listKey].forEach(item => {
                    item.end_time = "2099-12-31 23:59:59";
                    item.type = 1;
                    item.begin_time = "2024-07-26 15:14:09";
                });
            }
        });

        // 音质权限信息
        obj.data.tone_info = {
            user_right_type: 1,
            user_right_list: [
                { "begin_time": "2024-07-26 15:14:09", "asset_id": "tone_mudai", "type": 1, "end_time": "2099-12-31 23:59:59", "valid": true },
                { "begin_time": "2024-07-26 15:14:09", "asset_id": "tone_chaoqing", "type": 2, "end_time": "2099-12-31 23:59:59", "valid": true },
                { "begin_time": "2024-07-26 15:14:09", "asset_id": "tone_quanjing", "type": 4, "end_time": "2099-12-31 23:59:59", "valid": true }
            ]
        };

        // 统一赋值状态
        const target = obj.data;
        const err = obj.error || {};
        [target, err].forEach(o => {
            o.vip_type = 6; o.user_type = 29; o.m_type = 1; o.is_vip = 1; o.svip_level = 9; o.svip_score = 999999;
            o.vip_end_time = "2099-12-31 23:59:59"; o.su_vip_end_time = "2099-12-31 23:59:59"; o.m_end_time = "2099-12-31 23:59:59";
        });
    }
}

// --- 个人中心 V3 ---
if (url.includes('/v1/fusion/userinfo')) {
    if (obj.data && obj.data.get_vip_info_v3) {
        let v3 = obj.data.get_vip_info_v3.data;
        ['vip_list', 'm_list', 'h_list'].forEach(key => {
            if (!Array.isArray(v3[key])) v3[key] = [];
            if (v3[key].length === 0) v3[key].push({ end_time: "2099-12-31 23:59:59", type: 1, begin_time: "2024-07-26 15:14:09" });
            else v3[key].forEach(i => { i.end_time = "2099-12-31 23:59:59"; i.begin_time = "2024-07-26 15:14:09"; });
        });
        Object.assign(v3, {
            vip_type: 6, m_type: 1, user_type: 29, is_vip: 1, svip_level: 9, svip_score: 999999,
            vip_end_time: "2099-12-31 23:59:59", su_vip_end_time: "2099-12-31 23:59:59"
        });
    }
}

// --- 我的信息 (已移除听书 bookvip_valid) ---
if (url.includes('/v3/get_my_info')) {
    if (obj.data) {
        Object.assign(obj.data, {
            svip_score: 999999, svip_level: 9, vip_type: 6, m_type: 1, y_type: 1, user_type: 29,
            musical_visible: 1, timbre_visible: 1, usermedal_visible: 1,
            su_vip_end_time: "2099-12-31 23:59:59"
        });
        obj.data["1ting_visible"] = 1;
        obj.data["1video_visible"] = 1;
    }
}

// --- 歌曲资源权限处理 (Lite) ---
if (url.includes('v1/get_res_privilege/lite')) {
    obj.status = 1; obj.vip_user_type = 3;
    const applyFields = (item) => {
        if (!item) return;
        item.privilege = 10; item.status = 1; item.pay_type = 0; item.price = 0;
        item.expire = 4102444799;
        if (item.trans_param) {
            item.trans_param.all_quality_free = 1;
            item.trans_param.is_super_vip = 1;
            item.trans_param.classmap = { "attr0": 234881032 };
        }
    };
    if (Array.isArray(obj.data)) {
        obj.data.forEach(audioItem => {
            applyFields(audioItem);
            if (audioItem.relate_goods) audioItem.relate_goods.forEach(applyFields);
        });
    }
}

// --- 其他通用处理 (配额、等级、背景等) ---
if (url.includes('/v1/get_remain_quota')) { obj.data.remain = 99998; obj.data.m_type = 1; }
if (url.includes('/vip_level/detail')) { obj.data.grade = 9; obj.data.growth = 999999; }
if (url.includes('/v2/get_kg_bg_pics')) {
    if (obj.data && obj.data.lists) obj.data.lists.forEach(l => l.pics && l.pics.forEach(p => p.is_suvip = 1));
}

$done({ body: JSON.stringify(obj) });