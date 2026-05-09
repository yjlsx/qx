// ================== BoxJs 配置 ================== //
const DEFAULT_CONFIG = {
 RSS_URL: 'https://feeds.feedburner.com/nytcn',
 MAX_ITEMS: 10,
 SHOW_SUMMARY: true,
 SUMMARY_LENGTH: 180,
 FETCH_ARTICLE_TEXT: true,       // 自动抓取文章页正文
 ARTICLE_POLICY: '',             // 文章页抓取策略，留空为 direct + 默认策略
 ARTICLE_FETCH_LIMIT: 5,         // 最多展开前几篇，避免定时任务运行过久
 ARTICLE_TEXT_LENGTH: 3000,      // 聚合页里每篇精读内容长度
 CREATE_READING_PAGE: true,      // 生成可点击打开的图文聚合页
 SHOW_ORIGINAL_LINK: true,       // 是否在每篇精读版末尾显示原文入口
 USE_AI_ANALYSIS: false,         // 使用 AI 生成每篇文章分析
 AI_BASE_URL: 'https://api.openai.com/v1',
 AI_API_KEY: '',
 AI_MODEL: 'gpt-4o-mini',
 AI_ANALYSIS_LIMIT: 5,
 UPLOAD_IMAGES_TO_TELEGRAPH: false, // 先上传图片到 Telegraph；通常用图片代理即可
 USE_IMAGE_PROXY: true,          // NYT 图片走代理，避免 static01.nyt.com 无法直连
 NOTIFY_TITLE_COUNT: 3,          // 通知里显示前几个标题
 USE_BARK: false,
 BARK_KEY: ''
};

const CONFIG = loadConfig();
const RSS_URL = CONFIG.RSS_URL;
const MAX_ITEMS = CONFIG.MAX_ITEMS;
const SHOW_SUMMARY = CONFIG.SHOW_SUMMARY;
const SUMMARY_LENGTH = CONFIG.SUMMARY_LENGTH;
const FETCH_ARTICLE_TEXT = CONFIG.FETCH_ARTICLE_TEXT;
const ARTICLE_POLICY = CONFIG.ARTICLE_POLICY;
const ARTICLE_FETCH_LIMIT = CONFIG.ARTICLE_FETCH_LIMIT;
const ARTICLE_TEXT_LENGTH = CONFIG.ARTICLE_TEXT_LENGTH;
const CREATE_READING_PAGE = CONFIG.CREATE_READING_PAGE;
const SHOW_ORIGINAL_LINK = CONFIG.SHOW_ORIGINAL_LINK;
const USE_AI_ANALYSIS = CONFIG.USE_AI_ANALYSIS;
const AI_BASE_URL = CONFIG.AI_BASE_URL;
const AI_API_KEY = CONFIG.AI_API_KEY;
const AI_MODEL = CONFIG.AI_MODEL;
const AI_ANALYSIS_LIMIT = CONFIG.AI_ANALYSIS_LIMIT;
const UPLOAD_IMAGES_TO_TELEGRAPH = CONFIG.UPLOAD_IMAGES_TO_TELEGRAPH;
const USE_IMAGE_PROXY = CONFIG.USE_IMAGE_PROXY;
const NOTIFY_TITLE_COUNT = CONFIG.NOTIFY_TITLE_COUNT;
const USE_BARK = CONFIG.USE_BARK;
const BARK_KEY = CONFIG.BARK_KEY;
// ============================================== //

