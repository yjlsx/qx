/*
 * The Economist 最新文章中文聚合页
 *
 * Quantumult X 配置示例：
 * [task_local]
 * 0 8,12,18,22 * * * https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/economist.js, tag=经济学人快讯, img-url=https://economistnew.buzzing.cc/icon.png
 *
 * BoxJs / QX 持久化配置：
 * econ_ai_api_key       OpenAI 或兼容接口 API Key；不填则只生成英文聚合页
 * econ_ai_base_url      默认 https://api.openai.com/v1
 * econ_ai_model         默认 gpt-4o-mini
 * econ_feed_url         默认 https://economistnew.buzzing.cc/feed.json
 * econ_max_items        默认 5
 * econ_preview_length   默认 220
 * econ_push_only_new    默认 true，避免重复推送
 */

const DEFAULTS = {
  FEED_URL: "https://economistnew.buzzing.cc/feed.json",
  MAX_ITEMS: 5,
  PREVIEW_LENGTH: 220,
  ARTICLE_TEXT_LENGTH: 12000,
  PUSH_ONLY_NEW: true,
  AI_BASE_URL: "https://api.openai.com/v1",
  AI_MODEL: "gpt-4o-mini",
  AI_API_KEY: "",
  TIMEOUT: 60000,
};

const CONFIG = {
  FEED_URL: readString("econ_feed_url", DEFAULTS.FEED_URL),
  MAX_ITEMS: readNumber("econ_max_items", DEFAULTS.MAX_ITEMS, 1, 10),
  PREVIEW_LENGTH: readNumber("econ_preview_length", DEFAULTS.PREVIEW_LENGTH, 80, 1000),
  ARTICLE_TEXT_LENGTH: readNumber("econ_article_text_length", DEFAULTS.ARTICLE_TEXT_LENGTH, 1000, 30000),
  PUSH_ONLY_NEW: readBoolean("econ_push_only_new", DEFAULTS.PUSH_ONLY_NEW),
  AI_BASE_URL: readString("econ_ai_base_url", DEFAULTS.AI_BASE_URL).replace(/\/+$/, ""),
  AI_MODEL: readString("econ_ai_model", DEFAULTS.AI_MODEL),
  AI_API_KEY: readString("econ_ai_api_key", DEFAULTS.AI_API_KEY),
  TIMEOUT: DEFAULTS.TIMEOUT,
};

const LAST_ID_KEY = "econ_last_top_id";
const TELEGRAPH_TOKEN_KEY = "econ_telegraph_token";

main()
  .catch((error) => {
    console.log(`[经济学人] 任务失败：${error.message || error}`);
    notify("经济学人快讯", "任务失败", String(error.message || error).slice(0, 180));
  })
  .finally(() => $done());

async function main() {
  if (typeof $task === "undefined") throw new Error("请在 Quantumult X 定时任务中运行");

  const feed = await fetchJson(CONFIG.FEED_URL);
  let items = normalizeItems(feed.items || []).slice(0, CONFIG.MAX_ITEMS);
  if (items.length === 0) {
    notify("经济学人快讯", "没有解析到文章", CONFIG.FEED_URL);
    return;
  }

  const topId = items[0].id || items[0].url || items[0].englishTitle;
  const lastId = readString(LAST_ID_KEY, "");
  if (CONFIG.PUSH_ONLY_NEW && lastId && lastId === topId) {
    console.log("[经济学人] 没有新文章，跳过推送");
    return;
  }

  items = await translateItems(items);
  const pageUrl = await createReadingPage(items);
  sendNotification(items, pageUrl);
  writeString(LAST_ID_KEY, topId);
}

function normalizeItems(rawItems) {
  return rawItems
    .map((item) => {
      const englishTitle = cleanText(
        item.summary || item._translations?.en?.title || stripHtml(item.content_html || "") || item.title || ""
      );
      const contentText = extractFeedArticleText(item, englishTitle);
      return {
        id: item.id || item.url || englishTitle,
        url: item.url || item.external_url || "",
        englishTitle,
        englishText: limitText(contentText || englishTitle, CONFIG.ARTICLE_TEXT_LENGTH),
        date: item._original_published || item.date_published || item.date_modified || "",
        image: item.image || extractFirstImage(item.content_html || ""),
      };
    })
    .filter((item) => item.englishTitle);
}

function extractFeedArticleText(item, title) {
  const fromText = cleanText(item.content_text || "");
  const fromHtml = cleanText(stripHtml(item.content_html || ""));
  let text = fromText || fromHtml || title;
  text = text
    .replace(/原文地址:\s*https?:\/\/\S+/gi, "")
    .replace(/\(\s*www\.economist\.com\s*\)$/i, "")
    .trim();
  return text || title;
}

