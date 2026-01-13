/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */


// ===============================================
// 酷狗音乐 - 播放链接解密 v9.0 (智能换Hash版)
// 核心逻辑：
// 1. 使用真实 Cookie 骗取 pay_type:0
// 2. 若 URL 为空，自动提取 extra 中的 128hash (MP3) 重试
// ===============================================

const url = $request.url;

// 1. 提取 Hash
const getParam = (url, key) => {
    const reg = new RegExp("(^|&)" + key + "=([^&]*)(&|$)", "i");
    const r = url.split('?')[1] ? url.split('?')[1].match(reg) : null;
    return r ? unescape(r[2]) : null;
};
const originalHash = getParam(url, "hash");

if (!originalHash) $done({});

// 2. 生成随机 ID 模拟真实设备 (关键！解决 pay_type:3 问题)
const randomHex = (len) => {
    let output = '';
    for (let i = 0; i < len; ++i) output += (Math.floor(Math.random() * 16)).toString(16);
    return output;
}
const fakeMid = randomHex(32);
const fakeDfid = randomHex(24);
// 模拟你浏览器里成功的 Cookie
const realCookie = `kg_mid=${fakeMid}; kg_dfid=${fakeDfid}; kg_open_key=2f4c93717f679bc2b07688be6230c230`;

console.log(` [KG_Crack] 初始请求 Hash: ${originalHash}`);

// 3. 定义请求函数
const requestMusic = (targetHash) => {
    return new Promise((resolve, reject) => {
        const req = {
            url: `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${targetHash}`,
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
                "Cookie": realCookie,
                "Accept": "*/*",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            }
        };
        $task.fetch(req).then(res => {
            try {
                let data = JSON.parse(res.body);
                resolve(data);
            } catch (e) { reject("JSON解析失败"); }
        }, err => reject("网络错误"));
    });
};

// 4. 执行逻辑：先试原 Hash -> 失败则试 MP3 Hash
requestMusic(originalHash).then(data => {
    
    // 情况A: 直接拿到了 URL
    if (data && data.url && data.url.length > 5) {
        console.log(" [KG_Crack] 原 Hash 解锁成功！");
        finish(data, originalHash);
    } 
    // 情况B: URL 为空，但提供了 extra 信息 (说明可能是 Hash 不对)
    else if (data && data.extra && data.extra["128hash"]) {
        const mp3Hash = data.extra["128hash"];
        console.log(` [KG_Crack] 原 Hash 无链接，尝试切换 MP3 Hash: ${mp3Hash}`);
        
        // 发起第二次请求 (换 MP3 Hash)
        requestMusic(mp3Hash).then(data2 => {
            if (data2 && data2.url && data2.url.length > 5) {
                console.log(" [KG_Crack] 切换 MP3 Hash 解锁成功！");
                finish(data2, mp3Hash);
            } else {
                console.log(" [KG_Crack] MP3 Hash 也无链接，放弃。");
                $done({}); // 彻底没救了
            }
        }).catch(err => {
            console.log(" [KG_Crack] 重试请求失败");
            $done({});
        });
    } 
    // 情况C: 彻底失败
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
