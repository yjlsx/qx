
/**
 [rewrite_local]


[rewrite_local]
# 酷狗唱片机皮肤净化与解锁
^https?:\/\/gateway\.kugou\.com\/(player\/v1\/model\/list|vipdress\/v1\/record_rack\/set_(user_record_rack|record_rack_check)) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kg/kugoupf.js



[mitm]
hostname = gateway.kugou.com, vip.kugou.com, gatewayretry.kugou.com, sentry.kugou.com, vipdress.kugou.com

 */

// ===========================================
// 核心修复：定义 url 和 body 变量
// ===========================================
const url = $request.url;
const body = $response.body;
let obj = {};

// 安全解析 JSON，防止报错
try {
    obj = JSON.parse(body);
} catch (e) {
    console.log("❌ JSON 解析失败，跳过处理");
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
//    功能：解锁限免 + 批量抓取真实地址存入缓存
// ===========================================
if (url.includes("/player/v1/model/list")) {
    // 内存暂存对象
    let skinMap = {};
    let count = 0;

    const deepClean = (data) => {
        if (typeof data !== 'object' || data === null) return;
        
        // 识别皮肤/唱片节点
        if (data.theme_id || data.record_id) {
            // --- A. 解锁显示 ---
            data.is_free = "1";
            data.can_use = 1;
            data.is_buy = 1;
            data.has_authority = true;
            data.vip_level = 0;
            data.is_svip = 0;
            data.vip_type = 1;
            data.model_label = "5"; 
            data.limit_free_info = { "limit_free_status": 1, "free_end_time": 4102415999 };

            // 修正皮肤类型
            if (data.theme_type === "3" || data.theme_type === "4") data.theme_type = "1";
            
            // 修正动态皮肤 (Type 5) 内部标签
            if (data.theme_type === "5" || data.theme_content_5) {
                data.label_name = "";
                if (data.theme_content_5) {
                    data.theme_content_5.label_name = "";
                    data.theme_content_5.free_type = 0;
                }
            }
            
            // 清理视觉干扰
            data.corner_mark = "";
            data.label_url = "";
            if (data.ext_params) {
                data.ext_params.vip_level = 0;
                data.ext_params.label_info = "";
                data.ext_params.corner_mark = "";
            }

            // --- B. 抓取资源地址 ---
            let realUrl = data.record_rack_url || data.zip || data.url || "";
            let skinId = data.record_id || data.record_rack_id;

            // 如果发现有 zip 地址，暂存到内存
            if (skinId && realUrl && realUrl.includes(".zip")) {
                skinMap[skinId] = realUrl;
                count++;
            }
        }
        
        // 递归
        for (let key in data) deepClean(data[key]);
    };
    
    // 执行处理
    deepClean(obj);

    // --- C. 一次性写入缓存 (防卡顿) ---
    if (count > 0) {
        try {
            let oldMapStr = $prefs.valueForKey("kg_skin_map_v2");
            let finalMap = oldMapStr ? JSON.parse(oldMapStr) : {};
            Object.assign(finalMap, skinMap); // 合并新旧数据
            $prefs.setValueForKey(JSON.stringify(finalMap), "kg_skin_map_v2");
            console.log(`❚ [KG_Player] 已缓存 ${count} 个新皮肤地址`);
        } catch (e) {
            console.log("❚ [KG_Player] 缓存写入异常");
        }
    }
}

// ===========================================
// 2. 皮肤设置接口 (set_user_record_rack)
//    功能：强制成功 + 优先使用真实地址 + 替补保底
// ===========================================
if (url.includes("record_rack/set_record_rack_check") || url.includes("record_rack/set_user_record_rack")) {
    // 强制修正状态码 (解决 36303 错误)
    obj.errcode = 0;
    obj.status = 1;
    obj.errmsg = "";
    if (!obj.data) obj.data = {};

    // 权限全开
    obj.data.can_use = 1;
    obj.data.is_set = 1;
    obj.data.record_rack_status = 1;
    obj.data.has_authority = true;
    obj.data.access = 1;
    obj.data.is_buy = 1;
    obj.data.vip_type = 0;
    obj.data.free_type = 3;
    obj.data.end_time = "2099-12-31 23:59:59";

    // 默认替补资源 (Twinkle)
    let finalZip = "https://vipimgbssdl.kugou.com/ce28fd025f628de3dd2e5b23a8aba9aa.zip";
    let finalImg = "https://vipimgbssdl.kugou.com/20d5d19363416d1444489a43fea884fd.png";

    // 获取当前请求的 ID
    let currentId = getUrlParam(url, "record_rack_id") || getUrlParam(url, "id");
    
    // 尝试从缓存读取真实地址
    let cacheStr = $prefs.valueForKey("kg_skin_map_v2");
    if (cacheStr && currentId) {
        try {
            let bigMap = JSON.parse(cacheStr);
            if (bigMap[currentId]) {
                console.log("❚ [KG_Set] 命中真实资源! ID: " + currentId);
                finalZip = bigMap[currentId];
            } else {
                console.log("❚ [KG_Set] 未命中缓存，使用替补资源");
            }
        } catch (e) {}
    }

    // 注入地址 (如果原数据没有，则填入我们准备好的)
    if (!obj.data.record_rack_url) obj.data.record_rack_url = finalZip;
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

// ===========================================
// 结束并输出
// ===========================================
$done({ body: JSON.stringify(obj) });