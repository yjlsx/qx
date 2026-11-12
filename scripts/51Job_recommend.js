/**
 * 前程无忧 - 职位推荐页广告移除
 * 对应 Loon: response.json.delete("resultbody.adsTabFeeds")
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (obj.resultbody && obj.resultbody.adsTabFeeds) {
        delete obj.resultbody.adsTabFeeds;
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("51Job recommend: " + e.message);
}
$done({ body });
