/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url$ url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js

[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */



if (!$request || !$request.url) {
  $done({});
}

const url = new URL($request.url);
const p = url.searchParams;

// 必要参数校验
if (!p.get("hash") || !p.get("album_audio_id")) {
  console.log("[KG_v5] missing required params");
  $done({});
}

// 按「模板顺序」手动拼接
let query = [
  `hash=${encodeURIComponent(p.get("hash"))}`,
  `mode=raw`,
  p.get("quality") ? `quality=${encodeURIComponent(p.get("quality"))}` : "",
  `fallback=0`,
  `debug=0`,
  p.get("album_id") ? `album_id=${encodeURIComponent(p.get("album_id"))}` : "",
  `album_audio_id=${encodeURIComponent(p.get("album_audio_id"))}`
].filter(Boolean).join("&");

const newUrl = `https://kg.zzxu.de/api/v5url?${query}`;

// 日志确认
console.log(
  `[KG_Replace] 正在请求替换源: ${newUrl}`
);

// 替换请求
$done({ url: newUrl });
