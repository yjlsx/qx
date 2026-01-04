/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */


/**
 * 修正版：确保音质对齐 + 错误响应拦截
 */

if (!$response || !$request) {
  $done({});
}

const url = $request.url;
const p = Object.fromEntries(new URL(url).searchParams.entries());

let targetQuality = p.quality || "high";

// 2. 构造第三方接口
const api = `https://kg.zzxu.de/api/v5url?hash=${p.hash}&mode=raw&quality=${targetQuality}&fallback=0&debug=0&album_id=${p.album_id || ""}&album_audio_id=${p.album_audio_id}`;

console.log("[KG_Replace] 请求音质: " + targetQuality);

$task.fetch({
  url: api,
  method: "GET",
  headers: {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    "Accept": "*/*"
  }
}).then(resp => {
  let body = resp.body;
  try {
    let obj = JSON.parse(body);
    
    // --- 关键补救逻辑 ---
    // 如果第三方返回 status: 0 (all attempts failed)，我们手动修正它，防止 App 报错
    if (obj.status === 0 && obj.attempts && obj.attempts[0]) {
        console.log("[KG_Replace] 检测到第三方报错，正在尝试注入 VIP 参数补救...");
        let att = obj.attempts[0];
        obj.status = 1;
        obj.error = "";
        att.status = 1;
        att.ok = true;
        // 这里的 vipToken 建议你在脚本顶部定义一个，或使用默认占位
        if (att.target) {
            att.target = att.target
                .replace(/vipType=0/g, "vipType=6")
                .replace(/IsFreePart=1/g, "IsFreePart=0");
            
            // 构造 data 节点
            obj.data = {
                "url": [att.target],
                "status": 1,
                "fmt": targetQuality === "viper_clear" ? "flac" : "mp3",
                "hash": p.hash
            };
        }
        body = JSON.stringify(obj);
    }
    
    $done({
      status: 200,
      headers: $response.headers,
      body: body
    });
  } catch (e) {
    // 解析失败回落官方
    $done({});
  }
}, _ => {
  $done({});
});
