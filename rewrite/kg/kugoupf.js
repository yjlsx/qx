
/**
 [rewrite_local]


[rewrite_local]
# 酷狗唱片机皮肤净化与解锁
^https?:\/\/gateway\.kugou\.com\/(player\/v1\/model\/list|vipdress\/v1\/record_rack\/set_(user_record_rack|record_rack_check)) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kg/kugoupf.js



[mitm]
hostname = gateway.kugou.com, vip.kugou.com, gatewayretry.kugou.com, sentry.kugou.com, vipdress.kugou.com

 */


// ===========================================
// ⚙️ 配置区域
// ===========================================
// 你的 GitHub JSON 地址
const GITHUB_DB_URL = "https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kg/pifu.json";

// ===========================================
// 脚本逻辑
// ===========================================
const url = $request.url;
let body = $response.body;
let obj = {};

try {
    obj = JSON.parse(body);
} catch (e) {
    // 只有在 set 接口且解析失败时才初始化为空，防止破坏原数据
    if (url.includes("set_user_record_rack")) {
        obj = { data: {} };
    } else {
        $done({});
    }
}

// 辅助函数
const getUrlParam = (url, name) => {
    const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
    const r = url.split('?')[1] ? url.split('?')[1].match(reg) : null;
    if (r != null) return unescape(r[2]);
    return null;
};

// 递归查找 URL
const findUrlById = (jsonData, targetId) => {
    if (typeof jsonData !== 'object' || jsonData === null) return null;
    let currentId = jsonData.record_id || jsonData.record_rack_id;
    if (currentId && String(currentId) === String(targetId)) {
        if (jsonData.record_rack_url) return jsonData.record_rack_url;
        if (jsonData.zip) return jsonData.zip;
        if (jsonData.url && jsonData.url.includes(".zip")) return jsonData.url;
        if (jsonData.file_hash) return `https://vipimgbssdl.kugou.com/${jsonData.file_hash}.zip`;
    }
    for (let key in jsonData) {
        let result = findUrlById(jsonData[key], targetId);
        if (result) return result;
    }
    return null;
};

// ===========================================
// 1. 播放器皮肤列表 (model/list)
//    功能：解锁显示，去标签，但保留原结构防止灰白
// ===========================================
if (url.includes("/player/v1/model/list")) {
    const deepClean = (data) => {
        if (typeof data !== 'object' || data === null) return;
        
        if (data.theme_id || data.record_id) {
            // --- 权限解锁 ---
            data.is_free = "1";
            data.can_use = 1;
            data.is_buy = 1;
            data.has_authority = true;
            data.vip_level = 0;
            
            // 统一角标为“限免”
            data.model_label = "5"; 
            data.limit_free_info = { "limit_free_status": 1, "free_end_time": 4102415999 };

            // ❌ 【重要修复】不要强行修改 theme_type，否则经典皮肤会丢失特效变灰
            // data.theme_type = "1";  <-- 这一行删掉
            
            // 针对 Type 5 动态皮肤，只清空标签文字
            if (data.theme_content_5) {
                data.theme_content_5.label_name = "";
                data.theme_content_5.free_type = 0;
            }
            
            // 清理视觉干扰
            data.label_name = "";
            data.corner_mark = "";
            data.label_url = "";
            if (data.ext_params) {
                data.ext_params.vip_level = 0;
            }
        }
        for (let key in data) deepClean(data[key]);
    };
    deepClean(obj);
    $done({ body: JSON.stringify(obj) });
}

// ===========================================
// 2. 皮肤设置接口 (set_user_record_rack)
//    功能：优先用原地址(解决经典皮肤变灰)，没有才查GitHub
// ===========================================
if (url.includes("record_rack/set_record_rack_check") || url.includes("record_rack/set_user_record_rack")) {
    // 1. 先保存服务器原始返回的 URL (如果有的话)
    // 经典皮肤/免费皮肤，服务器这里原本是有值的
    let originalUrl = "";
    if (obj.data && obj.data.record_rack_url) {
        originalUrl = obj.data.record_rack_url;
    }

    // 2. 强制设置为成功状态
    obj.errcode = 0;
    obj.status = 1;
    obj.errmsg = "";
    if (!obj.data) obj.data = {};
    
    // 3. 补全权限字段
    obj.data.can_use = 1;
    obj.data.is_set = 1;
    obj.data.record_rack_status = 1;
    obj.data.has_authority = true;
    obj.data.access = 1;
    obj.data.is_buy = 1;
    obj.data.vip_type = 0;
    obj.data.free_type = 3;
    obj.data.end_time = "2099-12-31 23:59:59";
    
    // 4. 清理弹窗
    obj.data.need_popup = 0;
    obj.data.popup_type = 0;
    obj.data.popup_content = "";
    obj.data.popup_button = "";
    obj.data.jump_url = "";
    ["popup_Info", "popup_info", "button_info"].forEach(f => {
        obj.data[f] = { "popup_type": 0, "popup_button": "", "jump_url": "", "popup_content": "" };
    });

    // 5. 【核心逻辑】决定使用哪个地址
    if (originalUrl && originalUrl.length > 5) {
        // A. 如果服务器本来就给了地址（经典皮肤），直接用！
        console.log("✅ [KG_Set] 检测到原生地址，直接放行 (解决经典皮肤灰白)");
        obj.data.record_rack_url = originalUrl;
        $done({ body: JSON.stringify(obj) });
    } else {
        // B. 如果服务器没给地址（付费/限定），才去 GitHub 查
        let currentId = getUrlParam(url, "record_rack_id") || getUrlParam(url, "id");
        if (currentId) {
            console.log(`❚ [KG_Cloud] 原生无地址，正在查询云端 ID: ${currentId}`);
            
            $task.fetch({ url: GITHUB_DB_URL }).then(response => {
                try {
                    let dbData = JSON.parse(response.body);
                    let targetUrl = findUrlById(dbData, currentId);
                    
                    if (targetUrl) {
                        console.log(`✅ [KG_Cloud] 云端注入成功: ${targetUrl}`);
                        obj.data.record_rack_url = targetUrl;
                    } else {
                        console.log(`⚠️ [KG_Cloud] 云端未收录 ID:${currentId}`);
                    }
                } catch (e) {
                    console.log("❌ [KG_Cloud] 数据库解析失败");
                }
                $done({ body: JSON.stringify(obj) });
            }, () => {
                console.log("❌ [KG_Cloud] 网络请求失败");
                $done({ body: JSON.stringify(obj) });
            });
        } else {
            $done({ body: JSON.stringify(obj) });
        }
    }
}