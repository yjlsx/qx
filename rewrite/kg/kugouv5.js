/**

[rewrite_local]
^https?:\/\/(?:gateway(?:retry|\d+)?|qgw)\.kugou\.com\/tracker\/v5(?:\/url)?(\?|$) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/main/rewrite/kg/kugouv5.js


[mitm]
hostname = gateway.kugou.com, gatewayretry.kugou.com, gateway3.kugou.com, qgw.kugou.com, kg.zzxu.de, m.kugou.com, music-api.gdstudio.xyz, cache.api.joox.com, api.joox.com, u.y.qq.com


 **/

const url = $request.url;
const headers = $request.headers;
const isResponseScript = typeof $response !== "undefined" && $response;
const responseBody = isResponseScript ? $response.body : "";
const OTTER_API = "https://music-api.gdstudio.xyz/api.php";
const JOOX_DIRECT_SOURCE = "joox_direct";
const QQ_DIRECT_SOURCE = "qq_direct";
const OTTER_SOURCES = ["netease", "kuwo", QQ_DIRECT_SOURCE, JOOX_DIRECT_SOURCE, "joox"];
const DEFAULT_OTTER_BR = 192;
const OTTER_BR_LEVELS = [999, 740, 320, 192, 128];
const META_PREFIX = "kg_otter_meta_";
const MATCH_PREFIX = "kg_otter_match_v6_";
const PREFER_ORIGINAL_WHEN_GOOD_ENOUGH = true;
const STRICT_SCORE_BASE = 200;
const LOOSE_SCORE_BASE = 100;
// 宽松匹配默认关闭，宁可不换源也不匹错
const ENABLE_LOOSE_MATCH = false;
// 搜索并发执行，单次请求与元数据探测共用此总预算，留出重写返回余量。
const TIME_BUDGET_MS = 4000;
const RETURN_MARGIN_MS = 100;
const CACHE_BUDGET_MS = 1000;
const QQ_API_URL = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const QQ_REFERER = "https://y.qq.com/";
const QQ_HEADERS = {
    "Content-Type": "application/json",
    "Referer": QQ_REFERER,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
    "Cookie": "uin="
};
const QQ_AUDIO_HEADERS = {
    "User-Agent": "IPhone-20709-KGTweLisRecHome-Range-ActD-wifi"
};
const GENERIC_AUDIO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};
const QQ_FILE_CONFIG = [
    { key: "320k", br: 320, prefix: "M800", ext: ".mp3" },
    { key: "128k", br: 128, prefix: "M500", ext: ".mp3" },
    { key: "m4a", br: 128, prefix: "C400", ext: ".m4a" }
];
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
// 试听/副歌片段，不是整首歌
const JOOX_SNIPPET_PATTERN = /preview|refrain|chorus|clip|snippet|trial/i;
const JOOX_MUSIC_QUALITIES = JOOX_FUZZY_MUSIC_QUALITIES.filter(key => !JOOX_SNIPPET_PATTERN.test(key));

console.log("🧭 当前请求路径：" + String(url).split(/[?#]/)[0]);

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

function isDeadlineExceeded(deadline) {
    return !!deadline && Date.now() >= deadline;
}

function requestFailure(code) {
    const error = new Error(code);
    error.requestCode = code;
    return error;
}

function isTimeout(error) {
    return error && (error.requestCode === "TIMEOUT" || error.requestCode === "DEADLINE");
}

function sourceLog(budget, message) {
    if (!budget.state.done) console.log(message);
}

// Settle the wrapper on timeout; QX fetch itself may still finish later.
function budgetFetch(options, budget) {
    if (budget.state.done) return Promise.reject(requestFailure("CANCELLED"));
    const remaining = budget.deadline - Date.now();
    if (remaining <= 0) return Promise.reject(requestFailure("DEADLINE"));
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (error, response) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            budget.state.pending.delete(cancel);
            if (error) reject(error);
            else resolve(response);
        };
        const cancel = () => finish(requestFailure("CANCELLED"));
        const timer = setTimeout(() => finish(requestFailure("TIMEOUT")), remaining);
        budget.state.pending.add(cancel);
        Promise.resolve().then(() => {
            if (settled || budget.state.done) throw requestFailure("CANCELLED");
            return $task.fetch(options);
        }).then(response => {
            if (isDeadlineExceeded(budget.deadline)) finish(requestFailure("DEADLINE"));
            else finish(null, response);
        }, () => finish(requestFailure("NETWORK")));
    });
}

function stopRequests(budget) {
    budget.state.done = true;
    Array.from(budget.state.pending).forEach(cancel => cancel());
}

