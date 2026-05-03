/*
接口去广告 + 移除所有“按比例返利”店铺单


[rewrite_local]
^https:\/\/gwh?\.xiaocantech\.com\/rpc$ url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/xiaocan.js
^https:\/\/gwh?\.xiaocantech\.com\/rpc$ url script-request-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/xiaocan.js
^https:\/\/gwh?\.xiaocantech\.com\/rpc$ url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/xiaocan.js

[mitm]
hostname = gw.xiaocantech.com, gwh.xiaocantech.com

*/

const isResponse = typeof $response !== "undefined";
const body = isResponse ? $response.body : (($request && $request.body) || "");
const headers = ($request && $request.headers) || {};
const url = ($request && $request.url) || "";
const isRequestHeader = !isResponse && !body;

function h(name) {
  const lower = String(name).toLowerCase();
  for (const k in headers) {
    if (String(k).toLowerCase() === lower) return String(headers[k] || "");
  }
  return "";
}

const method = h("methodname");
const server = h("servername");

function done(obj) {
  $done({ body: JSON.stringify(obj) });
}

function emptyOk(extra) {
  return Object.assign(
    {
      status: { code: 0 },
      data: null,
      list: [],
      records: [],
      record_list: [],
      order_list: [],
      show: false,
      is_show: false,
      if_show: false,
      show_popup: false,
      need_pop: false,
      popup: null,
      dialog: null,
    },
    extra || {}
  );
}

