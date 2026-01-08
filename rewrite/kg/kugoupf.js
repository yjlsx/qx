
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

// 辅助函数：解析 URL 参数
const getUrlParam = (url, name) => {
    const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
    const r = url.split('?')[1] ? url.split('?')[1].match(reg) : null;
    if (r != null) return unescape(r[2]);
    return null;
};

// 配置参数
const MAX_CACHE_SIZE = 100;  // 限制缓存的最大数量
const CACHE_EXPIRY_TIME = 86400000; // 1天 (以毫秒为单位)
let memoryCache = {}; // 内存缓存

// ===========================================
// 1. 捕获皮肤列表并存储皮肤 ID 和 URL
// ===========================================
if (url.includes("/player/v1/model/list")) {
    let skinMap = {};
    let count = 0;

    // 深度搜索函数，用于查找皮肤的 URL
    const findResources = (item) => {
        if (item.record_rack_url) return item.record_rack_url;
        if (item.zip) return item.zip;
        if (item.url && item.url.includes(".zip")) return item.url;
        
        if (item.file_hash) return `https://vipimgbssdl.kugou.com/${item.file_hash}.zip`;
        if (item.zip_hash) return `https://vipimgbssdl.kugou.com/${item.zip_hash}.zip`;
        
        if (item.extra && item.extra.file_hash) return `https://vipimgbssdl.kugou.com/${item.extra.file_hash}.zip`;
        
        return null;
    };

    const deepClean = (data) => {
        if (typeof data !== 'object' || data === null) return;
        
        if (data.theme_id || data.record_id) {
            let skinId = data.record_id || data.record_rack_id;
            
            // 保存皮肤 ID 和 URL
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

    // 存入内存缓存并限制缓存大小
    if (count > 0) {
        if (Object.keys(memoryCache).length >= MAX_CACHE_SIZE) {
            // 如果缓存达到最大数量，删除最早的缓存
            let keys = Object.keys(memoryCache);
            delete memoryCache[keys[0]]; // 删除最早的一个
        }
        Object.assign(memoryCache, skinMap);
        console.log(`❚ [KG_Player] 内存缓存更新: 捕获 ${count} 个资源地址`);
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
    
    // 从内存缓存查找对应的皮肤地址
    if (memoryCache && currentId && memoryCache[currentId]) {
        let matchedUrl = memoryCache[currentId];
        if (matchedUrl) {
            console.log(`✅ [KG_Set] 命中资源: ${currentId} -> ${matchedUrl}`);
            obj.data.record_rack_url = matchedUrl;
        } else {
            console.log(`⚠️ [KG_Set] 列表里未发现 ID:${currentId} 的 URL`);
            obj.data.record_rack_url = ""; // 返回空 URL 或者适当的错误处理
        }
    } else {
        console.log("⚠️ [KG_Set] 缓存为空或未找到对应的 ID");
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
