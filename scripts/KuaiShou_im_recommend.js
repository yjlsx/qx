/**
 * 快手 - 私信页运营推荐移除
 * 对应 Loon: response.json.delete("data.operationRecommendationList")
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (obj.data && obj.data.operationRecommendationList) {
        delete obj.data.operationRecommendationList;
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("KuaiShou im recommend: " + e.message);
}
$done({ body });