async function translateItems(items) {
  if (!CONFIG.AI_API_KEY) {
    console.log("[经济学人] 未配置 econ_ai_api_key，生成英文聚合页");
    return items.map((item) => Object.assign({}, item, { zhTitle: "", zhText: "" }));
  }

  const payload = items.map((item) => ({
    title: item.englishTitle,
    text: item.englishText,
  }));

  const prompt = [
    "请将下面 The Economist 文章标题和正文翻译成简体中文。",
    "要求：忠实翻译，不总结，不改写，不增加原文没有的信息。",
    "如果 text 只有标题，也只翻译现有内容。",
    "只返回 JSON 数组，长度和输入一致；每项格式为 {\"title\":\"中文标题\",\"text\":\"中文正文\"}。",
    JSON.stringify(payload),
  ].join("\n");

  try {
    const response = await fetchJson(`${CONFIG.AI_BASE_URL}/chat/completions`, {
      method: "POST",
      timeout: CONFIG.TIMEOUT,
      headers: {
        Authorization: `Bearer ${CONFIG.AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CONFIG.AI_MODEL,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: "你是严谨的新闻译者，负责把英文财经与国际新闻忠实翻译成自然的简体中文。",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    const content = response.choices?.[0]?.message?.content || "";
    const translations = parseJsonArray(content);
    return items.map((item, index) =>
      Object.assign({}, item, {
        zhTitle: cleanText(translations[index]?.title || ""),
        zhText: cleanText(translations[index]?.text || ""),
      })
    );
  } catch (error) {
    console.log(`[经济学人] AI 翻译失败，退回英文聚合页：${error.message || error}`);
    return items.map((item) => Object.assign({}, item, { zhTitle: "", zhText: "" }));
  }
}

async function createReadingPage(items) {
  try {
    return await createTelegraphPage(items, await getTelegraphToken(), true);
  } catch (error) {
    console.log(`[经济学人] 可展开聚合页生成失败，改用普通聚合页：${error.message || error}`);
    if (/ACCESS_TOKEN_INVALID/i.test(error.message || "")) {
      writeString(TELEGRAPH_TOKEN_KEY, "");
    }
    return createTelegraphPage(items, await getTelegraphToken(), false);
  }
}

async function createTelegraphPage(items, token, useDetails) {
  const title = `经济学人快讯 ${formatPageDate(new Date())}`;
  const content = buildTelegraphContent(items, useDetails);
  const body = [
    `access_token=${encodeURIComponent(token)}`,
    `title=${encodeURIComponent(title)}`,
    `author_name=${encodeURIComponent("Economist 中文聚合")}`,
    `content=${encodeURIComponent(JSON.stringify(content))}`,
    "return_content=false",
  ].join("&");

  const data = await fetchJson("https://api.telegra.ph/createPage", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (data.ok && data.result && data.result.url) {
    console.log(`[经济学人] 聚合页已生成：${data.result.url}`);
    return data.result.url;
  }
  throw new Error(data.error || "Telegraph 返回异常");
}

function buildTelegraphContent(items, useDetails) {
  const nodes = [
    { tag: "p", children: [`共 ${items.length} 篇。标题和正文为 AI 直译，不含 AI 总结分析。`] },
  ];

  items.forEach((item, index) => {
    const title = item.zhTitle || item.englishTitle;
    const text = item.zhText || item.englishText || item.englishTitle;
    const preview = makePreview(text);

    nodes.push({ tag: "h3", children: [`${index + 1}. ${title}`] });
    if (item.englishTitle && item.englishTitle !== title) {
      nodes.push({ tag: "p", children: [`原题：${item.englishTitle}`] });
    }

    const meta = formatDate(item.date);
    if (meta) nodes.push({ tag: "p", children: [meta] });

    if (item.image) {
      nodes.push({ tag: "img", attrs: { src: item.image } });
    }

    nodes.push({ tag: "p", children: [preview] });

    if (useDetails) {
      nodes.push({
        tag: "details",
        children: [
          { tag: "summary", children: ["展开全文"] },
          ...splitParagraphs(text).map((paragraph) => ({ tag: "p", children: [paragraph] })),
          { tag: "p", children: ["收缩：点击上方“展开全文”即可收起。"] },
        ],
      });
    } else {
      nodes.push({ tag: "h4", children: ["全文"] });
      splitParagraphs(text).forEach((paragraph) => nodes.push({ tag: "p", children: [paragraph] }));
    }

    if (item.url) {
      nodes.push({
        tag: "p",
        children: [{ tag: "a", attrs: { href: item.url }, children: ["阅读原文"] }],
      });
    }
    nodes.push({ tag: "hr" });
  });

  return nodes;
}

async function getTelegraphToken() {
  const savedToken = readString(TELEGRAPH_TOKEN_KEY, "");
  if (savedToken) return savedToken;

  const data = await fetchJson("https://api.telegra.ph/createAccount", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: [
      `short_name=${encodeURIComponent("economist_digest")}`,
      `author_name=${encodeURIComponent("Economist 中文聚合")}`,
    ].join("&"),
  });

  if (!data.ok || !data.result || !data.result.access_token) {
    throw new Error(data.error || "Telegraph 账号创建失败");
  }

  writeString(TELEGRAPH_TOKEN_KEY, data.result.access_token);
  return data.result.access_token;
}

function sendNotification(items, pageUrl) {
  const titles = items
    .slice(0, Math.min(3, items.length))
    .map((item, index) => `${index + 1}. ${item.zhTitle || item.englishTitle}`)
    .join("\n");
  const more = items.length > 3 ? `\n等 ${items.length} 篇` : "";
  notify("经济学人快讯", pageUrl ? "点击打开聚合页" : "聚合页生成失败", `${titles}${more}`, pageUrl);
}

function makePreview(text) {
  const clean = cleanText(text);
  return clean.length > CONFIG.PREVIEW_LENGTH
    ? `${clean.slice(0, CONFIG.PREVIEW_LENGTH)}...`
    : clean;
}

function splitParagraphs(text) {
  const normalized = String(text || "").replace(/\r/g, "");
  const parts = normalized.split(/\n{2,}|(?<=[。！？.!?])\s+(?=[A-Z\u4e00-\u9fa5])/);
  const paragraphs = parts.map((p) => cleanText(p)).filter(Boolean);
  return paragraphs.length ? paragraphs : [cleanText(text)];
}

function fetchJson(url, options) {
  return request(url, options).then((body) => JSON.parse(body));
}

function request(url, options) {
  const opts = Object.assign(
    {
      url,
      method: "GET",
      timeout: CONFIG.TIMEOUT,
      headers: {
        "User-Agent": "QuantumultX Economist AI Task",
        Accept: "application/json,text/xml,text/plain,*/*",
      },
    },
    options || {}
  );

  return new Promise((resolve, reject) => {
    $task.fetch(opts).then(
      (resp) => {
        const status = Number(resp.statusCode || resp.status || 0);
        const body = decodeResponseBody(resp);
        if (status >= 200 && status < 300) resolve(body);
        else reject(new Error(`HTTP ${status}: ${String(body || "").slice(0, 200)}`));
      },
      reject
    );
  });
}

function decodeResponseBody(resp) {
  if (!resp) return "";
  if (typeof resp.body === "string") return resp.body;
  if (resp.bodyBytes) return bytesToString(resp.bodyBytes);
  return "";
}

function bytesToString(bytes) {
  if (!bytes) return "";
  if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
  return String.fromCharCode.apply(null, Array.from(new Uint8Array(bytes)));
}

function parseJsonArray(text) {
  const raw = String(text || "").trim();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
}

function cleanText(text) {
  return decodeHtmlEntities(fixMojibake(String(text || "")))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fixMojibake(text) {
  return text
    .replace(/â/g, "'")
    .replace(/â/g, "'")
    .replace(/â/g, '"')
    .replace(/â/g, '"')
    .replace(/â/g, "-")
    .replace(/â/g, "-")
    .replace(/â¦/g, "...")
    .replace(/Â·/g, "·")
    .replace(/Â/g, "");
}

function decodeHtmlEntities(text) {
  const map = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity) => {
    if (map[entity]) return map[entity];
    if (entity[0] === "#") {
      const code = entity[1]?.toLowerCase() === "x"
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    }
    return _;
  });
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function extractFirstImage(html) {
  const match = String(html || "").match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? decodeHtmlEntities(match[1]) : "";
}

function limitText(text, maxLength) {
  const clean = cleanText(text);
  return clean.length > maxLength ? clean.slice(0, maxLength) : clean;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

function formatPageDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function notify(title, subtitle, message, openUrl) {
  const options = openUrl ? { "open-url": openUrl } : undefined;
  if (typeof $notify !== "undefined") $notify(title, subtitle, message, options);
}

function readPrefs(key) {
  if (typeof $prefs === "undefined") return null;
  const value = $prefs.valueForKey(key);
  return value === undefined || value === null || value === "" ? null : value;
}

function readString(key, fallback) {
  const value = readPrefs(key);
  return value === null ? fallback : String(value).trim();
}

function readNumber(key, fallback, min, max) {
  const value = Number(readPrefs(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function readBoolean(key, fallback) {
  const value = readPrefs(key);
  if (value === null) return fallback;
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
}

function writeString(key, value) {
  if (typeof $prefs !== "undefined") $prefs.setValueForKey(String(value || ""), key);
}
