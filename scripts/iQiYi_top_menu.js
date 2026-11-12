/**
 * 爱奇艺 - 顶部导航精简
 * 只保留指定的 nav id
 * 对应 Loon: jq nav_group_data[].nav_list filter
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    const keepIds = ["0", "2", "1007", "1", "6", "3"];
    if (Array.isArray(obj.nav_group_data)) {
        obj.nav_group_data.forEach(group => {
            if (Array.isArray(group.nav_list)) {
                group.nav_list = group.nav_list.filter(id => keepIds.includes(id));
            }
        });
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("iQiYi top menu: " + e.message);
}
$done({ body });
