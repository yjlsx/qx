/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */


const url = $request.url;

// 1. 提取原始 Hash
const getParam = (url, key) => {
    const reg = new RegExp("(^|&)" + key + "=([^&]*)(&|$)", "i");
    const r = url.split('?')[1] ? url.split('?')[1].match(reg) : null;
    return r ? unescape(r[2]) : null;
};
const originalHash = getParam(url, "hash");

if (!originalHash) $done({});

// 2. 【关键】注入你浏览器抓包的真实 Headers
// 这能让服务器认为请求来自你的浏览器，从而返回 pay_type: 0
const realHeaders = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Cookie": "kg_open_key=2f4c93717f679bc2b07688be6230c230; kg_dfid=4XRrr92RN5zm0Qu2Ex1AXAeZ; kg_mid=68b8f6bcee9fb76cb0052d9da3c37cf4",
    "Accept": "*/*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "zh-CN,zh-Hans;q=0.9",
    "Host": "m.kugou.com"
};

console.log(` [KG_Crack] 初始请求 Hash: ${originalHash}`);

// 3. 定义请求函数
const requestMusic = (targetHash) => {
    return new Promise((resolve, reject) => {
        const req = {
            url: `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${targetHash}`,
            headers: realHeaders // 使用真实身份
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
    
    // 情况A: 原 Hash 直接有地址
    if (data && data.url && data.url.length > 5) {
        console.log(" [KG_Crack] 原 Hash 解锁成功！");
        finish(data, originalHash);
    } 
    // 情况B: 原 Hash 没地址，尝试切换 MP3 Hash
    else if (data && data.extra && data.extra["128hash"]) {
        const mp3Hash = data.extra["128hash"];
        console.log(` [KG_Crack] 原 Hash 无链接 (PayType:${data.pay_type})，切换 MP3 Hash: ${mp3Hash}`);
        
        // 发起第二次请求 (换 MP3 Hash + 真实 Cookie)
        requestMusic(mp3Hash).then(data2 => {
            if (data2 && data2.url && data2.url.length > 5) {
                console.log(" [KG_Crack] 切换 MP3 Hash 解锁成功！");
                finish(data2, mp3Hash);
            } else {
                // 如果这里也是 url: ""，那就是真的彻底无解了
                console.log(` [KG_Crack] MP3 Hash 也为空 (PayType:${data2.pay_type})。此歌为服务器端硬锁。`);
                $done({}); 
            }
        }).catch(err => {
            console.log(" [KG_Crack] 重试请求失败");
            $done({});
        });
    } 
    else {
        console.log(` [KG_Crack] 无法获取信息 (PayType:${data.pay_type})`);
        $done({});
    }
}).catch(err => {
    console.log(" [KG_Crack] 请求异常");
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

