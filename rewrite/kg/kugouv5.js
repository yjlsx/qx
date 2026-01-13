/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */


/*
[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js

[mitm]
hostname = gateway.kugou.com
*/

const url = $request.url;
// 1. 获取原请求的 Hash 和 AlbumID
const getParam = (url, key) => {
    const reg = new RegExp("(^|&)" + key + "=([^&]*)(&|$)", "i");
    const r = url.split('?')[1] ? url.split('?')[1].match(reg) : null;
    return r ? unescape(r[2]) : null;
};

const hash = getParam(url, "hash");
const album_id = getParam(url, "album_id") || "";

// 2. 如果没有 Hash，直接放行原请求，不做处理
if (!hash) {
    $done({});
}

// 3. 构造那个能查到地址的新接口 (m.kugou.com)
const crackUrl = `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`;

const myRequest = {
    url: crackUrl,
    method: "GET",
    headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
        "Cookie": "kg_mid=6666" // 模拟简单的 Cookie
    }
};

console.log(` [KG_Crack] 正在后台请求 m.kugou.com 获取 Hash: ${hash}`);

// 4. 发起后台请求 ($task.fetch)
$task.fetch(myRequest).then(response => {
    try {
        // 解析 m.kugou.com 返回的数据
        const crackData = JSON.parse(response.body);
        
        // 5. 检查是否拿到了 url
        // 注意：m.kugou.com 返回的结构里，url 是一串字符
        if (crackData && crackData.url && crackData.url !== "") {
            console.log(" [KG_Crack] 成功获取播放地址: " + crackData.url);

            // 6. 【最关键的一步】伪造 App 能看懂的响应体 (Translate)
            // 把 m.kugou.com 的数据，塞进 tracker/v5 的模具里
            const fakeBody = {
                "status": 1,
                "error_code": 0,
                "data": { // 有些版本需要包一层 data，有些不需要，为了兼容可以直接铺开
                    "hash": hash,
                    "timelength": crackData.timeLength * 1000,
                    "filesize": crackData.fileSize,
                    "audio_name": crackData.fileName,
                    "author_name": crackData.singerName,
                    "url": [ crackData.url ], //  App 要求 url 必须是数组！
                    "img": crackData.album_img, 
                    "vip_type": 6,
                    "bitrate": 128000
                },
                // 为了兼容旧版结构，外层也放一份
                "url": [ crackData.url ], 
                "hash": hash,
                "vip_type": 6
            };
            
            // 返回伪造的 Body
            $done({ body: JSON.stringify(fakeBody) });
        } else {
            console.log(" [KG_Crack] m.kugou.com 返回的 URL 为空 (该歌曲可能服务器端硬性下架或无权)");
            // 如果新接口也没数据，就按原路返回(可能会显示需付费)，或者返回空
            $done({}); 
        }
    } catch (e) {
        console.log(" [KG_Crack] 解析失败: " + e);
        $done({});
    }
}, reason => {
    console.log(" [KG_Crack] 网络请求失败");
    $done({});
});
