/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */




if (!$response || !$request) {
  $done({});
}

const urlObj = new URL($request.url);
const p = Object.fromEntries(urlObj.searchParams.entries());

// 必要参数校验
if (!p.hash || !p.album_audio_id) {
  $done({});
}

// 构造第三方接口（顺序固定）
const api =
  "https://kg.zzxu.de/api/v5url" +
  "?hash=" + p.hash +
  "&mode=raw" +
  "&quality=" + (p.quality || "") +
  "&fallback=0" +
  "&debug=0" +
  "&album_id=" + (p.album_id || "") +
  "&album_audio_id=" + p.album_audio_id;

// 请求第三方
$task.fetch({
  url: api,
  method: "GET",
  headers: {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    "Accept": "*/*"
  }
}).then(resp => {
  // 成功就直接替换响应体
  $done({
    status: 200,
    headers: $response.headers,
    body: resp.body
  });
}, _ => {
  // 失败就回落官方
  $done({});
});
