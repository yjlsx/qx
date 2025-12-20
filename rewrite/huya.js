
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
 * 
 * 仅移除广告
 */

let body = $response.body;
let obj;

try {
    obj = JSON.parse(body);

    // 1. 处理直播间信息接口 (重点修正：只删广告字段)
    if ($request.url.indexOf('getLivingInfo') !== -1 || $request.url.indexOf('getRoomAds') !== -1) {
        if (obj.data) {
            // --- 精准删除广告字段 ---
            delete obj.data.ad_config;      // 广告配置
            delete obj.data.business_ad;   // 商业广告
            delete obj.data.v_ads;         // 视频流插播广告
            
            // --- 仅清空列表，不删除父节点 ---
            if (obj.data.banner) obj.data.banner = [];
            if (obj.data.pendant) obj.data.pendant = [];
            
            // --- 过滤组件中的广告项，保留弹幕人数等组件 ---
            if (obj.data.components && Array.isArray(obj.data.components)) {
                obj.data.components = obj.data.components.filter(item => {
                    return !item.name.includes("广告") && !item.name.includes("推广");
                });
            }
            console.log(" 已精准清理直播间广告字段，保留核心数据");
        }
    }

    // 2. 处理首页 Banner
    if ($request.url.indexOf('getBannerList') !== -1) {
        if (obj.data && obj.data.list) obj.data.list = [];
    }

    // 3. 处理开屏广告
    if ($request.url.indexOf('getStartupAds') !== -1) {
        if (obj.data) {
            obj.data.ads = [];
            obj.data.ad_list = [];
        }
    }

    body = JSON.stringify(obj);
} catch (e) {
    // 针对 M3U8 视频索引的正则清理 (保持不变)
    if (body.indexOf('#EXTM3U') !== -1) {
        body = body.replace(/#EXT-X-DISCONTINUITY[\s\S]*?#EXT-X-DISCONTINUITY/g, "");
    }
}

$done({ body });
