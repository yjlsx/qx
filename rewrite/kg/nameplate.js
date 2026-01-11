
/**
 [rewrite_local]

# 铭牌解锁
^https?:\/\/welfare\.kugou\.com\/nameplate\/v1\/(get_nameplate_list|set_user_nameplate) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kg/nameplate.js



[mitm]
hostname = gateway.kugou.com, vip.kugou.com, gatewayretry.kugou.com, sentry.kugou.com, vipdress.kugou.com

 */

// ===============================================
//铭牌 (Nameplate) 解锁
// ===============================================

const url = $request.url;
const body = $response.body;
let obj = {};

try {
    obj = JSON.parse(body);
} catch (e) {
    // 设置接口如果失败可能返回空，手动初始化
    if (url.includes("set_user_nameplate")) {
        obj = {};
    } else {
        $done({});
    }
}

// 辅助函数：获取 URL 参数
const getUrlParam = (url, name) => {
    const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
    const r = url.split('?')[1] ? url.split('?')[1].match(reg) : null;
    if (r != null) return unescape(r[2]);
    return null;
};

// ===========================================
// 1. 获取铭牌列表 (get_nameplate_list)
//    动作：解锁显示 + 【关键】偷取所有图片地址存入缓存
// ===========================================
if (url.includes("nameplate/v1/get_nameplate_list")) {
    let nameplateMap = {};
    let count = 0;

    if (obj.data && Array.isArray(obj.data)) {
        // 递归或遍历数据结构
        obj.data.forEach(group => {
            if (group.list && Array.isArray(group.list)) {
                group.list.forEach(item => {
                    // --- A. 表面解锁 ---
                    item.act_end_time = "2099-12-31 23:59:59";
                    item.label_name = "";    // 去掉“限定”
                    item.intro = "";
                    item.is_new = 0;
                    item.change_type = 1;    // 允许操作
                    
                    // --- B. 【核心】缓存图片地址 ---
                    if (item.nameplate_id) {
                        // 构造完整的详情对象存下来
                        // 注意：set接口需要 v1 字段，我们这里手动补齐
                        item.nameplate_url_v1 = item.nameplate_url;
                        item.nameplate_dynamic_v1 = item.nameplate_dynamic;
                        
                        // 存入内存对象
                        nameplateMap[item.nameplate_id] = item;
                        count++;
                    }
                });
            }
        });
        
        // 写入持久化存储 $prefs
        try {
            // 读取旧缓存合并（防止刷新丢失以前的数据）
            let oldMapStr = $prefs.valueForKey("kg_nameplate_map");
            let oldMap = oldMapStr ? JSON.parse(oldMapStr) : {};
            
            // 合并新旧数据
            Object.assign(oldMap, nameplateMap);
            
            // 保存
            $prefs.setValueForKey(JSON.stringify(oldMap), "kg_nameplate_map");
            console.log(`❚ [KG_Nameplate] 已缓存 ${count} 个铭牌地址`);
        } catch (e) {
            console.log(` [KG_Nameplate] 缓存写入失败`);
        }
    }
}

// ===========================================
// 2. 设置佩戴铭牌 (set_user_nameplate)
//    动作：无视服务器，直接从缓存提取地址返回成功
// ===========================================
else if (url.includes("nameplate/v1/set_user_nameplate")) {
    // 1. 获取你要戴哪个铭牌 ID
    let currentId = getUrlParam(url, "nameplate_id");
    
    // 2. 准备一个标准的成功模板
    let finalData = {
        "status": 1,
        "msg": "设置成功",
        "nameplate_id": parseInt(currentId) || 0,
        // 预设空值，后面尝试用缓存覆盖
        "nameplate_url": "",
        "nameplate_dynamic": ""
    };

    // 3. 从缓存里找地址 (这就是解决SVIP无法佩戴的关键)
    let cacheStr = $prefs.valueForKey("kg_nameplate_map");
    if (cacheStr && currentId) {
        try {
            let map = JSON.parse(cacheStr);
            let targetItem = map[currentId]; // 查表
            
            if (targetItem) {
                console.log(` [KG_Nameplate] 命中缓存 ID: ${currentId}`);
                // 把缓存里的图片地址填进去
                Object.assign(finalData, targetItem);
            } else {
                console.log(` [KG_Nameplate] 未命中缓存 ID: ${currentId} (列表里可能没刷出来)`);
            }
        } catch (e) {}
    }

    // 4. 暴力构造响应
    obj = {
        "status": 1,
        "error_code": 0,
        "errcode": 0,
        "msg": "success",
        "data": finalData // 把填好地址的数据塞回去
    };
}

$done({ body: JSON.stringify(obj) });
