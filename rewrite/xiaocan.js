/*
小蚕/小餐类接口去广告 + 移除所有“按比例返利”店铺单


[rewrite_local]
^https:\/\/gwh?\.xiaocantech\.com\/rpc$ url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/xiaocan.js

[mitm]
hostname = gw.xiaocantech.com, gwh.xiaocantech.com

*/

const body = typeof $response !== "undefined" ? $response.body : "";
const headers = ($request && $request.headers) || {};

function getHeader(name) {
  const wanted = String(name).toLowerCase();
  for (const key in headers) {
    if (String(key).toLowerCase() === wanted) return headers[key];
  }
  return "";
}

const method = String(getHeader("methodname") || "");
const server = String(getHeader("servername") || "");

function done(obj) {
  $done({ body: JSON.stringify(obj) });
}

function isObj(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function emptyStatus() {
  return { status: { code: 0 } };
}

function hasRatioRebate(item) {
  if (!isObj(item)) return false;

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

  for (const key of ratioKeys) {
    if (Number(item[key] || 0) > 0) return true;
  }

  const commissionKeys = [
    "max_commission",
    "user_max_commission",
    "media_max_commission",
    "commission",
    "commission_amount",
  ];

  for (const key of commissionKeys) {
    if (Number(item[key] || 0) > 0 && (
      Array.isArray(item.plan_activity_info_list) ||
      Object.prototype.hasOwnProperty.call(item, "poi_event_id") ||
      Object.prototype.hasOwnProperty.call(item, "wm_poi_id")
    )) {
      return true;
    }
  }

  if (Array.isArray(item.plan_activity_info_list) && item.plan_activity_info_list.length > 0) {
    return item.plan_activity_info_list.some((plan) => {
      return isObj(plan) && (
        Number(plan.ratio || 0) > 0 ||
        Number(plan.user_ratio || 0) > 0 ||
        Number(plan.media_ratio || 0) > 0 ||
        Number(plan.max_commission || 0) > 0 ||
        String(plan.plan_activity_type || "") !== ""
      );
    });
  }
  return false;
}

function filterRatioRebateLists(obj) {
  let removed = 0;

  function walk(node) {
    if (Array.isArray(node)) {
      for (const entry of node) {
        if (!hasRatioRebate(entry)) walk(entry);
      }
      return;
    }
    if (!isObj(node)) return;

    for (const key in node) {
      if (Array.isArray(node[key])) {
        const before = node[key].length;
        node[key] = node[key].filter((item) => !hasRatioRebate(item));
        removed += before - node[key].length;
      }
    }

    for (const key in node) {
      if (isObj(node[key]) || Array.isArray(node[key])) walk(node[key]);
    }
  }

  walk(obj);
  if (removed > 0) {
    obj._qx_removed_ratio_rebate_count = removed;
  }
  return obj;
}

function stripPlacementResources(obj) {
  if (!Array.isArray(obj.resources)) return obj;

  const denySlug = /(?:AD|ADS|POPUP|BANNER|SEARCH_RIGHT|XC_JG|CERAMIC|THEMESKIN|FANLI|MAIN_TO|GUIDE|BESTSELLERS_TAG|SAFETY_GUARANTEE)/i;
  obj.resources = obj.resources.map((resource) => {
    if (!isObj(resource)) return resource;
    const slug = String(resource.resource_slug || "");
    if (denySlug.test(slug)) {
      return {
        resource_id: resource.resource_id,
        value: null,
        status: { code: 0 },
        resource_slug: resource.resource_slug,
      };
    }
    return resource;
  });
  return obj;
}

function disablePopupLike(obj) {
  if (Object.prototype.hasOwnProperty.call(obj, "show")) obj.show = false;
  if (Object.prototype.hasOwnProperty.call(obj, "if_show")) obj.if_show = false;
  if (Object.prototype.hasOwnProperty.call(obj, "is_show")) obj.is_show = false;
  if (Object.prototype.hasOwnProperty.call(obj, "popup")) obj.popup = null;
  if (Object.prototype.hasOwnProperty.call(obj, "pop_up")) obj.pop_up = null;
  if (Object.prototype.hasOwnProperty.call(obj, "banner")) obj.banner = null;
  if (Object.prototype.hasOwnProperty.call(obj, "banners") && Array.isArray(obj.banners)) obj.banners = [];
  if (isObj(obj.data)) disablePopupLike(obj.data);
  return obj;
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
    if (method === "AdMobileService.MatchPlacement") {
      done({
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
      });
    } else if (method === "PlacementMatchService.BatchMatchPlacement") {
      done(stripPlacementResources(obj));
    } else if (method === "SilkwormRcsService.MeituanShangjinGetPoiList") {
      done(filterRatioRebateLists(obj));
    } else if (
      /Popup|PopUp|Banner|Marketing|Lottery|LuckRedPack|Challenge|VipPopup|RebornCouponPopup|NewMemberPopup|IsShow/i.test(method) ||
      /SilkwormAd/i.test(server)
    ) {
      done(disablePopupLike(obj));
    } else {
      const cleaned = filterRatioRebateLists(obj);
      if (cleaned._qx_removed_ratio_rebate_count > 0) {
        done(cleaned);
      } else {
        $done({});
      }
    }
  } catch (e) {
    $done({});
  }
}
