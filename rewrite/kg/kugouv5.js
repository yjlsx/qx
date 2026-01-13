/**

[rewrite_local]
^https?:\/\/gateway\.kugou\.com\/tracker\/v5\/url(\?|$) url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kugouv5.js


[mitm]
hostname = gateway.kugou.com, kg.zzxu.de


 */


// ===============================================
// 酷狗音乐 - 播放链接解密 v7.0 (三通道终极版)
// 逻辑：手机Web -> PC Web -> 上古Tracker -> 失败
// ===============================================

const url = $request.url;
const body = $response.body;

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

console.log(`🔍 [KG_Crack] 正在挖掘 Hash: ${hash}`);

// -----------------------------------------------
// 通道 A: m.kugou.com (模拟 Android)
// -----------------------------------------------
const tryChannelA = () => {
   return new Promise((resolve, reject) => {
       const req = {
           url: `https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`,
           headers: {
               "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36",
               "Cookie": "kg_mid=2333"
           }
       };
       $task.fetch(req).then(res => {
           try {
               let data = JSON.parse(res.body);
               if (data && data.url && data.url.length > 5) resolve(data);
               else reject("通道A无链接");
           } catch (e) { reject("通道A错误"); }
       }, err => reject("通道A超时"));
   });
};

// -----------------------------------------------
// 通道 B: www.kugou.com (PC 接口)
// -----------------------------------------------
const tryChannelB = () => {
   return new Promise((resolve, reject) => {
       const req = {
           url: `https://www.kugou.com/yy/index.php?r=play/getdata&hash=${hash}&album_id=${album_id}`,
           headers: { "Cookie": "kg_mid=2333" }
       };
       $task.fetch(req).then(res => {
           try {
               let data = JSON.parse(res.body);
               if (data && data.data && data.data.play_url) {
                   resolve({
                       url: data.data.play_url,
                       fileSize: data.data.filesize,
                       timeLength: data.data.timelength / 1000,
                       bitRate: data.data.bitrate * 1000,
                       fileName: data.data.audio_name
                   });
               } else {
                   reject("通道B拒绝(Code:" + data.err_code + ")");
               }
           } catch (e) { reject("通道B错误"); }
       }, err => reject("通道B超时"));
   });
};

// -----------------------------------------------
// 通道 C: trackercdn (上古接口 - 最后的稻草)
// -----------------------------------------------
const tryChannelC = () => {
   return new Promise((resolve, reject) => {
       // 使用 key=0 的免签模式尝试
       const req = {
           url: `http://trackercdn.kugou.com/i/v2/?appid=1005&pid=2&cmd=25&behavior=play&hash=${hash}&key=0`,
           headers: { "User-Agent": "KG_Mobile" }
       };
       $task.fetch(req).then(res => {
           try {
               let data = JSON.parse(res.body);
               if (data && data.url && data.url[0]) {
                   resolve({
                       url: data.url[0],
                       fileSize: data.file_size,
                       timeLength: data.time_length,
                       bitRate: data.bitrate,
                       fileName: "已解锁歌曲"
                   });
               } else {
                   reject("通道C失败");
               }
           } catch (e) { reject("通道C错误"); }
       }, err => reject("通道C超时"));
   });
};

// -----------------------------------------------
// 主逻辑
// -----------------------------------------------
tryChannelA()
   .then(data => success(data, "A"))
   .catch(errA => {
       console.log(`⚠️ ${errA} -> 尝试通道B`);
       tryChannelB()
           .then(data => success(data, "B"))
           .catch(errB => {
               console.log(`⚠️ ${errB} -> 尝试通道C`);
               tryChannelC()
                   .then(data => success(data, "C"))
                   .catch(errC => {
                       console.log(`❌ [KG_Crack] 全线崩溃。此歌为服务器端硬锁资源。`);
                       // 失败时直接返回原始数据，让App显示"购买"而不是报错闪退
                       $done({});
                   });
           });
   });

function success(data, channel) {
   console.log(`✅ [KG_Crack] 通道${channel} 立功！获取地址成功`);
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

