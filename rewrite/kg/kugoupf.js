
/**
 [rewrite_local]


[rewrite_local]
# 酷狗唱片机皮肤净化与解锁
^https?:\/\/gateway\.kugou\.com\/(player\/v1\/model\/list|vipdress\/v1\/record_rack\/set_(user_record_rack|record_rack_check)) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kg/kugoupf.js



[mitm]
hostname = gateway.kugou.com, vip.kugou.com, gatewayretry.kugou.com, sentry.kugou.com, vipdress.kugou.com

 */


// ===========================================
// ⚙️ 配置区域 (请修改这里)
// ===========================================
// 把下面的链接换成你 GitHub 上那个 skins.json 的 "Raw" 地址
const GITHUB_DB_URL = "https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kg/pifu.json";

// ===========================================
// 脚本逻辑开始
// ===========================================
const url = $request.url;
let body = $response.body;
let obj = {};

// 尝试解析
try {
    obj = JSON.parse(body);
} catch (e) {
    // 如果是 set 接口且解析失败，可能是空响应，我们需要手动构造 obj
    if (url.includes("set_user_record_rack")) {
        obj = { data: {} };
    } else {
        $done({});
    }
}

// 辅助函数：解析URL参数
const getUrlParam = (url, name) => {
    const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
    const r = url.split('?')[1] ? url.split('?')[1].match(reg) : null;
    if (r != null) return unescape(r[2]);
    return null;
};

// 辅助函数：递归查找 JSON 中的 URL
const findUrlById = (jsonData, targetId) => {
    if (typeof jsonData !== 'object' || jsonData === null) return null;
    
    // 检查当前对象是否匹配 ID
    let currentId = jsonData.record_id || jsonData.record_rack_id;
    // 注意：ID 可能是数字也可能是字符串，统一转字符串比较
    if (currentId && String(currentId) === String(targetId)) {
        // 找到了 ID，开始找地址
        if (jsonData.record_rack_url) return jsonData.record_rack_url;
        if (jsonData.zip) return jsonData.zip;
        if (jsonData.url && jsonData.url.includes(".zip")) return jsonData.url;
        if (jsonData.file_hash) return `https://vipimgbssdl.kugou.com/${jsonData.file_hash}.zip`;
    }

    // 没找到，继续递归遍历子属性
    for (let key in jsonData) {
        let result = findUrlById(jsonData[key], targetId);
        if (result) return result;
    }
    return null;
};

// ===========================================
// 1. 播放器皮肤列表 (model/list)
//    功能：仅做显示解锁 (不需要抓取了，因为你有云端数据库)
// ===========================================
if (url.includes("/player/v1/model/list")) {
    const deepClean = (data) => {
        if (typeof data !== 'object' || data === null) return;
        if (data.theme_id || data.record_id) {
            data.is_free = "1";
            data.can_use = 1;
            data.is_buy = 1;
            data.has_authority = true;
            data.vip_level = 0;
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
        }
        for (let key in data) deepClean(data[key]);
    };
    deepClean(obj);
    $done({ body: JSON.stringify(obj) });
}

// ===========================================
// 2. 皮肤设置接口 (set_user_record_rack)
//    功能：去 GitHub 查表 -> 注入地址
// ===========================================
if (url.includes("record_rack/set_record_rack_check") || url.includes("record_rack/set_user_record_rack")) {
    // 先把回包改写成成功状态
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
    
    // 清理弹窗
    obj.data.need_popup = 0;
    obj.data.popup_type = 0;
    obj.data.popup_content = "";
    obj.data.popup_button = "";
    obj.data.jump_url = "";
    ["popup_Info", "popup_info", "button_info"].forEach(f => {
        obj.data[f] = { "popup_type": 0, "popup_button": "", "jump_url": "", "popup_content": "" };
    });

    // --- 核心：去 GitHub 查数据 ---
    let currentId = getUrlParam(url, "record_rack_id") || getUrlParam(url, "id");
    
    if (currentId) {
        console.log(`❚ [KG_Cloud] 正在去 GitHub 查询 ID: ${currentId} ...`);
        
        // 发起网络请求
        $task.fetch({ url: GITHUB_DB_URL }).then(response => {
            try {
                let dbData = JSON.parse(response.body);
                // 在云端数据里查找
                let targetUrl = findUrlById(dbData, currentId);
                
                if (targetUrl) {
                    console.log(`✅ [KG_Cloud] 云端命中! ID:${currentId} -> URL:${targetUrl}`);
                    obj.data.record_rack_url = targetUrl;
                } else {
                    console.log(`⚠️ [KG_Cloud] 云端数据库未包含 ID:${currentId}`);
                }
            } catch (e) {
                console.log(`❌ [KG_Cloud] 云端数据解析失败: ${e}`);
            }
            // 无论找没找到，都要结束请求
            $done({ body: JSON.stringify(obj) });
            
        }, reason => {
            console.log(`❌ [KG_Cloud] 连接 GitHub 失败，请检查网络`);
            // 网络失败也要结束请求
            $done({ body: JSON.stringify(obj) });
        });
    } else {
        $done({ body: JSON.stringify(obj) });
    }
}