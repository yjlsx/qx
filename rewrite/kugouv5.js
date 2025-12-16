/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-request https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */



if (!$response || !$response.body) {
  console.log("[KG_V5] 无响应体，跳过");
  $done({});
  return;
}

let obj;
try {
  obj = JSON.parse($response.body);
} catch (e) {
  console.log("[KG_V5] JSON 解析失败");
  $done({});
  return;
}

// 确认是我们要的接口
if (!obj.data) {
  console.log("[KG_V5] 无 data 字段，非目标响应");
  $done({});
  return;
}

// 取原请求参数
const reqUrl = new URL($request.url);
const p = Object.fromEntries(reqUrl.searchParams.entries());

// 构造替换地址（顺序与你给的一致）
const newUrl =
  "https://kg.zzxu.de/api/v5url" +
  "?hash=" + p.hash +
  "&mode=raw" +
  "&quality=" + p.quality +
  "&fallback=0" +
  "&debug=0" +
  "&album_id=" + p.album_id +
  "&album_audio_id=" + p.album_audio_id;

// ⭐ 核心日志 1：命中
console.log("[KG_V5] 命中 v5 接口");

// ⭐ 核心日志 2：原地址
console.log("[KG_V5] 原 play_url = " + (obj.data.play_url || "none"));

// 替换
obj.data.play_url = newUrl;
obj.data.backup_url = [newUrl];

// ⭐ 核心日志 3：新地址
console.log("[KG_V5] 新 play_url = " + newUrl);

$done({
  body: JSON.stringify(obj)
});
