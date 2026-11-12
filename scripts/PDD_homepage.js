/**
 * 拼多多 - 首页精简
 * 移除不规则横幅、图标集、搜索热词，精简底栏标签页
 * 对应 Loon: response.json.delete + jq filter on homepage/hub
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    if (obj.result) {
        // 删除不规则横幅广告
        if (obj.result.dy_module) {
            delete obj.result.dy_module.irregular_banner_dy;
        }
        // 删除图标集
        delete obj.result.icon_set;
        // 删除搜索栏热词
        delete obj.result.search_bar_hot_query;

        // 底栏只保留首页、聊天、个人中心
        const keepLinks = ["index.html", "chat_list.html", "personal.html"];
        if (Array.isArray(obj.result.bottom_tabs)) {
            obj.result.bottom_tabs = obj.result.bottom_tabs.filter(t => keepLinks.includes(t.link));
        }
        if (Array.isArray(obj.result.buffer_bottom_tabs)) {
            obj.result.buffer_bottom_tabs = obj.result.buffer_bottom_tabs.filter(t => keepLinks.includes(t.link));
        }
        // 清理顶部选项的图标
        if (Array.isArray(obj.result.all_top_opts)) {
            obj.result.all_top_opts = obj.result.all_top_opts.map(item => {
                delete item.selected_image;
                delete item.image;
                delete item.height;
                delete item.width;
                return item;
            });
        }
    }
    body = JSON.stringify(obj);
} catch (e) {
    console.log("PDD homepage: " + e.message);
}
$done({ body });
