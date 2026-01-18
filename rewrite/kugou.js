/**
[rewrite_local]
# --- 下载接口 ---
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js
^https?:\/\/kg\.zzxu\.de\/api\/v5url\? url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugou.js
^https?:\/\/openapicdn\.kugou\.com\/v\d\/audio\/client_bg url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugou.js

# --- 核心权限分流---
^https?:\/\/gateway\.kugou\.com\/vip\/v1\/fusion\/userinfo url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugou1.js
^https?:\/\/gateway\.kugou\.com\/(?!(vip\/))v\d\/fusion\/userinfo url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugou.js

# --- 皮肤、唱机、名牌等装扮类 ---
^https?:\/\/.*\.kugou\.com\/.*(all_theme_skin|album\/check_buy|pendant|popup\/v1\/info|ocean\/v6\/theme|tools\.mobile\/v2\/theme\/info|dress_sales|authority\/(get_dress_authority_list|check_user_dress)|favor\/list|search\/mixed|vip_level\/welfare_list|playerPreview) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugou1.js

^https?:\/\/gateway\.kugou\.com\/(player\/v1\/model\/list|vipdress\/v1\/record_rack\/set_(user_record_rack|record_rack_check)) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kg/kugoupf.js

^https?:\/\/welfare\.kugou\.com\/nameplate\/v1\/(get_nameplate_list|set_user_nameplate) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kg/nameplate.js


# --- 基础信息、资产、余额类 ---
^https?:\/\/.*\.kugou\.com\/.*(login_by_token|get_my_info|vipinfoV2|get_login_extend_info|user\/vipinfo|userinfo|get_dev_user|follow_list|get_res_privilege|get_remain_quota|get_b_info|get_buy_info|consumption|coupon_package|userbalance|audio\/get_buy_info|getSongInfo|get_kg_bg_pics|vip_center_user_info|welfare\/diy\/v1|vip_level\/detail) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugou.js

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

if (url.includes('/v2/get_login_extend_info')) {
    obj.data.vipinfo.su_vip_end_time = "2099-12-31 23:59:59";
    //obj.data.vipinfo.bookvip_end_time = "2099-12-31 23:59:59";
    obj.data.vipinfo.su_vip_y_endtime = "2099-12-31 23:59:59";
    obj.data.vipinfo.su_vip_begin_time = "2024-07-26 15:14:09";
    obj.data.vipinfo.su_vip_clearday = "2024-07-26 15:14:09";
    obj.data.vipinfo.user_type = 29;
    obj.data.vipinfo.svip_level = 9;
    obj.data.vipinfo.m_type = 1;
    obj.data.vipinfo.vip_type = 6;
if(obj.data.vipinfo.svip_score){
    obj.data.vipinfo.svip_score = 999999;
      }
if(obj.data.vipinfo.vip_type){
    obj.data.vipinfo.vip_type = 6;
      }
if(obj.data.vipinfo.svip_level){
    obj.data.vipinfo.svip_level = 9;
      }
}

if (url.includes('/mobile/vipinfoV2')) {
    if (obj.data) {
        if (!Array.isArray(obj.data.vip_list)) {
            obj.data.vip_list = [];
        }
        if (obj.data.vip_list.length === 0) {
            obj.data.vip_list.push({
                end_time: "2099-12-31 23:59:59",
                type: 1,
                begin_time: "2024-07-26 15:14:09"
            });
        } else {
            obj.data.vip_list.forEach(item => {
                item.end_time = "2099-12-31 23:59:59";
                item.type = 1;
                item.begin_time = "2024-07-26 15:14:09";
            });
        }
        if (!Array.isArray(obj.data.m_list)) {
            obj.data.m_list = [];
        }
        if (obj.data.m_list.length === 0) {
            obj.data.m_list.push({
                end_time: "2099-12-31 23:59:59",
                type: 1,
                begin_time: "2024-07-26 15:14:09"
            });
        } else {
            obj.data.m_list.forEach(item => {
                item.end_time = "2099-12-31 23:59:59";
                item.type = 1;
                item.begin_time = "2024-07-26 15:14:09";
            });
        }
        if (!Array.isArray(obj.data.h_list)) {
            obj.data.h_list = [];
        }

        if (!Array.isArray(obj.data.tone_info)) {
            obj.data.tone_info.user_right_type = 1;
            obj.data.tone_info.user_right_list = [
          {
          "begin_time" : "2024-07-26 15:14:09",
          "asset_id" : "tone_mudai",
          "type" : 1,
          "end_time" : "2099-12-31 23:59:59",
          "valid" : true
        },
        {
          "begin_time" : "2024-07-26 15:14:09",
          "asset_id" : "tone_chaoqing",
          "type" : 2,
          "end_time" : "2099-12-31 23:59:59",
          "valid" : true
        },
        {
          "begin_time" : "2024-07-26 15:14:09",
          "asset_id" : "tone_quanjing",
          "type" : 4,
          "end_time" : "2099-12-31 23:59:59",
          "valid" : true
             }
          ];
        }
        if (obj.data.h_list.length === 0) {
            obj.data.h_list.push({
                end_time: "2099-12-31 23:59:59",
                type: 1,
                begin_time: "2024-07-26 15:14:09"
            });
        } else {
            obj.data.h_list.forEach(item => {
                item.end_time = "2099-12-31 23:59:59";
                item.type = 1;
                item.begin_time = "2024-07-26 15:14:09";
            });
        }
        if (!Array.isArray(obj.error.vip_list)) {
            obj.error.vip_list = [];
        }
        if (obj.error.vip_list.length === 0) {
            obj.error.vip_list.push({
                end_time: "2099-12-31 23:59:59",
                type: 1,
                begin_time: "2024-07-26 15:14:09"
            });
        } else {
            obj.error.vip_list.forEach(item => {
                item.end_time = "2099-12-31 23:59:59";
                item.type = 1;
                item.begin_time = "2024-07-26 15:14:09";
            });
        }
        if (!Array.isArray(obj.error.m_list)) {
            obj.error.m_list = [];
        }
        if (obj.error.m_list.length === 0) {
            obj.error.m_list.push({
                end_time: "2099-12-31 23:59:59",
                type: 1,
                begin_time: "2024-07-26 15:14:09"
            });
        } else {
            obj.error.m_list.forEach(item => {
                item.end_time = "2099-12-31 23:59:59";
                item.type = 1;
                item.begin_time = "2024-07-26 15:14:09";
            });
        }
        obj.data.vip_y_endtime = "2099-12-31 23:59:59";
        obj.data.m_type = 1;
        obj.data.vip_type = 6;
        obj.data.viptype = 6;
        obj.data.user_type = 29;
        obj.data.su_vip_upgrade_days = 99999;
        obj.data.vip_begin_time = "2024-07-26 15:14:09";
        obj.data.svip_begin_time = "2024-07-26 15:14:09";
        obj.data.su_vip_begin_time = "2024-07-26 15:14:09";
        obj.data.m_begin_time = "2024-07-26 15:14:09";
        obj.data.m_clearday = "2024-07-26 15:14:09";
        obj.data.vip_clearday = "2024-07-26 15:14:09";
        obj.data.su_vip_clearday = "2024-07-26 15:14:09";
        obj.data.su_vip_y_endtime = "2099-12-31 23:59:59";
        obj.data.super_vip_upgrade_month = 9999;
        obj.data.h_end_time = "2099-12-31 23:59:59";
        obj.data.m_y_endtime = "2099-12-31 23:59:59";
        obj.data.vip_end_time = "2099-12-31 23:59:59";
        obj.data.svip_level = 9;
        obj.data.is_vip = 1;
        obj.data.svip_score = 999999;
        obj.data.svip_end_time = "2099-12-31 23:59:59";
        obj.data.su_vip_end_time = "2099-12-31 23:59:59";
        obj.data.m_end_time = "2098-12-31 23:59:59";
        obj.error.vip_type = 4;
        obj.error.vip_begin_time = "2024-07-26 15:14:09";
        obj.error.svip_begin_time = "2024-07-26 15:14:09";
        obj.error.su_vip_begin_time = "2024-07-26 15:14:09";
        obj.error.m_begin_time = "2024-07-26 15:14:09";
        obj.error.m_clearday = "2024-07-26 15:14:09";
        obj.error.vip_clearday = "2024-07-26 15:14:09";
        obj.error.su_vip_clearday = "2024-07-26 15:14:09";
        obj.error.vip_y_endtime = "2099-12-31 23:59:59";
        obj.error.user_type = 29;
        obj.error.m_type = 1;
        obj.error.su_vip_upgrade_days = 99999;
        obj.error.super_vip_upgrade_month = 9999;
        obj.error.su_vip_end_time = "2099-12-31 23:59:59";
        obj.error.su_vip_y_endtime = "2099-12-31 23:59:59";
        obj.error.h_end_time = "2099-12-31 23:59:59";
        obj.error.vip_end_time = "2099-12-31 23:59:59";
        obj.error.svip_end_time = "2099-12-31 23:59:59";
        obj.error.svip_level = 9;
        obj.error.svip_score = 999999;
        obj.error.is_vip = 1;
        obj.error.m_end_time = "2099-12-31 23:59:59";
    }
}

if (url.includes('/v1/fusion/userinfo')) {
    if (obj.data && obj.data.get_vip_info_v3) {
        // 确保 vip_list 是一个数组
        if (!Array.isArray(obj.data.get_vip_info_v3.data.vip_list)) {
            obj.data.get_vip_info_v3.data.vip_list = [];
        }
        // 更新 vip_list 的元素或添加新元素
        if (obj.data.get_vip_info_v3.data.vip_list.length === 0) {
            obj.data.get_vip_info_v3.data.vip_list.push({
                end_time: "2099-12-31 23:59:59",
                type: 1,
                begin_time: "2024-07-26 15:14:09"
            });
        } else {
            obj.data.get_vip_info_v3.data.vip_list.forEach(item => {
                item.end_time = "2099-12-31 23:59:59";
                item.type = 1;
                item.begin_time = "2024-07-26 15:14:09";
            });
        }

        // 确保 m_list 是一个数组
        if (!Array.isArray(obj.data.get_vip_info_v3.data.m_list)) {
            obj.data.get_vip_info_v3.data.m_list = [];
        }
        // 更新 m_list 的元素或添加新元素
        if (obj.data.get_vip_info_v3.data.m_list.length === 0) {
            obj.data.get_vip_info_v3.data.m_list.push({
                end_time: "2099-12-31 23:59:59",
                type: 1,
                begin_time: "2024-07-26 15:14:09"
            });
        } else {
            obj.data.get_vip_info_v3.data.m_list.forEach(item => {
                item.end_time = "2099-12-31 23:59:59";
                item.type = 1;
                item.begin_time = "2024-07-26 15:14:09";
            });
        }

        // 确保 h_list 是一个数组
        if (!Array.isArray(obj.data.get_vip_info_v3.data.h_list)) {
            obj.data.get_vip_info_v3.data.h_list = [];
        }
        // 更新 h_list 的元素或添加新元素
        if (obj.data.get_vip_info_v3.data.h_list.length === 0) {
            obj.data.get_vip_info_v3.data.h_list.push({
                end_time: "2099-12-31 23:59:59",
                type: 1,
                begin_time: "2024-07-26 15:14:09"
            });
        } else {
            obj.data.get_vip_info_v3.data.h_list.forEach(item => {
                item.end_time = "2099-12-31 23:59:59";
                item.type = 1;
                item.begin_time = "2024-07-26 15:14:09";
            });
        }

        // 更新 vip_info_v3 的其他属性
        obj.data.get_vip_info_v3.data.vip_type = 6;
        obj.data.get_vip_info_v3.data.vip_y_endtime = "2099-12-31 23:59:59";
        obj.data.get_vip_info_v3.data.vip_begin_time = "2024-07-26 15:14:09";
        obj.data.get_vip_info_v3.data.svip_begin_time = "2024-07-26 15:14:09";
        obj.data.get_vip_info_v3.data.m_begin_time = "2024-07-26 15:14:09";
        obj.data.get_vip_info_v3.data.m_type = 1;
        obj.data.get_vip_info_v3.data.user_type = 29;
        obj.data.get_vip_info_v3.data.su_vip_upgrade_days = 9999;
        obj.data.get_vip_info_v3.data.super_vip_upgrade_month = 9999;
        obj.data.get_vip_info_v3.data.svip_upgrade_month = 9999;
        obj.data.get_vip_info_v3.data.su_vip_y_endtime = "2099-12-31 23:59:59";
        obj.data.get_vip_info_v3.data.m_end_time = "2099-12-31 23:59:59";
        obj.data.get_vip_info_v3.data.m_y_endtime = "2099-12-31 23:59:59";
        obj.data.get_vip_info_v3.data.svip_end_time = "2099-12-31 23:59:59";
        obj.data.get_vip_info_v3.data.su_vip_clearday = "2024-07-26 15:14:09";
        obj.data.get_vip_info_v3.data.vip_clearday = "2024-07-26 15:14:09";
        obj.data.get_vip_info_v3.data.su_vip_end_time = "2099-12-31 23:59:59";
        obj.data.get_vip_info_v3.data.vip_end_time = "2099-12-31 23:59:59";
        obj.data.get_vip_info_v3.data.is_vip = 1;
        obj.data.get_vip_info_v3.data.svip99 = 1;
        obj.data.get_vip_info_v3.data.svip_level = 9;
        obj.data.get_vip_info_v3.data.svip_score = 999999;
    }
}


if (url.includes('/v1/get_remain_quota') || url.includes('/goodsmstore/v1/get_remain_quota')) {
    obj.data.m_clearday = "2024-07-26 15:14:09";
    obj.data.upgrade = 4;
    obj.data.m_type = 1;
    obj.data.total = 99999;
    obj.data.remain = 99998;
}

if (url.includes('/promotionvip/v3/vip_level/detail')) {
    obj.data.grade = 9;
    obj.data.daily_growth = 15;
    obj.data.growth = 999999;
    obj.data.level_start_growth = 300000;
    obj.data.next_level_growth = 0;
}

if (url.includes('/updateservice/v1/get_dev_user')) {
    if (obj && obj.data && obj.data.list) {
       obj.data.list.forEach(user => {
    user.vipinfo.is_vip = 1;         // 将 is_vip 设置为 1
    user.vipinfo.vip_type = 6;       // 自定义 VIP 类型
    user.vipinfo.m_type = 1;         // 自定义会员类型
    user.vipinfo.svip_level = 9;     // 超级会员等级设为 5
    user.vipinfo.svip_score = 999999;  // 超级会员积分设为 999999
    user.vipinfo.vip_statu = 1;      // VIP 状态设为已开通
    user.vipinfo.user_type = 29;      // 用户类型设为 VIP
    user.vipinfo.user_y_type = 1;    // 额外类型设为 VIP
              });
       }
}

if (url.includes('/v3/get_my_info')) {
    if (obj.data) {
        obj.data.svip_score = 999999;
        obj.data.svip_level = 9;
        obj.data.vip_type = 6;
        obj.data.m_type = 1;
        obj.data.y_type = 1;
        obj.data.user_type = 29;
        obj.data.musical_visible = 1;
        obj.data.bookvip_valid = 1;
        obj.data.timbre_visible = 1;
        obj.data["1ting_visible"] = 1;
        obj.data["1video_visible"] = 1;
        obj.data.usermedal_visible = 1;
        obj.data.yaicreation_visible = 1;
        obj.data.collectlist_visible = 1;
        obj.data.su_vip_begin_time = "2024-07-26 15:14:09";
        obj.data.su_vip_y_endtime = "2099-12-31 23:59:59";
        obj.data.su_vip_clearday = "2024-07-26 15:14:09";
        obj.data.su_vip_end_time = "2099-12-31 23:59:59";
    }
}


if (url.includes('/v4/follow_list')) {
    if (obj.data && Array.isArray(obj.data.lists)) {
        obj.data.lists.forEach(item => {
            if ('vip_type' in item) {
                item.vip_type = 4; 
            }
            if ('m_type' in item) {
                item.m_type = 1; 
            }
            if ('svip_level' in item) {
                item.svip_level = 9; 
            }
        });
    }
}

if (url.includes('/promotionvip/v3/vip_level/welfare_recv')) {
    obj.errcode = 0;
    obj.status = 1;
    obj.errmsg = "";
}

if (url.includes('/listening/coupon_package')) {
    obj.data.gift_card_cnt = 9;
    obj.data.listen_coupon_cnt = 10;
    obj.data.super_welfare = 1;
    obj.data.super_welfare_v2_cnt = 1;
    obj.data.download_cnt = 9;
    obj.data.mp3_download_cnt = 9;
}

if (url.includes('/v1/get_res_privilege/lite')) {
    // 1. 全局状态修正
    obj.status = 1;
    obj.error_code = 0;
    obj.vip_user_type = 3;
    if (obj.userinfo) {
        obj.userinfo.m_type = 1;
        obj.userinfo.vip_type = 4;
        obj.userinfo.quota_remain = 999999;
    }

    // 2. 核心处理函数：严格按照你提供的参考内容赋值
    const handleAudioItem = (item) => {
        if (!item) return;

        // --- 基础权限设置 ---
        item.privilege = 1;
        item.status = 1;
        item.fail_process = 0;
        item.pay_type = 0;
        item.price = 0;
        item.pkg_price = 0;
        item.buy_count = 1;
        item.buy_count_vip = 1;
        item.buy_count_kubi = 1;
        item.buy_count_audios = 1;
        item.is_publish = 1;
        item.publish = 1;
        item.expire = 4102444799;         
        // 移除弹窗限制
        if (item.popup) delete item.popup;
        
        // 设置成功消息
        item._msg = "Allow: the audio is free(copyright).";
        item._errno = 0;
        
        // --- trans_param 内部字段设置 ---
        if (item.trans_param) {
            item.trans_param.musicpack_advance = 0;  // 0=不需要音乐包
            item.trans_param.pay_block_tpl = 1;      // 1=会员标识
            item.trans_param.display = 0;            // 0=不显示付费提示
            item.trans_param.display_rate = 0;       // 0=不显示费率
            item.trans_param.free_limited = 0;       // 0=不限制免费
            item.trans_param.all_quality_free = 1;   // 1=所有音质免费
            item.trans_param.download_privilege = 1; // 8=下载权限
            item.trans_param.is_super_vip = 1;
        }
    };

    if (obj.data && Array.isArray(obj.data)) {
        obj.data.forEach(audioItem => {
            handleAudioItem(audioItem); // 处理主条目 (album/audio)

            if (audioItem.relate_goods && Array.isArray(audioItem.relate_goods)) {
                audioItem.relate_goods.forEach(goods => {
                    handleAudioItem(goods);
                });
            }
        });
    }
}


if (url.includes('/v1/b_res_vip')) {
    obj.error_code = 0;
    obj.status = 1;
    obj.message = "开始下载";
    obj.mstore_location = 'hxy:${timestamp}';
}
if (url.includes('/welfare/diy/v1') || url.includes('/v1/consumption')) {
    obj.error_code = 0;
    obj.status = 1;
}
if (url.includes('/v5/url')) {
    obj.status = 1;
}

// --- 资源权限处理 (lite 接口) ---
if (url.includes('v1/get_res_privilege/lite')) {
    // 1. 设置顶层字段
    obj.status = 1;
    obj.error_code = 0;
    obj.message = "";
    obj.appid_group = 1;  
    obj.should_cache = 1;
    obj.vip_user_type = 3;
    
    // 2. 处理用户信息与配额
    if (obj.userinfo) {
        obj.userinfo.vip_type = 4; // 豪华 VIP 标识
        obj.userinfo.m_type = 1;
        obj.userinfo.vip_user_type = 3;
        obj.userinfo.quota_remain = 999999;
    }

    // 3. 处理音频数据列表 (包含专辑、单曲、关联音质)
    if (obj.data && Array.isArray(obj.data)) {
        obj.data.forEach((audioItem) => {
            // 定义一个内部函数，严格按照你提供的参考值进行赋值
            const applyFields = (item) => {
                if (!item) return;
                // 基础权限设置
                item.privilege = 10;
                item.status = 1;
                item.fail_process = 0;
                item.pay_type = 0;
                item.price = 0;
                item.pkg_price = 0;
                item.buy_count = 1;
                item.buy_count_vip = 1;
                item.buy_count_kubi = 1;
                item.buy_count_audios = 1;
                item.is_publish = 1;
                item.publish = 1;
                item.expire = 4102444799; // 永不过期
                
                if (item.popup) delete item.popup;
                item._msg = "Allow: the audio is free(copyright).";
                item._errno = 0;
                
                // trans_param 内部核心权限
                if (item.trans_param) {
                    item.trans_param.is_super_vip = 1;
                    item.trans_param.audio_privilege = 10;
                    item.trans_param.musicpack_advance = 0;
                    item.trans_param.pay_block_tpl = 1;
                    item.trans_param.display = 0;
                    item.trans_param.display_rate = 0;
                    item.trans_param.free_limited = 0;
                    item.trans_param.all_quality_free = 1;
                    item.trans_param.download_privilege = 8;
                    
                    // 注入关键 classmap 与 appid
                    item.trans_param.classmap = { "attr0": 234881032 };
                    item.trans_param.appid_block = "3124";
                }
            };

            // 处理主节点
            applyFields(audioItem);
            
            // 处理嵌套的音质节点 (relate_goods)
            if (audioItem.relate_goods && Array.isArray(audioItem.relate_goods)) {
                audioItem.relate_goods.forEach((goods) => {
                    applyFields(goods);
                });
            }
        });
    }
}

// --- 价格提示处理 (get_tips 接口) ---
else if (url.includes('v4/price/get_tips')) {
    if (obj.data && obj.data.get_tips) {
        obj.data.get_tips.forEach(tip => {
            tip.user_type = 29;
            tip.price = 0;
            tip.next_price = 0;
            tip.price_text = "0";
            if (tip.tips) {
                tip.tips.forEach(tipItem => {
                    tipItem.originalPrice = "0";
                    tipItem.discount = "10";
                    tipItem.discountText = "免费享受";
                });
            }
        });
    }
}


if (url.includes('/user/vipinfo')) {
    obj.data.is_vip = 1;   
    obj.data.vip_type = 6;   
    obj.data.user_type = 29;
    obj.data.m_type = 1;
    obj.data.m_y_endtime = "2099-12-31 15:14:48";
    obj.data.h_y_endtime = "2099-12-31 15:14:48";
    obj.data.vip_y_endtime = "2099-12-31 15:14:48";
    obj.data.vip_end_time = "2099-12-31 15:14:48";
    obj.data.su_vip_y_endtime = "2099-12-31 15:14:48";
    obj.data.su_vip_end_time = "2099-12-31 15:14:48";
    obj.data.su_vip_begin_time = "2024-07-26 15:14:09";
    obj.data.svip_level = 9;
    obj.data.svip_score = 999999;
    obj.data.vip_clearday = "2024-07-26 15:14:09";
    obj.data.su_vip_clearday = "2024-07-26 15:14:09";
    obj.data.m_end_time = "2099-12-31 15:14:48";
}

if (url.includes('/v2/get_kg_bg_pics')) {
    if (obj && obj.data && Array.isArray(obj.data.lists)) {
        obj.data.lists.forEach(list => {
            if (list.pics && Array.isArray(list.pics)) {
                list.pics.forEach(pic => {
                    // 设置每个 pic 的 is_suvip 属性为 1
                    pic.is_suvip = 1;
                });
            }
        });
    }
}


if (url.includes('/v1/get_b_info') || url.includes('/v1/get_buy_info')) {
    if (obj && obj.data && Array.isArray(obj.data)) {
        obj.data.forEach(item => {
            item.expire = 4102444799;
            item.buy = 1; 
            item.pay_type = 0;
            item.addtime = timestamp;
            });
        }
}

if (url.includes('/pendant\/v2\/get_user_pendant')) {
    obj.data.end_time = "2099-12-31 23:59:59";
    obj.status = 1;
    obj.error_code = 0;
}

if (url.includes('/v1/userbalance')) {
    obj.data = 999999;
}

if (url.includes('/vipdress/v1/record_rack/get_user_record_rack')) {
    obj.data.can_use = 1;
}

if (url.includes('/vipenergy/v2/entrance/vip_center_user_info')) {
    obj.data.user_type = 20;
}

if (url.includes('/audio/get_buy_info?')) {
    obj.status = 1;
    obj.error_code = 0;
    obj.message = " ";
    if (Array.isArray(obj.data)) {
        obj.data.forEach(item => {
            item.buy = 1;               
            item.pay_type = 1;          
            item.is_super_vip = 1;      
            item.asset_type = 1;        
            item.expire = 4102444799;   
            item.addtime = 1735447856;  
            item.buy_type = "1";        
        });
    }
}


if (url.includes('/app/i/getSongInfo\.php')) {
   if(obj && obj.privilege === 10)  {
      obj.privilege = 0;  // 设置无版权限制
  obj["128privilege"] = 0;
  obj["320privilege"] = 0;
  obj["sqprivilege"] = 0;
  obj["highprivilege"] = 0;
  obj.pay_type = 0;  // 设置为无需支付
  obj.fail_process = 0; // 无错误处理
  obj.error = "";  // 清除错误信息
  obj.trans_param.appid_block = "";  // 去除 appid 限制
  }
}


if (url.includes('api/v5url')) {
    // 只有在 status 为 0 (报错) 时才介入处理
    if (obj.status === 0) {
        if (obj.attempts && obj.attempts[0]) {
            let att = obj.attempts[0];
            
            // 修正顶层状态，欺骗 App 认为成功
            obj.status = 1;
            obj.error = "";
            
            // 提取关键链接并注入参数
            if (att.target) {
                att.target = att.target
                    .replace(/vipType=0/g, "vipType=6")
                    .replace(/vipToken=/g, "vipToken=" + vipToken) // 确保你定义了 vipToken 变量
                    .replace(/IsFreePart=1/g, "IsFreePart=0");
                
                // 关键步骤：由于 status 为 0 时原始数据没有 data 节点，必须手动创建
                obj.data = {
                    "url": [att.target],
                    "status": 1,
                    "fmt": "flac",
                    "hash": att.hash || ""
                };
            }
            
            // 修正 attempt 内部状态
            att.status = 1;
            att.ok = true;
        }
    }
}


// --- 3. 歌曲后台详情处理  ---
if (url.includes('v1/audio/client_bg')) {
    if (data.data && Array.isArray(data.data)) {
        data.data.forEach((item) => {
            if (item.copyright) {
                item.copyright.all_quality_free = 1;
                item.copyright.audio_pay_type = 0;
                item.copyright.album_pay_type = 0;
                item.copyright.audio_price = 0;
                item.copyright.album_price = 0;
                
                if (item.copyright.qualities) {
                    Object.keys(item.copyright.qualities).forEach(key => {
                        let q = item.copyright.qualities[key];
                        q.privilege = 10;
                        q.raw_privilege = 10;
                        q.sale_mode = {
                            "play": 0,
                            "raw_play": 0,
                            "download": 0,
                            "raw_download": 0
                        };
                    });
                }

                if (item.copyright.trans_param) {
                    item.copyright.trans_param.classmap = { "attr0": 234881032 };
                    item.copyright.trans_param.pay_block_tpl = 1;
                }
            }
            if (item.base) {
                item.base.is_publish = 1;
            }
        });
    }
}

// VIP 等级详情
if (url.includes('vip_level/detail')) {
    if (obj.data) {
        obj.data.grade = 9;
        obj.data.growth = 999999;
        obj.data.daily_growth = "20";
        obj.data.level_start_growth = 300000;
        obj.data.next_level_growth = 0;
        obj.data.popup_status = 0;
        if (obj.data.growth_conf && Array.isArray(obj.data.growth_conf)) {
            obj.data.growth_conf.forEach(item => {
                item.need_super_vip = 1;
            });
        }
    }
}



$done({ body: JSON.stringify(obj) });