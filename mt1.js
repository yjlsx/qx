/*
[rewrite_local]
# 美团外卖订单列表（改时间 + 店铺名）
^https:\/\/i\.waimai\.meituan\.com\/openh5\/order\/list\?.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt1.js

# 美团外卖订单详情（改时间 + 订单号 + 店铺名）
^https:\/\/i\.waimai\.meituan\.com\/openh5\/order\/manager\/v3\/detail\?.* url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/mt1.js

[mitm]
hostname = i.waimai.meituan.com, *.meituan.com
*/

/**
* - 列表页：修改 orderTime / orderTimeSec
* - 详情页：修改 order_time / 评论时间 / 订单号 
*/

// === 可修改的配置 ===
const CUSTOM_ORDER_TIME = "2026-01-17 10:27:39";   
const TARGET_ORDER_ID_NUM = "601953561547581635"; 
const TARGET_ARRIVAL_TIME = "01月17日 11:00-11:15"; 
const CUSTOM_POI_NAME = "汤芝未·药膳养生炖汤府（盘龙店）";   //  ·食肉狂徒·美式烤肉法式小排（万象城店）老妈蹄花汤·药膳蹄花（盘龙店）
// ======================

const TARGET_ORDER_ID_STR = TARGET_ORDER_ID_NUM.toString();

function getTimestamp(timeStr) {
  try {
    const ts = Math.floor(new Date(timeStr.replace(/-/g, "/")).getTime() / 1000);
    if (isNaN(ts) || ts <= 0) throw new Error("时间无效");
    return ts;
  } catch {
    return Math.floor(Date.now() / 1000);
  }
}
const TARGET_TIMESTAMP_SEC = getTimestamp(CUSTOM_ORDER_TIME);

const url = $request.url;
let body = $response.body;
if (!body) $done({});

try {
  const obj = JSON.parse(body);
  if (!obj?.data) return $done({});

  if (url.includes("/openh5/order/list")) {
    // 有的接口把列表放在 data.orderList / data.orders / data.order_list 等位置，尽量处理几种常见情况
    if (Array.isArray(obj.data.orderList)) {
      modifyOrderList(obj.data.orderList);
    } else if (Array.isArray(obj.data.orders)) {
      modifyOrderList(obj.data.orders);
    } else if (Array.isArray(obj.data.order_list)) {
      modifyOrderList(obj.data.order_list);
    } else {
      // 有时候列表直接是 data（非数组）或嵌套更深，尝试遍历 data 的所有数组字段并处理第一个数组
      for (const k in obj.data) {
        if (Array.isArray(obj.data[k])) {
          modifyOrderList(obj.data[k]);
          break;
        }
      }
    }
  } else if (url.includes("/openh5/order/manager/v3/detail")) {
    modifyOrderDetail(obj.data);
  }

  $done({ body: JSON.stringify(obj) });
} catch (e) {
  console.log(`[MT重写错误] ${e.message}`);
  $done({});
}

/**
 * 列表页处理：尽量修改各种可能的店铺名字段，并修改时间
 */
