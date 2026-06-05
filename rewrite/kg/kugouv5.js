/**

[rewrite_local]
^https?:\/\/(?:gateway(?:retry|\d+)?|qgw)\.kugou\.com\/tracker\/v5(?:\/url)?(\?|$) url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kg/kugouv5.js


[mitm]
hostname = gateway.kugou.com, gatewayretry.kugou.com, gateway3.kugou.com, qgw.kugou.com, kg.zzxu.de, m.kugou.com, music-api.gdstudio.xyz


 **/

const url = $request.url;
const headers = $request.headers;
const OTTER_API = "https://music-api.gdstudio.xyz/api.php";
const OTTER_SOURCES = ["joox", "netease", "kuwo"];
const OTTER_BR = 320;
const META_PREFIX = "kg_otter_meta_";
const MATCH_PREFIX = "kg_otter_match_";
// 原酷狗播放信息接口，已切换到 Otter/GD Studio 音源后保留备用：
// const KUGOU_PLAY_INFO_API = "https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=";

console.log("🧭 当前请求 URL：" + url);

function buildUrl(base, params) {
    return base + "?" + Object.keys(params)
        .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== "")
        .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key])))
        .join("&");
}

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFKC")
        .replace(/[([{【（].*?[)\]}】）]/g, " ")
        .replace(/[^\w\u4e00-\u9fa5]/g, "")
        .trim();
}

function splitArtists(value) {
    if (Array.isArray(value)) return value;
    return String(value || "")
        .split(/[、,，/&]| feat\.?| ft\.?/i)
        .map(item => item.trim())
        .filter(Boolean);
}

function isNameMatch(left, right) {
    const a = normalizeText(left);
    const b = normalizeText(right);
    return a && b && (a === b || a.includes(b) || b.includes(a));
}

function isArtistMatch(left, right) {
    const leftSet = splitArtists(left).map(normalizeText).filter(Boolean);
    const rightSet = splitArtists(right).map(normalizeText).filter(Boolean);
    return leftSet.some(a => rightSet.some(b => a === b || a.includes(b) || b.includes(a)));
}

function scoreCandidate(songName, artists, item, index) {
    let score = Math.max(0, 20 - index);
    if (normalizeText(songName) === normalizeText(item.name)) score += 100;
    else if (isNameMatch(songName, item.name)) score += 50;
    if (isArtistMatch(artists, item.artist)) score += 100;
    return score;
}

function fetchJson(requestUrl) {
    return $task.fetch({
        url: requestUrl,
        method: "GET",
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    }).then(resp => JSON.parse(resp.body || "{}"));
}

function readCachedTrackInfo(hash) {
    if (typeof $prefs === "undefined" || !$prefs.valueForKey) return null;

    try {
        const value = $prefs.valueForKey(META_PREFIX + String(hash).toLowerCase());
        if (!value) return null;
        const info = JSON.parse(value);
        return {
            name: info.songName || info.name || "",
            artists: splitArtists(info.singername || info.artist || ""),
            album: info.albumname || "",
            quality: info.quality || ""
        };
    } catch (e) {
        console.log("⚠️ 读取酷狗歌曲缓存失败：" + (e.message || e));
        return null;
    }
}

function readCachedMatch(hash) {
    if (typeof $prefs === "undefined" || !$prefs.valueForKey) return null;

    try {
        const value = $prefs.valueForKey(MATCH_PREFIX + String(hash).toLowerCase());
        return value ? JSON.parse(value) : null;
    } catch (_) {
        return null;
    }
}

function saveCachedMatch(hash, match) {
    if (typeof $prefs === "undefined" || !$prefs.setValueForKey || !match) return;

    try {
        $prefs.setValueForKey(JSON.stringify(match), MATCH_PREFIX + String(hash).toLowerCase());
    } catch (_) {}
}