function isObj(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function lower(s) {
  return String(s || "").toLowerCase();
}

function methodLooksLikeShopList() {
  return /PromotionList|GetPoiList|PoiList|ShopList|StoreList|LifeShopList|SearchPoi|Nearby|RecommendPoi|ActivityList|MerchantList/i.test(method);
}

function logRequestHeaderHit() {
  if (!/^https:\/\/gwh?\.xiaocantech\.com\/rpc$/i.test(url)) return;
  console.log(`[接口清理] 请求头命中：${server || "-"} | ${method || "-"}`);
}

function requestCacheKey() {
  return `xiaocan_req_${server || "server"}_${method || "method"}`.replace(/[^\w.-]/g, "_");
}

function rawRequestCacheKey() {
  return `${requestCacheKey()}_raw`;
}

function readCachedRequestObj() {
  if (typeof $prefs === "undefined") return null;
  const cached = $prefs.valueForKey(requestCacheKey());
  if (!cached) return null;
  try {
    return JSON.parse(cached);
  } catch (e) {
    return null;
  }
}

function readCachedRawRequestBody() {
  if (typeof $prefs === "undefined") return "";
  return $prefs.valueForKey(rawRequestCacheKey()) || "";
}

function saveRequestObjForSweep(obj) {
  if (typeof $prefs === "undefined" || !methodLooksLikeShopList()) return;
  if (findCoordPairs(obj).length === 0) return;
  $prefs.setValueForKey(JSON.stringify(obj), requestCacheKey());
  console.log(`[接口清理] ${method || "RPC"} 已缓存同城多点请求体`);
}

function saveRawRequestBodyForSweep(rawBody) {
  if (typeof $prefs === "undefined" || !methodLooksLikeShopList() || !rawBody) return;
  $prefs.setValueForKey(String(rawBody), rawRequestCacheKey());
  console.log(`[接口清理] ${method || "RPC"} 已缓存原始请求体`);
}

function widenCityShopRequest(obj) {
  if (!methodLooksLikeShopList() && !deepHasAnyKey(obj, /^(poi|shop|store|promotion|activity|merchant)/i, 0)) {
    return 0;
  }

  let changed = 0;
  const pageSizeKeys = /^(page_size|pagesize|pageSize|limit|size|count|page_count|pageCount|page_limit|pageLimit|offset_limit|offsetLimit)$/;
  const radiusKeys = /^(radius|distance|range|scope|search_radius|searchRadius|around_radius|aroundRadius|max_distance|maxDistance|nearby_distance|nearbyDistance|geo_radius|geoRadius|delivery_radius|deliveryRadius)$/;
  const sameCityKeys = /^(same_city|sameCity|city_scope|cityScope|in_city|inCity|only_city|onlyCity|whole_city|wholeCity|city_wide|cityWide|all_city|allCity)$/;
  const cityOnlyKeys = /^(city_only|cityOnly|is_city|isCity|local_city|localCity|current_city|currentCity)$/;
  const nearbyOnlyKeys = /^(nearby_only|nearbyOnly|only_nearby|onlyNearby|nearby|nearby_mode|nearbyMode)$/;
  const cityScopeTypeKeys = /^(scope_type|scopeType|range_type|rangeType|search_type|searchType|query_type|queryType)$/;

  function setNumber(node, key, value) {
    const old = Number(node[key] || 0);
    if (!old || old < value) {
      node[key] = value;
      changed += 1;
    }
  }

  function walk(node, depth) {
    if (depth > 8 || node == null) return;
    if (Array.isArray(node)) {
      node.forEach((x) => walk(x, depth + 1));
      return;
    }
    if (!isObj(node)) return;

    for (const key in node) {
      const lk = lower(key);
      const val = node[key];

      if (pageSizeKeys.test(key) || pageSizeKeys.test(lk)) {
        setNumber(node, key, 200);
      } else if (radiusKeys.test(key) || radiusKeys.test(lk)) {
        setNumber(node, key, 300000);
      } else if (sameCityKeys.test(key) || sameCityKeys.test(lk) || cityOnlyKeys.test(key) || cityOnlyKeys.test(lk)) {
        if (node[key] !== true && node[key] !== 1) {
          node[key] = typeof val === "number" ? 1 : true;
          changed += 1;
        }
      } else if (nearbyOnlyKeys.test(key) || nearbyOnlyKeys.test(lk)) {
        if (node[key] !== false && node[key] !== 0) {
          node[key] = typeof val === "number" ? 0 : false;
          changed += 1;
        }
      } else if ((cityScopeTypeKeys.test(key) || cityScopeTypeKeys.test(lk)) && typeof val === "string" && /nearby|around|distance/i.test(val)) {
        node[key] = "city";
        changed += 1;
      } else if (val && typeof val === "object") {
        walk(val, depth + 1);
      }
    }
  }

  walk(obj, 0);
  return changed;
}

function deepHasAnyKey(node, re, depth) {
  if (depth > 5 || node == null) return false;
  if (Array.isArray(node)) return node.some((x) => deepHasAnyKey(x, re, depth + 1));
  if (!isObj(node)) return false;
  for (const key in node) {
    if (re.test(key)) return true;
    if (deepHasAnyKey(node[key], re, depth + 1)) return true;
  }
  return false;
}

function keyLooksLikeRebate(key) {
  return /(ratio|commission|cps|union|plan_activity|poi_event|shangjin|fanli|fan_li)/i.test(key);
}

function hasStrongRatioRebateMarker(node) {
  if (!isObj(node)) return false;

  if (Array.isArray(node.plan_activity_info_list) && node.plan_activity_info_list.length > 0) return true;
  if (Array.isArray(node.commission_info_list) && node.commission_info_list.length > 0) return true;

  const ratioKeys = [
    "ratio",
    "user_ratio",
    "media_ratio",
    "shop_ratio",
    "store_ratio",
    "commission_ratio",
    "rebate_ratio",
    "cps_ratio",
    "platform_ratio",
  ];
  const commissionKeys = [
    "max_commission",
    "user_max_commission",
    "media_max_commission",
    "commission",
    "commission_amount",
  ];

  for (const k of ratioKeys) {
    if (Number(node[k] || 0) > 0) return true;
  }
  for (const k of commissionKeys) {
    if (Number(node[k] || 0) > 0) return true;
  }

  if (node.poi_event_id != null && String(node.poi_event_id) !== "" && String(node.poi_event_id) !== "0") return true;
  if (node.plan_activity_type != null && String(node.plan_activity_type) !== "" && String(node.plan_activity_type) !== "0") return true;

  return false;
}

function textLooksLikeRatioRebate(text) {
  const s = String(text || "");
  if (!s) return false;

  const cnKeywords = [
    "\u6309\u6bd4\u4f8b\u8fd4\u5229",
    "\u6bd4\u4f8b\u8fd4\u5229",
    "\u8fd4\u5229\u6bd4\u4f8b",
    "\u8fd4\u4f63",
    "\u4f63\u91d1",
    "\u8d4f\u91d1",
    "\u63a8\u5e7f\u8fd4\u5229",
    "\u8054\u76df\u6d3b\u52a8",
    "\u8054\u76df\u8fd4\u5229",
    "\u8fbe\u4eba\u8fd4\u5229",
    "\u5a92\u4f53\u8fd4\u5229",
    "\u5546\u5bb6\u8fd4\u5229",
  ];

  return (
    /CPS|cps|fanli|rebate|commission|ratio/i.test(s) ||
    cnKeywords.some((kw) => s.indexOf(kw) !== -1) ||
    /(?:\u8fd4|\u8fd4\u5229|\u8fd4\u4f63|\u4f63\u91d1|\u8d4f\u91d1)[^\uff0c\u3002\uff1b,;]{0,12}\d+(?:\.\d+)?%/.test(s) ||
    /\d+(?:\.\d+)?%[^\uff0c\u3002\uff1b,;]{0,12}(?:\u8fd4|\u8fd4\u5229|\u8fd4\u4f63|\u4f63\u91d1|\u8d4f\u91d1)/.test(s)
  );
}

function deepHasRatioRebate(node, depth) {
  if (depth > 7 || node == null) return false;

  if (typeof node === "string") return textLooksLikeRatioRebate(node);
  if (typeof node === "number" || typeof node === "boolean") return false;

  if (Array.isArray(node)) {
    return node.some((x) => deepHasRatioRebate(x, depth + 1));
  }

  if (!isObj(node)) return false;

  if (hasStrongRatioRebateMarker(node)) return true;

  for (const key in node) {
    const val = node[key];
    const lk = lower(key);

    if (keyLooksLikeRebate(lk)) {
      if (typeof val === "number" && val > 0) return true;
      if (typeof val === "string" && val !== "" && val !== "0") return true;
      if (Array.isArray(val) && val.length > 0) return true;
      if (isObj(val) && Object.keys(val).length > 0) return true;
    }

    if (
      /^(ratio|user_ratio|media_ratio|shop_ratio|store_ratio|commission_ratio|rebate_ratio|cps_ratio|platform_ratio)$/.test(lk) &&
      Number(val || 0) > 0
    ) {
      return true;
    }

    if (
      /^(max_commission|user_max_commission|media_max_commission|commission|commission_amount|reward_amount|bounty_amount)$/.test(lk) &&
      Number(val || 0) > 0
    ) {
      return true;
    }

    if (/^(poi_event_id|plan_activity_type)$/.test(lk) && String(val || "") !== "") {
      return true;
    }

    if (deepHasRatioRebate(val, depth + 1)) return true;
  }

  return false;
}

function looksLikeResultList(key, arr) {
  if (!Array.isArray(arr)) return false;
  if (/list|items|results|poi|store|shop|promotion|data/i.test(key)) return true;
  if (arr.length === 0) return false;
  return arr.some((x) => isObj(x) && (
    Object.prototype.hasOwnProperty.call(x, "wm_poi_id") ||
    Object.prototype.hasOwnProperty.call(x, "store_id") ||
    Object.prototype.hasOwnProperty.call(x, "poi_id") ||
    Object.prototype.hasOwnProperty.call(x, "shop_id") ||
    Object.prototype.hasOwnProperty.call(x, "name")
  ));
}

function filterRatioRebateItems(obj) {
  let removed = 0;

  function shouldRemoveItem(item) {
    return isObj(item) && deepHasRatioRebate(item, 0);
  }

  function walk(node, path) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      node.forEach((x, i) => walk(x, `${path}[${i}]`));
      return;
    }

    for (const key in node) {
      const val = node[key];
      if (Array.isArray(val) && val.some(shouldRemoveItem) && looksLikeResultList(key, val)) {
        const before = val.length;
        node[key] = val.filter((item) => !shouldRemoveItem(item));
        const diff = before - node[key].length;
        if (diff > 0) {
          removed += diff;
          console.log(`[接口清理] ${path ? path + "." : ""}${key} 移除 ${diff} 条按比例返利项`);
        }
        node[key].forEach((x, i) => walk(x, `${path ? path + "." : ""}${key}[${i}]`));
      } else if (val && typeof val === "object") {
        walk(val, `${path ? path + "." : ""}${key}`);
      }
    }
  }

  if (Array.isArray(obj.poi_list)) {
    const before = obj.poi_list.length;
    obj.poi_list = obj.poi_list.filter((item) => !shouldRemoveItem(item));
    const diff = before - obj.poi_list.length;
    if (diff > 0) {
      removed += diff;
      console.log(`[接口清理] poi_list 移除 ${diff} 条按比例返利店铺`);
    }
  }

  walk(obj, "");
  if (removed > 0) obj._qx_removed_ratio_rebate_count = removed;
  return removed;
}

