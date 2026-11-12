/**
 * 爱奇艺 - 评论区广告移除
 * 只保留有 alias_name 的卡片
 * 对应 Loon: jq .cards |= map(select(has("alias_name")))
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (Array.isArray(obj.cards)) {
        obj.cards = obj.cards.filter(c => c && c.hasOwnProperty("alias_name"));
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("iQiYi comments: " + e.message);
}
$done({ body });