function modifyOrderList(orderList) {
  if (!Array.isArray(orderList)) return;

  orderList.forEach((order, idx) => {
    // 记录原始常见字段，便于调试
    const originalNames = {};

    // 常见直接字段
    ["wm_poi_name", "poiName", "wmPoiName", "poi_name", "shopName", "name"].forEach((field) => {
      if (order[field] !== undefined) originalNames[field] = order[field];
    });

    // 某些接口把 poi 信息放在子对象：poi / poi_info / wm_poi_info / poiInfo
    const poiContainers = ["poi", "poi_info", "wm_poi_info", "poiInfo", "wmPoiInfo"];
    poiContainers.forEach((c) => {
      if (order[c] && typeof order[c] === "object") {
        if (order[c].name !== undefined) originalNames[`${c}.name`] = order[c].name;
        if (order[c].poi_name !== undefined) originalNames[`${c}.poi_name`] = order[c].poi_name;
        if (order[c].poiName !== undefined) originalNames[`${c}.poiName`] = order[c].poiName;
      }
    });

    // 调试输出：显示第一个订单的原始店铺名快照（只打印前 5 条以免日志太长）
    if (idx < 5) console.log(`[MT列表-原始][idx=${idx}] ${JSON.stringify(originalNames)}`);

    // 修改时间字段
    if (order.orderTime !== undefined) order.orderTime = CUSTOM_ORDER_TIME.slice(0, 16);
    if (order.orderTimeSec !== undefined) order.orderTimeSec = TARGET_TIMESTAMP_SEC;
    if (order.order_time !== undefined) order.order_time = TARGET_TIMESTAMP_SEC;

    // 直接字段修改
    if (order.wm_poi_name !== undefined) order.wm_poi_name = CUSTOM_POI_NAME;
    if (order.poiName !== undefined) order.poiName = CUSTOM_POI_NAME;
    if (order.wmPoiName !== undefined) order.wmPoiName = CUSTOM_POI_NAME;
    if (order.poi_name !== undefined) order.poi_name = CUSTOM_POI_NAME;
    if (order.shopName !== undefined) order.shopName = CUSTOM_POI_NAME;
    if (order.name !== undefined && isLikelyPoiName(order.name)) order.name = CUSTOM_POI_NAME;

    // 子对象内修改
    poiContainers.forEach((c) => {
      if (order[c] && typeof order[c] === "object") {
        if (order[c].name !== undefined) order[c].name = CUSTOM_POI_NAME;
        if (order[c].poi_name !== undefined) order[c].poi_name = CUSTOM_POI_NAME;
        if (order[c].poiName !== undefined) order[c].poiName = CUSTOM_POI_NAME;
      }
    });

    // 如果订单里包含一个统一的 poi_info 数组（少见），也尝试处理
    if (Array.isArray(order.poi_info)) {
      order.poi_info.forEach((p) => {
        if (p.name !== undefined) p.name = CUSTOM_POI_NAME;
        if (p.poi_name !== undefined) p.poi_name = CUSTOM_POI_NAME;
      });
    }

    // 输出修改后的快照（前5条）
    if (idx < 5) {
      const afterNames = {};
      ["wm_poi_name", "poiName", "wmPoiName", "poi_name", "shopName", "name"].forEach((field) => {
        if (order[field] !== undefined) afterNames[field] = order[field];
      });
      poiContainers.forEach((c) => {
        if (order[c] && typeof order[c] === "object") {
          if (order[c].name !== undefined) afterNames[`${c}.name`] = order[c].name;
          if (order[c].poi_name !== undefined) afterNames[`${c}.poi_name`] = order[c].poi_name;
        }
      });
      console.log(`[MT列表-修改后][idx=${idx}] ${JSON.stringify(afterNames)}`);
    }
  });

  console.log(`[MT列表页] 已尝试设置 店铺名 -> ${CUSTOM_POI_NAME} & 时间 -> ${CUSTOM_ORDER_TIME}`);
}

/**
 * 详情页处理（保留原有逻辑）
 */
function modifyOrderDetail(data) {
  const oldId = data.id || data.id_view || "unknown";

  // 修改订单号
  ["id", "id_view", "id_text"].forEach((key) => {
    if (data[key] !== undefined)
      data[key] = key === "id" ? TARGET_ORDER_ID_NUM : TARGET_ORDER_ID_STR;
  });

  // 修改下单时间
  if (data.order_time !== undefined) data.order_time = TARGET_TIMESTAMP_SEC;

  // 修改期望送达时间
  if (data.expected_arrival_time !== undefined)
    data.expected_arrival_time = TARGET_ARRIVAL_TIME;

  // 修改店铺名（详情页常见字段）
  if (data.poi_name !== undefined) data.poi_name = CUSTOM_POI_NAME;
  if (data.wm_poi_name !== undefined) data.wm_poi_name = CUSTOM_POI_NAME;
  if (data.poi && typeof data.poi === "object") {
    if (data.poi.name !== undefined) data.poi.name = CUSTOM_POI_NAME;
    if (data.poi.poi_name !== undefined) data.poi.poi_name = CUSTOM_POI_NAME;
  }

  // 评论时间（主评论 + 回复）
  if (data.comment) {
    if (data.comment.comment_time !== undefined) data.comment.comment_time = TARGET_TIMESTAMP_SEC + 600;
    if (Array.isArray(data.comment.add_comment_list))
      data.comment.add_comment_list.forEach((reply) => {
        if (reply.time !== undefined) reply.time = TARGET_TIMESTAMP_SEC + 1200;
      });
  }

  // 替换订单号相关链接
  if (data.scheme) data.scheme = data.scheme.replace(new RegExp(oldId, "g"), TARGET_ORDER_ID_STR);
  if (data.insurance?.insurance_detail_url)
    data.insurance.insurance_detail_url = data.insurance.insurance_detail_url.replace(new RegExp(oldId, "g"), TARGET_ORDER_ID_STR);

  console.log(`[MT详情页] 订单号 ${TARGET_ORDER_ID_STR} | 时间 ${CUSTOM_ORDER_TIME} | 店铺 ${CUSTOM_POI_NAME}`);
}

/**
 * 简单启发式：判断 name 字段是否更可能是店铺名（避免误改商品名等）
 */
function isLikelyPoiName(nameStr) {
  if (!nameStr || typeof nameStr !== "string") return false;
  // 含有“店”/“馆”/“饭”/“店名”/括号等关键词更可能是店铺名
  return /店|馆|饭|楼|馆|(店)|（|）|\(|\)/.test(nameStr) || nameStr.length <= 60;
}