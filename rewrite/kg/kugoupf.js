
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
//    功能：按 ID 精准提取下载地址 + 界面解锁
// ===========================================
if (url.includes("/player/v1/model/list")) {
    let skinMap = {};
    let count = 0;

    // --- 定义一个函数，专门在一个皮肤对象里找 URL ---
    const extractSkinUrl = (item) => {
        // 1. 先找最显眼的位置
        if (item.record_rack_url) return item.record_rack_url;
        if (item.zip) return item.zip;
        if (item.url && item.url.includes(".zip")) return item.url;
        
        // 2. 找 extra / ext_params 里的藏匿点
        if (item.extra && item.extra.zip) return item.extra.zip;
        if (item.ext_params && item.ext_params.down_url) return item.ext_params.down_url;

        // 3. 找 theme_content_5 (动态皮肤) 里的地址
        if (item.theme_content_5 && item.theme_content_5.zip) return item.theme_content_5.zip;
        
        return null;
    };

    const deepClean = (data) => {
        if (typeof data !== 'object' || data === null) return;
        
        // 命中一个皮肤节点
        if (data.theme_id || data.record_id) {
            let skinId = data.record_id || data.record_rack_id;
            
            // --- A. 界面显示解锁 (保持之前的功能) ---
            data.is_free = "1";
            data.can_use = 1;
            data.is_buy = 1;
            data.has_authority = true;
            data.vip_level = 0;
            data.is_svip = 0;
            data.vip_type = 1;
            data.model_label = "5"; 
            data.limit_free_info = { "limit_free_status": 1, "free_end_time": 4102415999 };
            
            // 修复类型和标签
            if (data.theme_type === "3" || data.theme_type === "4") data.theme_type = "1";
            if (data.theme_type === "5" || data.theme_content_5) {
                data.label_name = "";
                if (data.theme_content_5) {
                    data.theme_content_5.label_name = "";
                    data.theme_content_5.free_type = 0;
                }
            }
            // 清理角标
            data.corner_mark = "";
            data.label_url = "";
            if (data.ext_params) data.ext_params.vip_level = 0;

            // --- B. 【核心】按 ID 抓取地址并绑定 ---
            if (skinId) {
                let targetUrl = extractSkinUrl(data);
                
                // 只有当找到了 zip 地址，才存入 map
                if (targetUrl && targetUrl.includes(".zip")) {
                    skinMap[skinId] = targetUrl; // 关键：ID 和 URL 一一对应
                    count++;
                }
            }
        }
        
        // 递归遍历子节点
        for (let key in data) deepClean(data[key]);
    };
    
    deepClean(obj);

    // 将匹配好的 ID-URL 对写入缓存
    if (count > 0) {
        try {
            // 读取旧缓存合并，防止丢失
            let oldMapStr = $prefs.valueForKey("kg_skin_map_v2");
            let finalMap = oldMapStr ? JSON.parse(oldMapStr) : {};
            
            Object.assign(finalMap, skinMap);
            
            $prefs.setValueForKey(JSON.stringify(finalMap), "kg_skin_map_v2");
            console.log(`❚ [KG_Player] 已更新 ${count} 个皮肤的 ID-URL 绑定`);
        } catch (e) {}
    } else {
        console.log(`❚ [KG_Player] 列表扫描完成，未发现包含ZIP的皮肤`);
    }
}

// ===========================================
// 2. 皮肤设置接口 (set_user_record_rack)
//    功能：根据 ID 从缓存里取回对应的 URL
// ===========================================
if (url.includes("record_rack/set_record_rack_check") || url.includes("record_rack/set_user_record_rack")) {
    obj.errcode = 0;
    obj.status = 1;
    obj.errmsg = "";
    if (!obj.data) obj.data = {};

    // 基础全开
    obj.data.can_use = 1;
    obj.data.is_set = 1;
    obj.data.record_rack_status = 1;
    obj.data.has_authority = true;
    obj.data.access = 1;
    obj.data.is_buy = 1;
    obj.data.vip_type = 0;
    obj.data.free_type = 3;
    obj.data.end_time = "2099-12-31 23:59:59";

    // --- 【核心步骤】按 ID 找回地址 ---
    // 1. 获取你要设置的那个皮肤的 ID
    let currentId = getUrlParam(url, "record_rack_id") || getUrlParam(url, "id");
    
    // 2. 打开缓存本
    let cacheStr = $prefs.valueForKey("kg_skin_map_v2");
    
    // 3. 只有 ID 匹配时才填入地址
    if (cacheStr && currentId) {
        try {
            let bigMap = JSON.parse(cacheStr);
            let matchedUrl = bigMap[currentId];
            
            if (matchedUrl) {
                console.log(`✅ [KG_Set] ID匹配成功! ID:${currentId} -> URL:${matchedUrl}`);
                obj.data.record_rack_url = matchedUrl;
            } else {
                console.log(`⚠️ [KG_Set] 缓存里没找到 ID:${currentId} 的地址 (列表接口可能没下发)`);
            }
        } catch (e) {
            console.log("❌ 缓存读取错误");
        }
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