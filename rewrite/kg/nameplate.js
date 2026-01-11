
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
let body = $response.body;
let obj = {};

try {
   obj = JSON.parse(body);
} catch (e) {
   if (url.includes("set_user_nameplate")) obj = {};
   else $done({});
}

const getUrlParam = (url, name) => {
   const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
   const r = url.split('?')[1] ? url.split('?')[1].match(reg) : null;
   if (r != null) return unescape(r[2]);
   return null;
};

// ===========================================
// 1. 获取铭牌列表 (get_nameplate_list)
// ===========================================
if (url.includes("nameplate/v1/get_nameplate_list")) {
   let nameplateMap = {};
   let count = 0;

   if (obj.data && Array.isArray(obj.data)) {
       // ❌ 不再合并分组，不再删除分组，防止 App 报错
       // ✅ 遍历现有分组，原地修改
       obj.data.forEach(group => {
           
           // 顺便把"超级VIP"的分组名改得好听点，但不改 ID 防止冲突
           if (group.tag_name && group.tag_name.includes("VIP")) {
               group.tag_name = "精选铭牌 (已解锁)";
           }

           if (group.list && Array.isArray(group.list)) {
               group.list.forEach(item => {
                   // ---------------------------------------
                   // [全员 Type 5 伪装]
                   // 按照你的要求，全部模仿 V9 限定铭牌
                   // ---------------------------------------
                   item.nameplate_type = 5;

                   // [权限赋予]
                   item.is_buy = 1;          // 伪装已购买
                   item.pay_status = 1;
                   item.status = 1;
                   
                   item.change_type = 1;     // 1=直接佩戴
                   item.button_status = 1;   // 按钮可点
                   
                   // [彻底去毒 - 抹除所有 VIP/任务 痕迹]
                   item.is_vip = 0;
                   item.vip_type = 0;
                   item.vip_level = 0;
                   item.supper_vip = 0;
                   item.is_activity = 0;
                   item.new_days = 0;        // 去掉"新"标
                   
                   // [清理弹窗与跳转]
                   item.intro = "";          // 简介必须空，否则弹窗
                   item.label_name = "";     // 清空角标，或者写"已购"
                   item.jump_url = "";       // 禁止跳转
                   item.buy_url = "";
                   item.price = 0;
                   
                   item.act_end_time = "2099-12-31 23:59:59";

                   // [缓存图片地址]
                   if (item.nameplate_id) {
                       item.nameplate_url_v1 = item.nameplate_url;
                       item.nameplate_dynamic_v1 = item.nameplate_dynamic;
                       nameplateMap[item.nameplate_id] = item;
                       count++;
                   }
               });
           }
       });
       
       // 存入缓存
       try {
           let oldMapStr = $prefs.valueForKey("kg_nameplate_map");
           let oldMap = oldMapStr ? JSON.parse(oldMapStr) : {};
           Object.assign(oldMap, nameplateMap);
           $prefs.setValueForKey(JSON.stringify(oldMap), "kg_nameplate_map");
           console.log(`❚ [KG_Nameplate] 修复页面结构，缓存 ${count} 个`);
       } catch (e) {}
   }
}

// ===========================================
// 2. 设置佩戴铭牌 (set_user_nameplate)
// ===========================================
else if (url.includes("nameplate/v1/set_user_nameplate")) {
   let currentId = getUrlParam(url, "nameplate_id");
   
   let finalData = {
       "status": 1,
       "msg": "设置成功",
       "nameplate_id": parseInt(currentId) || 0,
       "nameplate_url": "",
       "nameplate_dynamic": ""
   };

   let cacheStr = $prefs.valueForKey("kg_nameplate_map");
   if (cacheStr && currentId) {
       try {
           let map = JSON.parse(cacheStr);
           let targetItem = map[currentId];
           if (targetItem) {
               console.log(`✅ [KG_Nameplate] 缓存命中 ID: ${currentId}`);
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
