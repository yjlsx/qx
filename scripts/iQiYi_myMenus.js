/**
 * 爱奇艺 - 我的页面精简
 * 过滤指定 block 和 menuList 项
 * 对应 Loon: jq filter data by statistic.block and menuList statistic2.block
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (Array.isArray(obj.data)) {
        obj.data = obj.data.filter(item => {
            // 过滤掉 statistic.block == "wd_liebiao_2"
            if (item.statistic && item.statistic.block === "wd_liebiao_2") return false;
            // 过滤 menuList 中 statistic2.block == "wd_liebiao_3" 的项
            if (Array.isArray(item.menuList)) {
                item.menuList = item.menuList.filter(menu =>
                    !(menu.statistic2 && menu.statistic2.block === "wd_liebiao_3")
                );
                // 如果所有 menuList 都被过滤掉了，检查是否还有其他内容
            }
            return true;
        });
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("iQiYi myMenus: " + e.message);
}
$done({ body });
