/**
 * 拼多多 - 搜索结果广告移除
 * 对应 Loon: response.json.delete("expansion")
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (obj.expansion) delete obj.expansion;
    body = JSON.stringify(obj);
} catch (e) {
    console.log("PDD search: " + e.message);
}
$done({ body });
