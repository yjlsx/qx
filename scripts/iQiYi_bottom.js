/**
 * 爱奇艺 - 底栏精简 + 主题移除
 * 删除 theme_list，底栏只保留推荐和我的
 * 对应 Loon: response.json.delete("theme_list") + jq filter bottom_tab_type
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    delete obj.theme_list;
    const keepTypes = ["rec", "my"];
    if (Array.isArray(obj.cards)) {
        obj.cards = obj.cards.map(card => {
            if (Array.isArray(card.items)) {
                card.items = card.items.filter(item =>
                    item.other && keepTypes.includes(item.other.bottom_tab_type)
                );
            }
            return card;
        });
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("iQiYi bottom: " + e.message);
}
$done({ body });