function firstUsable(promises) {
    return new Promise(resolve => {
        let remaining = promises.length;
        if (!remaining) resolve(null);
        promises.forEach(promise => promise.then(result => {
            if (result) resolve(result);
            if (--remaining === 0) resolve(null);
        }, () => {
            if (--remaining === 0) resolve(null);
        }));
    });
}

function getOtterBrForQuality(quality) {
    const value = String(quality || "").toLowerCase();
    if (value === "128" || value === "standard" || value === "normal") return 128;
    if (value === "192" || value === "high" || value === "hq") return 192;
    if (value === "320" || value === "exhigh") return 320;
    if (value === "740" || value === "flac" || value === "sq" || value === "lossless") return 740;
    if (value === "999" || value === "viper" || value === "viper_clear" || value === "hires" || value === "super") return 999;
    return 0;
}

// 只降不升；targetBr=0（quality 无法识别）时保留全档位
function getFallbackBrList(targetBr) {
    const requestedBr = Number(targetBr) || 0;
    if (requestedBr <= 0) return OTTER_BR_LEVELS.slice();

    const list = [requestedBr];
    OTTER_BR_LEVELS.forEach(br => {
        if (br < requestedBr) list.push(br);
    });
    return list;
}

function isUsablePlayInfo(match) {
    const audioUrl = match && match.url;
    const firstUrl = Array.isArray(audioUrl) ? audioUrl[0] : audioUrl;
    return !!firstUrl && Number(match.br) !== -1;
}

function formatMatchTitle(item) {
    if (!item) return "未知歌曲";
    const name = item.name || item.songName || item.title || "未知歌曲";
    const artist = Array.isArray(item.artist) ? item.artist.join("/") : (item.artist || item.singername || item.author_name || "");
    return artist ? `${name} - ${artist}` : name;
}

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFKC")
        .replace(/[([{【（].*?[)\]}】）]/g, " ")
        .replace(/[^\w一-龥]/g, "")
        .trim();
}

function normalizeStrictText(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFKC")
        .replace(/[^\w一-龥]/g, "")
        .trim();
}

function splitArtists(value) {
    if (Array.isArray(value)) return value;
    return String(value || "")
        .split(/[、,，/&]| feat\.?| ft\.?/i)
        .map(item => item.trim())
        .filter(Boolean);
}

function uniqueNormalizedArtists(value) {
    return Array.from(new Set(splitArtists(value).map(normalizeStrictText).filter(Boolean))).sort();
}

function isStrictNameMatch(left, right) {
    const a = normalizeStrictText(left);
    const b = normalizeStrictText(right);
    return a && b && a === b;
}

function isStrictArtistMatch(left, right) {
    const leftSet = uniqueNormalizedArtists(left);
    const rightSet = uniqueNormalizedArtists(right);
    return leftSet.length > 0
        && leftSet.length === rightSet.length
        && leftSet.every((artist, index) => artist === rightSet[index]);
}

function hasCoverMarker(item) {
    const text = [
        item && item.name,
        item && item.artist,
        item && item.album
    ].flat().join(" ").toLowerCase().normalize("NFKC");

    return /翻唱|翻自|翻奏|cover|covered\s+by|cover\s+by|原唱[:：]|致敬|remake/i.test(text);
}

function isStrictCandidateMatch(songName, artists, item) {
    return item
        && !hasCoverMarker(item)
        && isStrictNameMatch(songName, item.name)
        && isStrictArtistMatch(artists, item.artist);
}

function isNameMatch(left, right) {
    const a = normalizeText(left);
    const b = normalizeText(right);
    return a && b && a === b;
}

function normalizedArtistSet(value) {
    return Array.from(new Set(splitArtists(value).map(normalizeText).filter(Boolean))).sort();
}

function isArtistMatch(left, right) {
    const leftSet = normalizedArtistSet(left);
    const rightSet = normalizedArtistSet(right);
    return leftSet.length > 0
        && leftSet.length === rightSet.length
        && leftSet.every((artist, index) => artist === rightSet[index]);
}

// 宽松轮：歌手有交集即可。子串包含要求 3 字以上，避免两字艺名互撞
function hasArtistOverlap(left, right) {
    const leftSet = uniqueNormalizedArtists(left);
    const rightSet = uniqueNormalizedArtists(right);
    if (!leftSet.length || !rightSet.length) return false;
    return leftSet.some(artist => rightSet.some(other =>
        artist === other
        || (artist.length >= 3 && other.indexOf(artist) >= 0)
        || (other.length >= 3 && artist.indexOf(other) >= 0)
    ));
}

