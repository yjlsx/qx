/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */

// ===============================================
// 酷狗音乐 - 播放链接解密 v12.0 (浏览器指纹模拟版)
// 核心逻辑：
// 1. 注入 Sec-Fetch-* 头，完美伪装成 Safari 浏览器导航
// 2. 骗取 pay_type: 0 后，自动尝试 MP3 Hash
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

// 2. 【核心】1:1 复刻你浏览器抓包的 Headers
// 包含 Sec-Fetch 系列，这是骗过服务器的关键
const browserHeaders = {
    "Cookie": "kg_open_key=2f4c93717f679bc2b07688be6230c230; kg_dfid=4XRrr92RN5zm0Qu2Ex1AXAeZ; kg_mid=68b8f6bcee9fb76cb0052d9da3c37cf4",
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "zh-CN,zh-Hans;q=0.9",
    "Connection": "keep-alive",
    "Host": "m.kugou.com",
    // --- 浏览器指纹特征 ---
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Dest": "document"
};

console.log(` [KG_Crack] 初始请求 Hash: ${originalHash}`);

// 3. 通用请求函数
const requestMusic = (targetHash) => {
    return new Promise((resolve, reject) => {
        const req = {
            url: `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${targetHash}`,
            headers: browserHeaders // 使用伪装头
        };
        $task.fetch(req).then(res => {
            try {
                // 酷狗有时候返回的是 JSON，有时候可能是 HTML，这里尝试解析
                let data = JSON.parse(res.body);
                resolve(data);
            } catch (e) { 
                // 如果返回的不是JSON，说明伪装太像了，返回了网页？
                console.log("非JSON响应，可能需要处理");
                reject("JSON解析失败"); 
            }
        }, err => reject("网络错误"));
    });
};

// 4. 执行逻辑
requestMusic(originalHash).then(data => {
    
    // 调试日志：看看这次是不是 pay_type: 0 了
    if (data && data.pay_type !== undefined) {
        console.log(` [KG_Crack] 身份伪装结果: PayType=${data.pay_type} (0为成功)`);
    }

    // 情况A: 原 Hash 直接有地址
    if (data && data.url && data.url.length > 5) {
        console.log(" [KG_Crack] 原 Hash 直连成功！");
        finish(data, originalHash);
    } 
    // 情况B: URL 为空 (浏览器就是这种情况)，尝试提取 MP3 Hash
    else if (data && data.extra && data.extra["128hash"]) {
        const mp3Hash = data.extra["128hash"];
        console.log(` [KG_Crack] 原链接为空，捕获 MP3 Hash: ${mp3Hash}`);
        console.log(` [KG_Crack] 使用浏览器身份请求 MP3 资源...`);
        
        // 发起第二次请求 (换 MP3 Hash + 浏览器头)
        requestMusic(mp3Hash).then(data2 => {
            if (data2 && data2.url && data2.url.length > 5) {
                console.log(` [KG_Crack] 二次爆破成功！获取到 MP3 链接`);
                finish(data2, mp3Hash);
            } else {
                console.log(` [KG_Crack] 即使是 pay_type:0，MP3 链接依然为空。`);
                // 这种情况下，服务器就是不给链接，没办法了
                $done({});
            }
        }).catch(err => {
            console.log(" [KG_Crack] 二次请求失败");
            $done({});
        });
    } 
    else {
        console.log(` [KG_Crack] 无法获取信息 (PayType:${data ? data.pay_type : "?"})`);
        $done({});
    }
}).catch(err => {
    console.log(" [KG_Crack] 请求异常: " + err);
    $done({});
});

// 5. 构造最终响应
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