function loadConfig() {
 return {
   RSS_URL: readString('nysb_rss_url', DEFAULT_CONFIG.RSS_URL),
   MAX_ITEMS: readNumber('nysb_max_items', DEFAULT_CONFIG.MAX_ITEMS, 1, 30),
   SHOW_SUMMARY: readBoolean('nysb_show_summary', DEFAULT_CONFIG.SHOW_SUMMARY),
   SUMMARY_LENGTH: readNumber('nysb_summary_length', DEFAULT_CONFIG.SUMMARY_LENGTH, 50, 1000),
   FETCH_ARTICLE_TEXT: readBoolean('nysb_fetch_article_text', DEFAULT_CONFIG.FETCH_ARTICLE_TEXT),
   ARTICLE_POLICY: readString('nysb_article_policy', DEFAULT_CONFIG.ARTICLE_POLICY),
   ARTICLE_FETCH_LIMIT: readNumber('nysb_article_fetch_limit', DEFAULT_CONFIG.ARTICLE_FETCH_LIMIT, 0, 20),
   ARTICLE_TEXT_LENGTH: readNumber('nysb_article_text_length', DEFAULT_CONFIG.ARTICLE_TEXT_LENGTH, 100, 5000),
   CREATE_READING_PAGE: readBoolean('nysb_create_reading_page', DEFAULT_CONFIG.CREATE_READING_PAGE),
   SHOW_ORIGINAL_LINK: readBoolean('nysb_show_original_link', DEFAULT_CONFIG.SHOW_ORIGINAL_LINK),
   USE_AI_ANALYSIS: readBoolean('nysb_use_ai_analysis', DEFAULT_CONFIG.USE_AI_ANALYSIS),
   AI_BASE_URL: readString('nysb_ai_base_url', DEFAULT_CONFIG.AI_BASE_URL).replace(/\/+$/, ''),
   AI_API_KEY: readString('nysb_ai_api_key', DEFAULT_CONFIG.AI_API_KEY),
   AI_MODEL: readString('nysb_ai_model', DEFAULT_CONFIG.AI_MODEL),
   AI_ANALYSIS_LIMIT: readNumber('nysb_ai_analysis_limit', DEFAULT_CONFIG.AI_ANALYSIS_LIMIT, 0, 20),
   UPLOAD_IMAGES_TO_TELEGRAPH: readBoolean('nysb_upload_images_to_telegraph', DEFAULT_CONFIG.UPLOAD_IMAGES_TO_TELEGRAPH),
   USE_IMAGE_PROXY: readBoolean('nysb_use_image_proxy', DEFAULT_CONFIG.USE_IMAGE_PROXY),
   NOTIFY_TITLE_COUNT: readNumber('nysb_notify_title_count', DEFAULT_CONFIG.NOTIFY_TITLE_COUNT, 1, 10),
   USE_BARK: readBoolean('nysb_use_bark', DEFAULT_CONFIG.USE_BARK),
   BARK_KEY: readString('nysb_bark_key', DEFAULT_CONFIG.BARK_KEY)
 };
}

