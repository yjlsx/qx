/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */


// ===============================================
// 酷狗音乐 - 播放链接解密 v11.0 (定向爆破版)
// 核心逻辑：
// 1. 植入用户提供的真实 Cookie (解决付费弹窗)
// 2. 自动提取 extra 中的 MP3 Hash (解决空链接)
// ===============================================

const url = $request.url;

// 1. 提取原始 Hash
const getParam = (url, key) => {
    const reg = new RegExp("(^|&)" + key + "=([^&]*)(&|$)", "i");
    const r = url.split('?')[1] ? url.split('?')[1].match(reg) : null;
    return r ? unescape(r[2]) : null;
};
const originalHash = getParam(url, "hash");

if (!originalHash) $done({});

// 2. 【核心】注入你抓包提供的真实身份 Headers
// 这是让服务器返回 pay_type: 0 的关键
const realHeaders = {
    "Cookie": "kg_open_key=2f4c93717f679bc2b07688be6230c230; kg_dfid=4XRrr92RN5zm0Qu2Ex1AXAeZ; kg_mid=68b8f6bcee9fb76cb0052d9da3c37cf4",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Accept": "*/*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "zh-CN,zh-Hans;q=0.9",
    "Connection": "keep-alive",
    "Host": "m.kugou.com"
};

console.log(` [KG_Crack] 初始请求 Hash: ${originalHash}`);

// 3. 通用请求函数
const requestMusic = (targetHash) => {
    return new Promise((resolve, reject) => {
        const req = {
            url: `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${targetHash}`,
            headers: realHeaders // 使用你的真实 Cookie
        };
        $task.fetch(req).then(res => {
            try {
                let data = JSON.parse(res.body);
                resolve(data);
            } catch (e) { reject("JSON解析失败"); }
        }, err => reject("网络错误"));
    });
};

// 4. 执行逻辑
requestMusic(originalHash).then(data => {
    
    // 情况A: 第一次就拿到了 URL (完美)
    if (data && data.url && data.url.length > 5) {
        console.log(" [KG_Crack] 原 Hash 直连成功！");
        finish(data, originalHash);
    } 
    // 情况B: URL 为空，但有 extra 数据 (这首歌的情况)
    else if (data && data.extra && data.extra["128hash"]) {
        const mp3Hash = data.extra["128hash"];
        console.log(` [KG_Crack] 原 Hash 为空 (PayType:${data.pay_type})，捕获到 MP3 Hash: ${mp3Hash}`);
        console.log(` [KG_Crack] 正在发起二次爆破...`);
        
        // 使用新 Hash + 你的 Cookie 再次请求
        requestMusic(mp3Hash).then(data2 => {
            if (data2 && data2.url && data2.url.length > 5) {
                console.log(` [KG_Crack] 二次爆破成功！获取到 MP3 链接`);
                finish(data2, mp3Hash);
            } else {
                console.log(` [KG_Crack] 二次尝试也失败。链接仍为空。`);
                $done({});
            }
        }).catch(err => {
            console.log(" [KG_Crack] 二次请求网络错误");
            $done({});
        });
    } 
    // 情况C: 彻底无解
    else {
        console.log(` [KG_Crack] 无法获取信息 (PayType:${data.pay_type})`);
        $done({});
    }
}).catch(err => {
    console.log(" [KG_Crack] 初始请求异常");
    $done({});
});

// 5. 构造最终响应 (翻译给 App 听)
function finish(data, finalHash) {
    const fakeBody = {
        "status": 1,
        "error_code": 0,
        "url": [ data.url ],
        "hash": finalHash,
        "new_hash": finalHash,
        "file_size": data.fileSize || 0,
        "time_length": (data.timeLength || 0) * 1000,
        "bitrate": data.bitRate || 128000,
        "file_name": data.fileName || "已解锁歌曲",
        "store_type": "audio",
        "vip_type": 6,
        "trans_param": { "musicpack_advance": 0, "pay_block_tpl": 0 }
    };
    $done({ body: JSON.stringify(fakeBody) });
}
