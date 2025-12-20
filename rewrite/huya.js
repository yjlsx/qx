
/*
####################################################################
# 配置区
####################################################################
[filter_local]
# 拦截虎牙插播广告视频流与图片资源
host-suffix, ad-img.huya.com, reject
host-suffix, ad-video.huya.com, reject
host-suffix, ads-sc.huya.com, reject
host-suffix, business.huya.com, reject
host, ias.huya.com, reject
host, adid.huya.com, reject
host, sniper.huya.com, reject



[rewrite_local]
# 拦截直播间广告配置、启动广告及 Banner
^https?:\/\/.*huya\.com\/(main\/getRoomAds|config\/getStartupAds|main\/getBannerList|vapi\/getLivingInfo) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/huya.js


[mitm]
hostname = *.huya.com, analytics.huya.com, business.huya.com



*/

/*
 * 虎牙 App 全能去广告脚本 (针对插播广告、Banner、启动页)
 */

let body = $response.body;
let obj;

try {
    obj = JSON.parse(body);

    // 1. 处理直播间广告配置 (关键：针对30秒倒计时广告)
    if (body.indexOf('getRoomAds') !== -1 || body.indexOf('getLivingInfo') !== -1) {
        if (obj.data) {
            // 清空横幅广告
            obj.data.banner = [];
            // 清空挂件广告
            obj.data.pendant = [];
            // 清空视频流插播配置
            obj.data.v_ads = [];
            obj.data.ad_config = {};
            obj.data.business_ad = [];
            // 屏蔽直播间右下角悬浮球
            if (obj.data.components) {
                obj.data.components = obj.data.components.filter(item => !item.name.includes("广告"));
            }
        }
    }

    // 2. 处理首页 Banner 列表
    if (body.indexOf('getBannerList') !== -1) {
        if (obj.data && obj.data.list) {
            obj.data.list = [];
        }
    }

    // 3. 处理开屏启动广告
    if (body.indexOf('getStartupAds') !== -1) {
        if (obj.data) {
            obj.data.ads = [];
            obj.data.ad_list = [];
        }
    }

    body = JSON.stringify(obj);
} catch (e) {
    // 如果不是 JSON 格式，可能是 M3U8 视频索引
    if (body.indexOf('#EXTM3U') !== -1) {
        // 尝试删除 HLS 插入标记
        body = body.replace(/#EXT-X-DISCONTINUITY[\s\S]*?#EXT-X-DISCONTINUITY/g, "");
    }
}

$done({ body });
