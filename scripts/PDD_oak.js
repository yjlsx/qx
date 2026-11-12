/**
 * 拼多多 - 商品详情页底部推广移除
 * 对应 Loon: response.json.delete(["bottom_section_list", "ui.bottom_section", "ui.live_section.float_info"])
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    delete obj.bottom_section_list;
    if (obj.ui) {
        delete obj.ui.bottom_section;
        if (obj.ui.live_section) {
            delete obj.ui.live_section.float_info;
        }
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("PDD oak: " + e.message);
}
$done({ body });
