
/**
 [rewrite_local]


[rewrite_local]
# 酷狗唱片机皮肤净化与解锁
^https?:\/\/gateway\.kugou\.com\/(player\/v1\/model\/list|vipdress\/v1\/record_rack\/set_(user_record_rack|record_rack_check)) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kg/kugoupf.js



[mitm]
hostname = gateway.kugou.com, vip.kugou.com, gatewayretry.kugou.com, sentry.kugou.com, vipdress.kugou.com

 */
// ===========================================
// 基础初始化
// ===========================================
const url = $request.url;
const body = $response.body;
let obj = {};

try {
    obj = JSON.parse(body);
} catch (e) {
    console.log("❌ JSON 解析失败");
    $done({});
}

// 辅助函数：解析URL参数
const getUrlParam = (url, name) => {
    const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
    const r = url.split('?')[1] ? url.split('?')[1].match(reg) : null;
    if (r != null) return unescape(r[2]);
    return null;
};

// ===========================================
// 1. 播放器皮肤列表 (model/list)
//    功能：寻找 ZIP 地址 或 Hash 值
// ===========================================
if (url.includes("/player/v1/model/list")) {
    let skinMap = {};
    let count = 0;

    // 深度搜索函数
    const findResources = (item) => {
        // 1. 找现成的 ZIP 地址
        if (item.record_rack_url) return item.record_rack_url;
        if (item.zip) return item.zip;
        if (item.url && item.url.includes(".zip")) return item.url;
        
        // 2. 找 Hash 值并构造地址 (这是破局的关键!)
        // 常见的 Hash 字段名: file_hash, zip_hash, hash
        if (item.file_hash) return `https://vipimgbssdl.kugou.com/${item.file_hash}.zip`;
        if (item.zip_hash) return `https://vipimgbssdl.kugou.com/${item.zip_hash}.zip`;
        
        // 3. 递归查找 extra / ext_params
        if (item.extra && item.extra.file_hash) return `https://vipimgbssdl.kugou.com/${item.extra.file_hash}.zip`;
        
        return null;
    };

    const deepClean = (data) => {
        if (typeof data !== 'object' || data === null) return;
        
        // 识别皮肤节点
        if (data.theme_id || data.record_id) {
            let skinId = data.record_id || data.record_rack_id;
            
            // --- 界面解锁 (保持不变) ---
            data.is_free = "1";
            data.can_use = 1;
            data.is_buy = 1;
            data.has_authority = true;
            data.vip_level = 0;
            data.is_svip = 0;
            data.vip_type = 1;
            data.model_label = "5"; 
            data.limit_free_info = { "limit_free_status": 1, "free_end_time": 4102415999 };
            if (data.theme_type === "3" || data.theme_type === "4") data.theme_type = "1";
            if (data.theme_type === "5" || data.theme_content_5) {
                data.label_name = "";
                if (data.theme_content_5) {
                    data.theme_content_5.label_name = "";
                    data.theme_content_5.free_type = 0;
                }
            }
            data.corner_mark = "";
            data.label_url = "";
            if (data.ext_params) data.ext_params.vip_level = 0;

            // --- 【核心】抓取或构造地址 ---
            if (skinId) {
                let targetUrl = findResources(data);
                if (targetUrl) {
                    skinMap[skinId] = targetUrl;
                    count++;
                }
            }
        }
        
        for (let key in data) deepClean(data[key]);
    };
    
    deepClean(obj);

    // 存入缓存
    if (count > 0) {
        try {
            let oldMapStr = $prefs.valueForKey("kg_skin_map_v2");
            let finalMap = oldMapStr ? JSON.parse(oldMapStr) : {};
            Object.assign(finalMap, skinMap);
            $prefs.setValueForKey(JSON.stringify(finalMap), "kg_skin_map_v2");
            console.log(`❚ [KG_Player] 缓存库更新: 捕获 ${count} 个资源地址`);
        } catch (e) {}
    }
}

// ===========================================
// 2. 皮肤设置接口 (set_user_record_rack)
//    功能：强制成功 + 注入刚才构造的地址
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

    // 获取当前请求的 ID
    let currentId = getUrlParam(url, "record_rack_id") || getUrlParam(url, "id");
    
    // 读取缓存
    let cacheStr = $prefs.valueForKey("kg_skin_map_v2");
    
    if (cacheStr && currentId) {
        try {
            let bigMap = JSON.parse(cacheStr);
            let matchedUrl = bigMap[currentId];
            
            if (matchedUrl) {
                console.log(`✅ [KG_Set] 命中资源: ${currentId} -> ${matchedUrl}`);
                obj.data.record_rack_url = matchedUrl;
            } else {
                console.log(`⚠️ [KG_Set] 列表里未发现 ID:${currentId} 的 URL 或 Hash`);
            }
        } catch (e) {}
    }

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

$done({ body: JSON.stringify(obj) });