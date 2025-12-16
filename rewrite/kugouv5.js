/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url$ url script-request https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js

[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */


// Quantumult X - script-request
// 目标：v5 → kg.zzxu.de，仅保留必要参数

if (!$request || !$request.url) {
  $done({});
}

const url = new URL($request.url);
const p = Object.fromEntries(url.searchParams.entries());

// 必要参数校验
if (!p.hash || !p.album_audio_id) {
  console.log("[KG_v5] missing required params");
  $done({});
}

// 只保留「确定有用」的字段
const params = {
  hash: p.hash,
  album_audio_id: p.album_audio_id,
  album_id: p.album_id || "",
  quality: p.quality || "",
  need_ogg: p.need_ogg || ""
};

// 拼接 query
const query = Object.keys(params)
  .filter(k => params[k] !== "")
  .map(k => `${k}=${encodeURIComponent(params[k])}`)
  .join("&");

const newUrl = `https://kg.zzxu.de/api/v5url?${query}`;

// 日志（用于确认行为）
console.log(
  `[KG_Replace] 正在请求替换源: ${newUrl}`
);

// 替换请求
$done({ url: newUrl });
