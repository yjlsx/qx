/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url$ url script-request https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js

[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */


if (!$request || !$request.url) {
  $done({});
}

const url = new URL($request.url);
const p = Object.fromEntries(url.searchParams.entries());

// 必要参数
if (!p.hash || !p.album_audio_id) {
  $done({});
}

// 原样透传官方参数（不猜、不改）
const params = {
  hash: p.hash,
  album_id: p.album_id || "",
  album_audio_id: p.album_audio_id,
  quality: p.quality || "",
  need_ogg: p.need_ogg || "",
  vipdl: p.vipdl || "",
  vipType: p.vipType || "",
  mode: "raw",
  fallback: "0"
};

// 拼接 query
const query = Object.keys(params)
  .filter(k => params[k] !== "")
  .map(k => `${k}=${encodeURIComponent(params[k])}`)
  .join("&");

// 新请求地址
const newUrl = `https://kg.zzxu.de/api/v5url?${query}`;

// 🔴 关键点：直接替换请求 URL
$done({
  url: newUrl
});