// 通过严格判定即保底 STRICT_SCORE_BASE 分，附加分仅用于排序
function scoreCandidate(songName, artists, item, index) {
    if (!isStrictCandidateMatch(songName, artists, item)) return -1;
    let score = STRICT_SCORE_BASE + Math.max(0, 20 - index);
    if (normalizeText(songName) === normalizeText(item.name)) score += 50;
    if (isArtistMatch(artists, item.artist)) score += 50;
    return score;
}

function scoreLooseCandidate(songName, artists, item, index) {
    if (!item || hasCoverMarker(item)) return -1;
    if (!isStrictNameMatch(songName, item.name) && !isNameMatch(songName, item.name)) return -1;
    if (!hasArtistOverlap(artists, item.artist)) return -1;
    let score = LOOSE_SCORE_BASE + Math.max(0, 20 - index);
    if (isStrictNameMatch(songName, item.name)) score += 30;
    return score;
}

function fetchJson(requestUrl, budget) {
    return budgetFetch({
        url: requestUrl,
        method: "GET",
        headers: GENERIC_AUDIO_HEADERS
    }, budget).then(resp => {
        const statusCode = Number(resp.statusCode || resp.status || 200);
        if (statusCode >= 400) throw requestFailure("HTTP_" + statusCode);
        return JSON.parse(resp.body || "{}");
    });
}

function fetchText(requestUrl, requestHeaders, budget) {
    return budgetFetch({
        url: requestUrl,
        method: "GET",
        headers: requestHeaders || {}
    }, budget).then(resp => {
        const statusCode = Number(resp.statusCode || resp.status || 200);
        if (statusCode >= 400) throw requestFailure("HTTP_" + statusCode);
        return resp.body || "";
    });
}

function fetchPostJson(requestUrl, requestBody, requestHeaders, budget) {
    return budgetFetch({
        url: requestUrl,
        method: "POST",
        headers: requestHeaders || { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody || {})
    }, budget).then(resp => {
        const statusCode = Number(resp.statusCode || resp.status || 200);
        if (statusCode >= 400) throw requestFailure("HTTP_" + statusCode);
        return JSON.parse(resp.body || "{}");
    });
}

function getHeaderValue(headers, name) {
    const target = String(name || "").toLowerCase();
    const source = headers || {};
    for (const key of Object.keys(source)) {
        if (String(key).toLowerCase() === target) return source[key];
    }
    return "";
}

