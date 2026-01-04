/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */


if (!$response || !$request) {
  $done({});
}

// 1. 从 App 原始请求中精准提取当前选择的音质
const p = Object.fromEntries(new URL($request.url).searchParams.entries());
const selectedQuality = p.quality || "high"; 

// 2. 构造第三方接口，确保 quality 参数原样传递
const api = `https://kg.zzxu.de/api/v5url?hash=${p.hash}&mode=raw&quality=${selectedQuality}&fallback=0&debug=0&album_id=${p.album_id || ""}&album_audio_id=${p.album_audio_id}`;

$task.fetch({
  url: api,
  method: "GET",
  headers: { "User-Agent": "Mozilla/5.0", "Accept": "*/*" }
}).then(resp => {
  let obj = JSON.parse(resp.body);

  // 3. 只有当第三方接口返回 status: 0 时才执行结构补救
  if (obj.status === 0 && obj.attempts && obj.attempts[0]) {
    let att = obj.attempts[0];
    obj.status = 1;
    obj.error = "";
    att.status = 1;
    att.ok = true;
    
    if (att.target) {
      // 这里的参数替换是为了确保后端接口能正确识别请求权限
      const fixedUrl = att.target
        .replace(/vipType=0/g, "vipType=6")
        .replace(/IsFreePart=1/g, "IsFreePart=0");

      // 4. 自动匹配文件格式：只要是 viper 或 super 级别，强制指定为 flac
      const finalFmt = (selectedQuality.includes("viper") || selectedQuality === "super") ? "flac" : "mp3";

      obj.data = {
        "url": [fixedUrl],
        "status": 1,
        "fmt": finalFmt,
        "hash": p.hash
      };
      att.target = fixedUrl;

      // 日志输出：确认音质对齐情况
      console.log(`[音质替换] 目标音质: ${selectedQuality} -> 对应格式: ${finalFmt}`);
      console.log(`[音质替换] 替换源: ${fixedUrl}`);
    }
  }

  $done({
    status: 200,
    headers: $response.headers,
    body: JSON.stringify(obj)
  });
}, _ => {
  $done({});
});

