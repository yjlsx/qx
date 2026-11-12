/**
 * 前程无忧 - 好职位页横幅移除
 * 对应 Loon: response.json.delete("resultbody.bannerList")
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (obj.resultbody && obj.resultbody.bannerList) {
        delete obj.resultbody.bannerList;
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("51Job banner: " + e.message);
}
$done({ body });
