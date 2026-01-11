
/**
 [rewrite_local]

# 铭牌解锁
^https?:\/\/welfare\.kugou\.com\/nameplate\/v1\/(get_nameplate_list|set_user_nameplate) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kg/nameplate.js



[mitm]
hostname = gateway.kugou.com, vip.kugou.com, gatewayretry.kugou.com, sentry.kugou.com, vipdress.kugou.com

 */

// ===============================================
// 铭牌 (Nameplate) 解锁
// ===============================================

const url = $request.url;
const body = $response.body;
let obj = {};

try {
    obj = JSON.parse(body);
} catch (e) {
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
//    核心目标：骗过 App 逻辑，把"购买"按钮变成"佩戴"
// ===========================================
if (url.includes("nameplate/v1/get_nameplate_list")) {
    let nameplateMap = {};
    let count = 0;

    if (obj.data && Array.isArray(obj.data)) {
        obj.data.forEach(group => {
            if (group.list && Array.isArray(group.list)) {
                group.list.forEach(item => {
                    // ---------------------------------------
                    // [关键修改] 权限与按钮状态伪装
                    // ---------------------------------------
                    item.is_buy = 1;          // 伪装已购买
                    item.pay_status = 1;      // 支付状态：已支付
                    item.status = 1;          // 状态：正常
                    
                    item.change_type = 1;     // [最关键] 1代表直接佩戴，2代表需购买/任务
                    item.button_status = 1;   // 按钮状态：可用
                    
                    item.vip_type = 0;        // 去掉VIP属性，防止App判断VIP过期
                    item.price = 0;           // 价格改为0
                    
                    item.act_end_time = "2099-12-31 23:59:59"; // 永不过期
                    
                    // 清理视觉干扰
                    item.label_name = "";     // 去掉“限定”角标
                    item.intro = "";          // 去掉简介
                    item.is_new = 0;          // 去掉红点

                    // ---------------------------------------
                    // [缓存逻辑] 偷取图片地址
                    // ---------------------------------------
                    if (item.nameplate_id) {
                        item.nameplate_url_v1 = item.nameplate_url;
                        item.nameplate_dynamic_v1 = item.nameplate_dynamic;
                        nameplateMap[item.nameplate_id] = item;
                        count++;
                    }
                });
            }
        });
        
        // 写入缓存
        try {
            let oldMapStr = $prefs.valueForKey("kg_nameplate_map");
            let oldMap = oldMapStr ? JSON.parse(oldMapStr) : {};
            Object.assign(oldMap, nameplateMap);
            $prefs.setValueForKey(JSON.stringify(oldMap), "kg_nameplate_map");
            console.log(`❚ [KG_Nameplate] 已伪装权限并缓存 ${count} 个铭牌`);
        } catch (e) {}
    }
}

// ===========================================
// 2. 设置佩戴铭牌 (set_user_nameplate)
//    功能：拦截请求，从缓存填入地址
// ===========================================
else if (url.includes("nameplate/v1/set_user_nameplate")) {
    let currentId = getUrlParam(url, "nameplate_id");
    
    // 默认成功模板
    let finalData = {
        "status": 1,
        "msg": "设置成功",
        "nameplate_id": parseInt(currentId) || 0,
        "nameplate_url": "",
        "nameplate_dynamic": ""
    };

    // 读取缓存填入地址
    let cacheStr = $prefs.valueForKey("kg_nameplate_map");
    if (cacheStr && currentId) {
        try {
            let map = JSON.parse(cacheStr);
            let targetItem = map[currentId];
            if (targetItem) {
                console.log(` [KG_Nameplate] 缓存命中 ID: ${currentId}`);
                Object.assign(finalData, targetItem);
            }
        } catch (e) {}
    }

    obj = {
        "status": 1,
        "error_code": 0,
        "errcode": 0,
        "msg": "success",
        "data": finalData
    };
}

$done({ body: JSON.stringify(obj) });