async function resolveOtterMusicUrl(hash) {
    const target = readCachedTrackInfo(hash);

    if (!target.name || target.artists.length === 0) {
        console.log("⚠️ 未找到 get_res_privilege/lite 缓存，无法自动换源。");
        return null;
    }

    const keyword = `${target.name} ${target.artists[0]}`;
    console.log(`🔎 Otter 自动匹配：${keyword}`);

    const cachedMatch = readCachedMatch(hash);
    if (cachedMatch && cachedMatch.source && cachedMatch.id) {
        console.log(`♻️ 使用已缓存音源：${cachedMatch.source}`);
        return cachedMatch;
    }

    for (const source of OTTER_SOURCES) {
        try {
            const searchUrl = buildUrl(OTTER_API, {
                types: "search",
                name: keyword,
                count: 5,
                pages: 1,
                source
            });
            const list = await fetchJson(searchUrl);
            if (!Array.isArray(list) || list.length === 0) continue;

            const match = list
                .map((item, index) => ({ item, score: scoreCandidate(target.name, target.artists, item, index) }))
                .filter(pair => pair.score >= 120 && pair.item && (pair.item.id || pair.item.url_id))
                .sort((a, b) => b.score - a.score)[0];

            if (!match) continue;
            const trackId = match.item.id || match.item.url_id;

            const playUrl = buildUrl(OTTER_API, {
                types: "url",
                id: trackId,
                br: OTTER_BR,
                source
            });
            const playInfo = await fetchJson(playUrl);
            if (playInfo && playInfo.url) {
                console.log(`✅ 已切换到 ${source} 音源：${match.item.name}`);
                const matchInfo = {
                    source,
                    id: trackId,
                    name: match.item.name,
                    artist: Array.isArray(match.item.artist) ? match.item.artist.join("/") : match.item.artist
                };
                saveCachedMatch(hash, matchInfo);
                return matchInfo;
            }
        } catch (e) {
            console.log(`⚠️ ${source} 音源匹配失败：${e.message || e}`);
        }
    }

    return null;
}

// 原酷狗回退逻辑，当前注释保留：
// function rewriteToKugou(hash) {
//     const newUrl = KUGOU_PLAY_INFO_API + hash;
//     headers["x-router"] = "m.kugou.com";
//     $done({
//         url: newUrl,
//         headers: headers
//     });
// }

// 处理 /v5/url、/tracker/v5/url 和 /tracker/v5 请求重写
if (url.includes("/v5/url?") || url.includes("/tracker/v5/url?") || url.includes("/tracker/v5?")) {
    const hashMatch = url.match(/hash=([0-9a-fA-F]{32})/);
    const hash = hashMatch ? hashMatch[1] : '';

    console.log("🔍 检测 hash 参数：" + (hash || "未找到"));

    if (hash) {
        resolveOtterMusicUrl(hash).then(match => {
            if (!match) {
                console.log("⚠️ Otter 未找到可用音源，跳过重写。");
                $done({});
                return;
            }

            const newUrl = buildUrl(OTTER_API, {
                kg_otter: 1,
                kg_hash: hash,
                kg_source: match.source,
                kg_name: match.name,
                kg_artist: match.artist,
                types: "url",
                id: match.id,
                br: OTTER_BR,
                source: match.source
            });

            delete headers["x-router"];
            delete headers["X-Router"];
            delete headers["Host"];
            delete headers["host"];
            console.log("✅ 请求重写到 Otter 聚合音源。");
            console.log("🎯 新 URL：" + newUrl);

            $done({
                url: newUrl,
                headers: headers
            });
        }).catch(e => {
            console.log("⚠️ Otter 自动换源异常：" + (e.message || e));
            $done({});
        });
    } else {
        console.log("❌ 未检测到合法 hash，跳过重写。");
        $done({});
    }
    return;
}

// 处理 /vipcenter/ios 请求头修改
if (url.includes("/vipcenter/ios")) {
  const 截取长度 = 112; // 你给的浏览器抓包的 user_label 长度
  let match = url.match(/user_label=([^&]*)/);
  if (match) {
    let userLabelEncoded = match[1];
    if (userLabelEncoded.length > 截取长度) {
      let newUserLabelEncoded = userLabelEncoded.substring(0, 截取长度);
      let newUrl = url.replace(/user_label=[^&]*/, `user_label=${newUserLabelEncoded}`);
      
      console.log("重写后 user_label 长度: " + newUserLabelEncoded.length);
      console.log("重写新 URL: " + newUrl);
      
      $done({
        url: newUrl,
        headers: headers,
        body: $request.body
      });
      return;
    }
  }
}

// 未命中重写逻辑
console.log("ℹ️ 非目标请求，无需处理");
$done({});
