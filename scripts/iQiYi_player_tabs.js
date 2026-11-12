/**
 * 爱奇艺 - 播放器标签页精简
 * 移除 activity_tab、各类推广卡片和 block_class
 * 对应 Loon: response.json.delete + jq del cards
 */

function removeBlockClass(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
        return obj.filter(item => !(item && typeof item === "object" && item.block_class !== undefined))
                  .map(item => removeBlockClass(item));
    }
    const result = {};
    for (const key of Object.keys(obj)) {
        if (obj[key] && typeof obj[key] === "object" && obj[key].block_class !== undefined) {
            continue;
        }
        result[key] = removeBlockClass(obj[key]);
    }
    return result;
}

let body = $response.body;
try {
    let obj = JSON.parse(body);
    // 删除活动标签
    if (obj.kv_pair) delete obj.kv_pair.activity_tab;
    // 删除推广卡片
    if (Array.isArray(obj.cards)) {
        const removeAliases = [
            "play_vip_promotion", "play_detail_tag", "play_chat_entrance",
            "play_ad_no_vip", "play_vertical_short_video", "play_rap_custom",
            "play_topical_tab", "play_vertical", "play_water_fall_like"
        ];
        obj.cards = obj.cards.filter(c => !removeAliases.includes(c.alias_name));
    }
    obj = removeBlockClass(obj);
    body = JSON.stringify(obj);
} catch (e) {
    console.log("iQiYi player tabs: " + e.message);
}
$done({ body });
