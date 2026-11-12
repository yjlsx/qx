/**
 * 拼多多 - 订单列表增长提示移除
 * 对应 Loon: response.json.jq orders -> order_buttons -> del order_growth_tip
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (Array.isArray(obj.orders)) {
        obj.orders.forEach(order => {
            if (Array.isArray(order.order_buttons)) {
                order.order_buttons.forEach(btn => {
                    delete btn.order_growth_tip;
                });
            }
        });
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("PDD order list: " + e.message);
}
$done({ body });
