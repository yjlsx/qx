
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
   let allItems = [];
   let count = 0;

   if (obj.data && Array.isArray(obj.data) && obj.data.length > 0) {
       
       // 1. 提取所有铭牌
       obj.data.forEach(group => {
           if (group.list && Array.isArray(group.list)) {
               allItems.push(...group.list);
           }
       });

       // 2. 统一改造为"已购限定款"
       allItems.forEach(item => {
           // [核心伪装] 统统改成 Type 5 (限定/活动)
           // 这种类型通常脱离 VIP 体系，属于单品逻辑
           item.nameplate_type = 5;

           // [权限赋予]
           item.is_buy = 1;          // 只有买了这个限定品
           item.pay_status = 1;
           item.status = 1;
           item.change_type = 1;     // 1=直接佩戴
           item.button_status = 1;
           
           // [去VIP化] 告诉App这不是会员赠品，这是我买的单品
           item.is_vip = 0;
           item.vip_type = 0;
           item.vip_level = 0;
           item.supper_vip = 0;
           
           // [清理干扰]
           item.intro = "";          // 清空"升级V9可用"
           item.label_name = "已解锁"; // 给个好听的角标
           item.jump_url = "";
           item.buy_url = "";
           item.price = 0;
           
           item.act_end_time = "2099-12-31 23:59:59";

           // [缓存搬运]
           if (item.nameplate_id) {
               item.nameplate_url_v1 = item.nameplate_url;
               item.nameplate_dynamic_v1 = item.nameplate_dynamic;
               nameplateMap[item.nameplate_id] = item;
               count++;
           }
       });

       // 3. 构造唯一的"全部已解锁"分组
       // 使用最安全的 tag_id = 1
       let safeGroup = {
           "tag_id": 1,
           "tag_name": "全部铭牌 (已解锁)",
           "list": allItems,
           "order": 0
       };

       // 4. 替换
       obj.data = [safeGroup];
       
       console.log(`❚ [KG_Nameplate] 全员限定伪装完成，共 ${count} 个`);
       
       // 写入缓存
       try {
           let oldMapStr = $prefs.valueForKey("kg_nameplate_map");
           let oldMap = oldMapStr ? JSON.parse(oldMapStr) : {};
           Object.assign(oldMap, nameplateMap);
           $prefs.setValueForKey(JSON.stringify(oldMap), "kg_nameplate_map");
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