function stripPlacementResources(obj) {
  if (!Array.isArray(obj.resources)) return false;

  const deny = /AD|ADS|POPUP|BANNER|SEARCH_RIGHT|XC_JG|CERAMIC|THEMESKIN|FANLI|MAIN_TO|GUIDE|BESTSELLERS_TAG|SAFETY_GUARANTEE|ADV|VIP_BRAND|HOME_TAB/i;
  let changed = false;

  obj.resources = obj.resources.map((r) => {
    if (!isObj(r)) return r;
    if (deny.test(String(r.resource_slug || ""))) {
      changed = true;
      return {
        resource_id: r.resource_id,
        value: null,
        status: { code: 0 },
        resource_slug: r.resource_slug,
      };
    }
    return r;
  });

  return changed;
}

function disablePopupLike(obj) {
  let changed = false;

  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    for (const key in node) {
      const lk = lower(key);
      if (/^(show|if_show|is_show|show_popup|if_pop|need_pop|ad_open)$/.test(lk)) {
        node[key] = false;
        changed = true;
      } else if (/popup|banner|adver|advert|lottery|marketing/i.test(key)) {
        if (Array.isArray(node[key])) node[key] = [];
        else if (isObj(node[key])) node[key] = null;
        else if (typeof node[key] === "number") node[key] = 0;
        else if (typeof node[key] === "string") node[key] = "";
        changed = true;
      } else {
        walk(node[key]);
      }
    }
  }

  walk(obj);
  return changed;
}

