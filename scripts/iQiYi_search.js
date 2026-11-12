/**
 * 爱奇艺 - 搜索页广告移除
 * 对应 Loon: jq filter cards by alias_name + del base.statistics
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    const removeAliases = ["ad_trueview", "ad_mobile_flow", "search_mid_text_ad"];
    if (Array.isArray(obj.cards)) {
        obj.cards = obj.cards.filter(c => !removeAliases.includes(c.alias_name));
    }
    if (obj.base && obj.base.statistics && obj.base.statistics.ad_str) {
        delete obj.base.statistics;
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("iQiYi search: " + e.message);
}
$done({ body });
