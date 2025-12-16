/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-request https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */



/**
 * Quantumult X
 * script-request
 */

if (typeof $request === "undefined") {
  $done({});
  return;
}

const oldUrl = $request.url;

if (!oldUrl.includes("/tracker/v5/url")) {
  $done({});
  return;
}

console.log("[KG_V5] script-request 命中");
console.log("[KG_V5] 原始 URL:", oldUrl);

let p;
try {
  const u = new URL(oldUrl);
  p = Object.fromEntries(u.searchParams.entries());
} catch (e) {
  console.log("[KG_V5] URL 解析失败");
  $done({});
  return;
}

// 必要参数校验
if (!p.hash || !p.album_audio_id) {
  console.log("[KG_V5] 缺少必要参数");
  $done({});
  return;
}


const newUrl =
  "https://kg.zzxu.de/api/v5url" +
  "?hash=" + encodeURIComponent(p.hash) +
  "&mode=raw" +
  "&quality=" + encodeURIComponent(p.quality || "") +
  "&fallback=0" +
  "&debug=0" +
  "&album_id=" + encodeURIComponent(p.album_id || "") +
  "&album_audio_id=" + encodeURIComponent(p.album_audio_id);

console.log("[KG_V5] 目标 URL(逻辑):", newUrl);

// Quantumult X：这里只能安全返回 headers / method
$done({
  method: "GET",
  headers: $request.headers
});


