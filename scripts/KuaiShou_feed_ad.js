/**
 * 快手 - 信息流广告过滤
 * 移除 feeds 中带 ad 字段的条目
 * 对应 Loon: response.json.jq feeds filter
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (Array.isArray(obj.feeds)) {
        obj.feeds = obj.feeds.filter(item => !item.ad);
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("KuaiShou feed ad: " + e.message);
}
$done({ body });
