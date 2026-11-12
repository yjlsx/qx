/**
 * 快手 - 启动配置精简
 * 移除换皮肤配置、精简侧边栏
 * 对应 Loon: response.json.delete + jq filter
 */

let body = $response.body;
try {
    let obj = JSON.parse(body);
    
    // 删除换皮肤配置和侧边栏的部分列表
    if (obj.reskinConfig) delete obj.reskinConfig;
    if (obj.sidebarExSquareStyle) {
        delete obj.sidebarExSquareStyle.moreList;
        delete obj.sidebarExSquareStyle.topList;
        
        // 仅保留指定的侧边栏项目
        const keepTitles = ["设置", "历史记录", "草稿箱", "我的钱包", "小程序", 
                           "未成年人模式", "官方客服", "内容偏好", "离线模式", 
                           "稍后再看", "举报中心", "挂件"];
        if (Array.isArray(obj.sidebarExSquareStyle.commonlyUsedList)) {
            obj.sidebarExSquareStyle.commonlyUsedList = 
                obj.sidebarExSquareStyle.commonlyUsedList.filter(item => 
                    item && keepTitles.includes(item.title)
                );
        }
    }
    
    body = JSON.stringify(obj);
} catch (e) {
    console.log("KuaiShou startup: " + e.message);
}
$done({ body });
