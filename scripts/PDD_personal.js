/**
 * 拼多多 - 个人中心精简
 * 对应 Loon: response.json.delete 多个字段
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    delete obj.monthly_card_entrance;
    delete obj.personal_center_style_v2_vo;
    delete obj.personal_banner;
    if (obj.icon_set) {
        delete obj.icon_set.icons;
        delete obj.icon_set.top_personal_icons;
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("PDD personal: " + e.message);
}
$done({ body });