function disableOrderAbnormalPopup(obj) {
  let changed = false;
  const dangerKey = /reject|rejection|abnormal|exception|resurrection|pending.*order|order.*popup|order.*award|force.*screen|user.*force.*screen|popup|dialog/i;

  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    for (const key in node) {
      const lk = lower(key);
      if (/^(show|is_show|if_show|show_popup|need_pop|need_popup|has_popup|can_popup|if_force_screen|force_screen|user_force_screen_show)$/.test(lk)) {
        node[key] = false;
        changed = true;
      } else if (/^(user_force_screen|force_screen_info|force_screen_data|abnormal_order_info)$/.test(lk)) {
        node[key] = null;
        changed = true;
      } else if (/^(if_celebrate|if_page_gift|if_receive_add_gift|if_alpay_promotion_one|if_promotion_muster)$/.test(lk)) {
        node[key] = false;
        changed = true;
      } else if (dangerKey.test(key)) {
        if (Array.isArray(node[key])) node[key] = [];
        else if (isObj(node[key])) node[key] = null;
        else if (typeof node[key] === "boolean") node[key] = false;
        else if (typeof node[key] === "number") node[key] = 0;
        else if (typeof node[key] === "string") node[key] = "";
        changed = true;
      } else {
        walk(node[key]);
      }
    }
  }

  walk(obj);
  return changed;
}

