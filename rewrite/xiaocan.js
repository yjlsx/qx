/*
小蚕/小餐类接口去广告 + 移除所有“按比例返利”店铺单


[rewrite_local]
^https:\/\/gwh?\.xiaocantech\.com\/rpc$ url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/xiaocan.js

[mitm]
hostname = gw.xiaocantech.com, gwh.xiaocantech.com

*/

const body = typeof $response !== "undefined" ? $response.body : "";
const headers = ($request && $request.headers) || {};

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

function isObj(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function lower(s) {
  return String(s || "").toLowerCase();
}

function keyLooksLikeRebate(key) {
  return /(ratio|rebate|commission|cps|union|media|activity|plan|poi_event|reward|bounty|shangjin|fanli|fan_li)/i.test(key);
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

  if (Array.isArray(node.plan_activity_info_list) && node.plan_activity_info_list.length > 0) return true;
  if (Array.isArray(node.activity_info_list) && node.activity_info_list.length > 0) return true;
  if (Array.isArray(node.commission_info_list) && node.commission_info_list.length > 0) return true;

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

    if (/^(poi_event_id|event_id|activity_id|plan_activity_type|rebate_condition)$/.test(lk) && String(val || "") !== "") {
      return true;
    }

    if (deepHasRatioRebate(val, depth + 1)) return true;
  }

  return false;
}

function looksLikeResultList(key, arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  if (/list|items|results|poi|store|shop|promotion|data/i.test(key)) return true;
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

  function walk(node, path) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      node.forEach((x, i) => walk(x, `${path}[${i}]`));
      return;
    }

    for (const key in node) {
      const val = node[key];
      if (Array.isArray(val) && looksLikeResultList(key, val)) {
        const before = val.length;
        node[key] = val.filter((item) => !deepHasRatioRebate(item, 0));
        const diff = before - node[key].length;
        if (diff > 0) {
          removed += diff;
          console.log(`[小蚕清理] ${path ? path + "." : ""}${key} 移除 ${diff} 条按比例返利项`);
        }
        node[key].forEach((x, i) => walk(x, `${path ? path + "." : ""}${key}[${i}]`));
      } else if (val && typeof val === "object") {
        walk(val, `${path ? path + "." : ""}${key}`);
      }
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

if (!body) {
  $done({});
} else {
  let obj;
  try {
    obj = JSON.parse(body);
  } catch (e) {
    $done({});
  }

  try {
    let changed = false;

    if (method === "AdMobileService.MatchPlacement" || /SilkwormAd/i.test(server)) {
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
    } else {
      changed = stripPlacementResources(obj) || changed;
      changed = disablePopupLike(obj) || changed;
      changed = filterRatioRebateItems(obj) > 0 || changed;
    }

    if (changed) done(obj);
    else $done({});
  } catch (e) {
    console.log(`[小蚕清理] 异常：${e.message || e}`);
    $done({});
  }
}
