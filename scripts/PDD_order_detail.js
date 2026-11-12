/**
 * 拼多多 - 订单详情页商品推荐移除
 * 对应 Loon: response.json.delete("data.goods_list")
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (obj.data) delete obj.data.goods_list;
    body = JSON.stringify(obj);
} catch (e) {
    console.log("PDD order detail: " + e.message);
}
$done({ body });
