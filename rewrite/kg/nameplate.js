
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

       obj.data.forEach(group => {

           // ---------------------------------------

           // [核心突破] 篡改分组信息

           // 只要 App 看到"超级VIP"标签，就会强制锁死

           // 所以我们把所有分组都伪装成"推荐"(tag_id=1)

           // ---------------------------------------

           if (group.tag_name && group.tag_name.includes("VIP")) {

               group.tag_name = "热门推荐"; // 改名

               group.tag_id = "1";          // 改ID为普通推荐

           }



           if (group.list && Array.isArray(group.list)) {

               group.list.forEach(item => {

                   // ---------------------------------------

                   // [降维打击] 强制所有类型为 1 (静态图)

                   // Type 2 (动态) 和 Type 5 (限定) 都有特殊校验

                   // 统一改为 1 最安全，虽然没了动效，但能佩戴！

                   // ---------------------------------------

                   item.nameplate_type = 1;



                   // ---------------------------------------

                   // [权限伪装]

                   // ---------------------------------------

                   item.is_buy = 1;

                   item.pay_status = 1;

                   item.status = 1;

                   item.change_type = 1;    // 1=直接佩戴

                   item.button_status = 1;

                   

                   // 抹除 VIP 特征

                   item.is_vip = 0;

                   item.vip_type = 0;

                   item.vip_level = 0;

                   item.supper_vip = 0;     // 关键：去除SVIP标记

                   item.is_svip = 0;        // 猜测字段，一并去除

                   

                   // 清空干扰信息

                   item.jump_url = "";

                   item.buy_url = "";

                   item.label_name = "";

                   item.intro = "";

                   item.price = 0;

                   item.act_end_time = "2099-12-31 23:59:59";



                   // ---------------------------------------

                   // [缓存搬运]

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

           console.log(`❚ [KG_Nameplate] 分组越狱完成，缓存 ${count} 个`);

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

