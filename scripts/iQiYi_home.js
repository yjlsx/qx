/**
 * 爱奇艺 - 首页精简
 * 移除统计、焦点图广告、信息流广告、trueview广告
 * 对应 Loon: response.json.delete("base.statistics") + jq del focus/ad cards
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    // 删除统计
    if (obj.base) delete obj.base.statistics;
    // 删除广告卡片
    if (Array.isArray(obj.cards)) {
        const removeAliases = ["focus", "ad_mobile_flow", "ad_trueview"];
        obj.cards = obj.cards.filter(c => !removeAliases.includes(c.alias_name));
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("iQiYi home: " + e.message);
}
$done({ body });
