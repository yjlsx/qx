/**
 * 爱奇艺 - 搜索建议广告移除
 * 对应 Loon: response.json.delete("data")
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (obj.data) delete obj.data;
    body = JSON.stringify(obj);
} catch (e) {
    console.log("iQiYi search suggest: " + e.message);
}
$done({ body });
