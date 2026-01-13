/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */


// ===============================================
// 酷狗音乐 - 播放链接解密 v6.0 (双通道救援版)
// 逻辑：优先尝试 m.kugou.com，失败则自动切换 www.kugou.com
// ===============================================

const url = $request.url;
const method = $request.method;

// 1. 提取 Hash
const getParam = (url, key) => {
    const reg = new RegExp("(^|&)" + key + "=([^&]*)(&|$)", "i");
    const r = url.split('?')[1] ? url.split('?')[1].match(reg) : null;
    return r ? unescape(r[2]) : null;
};

const hash = getParam(url, "hash");
const album_id = getParam(url, "album_id") || "";

// 无 Hash 则放行
if (!hash) $done({});

console.log(` [KG_Crack] 开始尝试解锁 Hash: ${hash}`);

// -----------------------------------------------
// 通道 A: m.kugou.com (手机网页版接口)
// -----------------------------------------------
const tryChannelA = () => {
    return new Promise((resolve, reject) => {
        const req = {
            url: `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`,
            headers: { "Cookie": "kg_mid=8888" }
        };
        $task.fetch(req).then(res => {
            try {
                let data = JSON.parse(res.body);
                if (data && data.url && data.url.length > 5) {
                    resolve(data); // 成功拿到
                } else {
                    reject("通道A无链接: " + (data.error || "未知错误"));
                }
            } catch (e) { reject("通道A解析失败"); }
        }, err => reject("通道A网络错误"));
    });
};

// -----------------------------------------------
// 通道 B: www.kugou.com (PC网页版接口 - 备用)
// -----------------------------------------------
const tryChannelB = () => {
    return new Promise((resolve, reject) => {
        const req = {
            url: `https://www.kugou.com/yy/index.php?r=play/getdata&hash=${hash}&album_id=${album_id}`,
            headers: { 
                "Cookie": "kg_mid=8888",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36"
            }
        };
        $task.fetch(req).then(res => {
            try {
                let data = JSON.parse(res.body);
                // PC版返回结构不同，url在 data.play_url
                if (data && data.data && data.data.play_url) {
                    // 格式化为标准结构以便统一处理
                    resolve({
                        url: data.data.play_url,
                        fileSize: data.data.filesize,
                        timeLength: data.data.timelength / 1000, // PC版可能是毫秒
                        bitRate: data.data.bitrate * 1000,
                        fileName: data.data.audio_name,
                        singerName: data.data.author_name
                    });
                } else {
                    reject("通道B也无链接");
                }
            } catch (e) { reject("通道B解析失败"); }
        }, err => reject("通道B网络错误"));
    });
};

// -----------------------------------------------
// 主逻辑：串行尝试
// -----------------------------------------------
tryChannelA()
    .then(data => {
        console.log(" [KG_Crack] 通道A 解锁成功！");
        finish(data);
    })
    .catch(errA => {
        console.log(` [KG_Crack] ${errA}，正在尝试通道B...`);
        tryChannelB()
            .then(data => {
                console.log(" [KG_Crack] 通道B 解锁成功！");
                finish(data);
            })
            .catch(errB => {
                console.log(` [KG_Crack] 全部通道失败，歌曲可能为严控付费资源。`);
                $done({}); // 彻底失败，返回原数据
            });
    });

// -----------------------------------------------
// 格式封装并返回
// -----------------------------------------------
function finish(data) {
    const fakeBody = {
        "status": 1,
        "error_code": 0,
        "url": [ data.url ],
        "hash": hash,
        "new_hash": hash,
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
