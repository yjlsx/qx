/**
[rewrite_local]
# 酷狗唱片机皮肤净化与本地资源缓存（不再请求 GitHub 皮肤库）
^https?:\/\/(?:gateway(?:retry|\d+)?|qgw)\.kugou\.com\/(?:player\/v1\/model\/list|vipdress\/v1\/record_rack\/(?:get_record_rack_list|set_(?:user_record_rack|record_rack_check)))(?:\?|$) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/main/rewrite/kg/kugoupf.js
^https?:\/\/vipdress\.kugou\.com\/v1\/record_rack\/(?:get_record_rack_list|set_(?:user_record_rack|record_rack_check))(?:\?|$) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/main/rewrite/kg/kugoupf.js


[mitm]
hostname = gateway.kugou.com, gatewayretry.kugou.com, gateway3.kugou.com, qgw.kugou.com, vip.kugou.com, sentry.kugou.com, vipdress.kugou.com

 */

// 仅保存酷狗接口实际返回的资源地址。脚本本身可以从 GitHub 加载，但不再下载 pifu.json。
// 更新规则和脚本后先打开播放器皮肤列表，再选皮肤。全局主题不由本脚本处理。
// 日志仅表示资源来源，不代表服务器已授权或手机已应用成功；无资源时保留原响应。
const CACHE_KEY = "kg_record_rack_cache_v2";
const CACHE_LIMIT = 300;
const UNSIGNED_TTL = 7 * 24 * 60 * 60 * 1000;
const SIGNED_TTL = 60 * 60 * 1000;
const now = Date.now();
const requestUrl = typeof $request !== "undefined" ? String($request.url || "") : "";
const responseBody = typeof $response !== "undefined" ? $response.body : null;
let finished = false;

function finish(value) {
    if (finished) return;
    finished = true;
    $done(value || {});
}

function log(message) {
    try { console.log(message); } catch (_) { /* QX console is optional in tests. */ }
}

function passthrough(reason) {
    if (reason) log("⚠️ [KG_Skin] " + reason + "，保留原响应");
    finish({});
}

function parseJson(value) {
    if (typeof value !== "string" || !value) return null;
    try { return JSON.parse(value); } catch (_) { return null; }
}

function isPlayerList() {
    return /^https?:\/\/(?:gateway(?:retry|\d+)?|qgw)\.kugou\.com\/player\/v1\/model\/list(?:\?|$)/i.test(requestUrl);
}

function isRackList() {
    return /^https?:\/\/(?:(?:gateway(?:retry|\d+)?|qgw)\.kugou\.com\/vipdress|vipdress\.kugou\.com)\/v1\/record_rack\/get_record_rack_list(?:\?|$)/i.test(requestUrl);
}

function isRackSet() {
    return /^https?:\/\/(?:(?:gateway(?:retry|\d+)?|qgw)\.kugou\.com\/vipdress|vipdress\.kugou\.com)\/v1\/record_rack\/set_(?:user_record_rack|record_rack_check)(?:\?|$)/i.test(requestUrl);
}

function queryValue(name) {
    const match = requestUrl.match(new RegExp("[?&]" + name + "=([^&#]*)", "i"));
    if (!match) return "";
    try { return decodeURIComponent(match[1].replace(/\+/g, " ")); } catch (_) { return match[1]; }
}

function requestRackId() {
    const fromUrl = queryValue("record_rack_id") || queryValue("id");
    if (fromUrl) return String(fromUrl);
    const body = String(($request && $request.body) || "");
    const json = parseJson(body);
    if (json && (json.record_rack_id !== undefined || json.id !== undefined)) {
        return String(json.record_rack_id !== undefined ? json.record_rack_id : json.id);
    }
    const match = body.match(/(?:^|&)record_rack_id=([^&]+)/i) || body.match(/(?:^|&)id=([^&]+)/i);
    if (!match) return "";
    try { return decodeURIComponent(match[1].replace(/\+/g, " ")); } catch (_) { return match[1]; }
}

function rackId(value) {
    if (typeof value !== "string" && typeof value !== "number") return "";
    if (!/^\d{1,16}$/.test(String(value)) || Number(value) > 9007199254740991) return "";
    return String(Number(value));
}

function numericVersion(value) {
    const version = Number(value);
    return isFinite(version) && version >= 0 ? version : 0;
}