function cloneJson(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function hasHeader(name) {
  return h(name) !== "";
}

function isCitySweepRequest() {
  return hasHeader("X-QX-Xiaocan-City-Sweep");
}

function coordNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function findCoordPairs(root) {
  const pairs = [];
  const latNames = /^(lat|latitude|user_lat|userLat|gcj_lat|gcjLat|poi_lat|poiLat|shop_lat|shopLat|store_lat|storeLat)$/;
  const lngNames = /^(lng|lon|longitude|user_lng|userLng|user_lon|userLon|gcj_lng|gcjLng|gcj_lon|gcjLon|poi_lng|poiLng|poi_lon|poiLon|shop_lng|shopLng|shop_lon|shopLon|store_lng|storeLng|store_lon|storeLon)$/;

  function walk(node, depth) {
    if (depth > 7 || node == null) return;
    if (Array.isArray(node)) {
      node.forEach((x) => walk(x, depth + 1));
      return;
    }
    if (!isObj(node)) return;

    let latKey = "";
    let lngKey = "";
    for (const key in node) {
      if (!latKey && latNames.test(key) && coordNumber(node[key]) != null) latKey = key;
      if (!lngKey && lngNames.test(key) && coordNumber(node[key]) != null) lngKey = key;
    }
    if (latKey && lngKey) pairs.push({ node, latKey, lngKey });

    for (const key in node) {
      if (node[key] && typeof node[key] === "object") walk(node[key], depth + 1);
    }
  }

  walk(root, 0);
  return pairs;
}

function firstCoordFrom(root) {
  const pair = findCoordPairs(root)[0];
  if (!pair) return null;
  const lat = coordNumber(pair.node[pair.latKey]);
  const lng = coordNumber(pair.node[pair.lngKey]);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function findHeaderCoordPairs(headerObj) {
  const pairs = [];
  const latNames = /^(x-)?(lat|latitude|user-lat|user_lat|gcj-lat|gcj_lat|poi-lat|poi_lat)$/i;
  const lngNames = /^(x-)?(lng|lon|longitude|user-lng|user_lng|user-lon|user_lon|gcj-lng|gcj_lng|gcj-lon|gcj_lon|poi-lng|poi_lng|poi-lon|poi_lon)$/i;
  let latKey = "";
  let lngKey = "";

  for (const key in headerObj || {}) {
    if (!latKey && latNames.test(key) && coordNumber(headerObj[key]) != null) latKey = key;
    if (!lngKey && lngNames.test(key) && coordNumber(headerObj[key]) != null) lngKey = key;
  }

  if (latKey && lngKey) pairs.push({ node: headerObj, latKey, lngKey });
  return pairs;
}

function applyCoordOffset(root, offset) {
  const pairs = findCoordPairs(root);
  pairs.forEach(({ node, latKey, lngKey }) => {
    const lat = coordNumber(node[latKey]);
    const lng = coordNumber(node[lngKey]);
    if (lat == null || lng == null) return;
    node[latKey] = Number((lat + offset.lat).toFixed(6));
    node[lngKey] = Number((lng + offset.lng).toFixed(6));
  });
  return pairs.length;
}

function applyHeaderCoordOffset(headerObj, offset) {
  const pairs = findHeaderCoordPairs(headerObj);
  pairs.forEach(({ node, latKey, lngKey }) => {
    const lat = coordNumber(node[latKey]);
    const lng = coordNumber(node[lngKey]);
    if (lat == null || lng == null) return;
    node[latKey] = String(Number((lat + offset.lat).toFixed(6)));
    node[lngKey] = String(Number((lng + offset.lng).toFixed(6)));
  });
  return pairs.length;
}

function listItemKey(item) {
  if (!isObj(item)) return "";
  const keys = [
    "wm_poi_id",
    "poi_id",
    "store_id",
    "shop_id",
    "merchant_id",
    "id",
    "name",
  ];
  for (const key of keys) {
    if (item[key] != null && String(item[key]) !== "") return `${key}:${String(item[key])}`;
  }
  const name = item.name || item.poi_name || item.shop_name || item.store_name;
  const address = item.address || item.addr || item.distance || "";
  return name ? `fallback:${name}|${address}` : "";
}

function mergeList(target, source) {
  if (!Array.isArray(target) || !Array.isArray(source)) return 0;
  const seen = {};
  target.forEach((item) => {
    const key = listItemKey(item);
    if (key) seen[key] = true;
  });

  let added = 0;
  source.forEach((item) => {
    const key = listItemKey(item);
    if (!key || seen[key]) return;
    target.push(item);
    seen[key] = true;
    added += 1;
  });
  return added;
}

function collectResultLists(root) {
  const lists = [];

  function walk(node, path) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((x, i) => walk(x, `${path}[${i}]`));
      return;
    }

    for (const key in node) {
      const val = node[key];
      if (looksLikeResultList(key, val)) {
        lists.push({ path: `${path ? path + "." : ""}${key}`, arr: val });
      } else if (val && typeof val === "object") {
        walk(val, `${path ? path + "." : ""}${key}`);
      }
    }
  }

  walk(root, "");
  return lists;
}

