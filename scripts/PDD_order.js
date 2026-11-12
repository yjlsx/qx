/**
 * 拼多多 - 订单页营销横幅移除
 * 对应 Loon: response.json.delete(["marketing_banner_vo", "shipping.banner_above_recommend"])
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    delete obj.marketing_banner_vo;
    if (obj.shipping) delete obj.shipping.banner_above_recommend;
    body = JSON.stringify(obj);
} catch (e) {
    console.log("PDD order: " + e.message);
}
$done({ body });
