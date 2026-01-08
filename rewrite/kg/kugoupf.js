
/**
 [rewrite_local]


[rewrite_local]
# 酷狗唱片机皮肤净化与解锁
^https?:\/\/gateway\.kugou\.com\/(player\/v1\/model\/list|vipdress\/v1\/record_rack\/set_(user_record_rack|record_rack_check)) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kg/kugoupf.js



[mitm]
hostname = gateway.kugou.com, vip.kugou.com, gatewayretry.kugou.com, sentry.kugou.com, vipdress.kugou.com

 */

// 辅助函数：解析URL参数
const getUrlParam = (url, name) => {
    const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
    const r = url.split('?')[1] ? url.split('?')[1].match(reg) : null;
    if (r != null) return unescape(r[2]);
    return null;
};

// ===========================================
// 1. 播放器皮肤列表 (model/list)
//    优化：使用内存映射表 (Map) 暂存，最后一次性写入，杜绝卡顿
// ===========================================
if (url.includes("/player/v1/model/list")) {
    // 定义一个内存对象，用来暂存本次抓取到的所有 ID:URL 对
    let skinMap = {};
    let count = 0;

    const deepClean = (data) => {
        if (typeof data !== 'object' || data === null) return;
        
        // 识别皮肤节点
        if (data.theme_id || data.record_id) {
            // --- A. 基础解锁逻辑 (内存操作，极快) ---
            data.is_free = "1";
            data.can_use = 1;
            data.is_buy = 1;
            data.has_authority = true;
            data.vip_level = 0;
            data.is_svip = 0;
            data.vip_type = 1;
            data.model_label = "5"; 
            data.limit_free_info = { "limit_free_status": 1, "free_end_time": 4102415999 };

            // 修复特殊类型
            if (data.theme_type === "3" || data.theme_type === "4") data.theme_type = "1";
            if (data.theme_type === "5" || data.theme_content_5) {
                data.label_name = "";
                if (data.theme_content_5) {
                    data.theme_content_5.label_name = "";
                    data.theme_content_5.free_type = 0;
                }
            }
            
            // 清理干扰
            data.corner_mark = "";
            data.label_url = "";
            if (data.ext_params) {
                data.ext_params.vip_level = 0;
                data.ext_params.label_info = "";
                data.ext_params.corner_mark = "";
            }

            // --- B. 【核心优化】批量抓取逻辑 ---
            // 只要有 zip 地址，就先存到 skinMap 对象里，不进行耗时的 IO 操作
            let realUrl = data.record_rack_url || data.zip || data.url || "";
            let skinId = data.record_id || data.record_rack_id;

            if (skinId && realUrl && realUrl.includes(".zip")) {
                skinMap[skinId] = realUrl; // 存入内存
                count++;
            }
        }
        
        for (let key in data) deepClean(data[key]);
    };
    
    // 执行遍历
    deepClean(obj);

    // --- C. 遍历结束后，一次性写入存储 ---
    if (count > 0) {
        // 将整个 Map 转为 JSON 字符串存储，只执行一次 IO
        // 使用 try-catch 防止数据量过大报错（虽然一般不会）
        try {
            // 先读取旧的缓存(如果有)，进行合并，防止覆盖掉上次抓取的其他数据
            let oldMapStr = $prefs.valueForKey("kg_skin_map_v2");
            let finalMap = oldMapStr ? JSON.parse(oldMapStr) : {};
            
            // 合并新数据
            Object.assign(finalMap, skinMap);
            
            // 写入
            $prefs.setValueForKey(JSON.stringify(finalMap), "kg_skin_map_v2");
            console.log(`❚ [KG_Player] 性能优化模式：已批量缓存 ${count} 个皮肤地址`);
        } catch (e) {
            console.log("❚ [KG_Player] 缓存写入失败: " + e);
        }
    } else {
        console.log("❚ [KG_Player] 列表处理完成 (本次未发现新资源地址)");
    }
}

// ===========================================
// 2. 皮肤设置接口 (set_user_record_rack)
//    功能：从大缓存中读取地址
// ===========================================
if (url.includes("record_rack/set_record_rack_check") || url.includes("record_rack/set_user_record_rack")) {
    obj.errcode = 0;
    obj.status = 1;
    obj.errmsg = "";
    if (!obj.data) obj.data = {};

    obj.data.can_use = 1;
    obj.data.is_set = 1;
    obj.data.record_rack_status = 1;
    obj.data.has_authority = true;
    obj.data.access = 1;
    obj.data.is_buy = 1;
    obj.data.vip_type = 0;
    obj.data.free_type = 3;
    obj.data.end_time = "2099-12-31 23:59:59";

    // 默认替补 (Twinkle)
    let finalZip = "https://vipimgbssdl.kugou.com/ce28fd025f628de3dd2e5b23a8aba9aa.zip";
    let finalImg = "https://vipimgbssdl.kugou.com/20d5d19363416d1444489a43fea884fd.png";

    // 获取当前 ID
    let currentId = getUrlParam(url, "record_rack_id") || getUrlParam(url, "id");
    
    // 从大缓存中查找
    let cacheStr = $prefs.valueForKey("kg_skin_map_v2");
    if (cacheStr && currentId) {
        try {
            let bigMap = JSON.parse(cacheStr);
            if (bigMap[currentId]) {
                console.log("❚ [KG_Set] 命中缓存，使用真实地址! ID: " + currentId);
                finalZip = bigMap[currentId];
            } else {
                console.log("❚ [KG_Set] 缓存未命中，使用默认替补");
            }
        } catch (e) {
            console.log("❚ [KG_Set] 读取缓存出错");
        }
    }

    // 注入地址
    if (!obj.data.record_rack_url) obj.data.record_rack_url = finalZip;
    // 图片如果没给，也用替补的（或者你可以考虑在上面列表里把图片也缓存了，逻辑一样）
    if (!obj.data.user_share_img) obj.data.user_share_img = finalImg;
    if (!obj.data.share_img) obj.data.share_img = finalImg;
    if (!obj.data.record_rack_img) obj.data.record_rack_img = finalImg;

    // 清理弹窗
    obj.data.need_popup = 0;
    obj.data.popup_type = 0;
    obj.data.popup_content = "";
    obj.data.popup_button = "";
    obj.data.jump_url = "";
    const popupFields = ["popup_Info", "popup_info", "button_info", "popup_info_v2"];
    popupFields.forEach(f => {
        obj.data[f] = { "popup_type": 0, "popup_button": "", "jump_url": "", "popup_content": "" };
    });
}