// server-md5 / x-cos-meta-md5 最可信；腾讯 COS 单段对象的 ETag 就是内容 MD5，可当强 hash 用
function parseAudioMetadata(headers) {
    const strongMd5 = String(
        getHeaderValue(headers, "server-md5")
        || getHeaderValue(headers, "x-cos-meta-md5")
        || ""
    ).toLowerCase().replace(/["']/g, "");
    const rawEtag = String(getHeaderValue(headers, "etag") || "").toLowerCase().replace(/["']/g, "");
    // 分段上传的 ETag 形如 "<md5>-2"，不是内容 MD5，排除掉
    const etag = /^[0-9a-f]{32}$/.test(rawEtag) ? rawEtag : "";
    const server = String(getHeaderValue(headers, "server") || "").toLowerCase();
    const isCos = server.indexOf("cos") >= 0
        || !!getHeaderValue(headers, "x-cos-request-id")
        || !!getHeaderValue(headers, "x-cos-hash-crc64ecma");
    // COS 单段对象：ETag == 文件 MD5，可信；否则仅作弱 hash 备用
    const cosEtagHash = etag && isCos ? etag : "";
    const contentRange = String(getHeaderValue(headers, "content-range") || "");
    const rangeMatch = contentRange.match(/\/(\d+)$/);
    const size = Number(rangeMatch ? rangeMatch[1] : getHeaderValue(headers, "content-length")) || 0;

    return {
        hash: /^[0-9a-f]{32}$/.test(strongMd5) ? strongMd5 : (cosEtagHash || ""),
        weakHash: etag,
        size: size > 0 ? size : 0,
        contentType: getHeaderValue(headers, "content-type") || ""
    };
}

async function fetchAudioMetadata(audioUrl, baseHeaders, budget) {
    const base = baseHeaders || GENERIC_AUDIO_HEADERS;
    const attempts = [
        { method: "HEAD", headers: base },
        { method: "GET", headers: Object.assign({ Range: "bytes=0-0" }, base) }
    ];

    for (const attempt of attempts) {
        try {
            const resp = await budgetFetch({
                url: audioUrl,
                method: attempt.method,
                headers: attempt.headers
            }, budget);
            const statusCode = Number(resp.statusCode || resp.status || 200);
            if (statusCode >= 400) continue;
            const metadata = parseAudioMetadata(resp.headers || {});
            if (metadata.hash || metadata.weakHash || metadata.size > 0) return metadata;
        } catch (error) {
            if (isTimeout(error) || error.requestCode === "CANCELLED") throw error;
        }
    }

    return null;
}

function parseJsonp(text, callbackName) {
    let value = String(text || "").trim();
    const prefix = callbackName + "(";
    if (value.indexOf(prefix) === 0) value = value.slice(prefix.length, -1);
    return JSON.parse(value || "{}");
}

function normalizeQqSearchItem(song) {
    if (!song) return null;
    const songmid = song.mid || song.songmid || "";
    if (!songmid) return null;
    const album = song.album || {};
    const file = song.file || {};
    const artists = (song.singer || [])
        .map(artist => artist && artist.name)
        .filter(Boolean);

    return {
        id: songmid,
        // filename 要 media_mid，与 songmid 不总相同
        media_mid: file.media_mid || file.media_id || songmid,
        url_id: songmid,
        lyric_id: songmid,
        name: song.title || song.songname || "",
        artist: artists,
        album: album.title || song.albumname || "",
        source: QQ_DIRECT_SOURCE
    };
}

async function searchDirectQq(keyword, budget) {
    const searchBody = {
        req_1: {
            method: "DoSearchForQQMusicDesktop",
            module: "music.search.SearchCgiService",
            param: {
                num_per_page: 5,
                page_num: 1,
                query: keyword,
                search_type: 0
            }
        }
    };
    const searchResult = await fetchPostJson(QQ_API_URL, searchBody, QQ_HEADERS, budget);
    const list = searchResult && searchResult.req_1 && searchResult.req_1.data && searchResult.req_1.data.body && searchResult.req_1.data.body.song && searchResult.req_1.data.body.song.list || [];
    return list.map(normalizeQqSearchItem).filter(Boolean);
}

function getQqQualityKeys(targetBr) {
    const br = Number(targetBr) || DEFAULT_OTTER_BR;
    if (br >= 320) return ["320k"];
    if (br >= 128) return ["128k", "m4a"];
    return ["m4a"];
}

function buildQqVkeyRequestBody(songmid, mediaMid, qualityKeys) {
    const resolvedMediaMid = mediaMid || songmid;
    const filenames = qualityKeys.map(key => {
        const cfg = QQ_FILE_CONFIG.filter(item => item.key === key)[0];
        return cfg ? cfg.prefix + songmid + resolvedMediaMid + cfg.ext : "";
    }).filter(Boolean);

    return {
        req_1: {
            module: "vkey.GetVkeyServer",
            method: "CgiGetVkey",
            param: {
                filename: filenames,
                guid: "10000",
                songmid: qualityKeys.map(() => songmid),
                songtype: qualityKeys.map(() => 0),
                uin: "0",
                loginflag: 1,
                platform: "20"
            }
        },
        loginUin: "0",
        comm: {
            uin: "0",
            format: "json",
            ct: 24,
            cv: 0
        }
    };
}

function extractQqVkeyUrl(data) {
    const result = data && data.req_1 && data.req_1.data || {};
    const sip = result.sip || [];
    const midurlinfo = result.midurlinfo || [];
    if (!sip.length || !midurlinfo.length) return null;

    for (let index = 0; index < midurlinfo.length; index++) {
        const info = midurlinfo[index];
        if (info && info.purl) return { url: sip[0] + info.purl, index: index };
    }
    return null;
}

async function fetchDirectQqPlayInfo(match, targetBr, budget) {
    if (!match || !match.id) return null;
    const songmid = String(match.id).replace(/^qq_/, "");
    const mediaMid = String(match.media_mid || songmid).replace(/^qq_/, "");
    const qualityKeys = getQqQualityKeys(targetBr);
    const playInfo = await fetchPostJson(QQ_API_URL, buildQqVkeyRequestBody(songmid, mediaMid, qualityKeys), QQ_HEADERS, budget);
    const vkey = extractQqVkeyUrl(playInfo);
    if (!vkey) return null;
    const audioUrl = vkey.url;

    // QQ 播放地址不含 md5，必须从响应头取
    const metadata = await fetchAudioMetadata(audioUrl, QQ_AUDIO_HEADERS, budget);
    if (!metadata || !metadata.hash || !metadata.size) {
        sourceLog(budget, "⚠️ QQ 音源缺少真实 MD5 或文件大小，跳过。");
        return null;
    }

    const usedKey = qualityKeys[vkey.index] || qualityKeys[0];
    const cfg = QQ_FILE_CONFIG.filter(item => item.key === usedKey)[0];

    return Object.assign({}, match, {
        id: songmid,
        url: String(audioUrl).replace(/&amp;/g, "&"),
        br: cfg && cfg.br || targetBr,
        requested_br: targetBr,
        size: metadata.size,
        fileHash: metadata.hash,
        contentType: metadata.contentType,
        source: QQ_DIRECT_SOURCE
    });
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

async function searchDirectJoox(keyword, budget) {
    const searchUrl = buildUrl("https://cache.api.joox.com/openjoox/v2/search_type", {
        country: "hk",
        lang: "zh_TW",
        key: keyword,
        type: "0"
    });
    const searchResult = JSON.parse(await fetchText(searchUrl, JOOX_HEADERS, budget));
    return (searchResult.tracks || []).map(normalizeJooxSearchItem).filter(Boolean);
}

function getJooxCandidateKeys(targetBr) {
    const highResKeys = JOOX_MUSIC_QUALITIES.filter(key => /master|hires|flac|ape|atmos|dolby/i.test(key));
    const br320Keys = JOOX_MUSIC_QUALITIES.filter(key => /320|high/i.test(key));
    const br192Keys = JOOX_MUSIC_QUALITIES.filter(key => /192/i.test(key));
    const lowKeys = JOOX_MUSIC_QUALITIES.filter(key => !highResKeys.includes(key) && !br320Keys.includes(key) && !br192Keys.includes(key));

    if (Number(targetBr) >= 740) return highResKeys;
    if (Number(targetBr) >= 320) return br320Keys;
    if (Number(targetBr) >= 192) return br192Keys;
    return lowKeys;
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

async function fetchDirectJooxPlayInfo(match, targetBr, budget) {
    if (!match || !match.id) return null;

    const infoUrl = buildUrl("https://api.joox.com/web-fcgi-bin/web_get_songinfo", {
        songid: match.id,
        lang: "zh_TW",
        country: "hk"
    });
    const songInfo = parseJsonp(await fetchText(infoUrl, JOOX_HEADERS, budget), "MusicInfoCallback");
    const candidateKeys = getJooxCandidateKeys(targetBr);

    for (const key of candidateKeys) {
        const audioUrl = songInfo[key];
        if (!audioUrl || String(audioUrl).indexOf("http") !== 0) continue;
        if (JOOX_SNIPPET_PATTERN.test(String(audioUrl))) {
            sourceLog(budget, `ℹ️ Joox ${key} 指向试听片段，跳过。`);
            continue;
        }

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

async function fetchOtterPlayInfo(match, targetBr, budget) {
    if (!match || !match.source || !match.id) return null;

    const playUrl = buildUrl(OTTER_API, {
        types: "url",
        id: match.id,
        br: targetBr,
        source: match.source
    });
    const playInfo = await fetchJson(playUrl, budget);
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

// 补探真实 size 与 MD5：download 校验文件 MD5，用错就整首失败。
// 强 MD5（server-md5 / 腾讯 COS 单段 ETag）优先，探不到才回退酷狗原 hash。
async function enrichWithRealMetadata(match, budget) {
    if (!match || !match.url) return match;
    // 只有已经拿到合法 32 位 MD5 时才跳过补探
    const existingHash = String(match.fileHash || "").toLowerCase();
    const hasStrongHash = /^[0-9a-f]{32}$/.test(existingHash);
    if (hasStrongHash && match.size) return match;

    const audioUrl = Array.isArray(match.url) ? match.url[0] : match.url;
    const metadata = await fetchAudioMetadata(audioUrl, GENERIC_AUDIO_HEADERS, budget);
    if (!metadata) return match;

    // 探到的强 hash 比来路不明的 fileHash 更可信，优先采用
    const resolvedHash = metadata.hash || (hasStrongHash ? existingHash : "");
    return Object.assign({}, match, {
        size: metadata.size || match.size || 0,
        fileHash: resolvedHash,
        contentType: match.contentType || metadata.contentType || ""
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
        console.log("⚠️ 读取酷狗歌曲缓存失败：缓存格式无效。");
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

async function fetchSourcePlayInfo(match, targetBr, budget) {
    if (!match || !match.source) return null;
    if (match.source === JOOX_DIRECT_SOURCE) return fetchDirectJooxPlayInfo(match, targetBr, budget);
    if (match.source === QQ_DIRECT_SOURCE) return fetchDirectQqPlayInfo(match, targetBr, budget);
    return fetchOtterPlayInfo(match, targetBr, budget);
}

async function searchSource(source, keyword, budget) {
    if (source === JOOX_DIRECT_SOURCE) return searchDirectJoox(keyword, budget);
    if (source === QQ_DIRECT_SOURCE) return searchDirectQq(keyword, budget);
    const searchUrl = buildUrl(OTTER_API, {
        types: "search",
        name: keyword,
        count: 5,
        pages: 1,
        source: source
    });
    return fetchJson(searchUrl, budget);
}

function pickCandidate(target, list, strict) {
    const threshold = strict ? STRICT_SCORE_BASE : LOOSE_SCORE_BASE;
    return list
        .map((item, index) => ({
            item: item,
            score: strict
                ? scoreCandidate(target.name, target.artists, item, index)
                : scoreLooseCandidate(target.name, target.artists, item, index)
        }))
        .filter(pair => pair.score >= threshold && pair.item && (pair.item.id || pair.item.url_id))
        .sort((a, b) => b.score - a.score)[0] || null;
}

async function hydrateMatch(matchInfo, fallbackBrList, budget) {
    for (const br of fallbackBrList) {
        if (budget.state.done) throw requestFailure("CANCELLED");
        if (isDeadlineExceeded(budget.deadline)) throw requestFailure("DEADLINE");
        const tryMatchInfo = Object.assign({}, matchInfo, { br: br });
        sourceLog(budget, `🎚️ ${matchInfo.source} 请求 ${br}k 播放地址`);
        const hydratedMatch = await fetchSourcePlayInfo(tryMatchInfo, br, budget);
        if (isUsablePlayInfo(hydratedMatch)) return { match: hydratedMatch, br: br };
        sourceLog(budget, `ℹ️ ${matchInfo.source} ${br}k 未返回可用 URL`);
    }
    return null;
}

async function resolveOtterMusicUrl(hash, targetBr) {
    const startedAt = Date.now();
    const budget = { deadline: startedAt + TIME_BUDGET_MS - RETURN_MARGIN_MS, state: { done: false, pending: new Set() } };
    const diag = { sources: [], timedOut: false };
    const target = readCachedTrackInfo(hash);
    if (!target || !target.name || target.artists.length === 0) {
        console.log("⚠️ 未找到 get_res_privilege/lite 缓存，无法自动换源。");
        return null;
    }

    const keyword = `${target.name} ${target.artists[0]}`;
    console.log(`🔎 Otter 自动匹配：${keyword}｜总预算 ${TIME_BUDGET_MS}ms`);
    const fallbackBrList = getFallbackBrList(targetBr);
    const triedCandidates = new Set();
    const searchResults = {};

    function record(label, stage, error) {
        if (budget.state.done) return;
        const timedOut = isTimeout(error);
        if (timedOut) diag.timedOut = true;
        const httpStatus = String(error && error.requestCode || "").match(/^HTTP_(\d{3})$/);
        const reason = timedOut ? "超时，结果未确认" : "失败" + (httpStatus ? `（HTTP ${httpStatus[1]}）` : "");
        diag.sources.push(label + ":" + stage + reason);
        console.log(`⚠️ ${label} ${stage}${reason}｜已用 ${Date.now() - startedAt}ms`);
    }

    async function trySource(source, strict) {
        let stage = "搜索";
        try {
            if (!Object.prototype.hasOwnProperty.call(searchResults, source)) {
                sourceLog(budget, `🔍 ${source} 开始搜索`);
                searchResults[source] = searchSource(source, keyword, budget);
            }
            const list = await searchResults[source];
            if (budget.state.done) return null;
            if (!Array.isArray(list) || !list.length) {
                if (strict) diag.sources.push(source + ":搜索无结果");
                sourceLog(budget, `ℹ️ ${source} 搜索无结果｜已用 ${Date.now() - startedAt}ms`);
                return null;
            }
            const candidate = pickCandidate(target, list, strict);
            if (!candidate) {
                if (strict) diag.sources.push(source + ":" + list.length + "条均不匹配");
                sourceLog(budget, `🔒 ${source} ${list.length}条均不匹配｜已用 ${Date.now() - startedAt}ms`);
                return null;
            }
            const candidateId = candidate.item.id || candidate.item.url_id;
            const candidateKey = source + "|" + candidateId;
            if (triedCandidates.has(candidateKey)) return null;
            const matchInfo = {
                source: source,
                id: candidateId,
                media_mid: candidate.item.media_mid || "",
                br: targetBr,
                name: candidate.item.name,
                artist: Array.isArray(candidate.item.artist) ? candidate.item.artist.join("/") : candidate.item.artist
            };
            sourceLog(budget, `🎵 ${source} 匹配到 ${formatMatchTitle(candidate.item)}｜已用 ${Date.now() - startedAt}ms`);
            stage = "播放地址查询";
            const result = await hydrateMatch(matchInfo, fallbackBrList, budget);
            if (!result) {
                triedCandidates.add(candidateKey);
                diag.sources.push(source + ":匹配到但无可用URL");
                return null;
            }
            stage = "音频信息查询";
            sourceLog(budget, `📦 ${source} 查询文件大小和 MD5`);
            const enriched = await enrichWithRealMetadata(result.match, budget);
            if (budget.state.done) return null;
            return { match: enriched, matchInfo: matchInfo, strict: strict };
        } catch (error) {
            record(source, stage, error);
            return null;
        }
    }

    try {
        const cachedMatch = readCachedMatch(hash, targetBr);
        if (cachedMatch && cachedMatch.source && cachedMatch.id) {
            const cacheBudget = { deadline: Math.min(budget.deadline, Date.now() + CACHE_BUDGET_MS), state: budget.state };
            console.log(`♻️ 检查已缓存音源：${cachedMatch.source}｜最多 ${CACHE_BUDGET_MS}ms`);
            try {
                const result = await hydrateMatch(cachedMatch, fallbackBrList, cacheBudget);
                if (result) {
                    const enriched = await enrichWithRealMetadata(result.match, cacheBudget);
                    console.log(`✅ 缓存音源可用｜耗时 ${Date.now() - startedAt}ms`);
                    return enriched;
                }
                triedCandidates.add(cachedMatch.source + "|" + cachedMatch.id);
                diag.sources.push("缓存(" + cachedMatch.source + "):无可用URL");
            } catch (error) {
                record("缓存(" + cachedMatch.source + ")", "查询", error);
            }
            console.log("ℹ️ 缓存未就绪，转为并发搜索。");
        }

        const matchRounds = ENABLE_LOOSE_MATCH ? [true, false] : [true];
        for (const strict of matchRounds) {
            if (isDeadlineExceeded(budget.deadline)) {
                diag.timedOut = true;
                break;
            }
            if (!strict) console.log("🪶 严格匹配全部落空，改用宽松匹配（歌名相同 + 歌手有交集）。");
            console.log(`🚀 并发搜索 ${OTTER_SOURCES.length} 个音源｜剩余 ${budget.deadline - Date.now()}ms`);
            const winner = await firstUsable(OTTER_SOURCES.map(source => trySource(source, strict)));
            if (winner) {
                stopRequests(budget);
                const actualBr = Number(winner.match.br) > 0 ? Number(winner.match.br) : targetBr;
                console.log(`✅ 已切换到 ${winner.match.source} ${actualBr}k 音源${strict ? "" : "（宽松匹配）"}，匹配歌曲：${formatMatchTitle(winner.match)}`);
                if (strict) saveCachedMatch(hash, targetBr, winner.matchInfo);
                console.log(`⏱️ 耗时 ${Date.now() - startedAt}/${TIME_BUDGET_MS}ms`);
                return winner.match;
            }
        }
        console.log(`📋 换源失败诊断｜耗时 ${Date.now() - startedAt}/${TIME_BUDGET_MS}ms｜${diag.sources.join("，") || "无源可试"}`);
        if (diag.timedOut) {
            console.log("⏱️ 部分请求超时中断，音源结果未确认；保留原响应，可稍后重试。");
        } else if (!ENABLE_LOOSE_MATCH) {
            console.log("🔒 本轮未取得严格匹配的可用音源，保留原响应（宽松匹配已关闭）。");
        }
        return null;
    } finally {
        stopRequests(budget);
    }
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

function normalizeAudioHash(value, fallbackHash) {
    const hash = String(value || "").toUpperCase();
    return /^[0-9A-F]{32}$/.test(hash) ? hash : String(fallbackHash || "").toUpperCase();
}

function normalizeFileSize(size) {
    const value = Number(size);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

// 有些接口给 bps 而非 kbps
function normalizeBitrate(value) {
    const bitRate = Number(value) || 0;
    if (bitRate <= 0) return 0;
    return bitRate > 10000 ? Math.round(bitRate / 1000) : Math.round(bitRate);
}

// 受限标记写法多样，值可能是数字或字符串
const KUGOU_RESTRICTED_PATTERNS = [
    /"is_free_part"\s*:\s*"?1"?/i,
    /"is_trial"\s*:\s*"?(1|true)"?/i,
    /"pay_block_tpl"\s*:\s*"?1"?/i,
    /"privilege"\s*:\s*"?(8|10)"?/i,
    /"fail_process"\s*:\s*"?[1-9]/i,
    /"pay_type"\s*:\s*"?[1-9]/i
];
const MIN_FULL_TRACK_BYTES = 1024 * 1024;

function inspectOriginalResponse(rawBody) {
    if (!rawBody) return null;

    let payload;
    try {
        payload = JSON.parse(rawBody);
    } catch (_) {
        return null;
    }
    if (!payload || typeof payload !== "object") return null;

    const rawText = String(rawBody);
    for (const pattern of KUGOU_RESTRICTED_PATTERNS) {
        if (pattern.test(rawText)) return null;
    }

    const buckets = [payload, payload.data].filter(bucket => bucket && typeof bucket === "object");
    for (const bucket of buckets) {
        const candidates = [bucket.url, bucket.play_url, bucket.backup_url, bucket.primaryUrl, bucket.urls];
        for (const candidate of candidates) {
            const value = Array.isArray(candidate) ? candidate.filter(Boolean)[0] : candidate;
            if (!value || String(value).indexOf("http") !== 0) continue;

            const size = Number(bucket.fileSize || bucket.file_size || bucket.filesize || bucket.size
                || payload.fileSize || payload.file_size || payload.filesize || payload.size) || 0;
            // 小于完整歌曲 → 多半是试听片段
            if (size > 0 && size < MIN_FULL_TRACK_BYTES) return null;

            const br = normalizeBitrate(bucket.bitRate || bucket.bitrate || payload.bitRate || payload.bitrate);
            return { url: String(value), br: br, size: size };
        }
    }

    return null;
}

function buildTrackerResponse(hash, match) {
    const audioUrl = Array.isArray(match.url) ? match.url[0] : match.url;
    const bitRate = Number(match.br) || DEFAULT_OTTER_BR;
    const fileSize = normalizeFileSize(match.size);
    const fmt = inferAudioFormat(audioUrl);
    const audioHash = normalizeAudioHash(match.fileHash, extractAudioHash(audioUrl, hash));

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

// 不回写 body：原响应头的 content-encoding 与已解码明文对不上
function passThroughOriginal() {
    $done({});
}

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

    if (!hash) {
        console.log("❌ 未检测到合法 hash，跳过重写。");
        passThroughOriginal();
        return;
    }

    const original = PREFER_ORIGINAL_WHEN_GOOD_ENOUGH ? inspectOriginalResponse(responseBody) : null;
    if (original && original.br >= targetBr) {
        console.log(`👌 原响应已可播且音质足够（${original.br}k ≥ ${targetBr}k），直接放行，不换源。`);
        passThroughOriginal();
        return;
    }
    if (original) {
        console.log(`↗️ 原响应可播但音质偏低（${original.br || "未知"}k < ${targetBr}k），继续尝试换源。`);
    }

    resolveOtterMusicUrl(hash, targetBr).then(match => {
        if (!match || !match.url) {
            console.log("⚠️ Otter 本轮未取得可用音源，保留原响应；原因见换源诊断。");
            passThroughOriginal();
            return;
        }

        const newBody = JSON.stringify(buildTrackerResponse(hash, match));
        console.log("✅ Tracker 响应已替换为 Otter/GD 音源。");
        console.log("🎵 下载音源歌曲：" + formatMatchTitle(match));
        console.log("🎯 音频地址已取得（不记录签名参数）");

        $done({
            status: "HTTP/1.1 200 OK",
            headers: buildJsonHeaders(),
            body: newBody
        });
    }).catch(e => {
        console.log("⚠️ Otter 自动换源异常，保留原响应。");
        passThroughOriginal();
    });
    return;
}

// 处理 /vipcenter/ios 请求头修改
// 需另注册 request-header 规则才会执行
if (url.includes("/vipcenter/ios")) {
  const 截取长度 = 112; // 你给的浏览器抓包的 user_label 长度
  let match = url.match(/user_label=([^&]*)/);
  if (match) {
    let userLabelEncoded = match[1];
    if (userLabelEncoded.length > 截取长度) {
      let newUserLabelEncoded = userLabelEncoded.substring(0, 截取长度);
      let newUrl = url.replace(/user_label=[^&]*/, `user_label=${newUserLabelEncoded}`);

      console.log("重写后 user_label 长度: " + newUserLabelEncoded.length);
      console.log("user_label 已截取，完整请求地址不写入日志");

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
