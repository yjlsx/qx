/**
 * 爱奇艺 - 瀑布流广告移除
 * 对应 Loon: del base.statistics + del block_class
 */

function removeBlockClass(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
        return obj.filter(item => !(item && typeof item === "object" && item.block_class !== undefined))
                  .map(item => removeBlockClass(item));
    }
    const result = {};
    for (const key of Object.keys(obj)) {
        if (obj[key] && typeof obj[key] === "object" && obj[key].block_class !== undefined) {
            continue;
        }
        result[key] = removeBlockClass(obj[key]);
    }
    return result;
}

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (obj.base && obj.base.statistics && obj.base.statistics.ad_str) {
        delete obj.base.statistics;
    }
    obj = removeBlockClass(obj);
    body = JSON.stringify(obj);
} catch (e) {
    console.log("iQiYi waterfall: " + e.message);
}
$done({ body });
