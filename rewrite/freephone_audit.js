const SCRIPT_NAME = "FreePhone 安全审计";
const url = $request.url || "";
const method = $request.method || "GET";
const status = ($response && ($response.status || $response.statusCode)) || 0;
const body = ($response && $response.body) || "";

const sensitiveKeyPattern = /(token|authorization|bearer|secret|password|receipt|transaction|entitlement|subscription|premium|vip|coin|credit|point|balance|wallet|number|phone|private)/i;
const assetKeyPattern = /(coin|credit|point|balance|wallet|purchase|receipt|transaction|entitlement|subscription|premium|vip|number|phone|private)/i;

function redactText(text) {
  return String(text)
    .replace(/Bearer\s+[A-Za-z0-9|._~+/=-]+/gi, "Bearer <redacted>")
    .replace(/(["']?(?:token|authorization|receipt|transaction_id|original_transaction_id)["']?\s*[:=]\s*["']?)[^"',}\s]+/gi, "$1<redacted>");
}

function shortPath(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return `${u.pathname}${u.search ? "?" + u.searchParams.toString() : ""}`;
  } catch (_) {
    return rawUrl;
  }
}

function collectKeys(value, prefix, out) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    if (value.length > 0) collectKeys(value[0], `${prefix}[]`, out);
    return;
  }
  Object.keys(value).forEach((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (assetKeyPattern.test(path)) out.add(path);
    collectKeys(value[key], path, out);
  });
}

function safeLog(message) {
  console.log(`[${SCRIPT_NAME}] ${redactText(message)}`);
}

try {
  const path = shortPath(url);
  safeLog(`${method} ${path} -> ${status}`);

  if (body) {
    const json = JSON.parse(body);
    const riskyKeys = new Set();
    collectKeys(json, "", riskyKeys);

    if (riskyKeys.size > 0) {
      safeLog(`发现关键字段: ${Array.from(riskyKeys).slice(0, 30).join(", ")}`);
      safeLog("审计建议: 这些字段只能由服务端校验和落库，客户端响应被改不应改变真实积分、订阅、购买或号码归属。");
    }

    const rawKeys = JSON.stringify(json, (key, value) => {
      if (sensitiveKeyPattern.test(key)) return "<redacted>";
      return value;
    });
    safeLog(`响应摘要: ${redactText(rawKeys).slice(0, 800)}`);
  }
} catch (error) {
  safeLog(`响应不是可解析 JSON，跳过正文审计: ${error.message}`);
}

$done({});
