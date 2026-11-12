/**
 * 爱奇艺 - 分类页精简
 * 对应 Loon: del base.statistics + del focus/ad_trueview cards
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (obj.base && obj.base.statistics && obj.base.statistics.ad_str) {
        delete obj.base.statistics;
    }
    if (Array.isArray(obj.cards)) {
        const removeAliases = ["entrence_focus", "ad_trueview"];
        obj.cards = obj.cards.filter(c => !removeAliases.includes(c.alias_name));
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("iQiYi category: " + e.message);
}
$done({ body });
