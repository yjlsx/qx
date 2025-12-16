/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-request https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */



if (!$request) {
  $done({});
}

const oldUrl = $request.url;

// 只处理 v5 接口
if (!oldUrl.includes("/tracker/v5/url")) {
  $done({});
}

const urlObj = new URL(oldUrl);
const p = Object.fromEntries(urlObj.searchParams.entries());

// 构造新 URL（顺序与你日志一致）
const newUrl =
  "https://kg.zzxu.de/api/v5url" +
  "?hash=" + p.hash +
  "&mode=raw" +
  "&quality=" + p.quality +
  "&fallback=0" +
  "&debug=0" +
  "&album_id=" + p.album_id +
  "&album_audio_id=" + p.album_audio_id;

// ⭐ headers：必须整包返回（不能只改一部分）
const newHeaders = Object.assign({}, $request.headers, {
  "Host": "kg.zzxu.de",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
  "Accept": "*/*",
  "Referer": "",
  "Origin": ""
});

$done({
  url: newUrl,
  method: "GET",
  headers: newHeaders
});

console.log("[KG_V5] script-request 命中");

