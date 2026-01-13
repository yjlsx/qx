/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */


const url = $request.url;
const headers = $request.headers;

console.log("🧭 当前请求 URL：" + url);

// 处理 /v5/url 和 /tracker/v5/url 请求重写
if (url.includes("/v5/url?") || url.includes("/tracker/v5/url?")) {
    const hashMatch = url.match(/hash=([0-9a-fA-F]{32})/);
    const hash = hashMatch ? hashMatch[1] : '';

    console.log("🔍 检测 hash 参数：" + (hash || "未找到"));

    if (hash) {
        const newUrl = `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`;
        headers['x-router'] = 'm.kugou.com';

        console.log("✅ 请求重写成功！");
        console.log("🎯 新 URL：" + newUrl);

        $done({
            url: newUrl,
            headers: headers
        });
    } else {
        console.log("❌ 未检测到合法 hash，跳过重写。");
        $done({});
    }
    return;
}

