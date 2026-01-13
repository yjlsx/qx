/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */


// ===============================================
// 酷狗音乐 - 播放链接解密 (Response Body 模式)
// 适配：Gateway v5 接口 & m.kugou.com 格式转换
// ===============================================

const url = $request.url;
const body = $response.body;

// 1. 提取 Hash 和 AlbumID
const getParam = (url, key) => {
    const reg = new RegExp("(^|&)" + key + "=([^&]*)(&|$)", "i");
    const r = url.split('?')[1] ? url.split('?')[1].match(reg) : null;
    return r ? unescape(r[2]) : null;
};

const hash = getParam(url, "hash");

// 如果没有 Hash，原路放行
if (!hash) {
    $done({});
}

// 2. 构造后台请求地址 (m.kugou.com)
const crackUrl = `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`;

const myRequest = {
    url: crackUrl,
    method: "GET",
    headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        "Cookie": "kg_mid=8888" 
    }
};

console.log(` [KG_Crack] 正在后台请求 Hash: ${hash}`);

// 3. 发起请求
$task.fetch(myRequest).then(response => {
    try {
        const webData = JSON.parse(response.body);
        
        // 4. 检查是否获取到了 URL
        // 你的抓包显示：成功时 url 有值，失败时 url 为 "" 或 undefined
        if (webData && webData.url && webData.url.length > 5) {
            console.log(" [KG_Crack] 成功获取地址: " + webData.url);
            
            // 5. 【关键】格式重组！把 m.kugou.com 的数据塞进 v5 接口的模具里
            const fakeBody = {
                "status": 1,
                "error_code": 0,
                "url": [ webData.url ], // v5 接口要求 url 是数组
                "hash": hash,
                "new_hash": hash,
                "file_size": webData.fileSize || 0,
                "time_length": (webData.timeLength || 0) * 1000,
                "bitrate": webData.bitRate || 128000,
                "file_name": webData.fileName || "已解锁歌曲",
                "store_type": "audio",
                "vip_type": 6,
                "trans_param": { 
                    "musicpack_advance": 0,
                    "pay_block_tpl": 0 
                }
            };
            
            $done({ body: JSON.stringify(fakeBody) });
            
        } else {
            console.log(" [KG_Crack] 歌曲硬锁，无法获取 URL (Error: " + (webData.error || "未知") + ")");
            // 失败时，返回原始响应，或者构造一个假的错误信息防止 App 卡死
            // 这里选择返回 null 让 App 走默认流程（可能会弹窗提示付费）
            $done({});
        }
    } catch (e) {
        console.log(" [KG_Crack] 解析错误: " + e);
        $done({});
    }
}, reason => {
    console.log(" [KG_Crack] 网络错误");
    $done({});
});