function validResourceUrl(value) {
    if (typeof value !== "string" || value.length > 8192 || /[\s\\]/.test(value)) return "";
    // Do not require browser URL/URLSearchParams globals in the rewrite engine.
    const match = value.match(/^https?:\/\/([a-z0-9.-]+)(?::(?:80|443))?(\/[^?#]*)(?:\?[^#]*)?(?:#.*)?$/i);
    if (!match || !/^(?:[a-z0-9-]+\.)*kugou\.com$/i.test(match[1])) return "";
    return /\.zip$/i.test(match[2]) ? value : "";
}

function urlParams(url) {
    const query = (url.split("?")[1] || "").split("#")[0];
    const params = Object.create(null);
    query.split("&").forEach(part => {
        const index = part.indexOf("=");
        if (!part) return;
        try {
            const key = decodeURIComponent(index < 0 ? part : part.slice(0, index)).toLowerCase();
            params[key] = decodeURIComponent(index < 0 ? "" : part.slice(index + 1));
        } catch (_) { /* Malformed parameters are treated as signed, short-lived URLs. */ }
    });
    return params;
}

function resourceExpiry(url, savedAt) {
    const params = urlParams(url);
    const signed = url.indexOf("?") >= 0 && !/^v(?:ersion)?=[^&]*$/i.test(url.split("?")[1]);
    let expiry = savedAt + (signed ? SIGNED_TTL : UNSIGNED_TTL);
    ["expires", "expire", "expires_at", "deadline"].forEach(key => {
        if (params[key] === undefined || !/^\d+$/.test(params[key])) return;
        const timestamp = Number(params[key]);
        if (isFinite(timestamp)) expiry = Math.min(expiry, timestamp < 1e12 ? timestamp * 1000 : timestamp);
    });
    return expiry;
}

function readCache() {
    if (typeof $prefs === "undefined" || !$prefs || typeof $prefs.valueForKey !== "function") {
        log("⚠️ [KG_Skin] 本地缓存存储不可用");
        return {};
    }
    try {
        const raw = $prefs.valueForKey(CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
        log("⚠️ [KG_Skin] 本地缓存读取失败");
        return {};
    }
}

function writeCache(cache) {
    if (typeof $prefs === "undefined" || !$prefs || typeof $prefs.setValueForKey !== "function") {
        log("⚠️ [KG_Skin] 本地缓存存储不可用");
        return false;
    }
    try {
        const keys = Object.keys(cache).sort((a, b) =>
            Number(cache[a].seen_at || cache[a].cached_at || 0) - Number(cache[b].seen_at || cache[b].cached_at || 0));
        while (keys.length > CACHE_LIMIT) delete cache[keys.shift()];
        if ($prefs.setValueForKey(JSON.stringify(cache), CACHE_KEY) === false) {
            log("⚠️ [KG_Skin] 本地缓存写入失败");
            return false;
        }
        return true;
    } catch (_) {
        log("⚠️ [KG_Skin] 本地缓存写入失败");
        return false;
    }
}

const RESOURCE_FIELDS = [
    "record_rack_id", "record_rack_version", "record_rack_url", "play_version",
    "show_type", "auto_effect", "extend", "record_rack_pag", "record_rack_centre_img",
    "record_rack_name", "record_rack_img", "share_img", "intro", "sort", "version"
];

function resourceFrom(item) {
    if (!item || typeof item !== "object" || item.record_rack_id === undefined) return null;
    const id = rackId(item.record_rack_id);
    if (!id || id === "0") return null;
    const url = validResourceUrl(item.record_rack_url);
    const resource = { record_rack_id: id, record_rack_version: numericVersion(item.record_rack_version) };
    RESOURCE_FIELDS.forEach(field => {
        if (item[field] !== undefined && field !== "record_rack_id" && field !== "record_rack_version" && field !== "record_rack_url") resource[field] = item[field];
    });
    if (url) resource.record_rack_url = url;
    return { id, version: resource.record_rack_version, url, resource };
}

function collectResources(value, found) {
    if (!value || typeof value !== "object") return;
    const resource = resourceFrom(value);
    if (resource) found.push(resource);
    Object.keys(value).forEach(key => collectResources(value[key], found));
}

function observeResources(obj) {
    const found = [];
    collectResources(obj, found);
    if (!found.length) return;
    const cache = readCache();
    let changed = false;
    let usable = false;
    found.forEach(item => {
        const old = cache[item.id];
        if (old && numericVersion(old.record_rack_version) > item.version) return;
        if (!item.url) {
            if (!old || item.version > numericVersion(old.record_rack_version)) {
                // Keep the new version as a tombstone so an old list cannot revive an obsolete ZIP.
                cache[item.id] = { record_rack_id: item.id, record_rack_version: item.version, cached_at: now, seen_at: now };
                changed = true;
            }
            return;
        }
        const next = item.resource;
        // Reopening a list is not proof that an unchanged signed URL has been renewed.
        next.cached_at = old && old.record_rack_url === item.url && item.url.indexOf("?") >= 0
            ? Number(old.cached_at) || now : now;
        next.seen_at = now;
        cache[item.id] = next;
        changed = true;
        usable = true;
    });
    if (changed && writeCache(cache)) {
        if (usable) log("✅ [KG_Skin] 已缓存实时皮肤资源");
        else log("❚ [KG_Skin] 只记录了新资源版本，接口没有可用下载地址");
    }
}

function cachedResource(id, minVersion) {
    if (!id) return null;
    const cache = readCache();
    const item = cache[String(id)];
    if (!item || rackId(item.record_rack_id) !== id || !validResourceUrl(item.record_rack_url)) return null;
    if (numericVersion(item.record_rack_version) < numericVersion(minVersion)) {
        log("⚠️ [KG_Skin] 缓存资源版本过旧，请重新打开皮肤列表");
        return null;
    }
    const savedAt = Number(item.cached_at) || 0;
    if (!savedAt || resourceExpiry(item.record_rack_url, savedAt) <= now) {
        log("⚠️ [KG_Skin] 本地资源地址已过期，请刷新皮肤列表");
        return null;
    }
    return item;
}

function cleanSkinData(value) {
    if (!value || typeof value !== "object") return;
    if (value.theme_id !== undefined || value.record_id !== undefined || value.record_rack_id !== undefined) {
        value.is_free = "1";
        value.can_use = 1;
        value.is_buy = 1;
        value.has_authority = true;
        value.vip_level = 0;
        value.model_label = "5";
        value.limit_free_info = { limit_free_status: 1, free_end_time: 4102415999 };
        value.label_name = "";
        value.corner_mark = "";
        value.label_url = "";
        if (value.ext_params && typeof value.ext_params === "object") value.ext_params.vip_level = 0;
        if (value.theme_content_5 && typeof value.theme_content_5 === "object") {
            value.theme_content_5.label_name = "";
            value.theme_content_5.free_type = 0;
        }
    }
    Object.keys(value).forEach(key => cleanSkinData(value[key]));
}

function applyCachedSelection(obj, id) {
    const resource = cachedResource(id, obj.data && obj.data.record_rack_version);
    if (!resource) {
        log("⚠️ [KG_Skin] 未找到有效的本地缓存资源，保留原响应；请先打开皮肤列表");
        return false;
    }
    if (!obj.data || typeof obj.data !== "object") obj.data = {};
    RESOURCE_FIELDS.forEach(key => {
        if (resource[key] !== undefined) obj.data[key] = resource[key];
    });
    obj.status = 1;
    obj.errcode = 0;
    obj.errmsg = "";
    obj.data.can_use = 1;
    obj.data.is_set = 1;
    obj.data.record_rack_status = 1;
    obj.data.has_authority = true;
    obj.data.access = 1;
    obj.data.is_buy = 1;
    obj.data.vip_type = 0;
    obj.data.free_type = 3;
    obj.data.end_time = "2099-12-31 23:59:59";
    obj.data.need_popup = 0;
    obj.data.popup_type = 0;
    obj.data.popup_content = "";
    obj.data.popup_button = "";
    obj.data.jump_url = "";
    ["popup_Info", "popup_info", "button_info"].forEach(key => {
        obj.data[key] = { popup_type: 0, popup_button: "", jump_url: "", popup_content: "" };
    });
    log("✅ [KG_Skin] 使用本地缓存资源，ID:" + id + "，版本:" + resource.record_rack_version + "；是否应用成功以客户端为准");
    return true;
}

function main() {
    if (!isPlayerList() && !isRackList() && !isRackSet()) return passthrough();
    const parsed = parseJson(responseBody);
    const status = typeof $response !== "undefined" ? Number($response.statusCode || 200) : 0;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || status < 200 || status >= 300) {
        return passthrough("响应无效或请求失败");
    }
    if (isPlayerList() || isRackList()) {
        if (Number(parsed.status) !== 1 || (parsed.errcode !== undefined && Number(parsed.errcode) !== 0)) {
            return passthrough("接口业务失败");
        }
        observeResources(parsed);
        if (isPlayerList()) cleanSkinData(parsed);
        return finish({ body: JSON.stringify(parsed) });
    }
    if (Array.isArray(parsed.data)) return passthrough("响应数据结构异常");
    const data = parsed.data && typeof parsed.data === "object" ? parsed.data : {};
    const requestedId = rackId(requestRackId());
    const responseId = rackId(data.record_rack_id);
    if (requestedId && responseId && requestedId !== responseId) return passthrough("请求与响应皮肤 ID 不一致");
    const id = requestedId || responseId;
    log("❚ [KG_Skin] 处理皮肤选择，ID:" + (id || "未知"));
    // Never replace a native resource with an older cached URL, including formats we do not understand.
    if (data.record_rack_url) {
        if (id) observeResources(Object.assign({}, data, { record_rack_id: id }));
        log("❚ [KG_Skin] 使用服务器原生响应，不替换资源地址");
        return finish({});
    }
    if (Number(parsed.status) === 1 && (id === "0" || Number(data.is_set) === 1)) {
        log("❚ [KG_Skin] 保留内置皮肤或已设置成功的原始结果");
        return finish({});
    }
    if (id && data.record_rack_version !== undefined) observeResources(Object.assign({}, data, { record_rack_id: id }));
    if (applyCachedSelection(parsed, id)) return finish({ body: JSON.stringify(parsed) });
    finish({});
}

try {
    main();
} catch (_) {
    passthrough("处理异常");
}
