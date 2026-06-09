/**

[rewrite_local]
^https?:\/\/(?:gateway(?:retry|\d+)?|qgw)\.kugou\.com\/tracker\/v5(?:\/url)?(\?|$) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/kg/kugouv5.js


[mitm]
hostname = gateway.kugou.com, gatewayretry.kugou.com, gateway3.kugou.com, qgw.kugou.com, kg.zzxu.de, m.kugou.com, music-api.gdstudio.xyz, cache.api.joox.com, api.joox.com


 **/

const url = $request.url;
const headers = $request.headers;
const isResponseScript = typeof $response !== "undefined" && $response;
const responseBody = isResponseScript ? $response.body : "";
const OTTER_API = "https://music-api.gdstudio.xyz/api.php";
const JOOX_DIRECT_SOURCE = "joox_direct";
const OTTER_SOURCES = ["netease", "kuwo", JOOX_DIRECT_SOURCE, "joox"];
const DEFAULT_OTTER_BR = 192;
const META_PREFIX = "kg_otter_meta_";
const MATCH_PREFIX = "kg_otter_match_";
const JOOX_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    "Cookie": "wmid=142420656; user_type=1; country=id; session_key=2a5d97d05dc8fe238150184eaf3519ad;",
    "X-Forwarded-For": "36.73.34.109",
    "Referer": "https://www.joox.com/"
};
const JOOX_FUZZY_MUSIC_QUALITIES = [
    "master_tapeUrl", "master_tapeURL", "master_tape_url", "masterTapeUrl", "masterTapeURL", "rMasterTapeUrl", "rMasterTapeURL",
    "hiresUrl", "hiresURL", "hires_url", "hiResUrl", "hiResURL", "rHiresUrl", "rHiResUrl",
    "flacUrl", "flacURL", "flac_url", "rFlacUrl", "rflacUrl", "rFLACUrl", "apeUrl", "apeURL", "ape_url", "rApeUrl", "rapeUrl",
    "stereo_atmosUrl", "stereo_atmosURL", "stereo_atmos_url", "stereoAtmosUrl", "stereoAtmosURL", "atmosUrl", "atmosURL", "atmos_url", "rStereoAtmosUrl", "rAtmosUrl",
    "dolby448Url", "dolby448URL", "dolby448_url", "rDolby448Url", "rDolby448URL", "dolby256Url", "dolby256URL", "dolby256_url", "rDolby256Url", "rDolby256URL",
    "r320Url", "r320url", "r320_url", "320Url", "320URL", "320_url", "url320", "mp3320Url", "mp3_320_url", "highUrl", "high_url",
    "r320oggUrl", "r320OggUrl", "r320OggURL", "r320_ogg_url", "320oggUrl", "320OggUrl", "ogg320Url", "ogg_320_url",
    "r192oggUrl", "r192OggUrl", "r192OggURL", "r192_ogg_url", "192oggUrl", "192OggUrl", "ogg192Url", "ogg_192_url",
    "r192k_mnacUrl", "r192k_mnacURL", "r192k_mnac_url", "r192kMnacUrl", "r192kMnacURL", "192k_mnacUrl", "192kMnacUrl", "mnac192Url", "mnac_192_url", "r192mnacUrl",
    "r192Url", "r192url", "r192_url", "192Url", "192URL", "192_url", "url192", "m4a192Url", "aac192Url", "aac_192_url",
    "mp3Url", "r128Url", "r128url", "r128_url", "128Url", "128URL", "128_url", "url128", "m4a128Url", "aac128Url", "mp3128Url",
    "m4aUrl", "r96Url", "r96url", "r96_url", "96Url", "96URL", "96_url", "url96", "r48Url", "r48url", "r48_url", "48Url", "48URL", "48_url", "url48",
    "r24Url", "r24url", "r24_url", "24Url", "24URL", "24_url", "url24", "lowUrl", "low_url", "previewUrl", "preview_url", "refrainUrl", "refrainURL", "refrain_url",
    "chorusUrl", "chorus_url", "clipUrl", "clip_url", "snippetUrl", "snippet_url", "trialUrl", "trial_url"
];
// 原酷狗播放信息接口，已切换到 Otter/GD Studio 音源后保留备用：
// const KUGOU_PLAY_INFO_API = "https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=";

console.log("🧭 当前请求 URL：" + url);

function buildUrl(base, params) {
    return base + "?" + Object.keys(params)
        .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== "")
        .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key])))
        .join("&");
}

