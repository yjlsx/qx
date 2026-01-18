/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */


if (!$response || !$request) {
  $done({});
}

const url = $request.url;
const p = Object.fromEntries(new URL(url).searchParams.entries());

const targetQuality = p.quality || "";

const api = "https://kg.zzxu.de/api/v5url" +
  "?hash=" + (p.hash || "") +
  "&mode=raw" +
  "&quality=" + targetQuality +
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

  if (obj.status === 0 && obj.attempts?.[0]?.target) {
    let att = obj.attempts[0];
    obj.status = 1;
    obj.error = "";
    att.status = 1;
    att.ok = true;
    
    // 替换 URL 中的权限标识
    const fixedUrl = att.target
      .replace(/vipType=0/g, "vipType=6")
      .replace(/IsFreePart=1/g, "IsFreePart=0");

    const q = targetQuality.toLowerCase();
    const finalFmt = (q.includes("viper") || q === "super" || q === "flac") ? "flac" : "mp3";

    obj.data = {
      "url": [fixedUrl],
      "status": 1,
      "fmt": finalFmt,
      "hash": p.hash
    };
    att.target = fixedUrl;

    console.log("❚ [KG_Replace] 获取成功，执行替换");
  }

  $done({
    status: 200,
    headers: $response.headers,
    body: JSON.stringify(obj)
  });
}, _ => {
  $done({});
});

