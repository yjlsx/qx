/**
 * 快手 - 用户主页推荐移除
 * 对应 Loon: response.json.delete("postRecommends")
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (obj.postRecommends) delete obj.postRecommends;
    body = JSON.stringify(obj);
} catch (e) {
    console.log("KuaiShou profile: " + e.message);
}
$done({ body });