function mergeCitySweepResults(target, extra) {
  const targetLists = collectResultLists(target);
  const extraLists = collectResultLists(extra);
  let added = 0;

  targetLists.forEach((targetList) => {
    extraLists.forEach((extraList) => {
      if (targetList.path === extraList.path) {
        added += mergeList(targetList.arr, extraList.arr);
      }
    });
  });

  return added;
}

function citySweepOffsets() {
  return [
    { lat: 0.14, lng: 0 },
    { lat: -0.14, lng: 0 },
    { lat: 0, lng: 0.16 },
    { lat: 0, lng: -0.16 },
    { lat: 0.1, lng: 0.12 },
    { lat: -0.1, lng: -0.12 },
  ];
}

function citySweepHeaders(offset, baseCoord) {
  const next = Object.assign({}, headers, { "X-QX-Xiaocan-City-Sweep": "1" });
  for (const key in next) {
    if (String(key).toLowerCase() === "content-length") delete next[key];
  }
  if (offset && applyHeaderCoordOffset(next, offset) === 0 && baseCoord) {
    next.latitude = String(Number((baseCoord.lat + offset.lat).toFixed(6)));
    next.longitude = String(Number((baseCoord.lng + offset.lng).toFixed(6)));
  }
  return next;
}

function finishResponse(obj, changed) {
  if (changed) done(obj);
  else $done({});
}

function processResponseObj(obj, skipRatioFilter) {
  let changed = false;

  if (/native_order_config\.json/i.test(url)) {
    obj.open_native = false;
    obj.open_ios_native = false;
    obj.open_android_native = false;
    obj.open_ohos_native = false;
    obj.open_flutter_native = false;
    console.log("[接口清理] 已关闭原生订单页配置，避免订单异常弹窗");
    changed = true;
  } else if (method === "AdMobileService.MatchPlacement" || /SilkwormAd/i.test(server)) {
    obj = {
      status: { code: 0 },
      data: {
        ad_open: 0,
        ad_type: [],
        ad_source: [],
        android_ad_id: "",
        android_slot_id: "",
        ios_ad_id: "",
        ios_slot_id: "",
        ad_photo: "",
      },
    };
    changed = true;
  } else if (/GetOrderRejectionRecord|GetPendingResurrectionOrder|IsShowOrderAwardPopup/i.test(method)) {
    obj = emptyOk();
    console.log(`[接口清理] 已关闭订单异常/订单奖励弹窗：${method}`);
    changed = true;
  } else {
    if (!skipRatioFilter) changed = filterRatioRebateItems(obj) > 0 || changed;
    changed = disableOrderAbnormalPopup(obj) || changed;
    changed = stripPlacementResources(obj) || changed;
    changed = disablePopupLike(obj) || changed;
  }

  return { obj, changed };
}

function finishCitySweep(obj, changed, needsRatioFilter) {
  if (needsRatioFilter) changed = filterRatioRebateItems(obj) > 0 || changed;
  finishResponse(obj, changed);
}

