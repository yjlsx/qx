/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */


if (!$response || !$request) {
  $done({});
}

const p = Object.fromEntries(new URL($request.url).searchParams.entries());

const originalQuality = p.quality || "high";

const api = "https://kg.zzxu.de/api/v5url" +
  "?hash=" + (p.hash || "") +
  "&mode=raw" +
  "&quality=high" + // 锁定请求 high 以确保接口不报错
  "&fallback=0" +
  "&debug=0" +
  "&album_id=" + (p.album_id || "") +
  "&album_audio_id=" + (p.album_audio_id || "");

console.log("❚ [KG_Replace] 正在请求替换源: " + api);

$task.fetch({
  url: api,
  method: "GET",
  headers: {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    "Accept": "*/*"
  }
}).then(resp => {
  let obj = JSON.parse(resp.body);

  if (obj.status === 0 || !obj.data) {
    let att = (obj.attempts && obj.attempts[0]) ? obj.attempts[0] : {};
    obj.status = 1;
    obj.error = "";
    
    let targetUrl = att.target || "";

    if (targetUrl) {
      // 修正权限参数
      const fixedUrl = targetUrl
        .replace(/vipType=\d+/g, "vipType=6")
        .replace(/IsFreePart=\d+/g, "IsFreePart=0");

      const finalFmt = (originalQuality.includes("viper") || originalQuality === "super") ? "flac" : "mp3";

      obj.data = {
        "url": [fixedUrl],
        "status": 1,
        "fmt": finalFmt,
        "hash": p.hash,
        "quality": originalQuality // 伪装回原始音质
      };

      // 修正 attempts 内部信息
      if (obj.attempts && obj.attempts[0]) {
        obj.attempts[0].status = 1;
        obj.attempts[0].ok = true;
        obj.attempts[0].target = fixedUrl;
      }
    }
  }

  console.log("❚ [KG_Replace] 获取成功，执行替换");

  $done({
    status: 200,
    headers: $response.headers,
    body: JSON.stringify(obj)
  });
}, _ => {
  $done({});
});
