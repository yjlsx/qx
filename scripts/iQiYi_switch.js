/**
 * 爱奇艺 - 通用开关广告禁用
 * 删除投屏广告资源，关闭各类广告开关
 * 对应 Loon: response.json.delete + response.json.replace
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (obj.content) {
        // 删除投屏设备广告资源
        if (obj.content.resource) {
            delete obj.content.resource.cast_device_ad;
        }
        // 关闭广告开关
        if (obj.content.switchs) {
            if (obj.content.switchs.app_ad) {
                obj.content.switchs.app_ad.app_ad_enable = 0;
                obj.content.switchs.app_ad.app_ad_duration = 0;
            }
            if (obj.content.switchs.ios_tech) {
                obj.content.switchs.ios_tech.kPreadAdHintSwitch = 0;
                obj.content.switchs.ios_tech.ad_download = 0;
            }
            if (obj.content.switchs.m_qiyi_ios_tech) {
                obj.content.switchs.m_qiyi_ios_tech.KFocusAdVideoPlayTimesIn4G = 0;
            }
        }
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("iQiYi switch: " + e.message);
}
$done({ body });
