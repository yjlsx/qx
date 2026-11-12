/**
 * 快手 - 直播广场横幅移除
 * 对应 Loon: response.json.delete("data.banners")
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (obj.data && obj.data.banners) delete obj.data.banners;
    body = JSON.stringify(obj);
} catch (e) {
    console.log("KuaiShou live banner: " + e.message);
}
$done({ body });
