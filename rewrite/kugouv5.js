/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-request https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */



if (!$request || !$request.url) {
  $done({});
  return;
}

const oldUrl = $request.url;

if (!oldUrl.includes("/tracker/v5/url")) {
  $done({});
  return;
}

const u = new URL(oldUrl);
const p = Object.fromEntries(u.searchParams.entries());

const newUrl =
  "https://kg.zzxu.de/api/v5url" +
  "?hash=" + (p.hash || "") +
  "&mode=raw" +
  "&quality=" + (p.quality || "") +
  "&fallback=0" +
  "&debug=0" +
  "&album_id=" + (p.album_id || "") +
  "&album_audio_id=" + (p.album_audio_id || "");

// ✅ 日志（Quantumult X 可见）
console.log("[KG_V5] 原始 URL:");
console.log(oldUrl);
console.log("[KG_V5] 替换为:");
console.log(newUrl);

$done({
  url: newUrl
});
