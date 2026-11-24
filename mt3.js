/*
[rewrite_local]
^https?:\/\/i\.waimai\.meituan\.com\/openh5\/order\/(?:list|manager\/v3\/(?:detail|status))(?:\?|$) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/main/mt3.js

[mitm]
hostname = i.waimai.meituan.com
*/

const CUSTOM_POI_NAME = "小鼎锅 · 现炒 · 长沙盖码饭（石龙店）";

function rewriteShopName(url, body) {
  const route = /^https?:\/\/i\.waimai\.meituan\.com\/openh5\/order\/(list|manager\/v3\/(?:detail|status))(?:\?|$)/.exec(url);
  if (!route || !body || !CUSTOM_POI_NAME.trim()) return {};

  const parts = body.split(/("(?:[^"\\]|\\.)*"(?:\s*:)?)/);
  const indexedBody = parts.map((part, index) =>
    index % 2 === 1 && !part.endsWith(":") ? `"${index} ${part.slice(1)}` : part
  ).join("");
  const data = JSON.parse(indexedBody)?.data;
  if (!data) return {};

  const replacement = JSON.stringify(CUSTOM_POI_NAME);
  let changed = false;
  function rename(indexedName) {
    if (typeof indexedName !== "string") return;
    const separator = indexedName.indexOf(" ");
    if (indexedName.slice(separator + 1) === CUSTOM_POI_NAME) return;
    parts[Number(indexedName.slice(0, separator))] = replacement;
    changed = true;
  }

  if (route[1] === "list") {
    for (const list of [data.orderList, data.orders, data.order_list]) {
      if (!Array.isArray(list)) continue;
      for (const order of list) {
        rename(order?.poiName);
        rename(order?.wm_poi_name);
      }
    }
  } else if (route[1] === "manager/v3/detail") {
    rename(data.poi_name);
    rename(data.wm_poi_name);
  } else {
    rename(data.poi_info?.poi_name);
  }
  return changed ? { body: parts.join("") } : {};
}

try {
  $done(rewriteShopName($request.url, $response.body));
} catch {
  $done({});
}