function readPrefs(key) {
 if (typeof $prefs === 'undefined') return null;
 const value = $prefs.valueForKey(key);
 return value === undefined || value === null || value === '' ? null : value;
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
 if (typeof value === 'boolean') return value;
 return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

async function main() {
 try {
   // 环境检测
   if (typeof $task === 'undefined') {
     throw new Error('此脚本必须在Quantumult X中运行');
   }

   console.log("ℹ️ 开始执行纽约时报推送任务");
   const resp = await fetchRSS();
   console.log("✅ RSS数据获取成功");

   let items = parseContent(resp);
   console.log(`📊 解析到有效条目：${items.length}条`);

   if (FETCH_ARTICLE_TEXT && items.length > 0) {
     items = await enrichItemsWithArticleText(items);
   }

   if (USE_AI_ANALYSIS && items.length > 0) {
     items = await enrichItemsWithAiAnalysis(items);
   }

   if (items.length > 0) {
     const readingPageUrl = CREATE_READING_PAGE ? await createReadingPage(items) : null;
     await sendNotification(items, readingPageUrl);
     console.log("📨 推送通知已发送");
   } else {
     console.log("⚠️ 未找到有效新闻条目");
   }
 } catch (e) {
   handleError(e);
 } finally {
   $done();
 }
}

// 增强版网络请求（含三级重试）
function fetchRSS() {
 return fetchText(RSS_URL, 'RSS');
}

function fetchText(url, label = '页面') {
 const policies = label === 'RSS' ? ['direct'] : getArticlePolicies();
 return fetchTextByPolicies(url, label, policies);
}

async function fetchTextByPolicies(url, label, policies) {
 let lastError = null;
 for (const policy of policies) {
   try {
     return await fetchTextWithPolicy(url, label, policy);
   } catch (error) {
     lastError = error;
     console.log(`⚠️ ${label}${policy ? `策略 ${policy}` : '默认策略'}失败: ${error.message}`);
   }
 }
 throw lastError || new Error(`${label}请求失败`);
}

function getArticlePolicies() {
 const policies = [];
 if (ARTICLE_POLICY) policies.push(ARTICLE_POLICY);
 policies.push('direct');
 policies.push(null);
 return policies.filter((policy, index, arr) => arr.indexOf(policy) === index);
}

function fetchTextWithPolicy(url, label = '页面', policy = null) {
 return new Promise((resolve, reject) => {
   const TIMEOUT = 30000;
   const RETRY_DELAY = [2000, 5000, 10000];
   let retryCount = 0;

   const attemptFetch = () => {
     const request = {
       url,
       timeout: TIMEOUT,
       headers: {
         'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
         'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
         'Accept-Language': 'zh-CN,zh-Hans;q=0.9,en;q=0.8'
       }
     };
     if (policy) request.policy = policy;

     $task.fetch(request).then(resp => {
       const statusCode = resp.statusCode || resp.status;
       if (statusCode >= 200 && statusCode < 300) {
         const decodedData = decodeResponseBody(resp);
         if (!decodedData) {
           reject(new Error(`${label}响应内容为空或无法解码`));
           return;
         }
         console.log(`📥 ${label}接收数据长度:`, decodedData.length);
         resolve(decodedData);
       } else if (retryCount < RETRY_DELAY.length) {
         console.log(`⚠️ ${label} HTTP ${statusCode} 错误，第 ${retryCount + 1} 次重试...`);
         setTimeout(attemptFetch, RETRY_DELAY[retryCount++]);
       } else {
         reject(new Error(`${label}最终请求失败: HTTP ${statusCode || '未知状态码'}`));
       }
     }, err => {
       if (retryCount < RETRY_DELAY.length) {
         console.log(`⚠️ ${label}网络错误 (${formatFetchError(err)})，第 ${retryCount + 1} 次重试...`);
         setTimeout(attemptFetch, RETRY_DELAY[retryCount++]);
       } else {
         reject(new Error(`${label}最终连接失败: ${formatFetchError(err)}`));
       }
     });
   };

   attemptFetch();
 });
}

function formatFetchError(err) {
 if (!err) return '未知错误';
 if (typeof err === 'string') return err;
 if (err.error) return err.error;
 if (err.message) return err.message;
 try {
   return JSON.stringify(err);
 } catch (e) {
   return String(err);
 }
}

function decodeResponseBody(resp) {
 if (typeof resp.body === 'string') return resp.body;
 if (resp.bodyBytes && typeof TextDecoder !== 'undefined') {
   return new TextDecoder('utf-8').decode(resp.bodyBytes);
 }
 return '';
}

// 增强版内容解析
function parseContent(xml) {
 try {
   console.log("🔍 开始解析XML内容");
   const parser = new DOMParser();
   const doc = parser.parseFromString(xml, "text/xml");

   // 验证XML有效性
   const parseError = doc.querySelector('parsererror');
   if (parseError) {
     throw new Error('XML解析错误：' + parseError.textContent.slice(0, 100));
   }

   const items = [];
   const entries = doc.querySelectorAll('item');
   console.log("📑 发现原始条目:", entries.length);

   entries.forEach((item, index) => {
     if (index >= MAX_ITEMS) return;

     const title = extractText(item, 'title');
     const rawLink = extractText(item, 'link');
     const link = cleanURL(rawLink);
     const content = extractText(item, 'content\\:encoded') || extractText(item, 'description');

     if (title && link) {
       items.push({
         title: cleanText(title),
         link: link,
         summary: generateSummary(content),
         image: extractFirstImage(content),
         category: extractText(item, 'category'),
         author: extractText(item, 'dc\\:creator'),
         pubDate: extractText(item, 'pubDate')
       });
       console.log(`📌 成功解析条目 ${index + 1}: ${title.slice(0, 20)}...`);
     }
   });

   return items;
 } catch (e) {
   throw new Error(`内容解析失败: ${e.message}`);
 }
}

// 安全版文本提取
function extractText(item, selector) {
 try {
   const elem = item.querySelector(selector);
   return elem?.textContent
     ?.replace(/<!\[CDATA\[|]]>/g, '')
     ?.trim() || null;
 } catch (e) {
   console.log(`⚠️ 提取 ${selector} 时发生错误: ${e.message}`);
   return null;
 }
}

// URL清理与标准化
function cleanURL(urlString) {
 try {
   const url = new URL(urlString);

   // 清除跟踪参数
   const blacklist = ['utm_', 'fbclid', '_ga', 'mc_', 'gclid', 'yclid'];
   blacklist.forEach(param => {
     url.searchParams.forEach((_, key) => {
       if (key.startsWith(param)) url.searchParams.delete(key);
     });
   });

   // 标准化URL格式
   url.hash = '';
   url.pathname = url.pathname.replace(/\/+/g, '/');
   url.search = url.search.replace(/[?&]+$/, '');

   console.log(`🔗 处理后的URL: ${url.toString()}`);
   return url.toString();
 } catch (e) {
   console.log(`⚠️ URL处理失败，使用原始URL: ${urlString}`);
   return urlString;
 }
}

// 摘要生成器
function generateSummary(content) {
 if (!SHOW_SUMMARY || !content) return null;

 const cleanContent = htmlToText(content);

 return cleanContent.length > SUMMARY_LENGTH
   ? cleanContent.slice(0, SUMMARY_LENGTH) + '...'
   : cleanContent;
}

// 文本净化
function cleanText(text) {
 return text
   .replace(/(【|】|&nbsp;)/g, ' ')
   .replace(/\s{2,}/g, ' ');
}

async function enrichItemsWithArticleText(items) {
 const nextItems = items.slice();
 const count = Math.min(nextItems.length, ARTICLE_FETCH_LIMIT);
 console.log(`📖 开始抓取文章正文：前 ${count} 篇`);

 for (let i = 0; i < count; i++) {
   const item = nextItems[i];
   try {
     const html = await fetchText(item.link, `文章 ${i + 1}`);
     const articleText = extractArticleText(html);
     const articleImage = extractArticleImage(html) || item.image;
     if (articleText) {
       nextItems[i] = {
         ...item,
         articleText: limitText(articleText, ARTICLE_TEXT_LENGTH),
         image: articleImage
       };
       console.log(`✅ 正文提取成功 ${i + 1}: ${item.title.slice(0, 20)}...`);
     } else {
       nextItems[i] = {
         ...item,
         image: articleImage
       };
       console.log(`⚠️ 未提取到正文 ${i + 1}: ${item.title.slice(0, 20)}...`);
     }
   } catch (e) {
     console.log(`⚠️ 正文抓取失败 ${i + 1}: ${e.message}`);
   }
 }

 return nextItems;
}

async function enrichItemsWithAiAnalysis(items) {
 if (!AI_API_KEY || !AI_BASE_URL || !AI_MODEL) {
   console.log('⚠️ AI分析已开启，但 Base URL / Key / Model 未配置完整，跳过');
   return items;
 }

 const nextItems = items.slice();
 const count = Math.min(nextItems.length, AI_ANALYSIS_LIMIT || nextItems.length);
 console.log(`🤖 开始 AI 分析：前 ${count} 篇，模型 ${AI_MODEL}`);

 for (let i = 0; i < count; i++) {
   const item = nextItems[i];
   const sourceText = (item.articleText || item.summary || '').trim();
   if (!sourceText) {
     console.log(`⚠️ AI分析跳过 ${i + 1}: 缺少正文或摘要`);
     continue;
   }

   try {
     const analysis = await generateAiAnalysis(item, sourceText);
     if (analysis) {
       nextItems[i] = {
         ...item,
         aiAnalysis: analysis
       };
       console.log(`✅ AI分析完成 ${i + 1}: ${item.title.slice(0, 20)}...`);
     }
   } catch (e) {
     console.log(`⚠️ AI分析失败 ${i + 1}: ${formatErrorMessage(e)}`);
   }
   if (i < count - 1) await sleep(1200);
 }

 return nextItems;
}

async function generateAiAnalysis(item, sourceText) {
 const endpoint = `${AI_BASE_URL}/chat/completions`;
 const content = [
   `标题：${item.title}`,
   item.category ? `栏目：${item.category}` : '',
   item.author ? `作者：${item.author}` : '',
   '',
   limitText(sourceText, 4500)
 ].filter(Boolean).join('\n');

 const body = JSON.stringify({
   model: AI_MODEL,
   messages: [
     {
       role: 'system',
       content: '你是一个中文新闻精读助手。请基于给定文章内容生成适合手机阅读的中文分析，不要编造正文没有的信息。'
     },
     {
       role: 'user',
       content: `请分析下面这篇纽约时报中文网文章。输出要求：\n1. 先用2-3句话概括核心内容。\n2. 再用3个要点解释重要背景、影响或值得注意的细节。\n3. 语言克制、准确，不要太长，总长度约250-450字。\n\n${content}`
     }
   ],
   temperature: 0.3,
   max_tokens: 700
 });

 let resp;
 try {
   resp = await $task.fetch({
     url: endpoint,
     method: 'POST',
     timeout: 45000,
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${AI_API_KEY}`
     },
     body
   });
 } catch (e) {
   throw new Error(`AI接口请求失败: ${formatFetchError(e)}`);
 }

 const statusCode = resp.statusCode || resp.status;
 const respBody = decodeResponseBody(resp);
 if (!respBody) {
   throw new Error(`AI接口响应为空，HTTP ${statusCode || '未知状态码'}`);
 }
 if (statusCode < 200 || statusCode >= 300) {
   throw new Error(`AI接口 HTTP ${statusCode}: ${respBody.slice(0, 160)}`);
 }

 let data;
 try {
   data = JSON.parse(respBody);
 } catch (e) {
   throw new Error(`AI接口返回非JSON: ${respBody.slice(0, 160)}`);
 }
 const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
 if (!text) {
   throw new Error('AI接口未返回分析内容');
 }

 return text.trim();
}

function sleep(ms) {
 return new Promise(resolve => setTimeout(resolve, ms));
}

function formatErrorMessage(error) {
 if (!error) return '未知错误';
 if (typeof error === 'string') return error;
 if (error.message) return error.message;
 if (error.error) return typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
 try {
   return JSON.stringify(error);
 } catch (e) {
   return String(error);
 }
}

function extractArticleText(html) {
 const bodyMatch = html.match(/<section[^>]+class=["'][^"']*article-body[^"']*["'][^>]*>([\s\S]*?)<\/section>/i);
 const source = bodyMatch ? bodyMatch[1] : html;
 const paragraphs = [];
 const paragraphReg = /<div[^>]+class=["'][^"']*article-paragraph[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
 let match;

 while ((match = paragraphReg.exec(source)) !== null) {
   const text = htmlToText(match[1]);
   if (text && !isNoiseParagraph(text)) paragraphs.push(text);
 }

 return paragraphs.join('\n\n');
}

function extractFirstImage(html) {
 const match = String(html || '').match(/<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/i);
 return match ? decodeHtml(match[1]) : null;
}

function extractArticleImage(html) {
 const source = String(html || '');
 const imagePatterns = [
   /<figure[^>]+class=["'][^"']*(?:article-span-photo|article-inline-photo)[^"']*["'][\s\S]*?<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/i,
   /<section[^>]+class=["'][^"']*article-body[^"']*["'][^>]*>[\s\S]*?<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/i,
   /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
   /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i
 ];

 for (const pattern of imagePatterns) {
   const match = source.match(pattern);
   if (match && match[1]) return normalizeImageUrl(match[1]);
 }

 return null;
}

function normalizeImageUrl(url) {
 const imageUrl = decodeHtml(String(url || '').trim())
   .replace(/-articleLarge(?=\.)/, '-master1050')
   .replace(/-videoLarge(?=\.)/, '-master1050');
 return USE_IMAGE_PROXY ? proxyImageUrl(imageUrl) : imageUrl;
}

function proxyImageUrl(url) {
 if (!/^https?:\/\/static\d*\.nyt\.com\//i.test(url)) return url;
 const noScheme = url.replace(/^https?:\/\//i, '');
 return `https://images.weserv.nl/?url=${encodeURIComponent(noScheme)}`;
}

function htmlToText(html) {
 return decodeHtml(String(html || '')
   .replace(/<script[\s\S]*?<\/script>/gi, '')
   .replace(/<style[\s\S]*?<\/style>/gi, '')
   .replace(/<figure[\s\S]*?<\/figure>/gi, '')
   .replace(/<[^>]+>/g, '')
   .replace(/\s+/g, ' ')
   .trim());
}

function decodeHtml(text) {
 return String(text || '')
   .replace(/&nbsp;/g, ' ')
   .replace(/&amp;/g, '&')
   .replace(/&lt;/g, '<')
   .replace(/&gt;/g, '>')
   .replace(/&quot;/g, '"')
   .replace(/&#39;/g, "'");
}

function isNoiseParagraph(text) {
 return /^(广告|翻译：|点击查看本文英文版|©|Copyright)/i.test(text);
}

function limitText(text, maxLength) {
 return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

async function createReadingPage(items) {
 const pageItems = UPLOAD_IMAGES_TO_TELEGRAPH ? await uploadArticleImages(items) : items;
 try {
   return await createTelegraphPage(pageItems, await getTelegraphToken());
 } catch (e) {
   if (/ACCESS_TOKEN_INVALID/i.test(e.message || '') && typeof $prefs !== 'undefined') {
     console.log('⚠️ Telegraph token 失效，重新创建账号后重试');
     $prefs.setValueForKey('', 'nysb_telegraph_token');
     try {
       return await createTelegraphPage(pageItems, await getTelegraphToken());
     } catch (retryError) {
       console.log(`⚠️ Telegraph重试失败: ${retryError.message}`);
     }
   }
   console.log(`⚠️ 图文聚合页生成失败，改用纯文本页重试: ${e.message}`);
   try {
     return await createTelegraphPage(pageItems, await getTelegraphToken(), true);
   } catch (plainError) {
     console.log(`⚠️ 纯文本聚合页也生成失败: ${plainError.message}`);
   }
   console.log(`⚠️ 聚合阅读页生成失败: ${e.message}`);
   return null;
 }
}

async function uploadArticleImages(items) {
 const nextItems = items.slice();

 for (let i = 0; i < nextItems.length; i++) {
   const rawImage = nextItems[i].image ? normalizeImageUrl(nextItems[i].image) : '';
   if (!rawImage) continue;

   try {
     const telegraphImage = await uploadImageToTelegraph(rawImage, `图片 ${i + 1}`);
     if (telegraphImage) {
       nextItems[i] = {
         ...nextItems[i],
         image: telegraphImage
       };
       console.log(`✅ 图片 ${i + 1} 已上传到 Telegraph: ${telegraphImage}`);
     }
   } catch (e) {
     console.log(`ℹ️ 图片 ${i + 1} 转存失败，已使用代理外链: ${e.message}`);
     nextItems[i] = {
       ...nextItems[i],
       image: rawImage
     };
   }
 }

 return nextItems;
}

async function uploadImageToTelegraph(imageUrl, label) {
 const imageResp = await fetchBinary(imageUrl, label);
 const imageBytes = toUint8Array(imageResp.bodyBytes);
 if (!imageBytes || !imageBytes.length) {
   throw new Error('图片内容为空');
 }

 const contentType = getHeader(imageResp.headers, 'Content-Type') || 'image/jpeg';
 const boundary = `----NYTimes${Date.now()}${Math.floor(Math.random() * 100000)}`;
 const filename = contentType.includes('png') ? 'image.png' : 'image.jpg';
 const head = stringToUtf8Bytes(
   `--${boundary}\r\n` +
   `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
   `Content-Type: ${contentType}\r\n\r\n`
 );
 const tail = stringToUtf8Bytes(`\r\n--${boundary}--\r\n`);
 const bodyBytes = concatBytes(head, imageBytes, tail);

 const resp = await $task.fetch({
   url: 'https://telegra.ph/upload',
   method: 'POST',
   headers: {
     'Content-Type': `multipart/form-data; boundary=${boundary}`
   },
   bodyBytes
 });

 const body = decodeResponseBody(resp);
 const data = JSON.parse(body);
 if (Array.isArray(data) && data[0] && data[0].src) {
   return `https://telegra.ph${data[0].src}`;
 }

 throw new Error(body.slice(0, 120) || 'Telegraph上传返回异常');
}

function fetchBinary(url, label = '图片') {
 return new Promise((resolve, reject) => {
   $task.fetch({
     url,
     timeout: 30000,
     headers: {
       'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
       'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
     }
   }).then(resp => {
     const statusCode = resp.statusCode || resp.status;
     if (statusCode >= 200 && statusCode < 300) {
       resolve(resp);
     } else {
       reject(new Error(`${label}下载失败: HTTP ${statusCode || '未知状态码'}`));
     }
   }, err => {
     reject(new Error(`${label}下载失败: ${formatFetchError(err)}`));
   });
 });
}

function toUint8Array(value) {
 if (!value) return null;
 if (value instanceof Uint8Array) return value;
 if (value instanceof ArrayBuffer) return new Uint8Array(value);
 if (Array.isArray(value)) return new Uint8Array(value);
 return null;
}

function stringToUtf8Bytes(text) {
 if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
 const bytes = [];
 for (let i = 0; i < text.length; i++) {
   const code = text.charCodeAt(i);
   if (code < 0x80) bytes.push(code);
   else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
   else bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
 }
 return new Uint8Array(bytes);
}

function concatBytes(...parts) {
 const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
 const output = new Uint8Array(totalLength);
 let offset = 0;
 parts.forEach(part => {
   output.set(part, offset);
   offset += part.length;
 });
 return output.buffer;
}

function getHeader(headers, name) {
 if (!headers) return '';
 const exact = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
 if (exact) return Array.isArray(exact) ? exact[0] : exact;
 const foundKey = Object.keys(headers).find(key => key.toLowerCase() === name.toLowerCase());
 return foundKey ? headers[foundKey] : '';
}

async function createTelegraphPage(items, token, plainTextOnly = false) {
 const title = `纽约时报中文网精选 ${formatDate(new Date())}`;
 const content = plainTextOnly ? buildPlainTelegraphContent(items) : buildTelegraphContent(items);
 const body = [
   `access_token=${encodeURIComponent(token)}`,
   `title=${encodeURIComponent(title)}`,
   `author_name=${encodeURIComponent('NYT 中文聚合')}`,
   `content=${encodeURIComponent(JSON.stringify(content))}`,
   `return_content=false`
 ].join('&');

 const resp = await $task.fetch({
   url: 'https://api.telegra.ph/createPage',
   method: 'POST',
   headers: {
     'Content-Type': 'application/x-www-form-urlencoded'
   },
   body
 });

 const data = JSON.parse(decodeResponseBody(resp));
 if (data.ok && data.result && data.result.url) {
   console.log(`🧾 聚合阅读页已生成: ${data.result.url}`);
   return data.result.url;
 }

 throw new Error(data.error || 'Telegraph返回异常');
}

function buildPlainTelegraphContent(items) {
 const nodes = [
   { tag: 'p', children: [`共 ${items.length} 条。图文版生成失败，本页为纯文本精读版。`] }
 ];

 items.forEach((item, index) => {
   nodes.push(buildArticleTitleNode(item, index));
   const meta = [item.category, item.author, formatPubDate(item.pubDate)].filter(Boolean).join(' / ');
   if (meta) nodes.push({ tag: 'p', children: [meta] });

   const text = item.aiAnalysis || item.articleText || item.summary || '';
   if (item.aiAnalysis) {
     nodes.push({ tag: 'p', children: ['AI 分析'] });
   }
   splitParagraphs(text).forEach(paragraph => {
     nodes.push({ tag: 'p', children: [paragraph] });
   });

   if (SHOW_ORIGINAL_LINK) nodes.push(buildOriginalLinkNode(item));
 });

 return nodes;
}

async function getTelegraphToken() {
 const key = 'nysb_telegraph_token';
 const savedToken = readString(key, '');
 if (savedToken) return savedToken;

 const body = [
   `short_name=${encodeURIComponent('nyt_digest')}`,
   `author_name=${encodeURIComponent('NYT 中文聚合')}`
 ].join('&');

 const resp = await $task.fetch({
   url: 'https://api.telegra.ph/createAccount',
   method: 'POST',
   headers: {
     'Content-Type': 'application/x-www-form-urlencoded'
   },
   body
 });

 const data = JSON.parse(decodeResponseBody(resp));
 if (!data.ok || !data.result || !data.result.access_token) {
   throw new Error(data.error || 'Telegraph账号创建失败');
 }

 if (typeof $prefs !== 'undefined') {
   $prefs.setValueForKey(data.result.access_token, key);
 }

 console.log('🔑 Telegraph token 已创建并保存');
 return data.result.access_token;
}

function buildTelegraphContent(items) {
 const nodes = [
   { tag: 'p', children: [`共 ${items.length} 条。以下为聚合页内精读版。`] }
 ];

 items.forEach((item, index) => {
   nodes.push(buildArticleTitleNode(item, index));

   const meta = [item.category, item.author, formatPubDate(item.pubDate)].filter(Boolean).join(' / ');
   if (meta) nodes.push({ tag: 'p', children: [meta] });

 const image = item.image ? normalizeImageUrl(item.image) : '';
 if (image) {
     nodes.push({ tag: 'img', attrs: { src: image } });
     console.log(`🖼️ 文章 ${index + 1} 图片: ${image}`);
   }

   const text = item.aiAnalysis || item.articleText || item.summary || '';
   if (item.aiAnalysis) {
     nodes.push({ tag: 'p', children: ['AI 分析'] });
   }
   splitParagraphs(text).forEach(paragraph => {
     nodes.push({ tag: 'p', children: [paragraph] });
   });

   if (SHOW_ORIGINAL_LINK) nodes.push(buildOriginalLinkNode(item));
 });

 return nodes;
}

function buildArticleTitleNode(item, index) {
 const title = `${index + 1}. ${item.title}`;
 return { tag: 'h3', children: [title] };
}

function buildOriginalLinkNode(item) {
 return {
   tag: 'p',
   children: [
     { tag: 'a', attrs: { href: item.link }, children: ['阅读原文'] }
   ]
 };
}

function splitParagraphs(text) {
 return String(text || '')
   .split(/\n{2,}/)
   .map(p => p.trim())
   .filter(Boolean);
}

function formatDate(date) {
 const pad = n => String(n).padStart(2, '0');
 return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatPubDate(pubDate) {
 if (!pubDate) return '';
 const date = new Date(pubDate);
 if (Number.isNaN(date.getTime())) return pubDate;
 return date.toLocaleString('zh-CN', {
   month: '2-digit',
   day: '2-digit',
   hour: '2-digit',
   minute: '2-digit'
 });
}

// 推送通知：短提醒，点击打开聚合阅读页
async function sendNotification(items, readingPageUrl) {
 const title = "纽约时报新闻精选";
 const content = buildNotificationContent(items, readingPageUrl);
 const options = readingPageUrl ? { "open-url": readingPageUrl } : {};

 $notify(title, "", content, options);

 // Bark推送（可选）
 if (USE_BARK && BARK_KEY && BARK_KEY !== 'your_key_here') {
   const barkUrl = readingPageUrl
     ? `&url=${encodeURIComponent(readingPageUrl)}`
     : '';
   await $task.fetch({
     url: `https://api.day.app/${BARK_KEY}/${encodeURIComponent(title)}/${encodeURIComponent(content)}?group=NYTChinese${barkUrl}`
   });
 }
}

function buildNotificationContent(items, readingPageUrl) {
 const titles = items
   .slice(0, NOTIFY_TITLE_COUNT)
   .map((item, index) => `${index + 1}. ${item.title}`)
   .join('\n');
 const rest = items.length > NOTIFY_TITLE_COUNT ? `\n等 ${items.length} 条新闻` : '';
 const hint = readingPageUrl ? '' : '\n\n聚合页生成失败，见日志';
 return `${titles}${rest}${hint}`;
}

// 增强错误处理
function handleError(error) {
 const timestamp = new Date().toLocaleString();
 const errorInfo = {
   message: error.message || String(error),
   stack: error.stack,
   type: typeof error
 };

 console.log(`🛑 [${timestamp}] 异常报告：
 ${JSON.stringify(errorInfo, null, 2)}
 当前配置：
 - RSS源: ${RSS_URL}
 - 最大条目: ${MAX_ITEMS}
 - 摘要显示: ${SHOW_SUMMARY}`);

 $notify("脚本运行异常", "请检查日志", (error.message || String(error)).slice(0, 100));
}

// 执行主程序
main();
