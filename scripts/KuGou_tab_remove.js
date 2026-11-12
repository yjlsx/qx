/**
 * 酷狗音乐 - 标签页精简
 * 移除 "AI帮唱"、"长相思2"、"K歌"、"小说"、"游戏" 等标签页
 * 用于 Quantumult X script-response-body
 */

const namesToRemove = ["AI帮唱", "长相思2", "K歌", "小说", "游戏"];

function removeByName(obj) {
    if (typeof obj !== "object" || obj === null) return obj;
    if (Array.isArray(obj)) {
        return obj
            .filter(item => !(item && typeof item === "object" && namesToRemove.includes(item.name)))
            .map(item => removeByName(item));
    }
    const result = {};
    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val && typeof val === "object" && namesToRemove.includes(val.name)) {
            continue; // 移除该键
        }
        result[key] = removeByName(val);
    }
    return result;
}

let body = $response.body;
try {
    let json = JSON.parse(body);
    json = removeByName(json);
    body = JSON.stringify(json);
} catch (e) {
    console.log("KuGou tab remove: JSON parse error - " + e.message);
}
$done({ body });
