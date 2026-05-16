/*
地理检测

[rewrite_local]
^https:\/\/gwh?\.xiaocantech\.com\/rpc$ url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/xiaocan.js

[mitm]
hostname = gw.xiaocantech.com, gwh.xiaocantech.com

*/

const body = typeof $response !== "undefined" ? $response.body : "";
const headers = ($request && $request.headers) || {};
const url = ($request && $request.url) || "";

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

function geoPass(extra) {
  return Object.assign(
    {
      status: { code: 0 },
      data: null,
      result: null,
      list: null,
      pass: true,
      allow: true,
      valid: true,
      enable: true,
      is_valid: true,
      is_pass: true,
      need_verify: false,
      need_retry: false,
      need_correct: false,
      show: false,
      is_show: false,
      show_popup: false,
      popup: null,
      dialog: null,
      toast: "",
      msg: "",
      message: "",
    },
    extra || {}
  );
}

function isGeoAbnormalResponse(obj) {
  if (!isObj(obj)) return false;
  const status = isObj(obj.status) ? obj.status : {};
  const code = Number(status.code);
  const msg = String(status.msg || status.message || obj.msg || obj.message || "");
  return code === 9 && /\u5730\u7406\u4f4d\u7f6\u5f02\u5e38|\u4f4d\u7f6\u5f02\u5e38|\u4fee\u6b63.*\u5c0f\u8695/i.test(msg);
}

function isObj(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function lower(s) {
  return String(s || "").toLowerCase();
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
          console.log(`[清理] ${path ? path + "." : ""}${key} 移除 ${diff} 条按比例返利项`);
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
      console.log(`[清理] poi_list 移除 ${diff} 条按比例返利店铺`);
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

    if (/FusionGrabPromotionQuota/i.test(method)) {
      console.log("[小蚕清理] 跳过抢单接口，保留服务端原始返回");
      $done({});
    } else if (/SilkwormRcs/i.test(server) || /SilkwormRcsService\./i.test(method) || isGeoAbnormalResponse(obj)) {
      obj = geoPass();
      console.log(`[小蚕清理] 已屏蔽地理/风控检测：${method || server || "geo abnormal response"}`);
      changed = true;
    } else if (/native_order_config\.json/i.test(url)) {
      obj.open_native = false;
      obj.open_ios_native = false;
      obj.open_android_native = false;
      obj.open_ohos_native = false;
      obj.open_flutter_native = false;
      console.log("[小蚕清理] 已关闭原生订单页配置，避免订单异常弹窗");
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
      console.log(`[清理] 已关闭订单异常/订单奖励弹窗：${method}`);
      changed = true;
    } else {
      changed = filterRatioRebateItems(obj) > 0 || changed;
      changed = disableOrderAbnormalPopup(obj) || changed;
      changed = stripPlacementResources(obj) || changed;
      changed = disablePopupLike(obj) || changed;
    }

    if (changed) done(obj);
    else $done({});
  } catch (e) {
    console.log(`[清理] 异常：${e.message || e}`);
    $done({});
  }
}