function getQueryParam(requestUrl, name) {
    const match = String(requestUrl || "").match(new RegExp("[?&]" + name + "=([^&]*)"));
    return match ? decodeURIComponent(match[1].replace(/\+/g, "%20")) : "";
}

function getOtterBrForQuality(quality) {
    const value = String(quality || "").toLowerCase();
    if (value === "128" || value === "standard" || value === "normal") return 128;
    if (value === "192" || value === "high" || value === "hq") return 192;
    if (value === "320" || value === "exhigh") return 320;
    if (value === "740" || value === "flac" || value === "sq" || value === "lossless") return 740;
    if (value === "999" || value === "viper" || value === "viper_clear" || value === "hires" || value === "super") return 999;
    return DEFAULT_OTTER_BR;
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

function fetchText(requestUrl, requestHeaders) {
    return $task.fetch({
        url: requestUrl,
        method: "GET",
        headers: requestHeaders || {}
    }).then(resp => {
        const statusCode = Number(resp.statusCode || resp.status || 200);
        if (statusCode >= 400) throw new Error("HTTP " + statusCode);
        return resp.body || "";
    });
}

function parseJsonp(text, callbackName) {
    let value = String(text || "").trim();
    const prefix = callbackName + "(";
    if (value.indexOf(prefix) === 0) value = value.slice(prefix.length, -1);
    return JSON.parse(value || "{}");
}

function normalizeJooxSearchItem(rawItem) {
    const item = Array.isArray(rawItem) ? rawItem[0] : rawItem;
    if (!item || !item.id) return null;
    const artists = (item.artist_list || [])
        .map(artist => artist && artist.name)
        .filter(Boolean);

    return {
        id: item.id,
        url_id: item.id,
        name: item.name || "",
        artist: artists,
        album: item.album_name || "",
        source: JOOX_DIRECT_SOURCE
    };
}

async function searchDirectJoox(keyword) {
    const searchUrl = buildUrl("https://cache.api.joox.com/openjoox/v2/search_type", {
        country: "hk",
        lang: "zh_TW",
        key: keyword,
        type: "0"
    });
    const searchResult = JSON.parse(await fetchText(searchUrl, JOOX_HEADERS));
    return (searchResult.tracks || []).map(normalizeJooxSearchItem).filter(Boolean);
}

function getJooxCandidateKeys(targetBr) {
    const highResKeys = JOOX_FUZZY_MUSIC_QUALITIES.filter(key => /master|hires|hires|flac|ape|atmos|dolby/i.test(key));
    const br320Keys = JOOX_FUZZY_MUSIC_QUALITIES.filter(key => /320|high/i.test(key));
    const br192Keys = JOOX_FUZZY_MUSIC_QUALITIES.filter(key => /192/i.test(key));
    const lowKeys = JOOX_FUZZY_MUSIC_QUALITIES.filter(key => !highResKeys.includes(key) && !br320Keys.includes(key) && !br192Keys.includes(key));

    if (Number(targetBr) >= 740) return highResKeys.concat(br320Keys, br192Keys, lowKeys);
    if (Number(targetBr) >= 320) return br320Keys.concat(br192Keys, lowKeys, highResKeys);
    if (Number(targetBr) >= 192) return br192Keys.concat(lowKeys, br320Keys, highResKeys);
    return lowKeys.concat(br192Keys, br320Keys, highResKeys);
}

function inferJooxBr(fieldName, targetBr) {
    const key = String(fieldName || "").toLowerCase();
    if (/master|hires|flac|ape|atmos|dolby/.test(key)) return 740;
    if (key.indexOf("320") >= 0 || key.indexOf("high") >= 0) return 320;
    if (key.indexOf("192") >= 0) return 192;
    if (key.indexOf("128") >= 0 || key.indexOf("mp3") >= 0) return 128;
    if (key.indexOf("96") >= 0 || key.indexOf("m4a") >= 0) return 96;
    return targetBr || DEFAULT_OTTER_BR;
}

async function fetchDirectJooxPlayInfo(match, targetBr) {
    if (!match || !match.id) return null;

    const infoUrl = buildUrl("https://api.joox.com/web-fcgi-bin/web_get_songinfo", {
        songid: match.id,
        lang: "zh_TW",
        country: "hk"
    });
    const songInfo = parseJsonp(await fetchText(infoUrl, JOOX_HEADERS), "MusicInfoCallback");
    const candidateKeys = getJooxCandidateKeys(targetBr);

    for (const key of candidateKeys) {
        const audioUrl = songInfo[key];
        if (!audioUrl || String(audioUrl).indexOf("http") !== 0) continue;

        return Object.assign({}, match, {
            url: String(audioUrl).replace(/&amp;/g, "&"),
            br: inferJooxBr(key, targetBr),
            requested_br: targetBr,
            size: songInfo.size || songInfo.fileSize || songInfo.file_size || 0,
            name: match.name || songInfo.msong || songInfo.songName || "",
            artist: match.artist || songInfo.msinger || songInfo.singerName || ""
        });
    }

    return null;
}

async function fetchOtterPlayInfo(match, targetBr) {
    if (!match || !match.source || !match.id) return null;

    const playUrl = buildUrl(OTTER_API, {
        types: "url",
        id: match.id,
        br: targetBr,
        source: match.source
    });
    const playInfo = await fetchJson(playUrl);
    const audioUrl = playInfo && (playInfo.url || (playInfo.data && playInfo.data.url));
    if (!audioUrl) return null;
    const normalizedAudioUrl = String(Array.isArray(audioUrl) ? audioUrl[0] : audioUrl).replace(/&amp;/g, "&");

    return Object.assign({}, match, {
        url: normalizedAudioUrl,
        br: playInfo.br || playInfo.bitrate || targetBr,
        requested_br: targetBr,
        size: playInfo.size || playInfo.filesize || playInfo.file_size || 0
    });
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

function readCachedMatch(hash, targetBr) {
    if (typeof $prefs === "undefined" || !$prefs.valueForKey) return null;

    try {
        const value = $prefs.valueForKey(MATCH_PREFIX + targetBr + "_" + String(hash).toLowerCase());
        const match = value ? JSON.parse(value) : null;
        return match && match.br === targetBr ? match : null;
    } catch (_) {
        return null;
    }
}

function saveCachedMatch(hash, targetBr, match) {
    if (typeof $prefs === "undefined" || !$prefs.setValueForKey || !match) return;

    try {
        $prefs.setValueForKey(JSON.stringify(match), MATCH_PREFIX + targetBr + "_" + String(hash).toLowerCase());
    } catch (_) {}
}

async function resolveOtterMusicUrl(hash, targetBr) {
    const target = readCachedTrackInfo(hash);

    if (!target || !target.name || target.artists.length === 0) {
        console.log("⚠️ 未找到 get_res_privilege/lite 缓存，无法自动换源。");
        return null;
    }

    const keyword = `${target.name} ${target.artists[0]}`;
    console.log(`🔎 Otter 自动匹配：${keyword}`);

    const cachedMatch = readCachedMatch(hash, targetBr);
    if (cachedMatch && cachedMatch.source && cachedMatch.id) {
        console.log(`♻️ 使用已缓存音源：${cachedMatch.source} ${targetBr}k`);
        const hydratedMatch = cachedMatch.source === JOOX_DIRECT_SOURCE
            ? await fetchDirectJooxPlayInfo(cachedMatch, targetBr)
            : await fetchOtterPlayInfo(cachedMatch, targetBr);
        if (hydratedMatch) return hydratedMatch;
        console.log("⚠️ 缓存音源 URL 失效，重新搜索。");
    }

    for (const source of OTTER_SOURCES) {
        try {
            let list;
            if (source === JOOX_DIRECT_SOURCE) {
                list = await searchDirectJoox(keyword);
            } else {
                const searchUrl = buildUrl(OTTER_API, {
                    types: "search",
                    name: keyword,
                    count: 5,
                    pages: 1,
                    source
                });
                list = await fetchJson(searchUrl);
            }
            if (!Array.isArray(list) || list.length === 0) continue;

            const match = list
                .map((item, index) => ({ item, score: scoreCandidate(target.name, target.artists, item, index) }))
                .filter(pair => pair.score >= 120 && pair.item && (pair.item.id || pair.item.url_id))
                .sort((a, b) => b.score - a.score)[0];

            if (!match) continue;
            const trackId = match.item.id || match.item.url_id;

            const matchInfo = {
                source,
                id: trackId,
                br: targetBr,
                name: match.item.name,
                artist: Array.isArray(match.item.artist) ? match.item.artist.join("/") : match.item.artist
            };
            const hydratedMatch = source === JOOX_DIRECT_SOURCE
                ? await fetchDirectJooxPlayInfo(matchInfo, targetBr)
                : await fetchOtterPlayInfo(matchInfo, targetBr);
            if (hydratedMatch && hydratedMatch.url) {
                console.log(`✅ 已切换到 ${source} ${targetBr}k 音源：${match.item.name}`);
                saveCachedMatch(hash, targetBr, matchInfo);
                return hydratedMatch;
            }
        } catch (e) {
            console.log(`⚠️ ${source} 音源匹配失败：${e.message || e}`);
        }
    }

    return null;
}

function inferAudioFormat(audioUrl) {
    const pathname = String(audioUrl || "").split("?")[0].toLowerCase();
    if (pathname.endsWith(".flac")) return "flac";
    if (pathname.endsWith(".m4a")) return "m4a";
    if (pathname.endsWith(".ogg")) return "ogg";
    return "mp3";
}

function extractAudioHash(audioUrl, fallbackHash) {
    const pathname = String(audioUrl || "").split("?")[0].toLowerCase();
    const match = pathname.match(/\/([0-9a-f]{32})\.(?:mp3|m4a|flac|ogg)$/);
    return String(match ? match[1] : fallbackHash).toUpperCase();
}

function normalizeFileSize(size) {
    const value = Number(size) || 0;
    if (!value) return 0;
    return value < 1024 * 1024 ? Math.round(value * 1024) : Math.round(value);
}

function buildTrackerResponse(hash, match) {
    const audioUrl = Array.isArray(match.url) ? match.url[0] : match.url;
    const bitRate = Number(match.br) || DEFAULT_OTTER_BR;
    const fileSize = normalizeFileSize(match.size);
    const fmt = inferAudioFormat(audioUrl);
    const audioHash = extractAudioHash(audioUrl, hash);

    return {
        status: 1,
        error: "",
        error_code: 0,
        errcode: 0,
        hash: audioHash,
        kg_hash: hash,
        url: [audioUrl],
        play_url: [audioUrl],
        backup_url: [audioUrl],
        primaryUrl: audioUrl,
        urls: [audioUrl],
        status_code: 1,
        fmt: fmt,
        extName: fmt,
        bitrate: bitRate,
        bitRate: bitRate,
        fileSize: fileSize,
        file_size: fileSize,
        filesize: fileSize,
        size: fileSize,
        data: {
            url: [audioUrl],
            backup_url: [audioUrl],
            status: 1,
            hash: audioHash,
            kg_hash: hash,
            fmt: fmt,
            extName: fmt,
            bitrate: bitRate,
            bitRate: bitRate,
            fileSize: fileSize,
            file_size: fileSize,
            filesize: fileSize,
            size: fileSize,
            primaryUrl: audioUrl,
            urls: [audioUrl],
            audio_name: match.name || "",
            author_name: match.artist || "",
            kg_otter_source: match.source || ""
        }
    };
}

function buildJsonHeaders() {
    const jsonHeaders = Object.assign({}, isResponseScript && $response.headers || {});
    Object.keys(jsonHeaders).forEach(key => {
        const lower = key.toLowerCase();
        if (lower === "content-encoding" || lower === "content-length" || lower === "transfer-encoding") {
            delete jsonHeaders[key];
        }
    });
    jsonHeaders["Content-Type"] = "application/json; charset=utf-8";
    return jsonHeaders;
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

// 处理 /v5/url、/tracker/v5/url 和 /tracker/v5 响应替换
if (url.includes("/v5/url?") || url.includes("/tracker/v5/url?") || url.includes("/tracker/v5?")) {
    if (!isResponseScript) {
        console.log("⚠️ 当前规则仍是 request-header，无法注入下载响应，请改为 script-response-body。");
        $done({});
        return;
    }

    const hashMatch = url.match(/hash=([0-9a-fA-F]{32})/);
    const hash = hashMatch ? hashMatch[1] : '';
    const quality = getQueryParam(url, "quality");
    const targetBr = getOtterBrForQuality(quality);

    console.log("🔍 检测 hash 参数：" + (hash || "未找到"));
    console.log("🎚️ 请求音质：" + (quality || "默认") + " -> GD br=" + targetBr);

    if (hash) {
        resolveOtterMusicUrl(hash, targetBr).then(match => {
            if (!match || !match.url) {
                console.log("⚠️ Otter 未找到可用音源，保留原响应。");
                $done({ body: responseBody });
                return;
            }

            const newBody = JSON.stringify(buildTrackerResponse(hash, match));
            console.log("✅ Tracker 响应已替换为 Otter/GD 音源。");
            console.log("🎯 音频 URL：" + match.url);

            $done({
                status: "HTTP/1.1 200 OK",
                headers: buildJsonHeaders(),
                body: newBody
            });
        }).catch(e => {
            console.log("⚠️ Otter 自动换源异常：" + (e.message || e));
            $done({ body: responseBody });
        });
    } else {
        console.log("❌ 未检测到合法 hash，跳过重写。");
        $done({ body: responseBody });
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
