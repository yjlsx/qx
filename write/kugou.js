/**

[filter_local]
# === 静态资源 / 弹窗 ===
URL-REGEX,^https:\/\/vipssr\.kugou\.com\/static\/js\/async\/flexPayPopup,REJECT
URL-REGEX,^https:\/\/gateway\.kugou\.com\/vipssr\/prepay_ios\.html,REJECT
URL-REGEX,^https:\/\/staticssl\.kugou\.com\/common\/js-lib\/vip\/dlg_ctrler_v2\.js$,REJECT
URL-REGEX,^https:\/\/h5\.kugou\.com\/apps\/vipcenter\/_next\/static\/css,REJECT
URL-REGEX,^https:\/\/vipssr\.kugou\.com\/static\/js\/vip\/newUi\/vipPageUnionIosContent-,REJECT
URL-REGEX,^https:\/\/fx\.service\.kugou\.com\/fx\/activity\/register\/center\/sidebar\/configV2$,REJECT
URL-REGEX,^https:\/\/service1\.fanxing\.kugou\.com\/video\/mo\/live\/pull\/mutiline\/cfg,REJECT
URL-REGEX,^http:\/\/log\.web\.kugou\.com\/postEvent\.php$,REJECT

# === 广告域名 ===
DOMAIN,webvoobssdl.kugou.com,REJECT
DOMAIN,ad.tencentmusic.com,REJECT
DOMAIN,ads.service.kugou.com,REJECT
DOMAIN,adsfile.kugou.com,REJECT
DOMAIN,mdpfilebssdlbig.kugou.com,REJECT
DOMAIN,adserviceretry.kugou.com,REJECT

# === 开屏广告 IP ===
IP-CIDR,157.255.11.247/32,REJECT,no-resolve
IP-CIDR,111.206.99.202/32,REJECT,no-resolve

[rewrite_local]

^https?:\/\/(m\.kugou\.com|gateway(retry)?\.kugou\.com|ads\.service\.kugou\.com|welfare\.kugou\.com|fx\.service\.kugou\.com|hwstore\.kugou\.com|loginservice\.kugou\.com|expendablekmrcdnretry\.kugou\.com)\/(ssr\/decocenter\/home|v5\/login_by_token|v2\/get_login_extend_info|card\/v1\/pxy\/top|ads\.gateway\/v2\/sidebar_link|ads\.gateway\/v2\/sidebar_top_card|ads\.gateway\/v2\/home_card|mobile\/vipinfoV2|v4\/mobile_splash(_sort)?|v2\/get_vip_config|ads\.gateway\/v5\/task_video\/qualification|els\.abt\/v1\/tmeab|pxy\/v1\/combo\/startup|mstc\/musicsymbol\/v1\/system\/profile|pendant\/v2\/get_user_pendant|v1\/blindbox_cabinet\/client_cabinet|ads\.gateway\/v2\/mobile_link|card\/v1\/pxy\/listen|flow\/user_config\/get_level_config_ios|v1\/starlight\/get_campaign_infos|searchnofocus\/v1\/search_no_focus_word|updateservice\/v1\/get_dev_user|v1\/login_by_quick_token|card\/v1\/pxy\/recommend_stream(_v2)?|v1\/get_res_privilege\/lite|v1\/union\/audio_info|ads\.gateway\/v2\/task_center_entrance|ocean\/v6\/theme\/category|tools\.mobile\/v2\/theme\/info|promotionvip\/v3\/vip_level\/detail)$ url script-response-body https://raw.githubusercontent.com/Yu9191/Rewrite/refs/heads/main/kugou.js

^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url$ url script-request https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js



[mitm]
hostname = %APPEND% *.kugou.com, *.*.kugou.com, kg.zzxu.de



 */

