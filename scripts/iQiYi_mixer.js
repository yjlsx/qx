/**
 * 爱奇艺 - 广告混合器拦截
 * 对应 Loon: response.json.delete("adSlots")
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (obj.adSlots) delete obj.adSlots;
    body = JSON.stringify(obj);
} catch (e) {
    console.log("iQiYi mixer: " + e.message);
}
$done({ body });