function tryCitySweepAndFinish(obj, changed, needsRatioFilter) {
  if (!isResponse || isCitySweepRequest() || !methodLooksLikeShopList()) {
    finishCitySweep(obj, changed, needsRatioFilter);
    return;
  }

  if (typeof $task === "undefined") {
    console.log(`[接口清理] ${method || "RPC"} 无法同城多点：$task 不可用`);
    finishCitySweep(obj, changed, needsRatioFilter);
    return;
  }

  let reqObj = null;
  let requestBodyIsJson = true;
  try {
    reqObj = JSON.parse(($request && $request.body) || "");
  } catch (e) {
    requestBodyIsJson = false;
    reqObj = readCachedRequestObj();
    if (reqObj) console.log(`[接口清理] ${method || "RPC"} 使用缓存请求体做同城多点`);
  }

  const listCount = collectResultLists(obj).length;
  const bodyCoordCount = reqObj ? findCoordPairs(reqObj).length : 0;
  const headerCoordCount = findHeaderCoordPairs(headers).length;
  const responseBaseCoord = firstCoordFrom(obj);
  if (listCount === 0 || (bodyCoordCount === 0 && headerCoordCount === 0 && !responseBaseCoord)) {
    console.log(`[接口清理] ${method || "RPC"} 无法同城多点：body坐标 ${bodyCoordCount}，header坐标 ${headerCoordCount}，响应坐标 ${responseBaseCoord ? 1 : 0}，列表 ${listCount}`);
    finishCitySweep(obj, changed, needsRatioFilter);
    return;
  }

  const requests = citySweepOffsets().map((offset) => {
    let nextBody = ($request && $request.body) || readCachedRawRequestBody();
    if (bodyCoordCount > 0) {
      const next = cloneJson(reqObj);
      if (applyCoordOffset(next, offset) === 0) return null;
      widenCityShopRequest(next);
      nextBody = JSON.stringify(next);
    } else if (requestBodyIsJson) {
      return null;
    }

    return $task.fetch({
      url,
      method: "POST",
      headers: citySweepHeaders(bodyCoordCount > 0 ? null : offset, responseBaseCoord),
      body: nextBody,
    }).then((resp) => {
      try {
        return JSON.parse(resp.body || "{}");
      } catch (e) {
        return null;
      }
    }, () => null);
  }).filter(Boolean);

  if (requests.length === 0) {
    finishResponse(obj, changed);
    return;
  }

  Promise.all(requests).then((results) => {
    let added = 0;
    results.forEach((extra) => {
      if (extra) added += mergeCitySweepResults(obj, extra);
    });
    if (added > 0) {
      obj._qx_city_sweep_added_count = added;
      console.log(`[接口清理] ${method || "RPC"} 同城多点合并新增 ${added} 条店铺`);
      changed = true;
    }
    finishCitySweep(obj, changed, needsRatioFilter);
  }, () => {
    finishCitySweep(obj, changed, needsRatioFilter);
  });
}

if (!body) {
  if (isRequestHeader) logRequestHeaderHit();
  $done({});
} else {
  let obj;
  try {
    obj = JSON.parse(body);
  } catch (e) {
    obj = null;
  }

  if (obj == null) {
    if (!isResponse && body) saveRawRequestBodyForSweep(body);
    $done({});
  } else try {
    if (!isResponse) {
      let changed = false;
      saveRequestObjForSweep(obj);
      const widened = widenCityShopRequest(obj);
      if (widened > 0) {
        console.log(`[接口清理] ${method || "RPC"} 已放宽同城店铺请求范围/数量：${widened} 处`);
        changed = true;
      }
      if (changed) done(obj);
      else $done({});
    } else {
      const deferRatioFilter = methodLooksLikeShopList();
      const result = processResponseObj(obj, deferRatioFilter);
      tryCitySweepAndFinish(result.obj, result.changed, deferRatioFilter);
    }
  } catch (e) {
    console.log(`[接口清理] 异常：${e.message || e}`);
    $done({});
  }
}
