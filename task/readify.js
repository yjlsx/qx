/*
 * Readify 畅读有声书 - 七天读书打卡 (Quantumult X)
 *
 * 使用方法：启用重写和 MitM 后，打开 Readify 的「七天读书打卡」活动页，
 * 收到「凭证已保存」通知即可运行定时任务。登录失效时重新打开活动页抓取。
 * 单账号；切换账号后，新抓取的完整凭证会替换旧账号。
 * 凭证首次保存或变化时通知；重复抓取只记日志，避免重复提醒。
 * 每次任务均通知最终结果，日志显示读取、查询、签到、领奖及结果五个阶段。
 * 日志时间为北京时间，包含请求耗时，不输出凭证值或完整接口响应。
 * BoxJS 可选：订阅 boxjs/boxjs.json 后可管理凭证、活动 ID、签到及领奖开关。
 * 不需要密码登录，不要把 HAR 内的真实凭证写入脚本或公开配置。
 *
 * [rewrite_local]
 * ^https:\/\/readifyapp\.voiceclub\.cn\/api\/(users|campaigns\/streaks\/status)(?:\?|$) url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/readify.js
 * ^https:\/\/readifyapp\.voiceclub\.cn\/api\/campaigns\/streaks(?:\/reward-claims)?(?:\?|$) url script-request-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/readify.js
 *
 * [task_local]
 * 5 9 * * * https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/readify.js, tag=Readify签到, img-url=https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/icon/readify.png, enabled=true
 *
 * [mitm]
 * hostname = readifyapp.voiceclub.cn
 *
 * readify_enabled       默认 true
 * readify_auth          自动抓取的请求头 JSON，仅保存在本机
 * readify_campaign_id   自动从活动请求读取，默认 reading-streak-7d-202607
 * readify_auto_claim    默认 true，第七天按活动页流程自动领奖
 */

const ORIGIN = "https://readifyapp.voiceclub.cn";
const DEFAULT_CAMPAIGN = "reading-streak-7d-202607";
const AUTH_KEY = "readify_auth";
const CAPTURE_URL = /^https:\/\/readifyapp\.voiceclub\.cn\/api\/(users|campaigns\/streaks(?:\/status|\/reward-claims)?)(?:\?|$)/i;
const HEADER_KEYS = [
  "x-user-id", "x-token", "x-device-id", "x-client-sys-region", "x-lang",
  "x-user-agent", "x-app-name", "x-client-region", "x-os", "x-v",
  "x-time-zone", "user-agent",
];
const DEFAULT_HEADERS = {
  "x-client-sys-region": "CN",
  "x-lang": "zh-Hans",
  "x-user-agent": "iOS/3.6.2",
  "x-app-name": "readifyai",
  "x-client-region": "USA",
  "x-os": "17.0",
  "x-v": "v1",
  "x-time-zone": "Asia/Shanghai",
  "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) readify version/3.6.2 platform/ios timezone/Asia/Shanghai lang/zh-Hans theme/light region/USA",
};

function readValue(key) {
  if (typeof $prefs !== "undefined") return $prefs.valueForKey(key);
  if (typeof $persistentStore !== "undefined") return $persistentStore.read(key);
  return "";
}

function writeValue(key, value) {
  if (typeof $prefs !== "undefined") return $prefs.setValueForKey(value, key);
  if (typeof $persistentStore !== "undefined") return $persistentStore.write(value, key);
  return false;
}

function readText(key, fallback) {
  const value = readValue(key);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readBoolean(key, fallback) {
  const value = readValue(key);
  if (value === false || value === 0) return false;
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    if (/^(false|0|off|no)$/i.test(value.trim())) return false;
    if (/^(true|1|on|yes)$/i.test(value.trim())) return true;
  }
  return fallback;
}

function filterHeaders(headers) {
  const lower = {};
  Object.keys(headers || {}).forEach(function (key) {
    if (typeof headers[key] === "string" && headers[key].trim()) {
      lower[key.toLowerCase()] = headers[key];
    }
  });
  const result = {};
  HEADER_KEYS.forEach(function (key) {
    if (lower[key]) result[key] = lower[key];
  });
  return result;
}

function hasAuth(headers) {
  return headers["x-user-id"] && headers["x-token"] && headers["x-device-id"];
}

function missingAuthFields(headers) {
  return ["x-user-id", "x-token", "x-device-id"].filter(function (key) {
    return !headers[key];
  });
}

function log(message) {
  const stamp = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 19).replace("T", " ");
  console.log("[" + stamp + "] [Readify] " + message);
}

function notify(subtitle, body) {
  log((typeof $request === "undefined" ? "[5/5] 结果 | " : "") + subtitle + " | " + body);
  if (typeof $notify === "function") {
    try { $notify("Readify 七天读书打卡", subtitle, body); }
    catch (_) { log("通知发送失败，请查看任务日志"); }
  } else {
    log("通知接口不可用，结果已写入日志");
  }
}

function failure(message, uncertain, code) {
  const error = new Error(message);
  error.safeMessage = message;
  error.uncertain = uncertain === true;
  if (code !== undefined) error.code = code;
  return error;
}

function errorText(error) {
  return error && error.safeMessage ? error.safeMessage : "运行异常，请重新抓取凭证后重试";
}

function capturedCampaign(request) {
  const match = /[?&]campaignId=([^&#]*)/.exec(request.url || "");
  try {
    if (match) return decodeURIComponent(match[1].replace(/\+/g, " "));
    if (typeof request.body === "string" && request.body) {
      const data = JSON.parse(request.body);
      if (data && typeof data.campaignId === "string") return data.campaignId;
    }
  } catch (_) { /* Partial request bodies must not replace a valid campaign. */ }
  return "";
}

function captureRequest(request) {
  const match = CAPTURE_URL.exec(request.url || "");
  if (!match) return;
  log("凭证抓取请求匹配 | /api/" + match[1]);
  const headers = filterHeaders(request.headers);
  if (!hasAuth(headers)) {
    log("请求缺少 " + missingAuthFields(headers).join(", ") + "，保留原配置；请打开七天读书打卡活动页");
    return;
  }
  log("凭证完整 | 已捕获 3 项必要请求头");
  const value = JSON.stringify(headers);
  const previous = readValue(AUTH_KEY);
  const changed = previous !== value;
  if (changed && !writeValue(AUTH_KEY, value)) {
    throw failure("凭证保存失败，请检查 Quantumult X 持久化存储");
  }
  const campaign = capturedCampaign(request);
  if (campaign && campaign !== readValue("readify_campaign_id")) {
    if (!writeValue("readify_campaign_id", campaign)) throw failure("活动 ID 保存失败，请在 BoxJS 中设置");
    log("活动 ID 已从请求更新");
  }
  if (changed) {
    notify(previous ? "凭证已更新" : "凭证已保存",
      "已更新当前账号，可运行 Readify 签到任务；新账号会替换旧账号。");
  } else {
    log("凭证未变化，不重复通知");
  }
}

function loadAuth() {
  let headers;
  try { headers = filterHeaders(JSON.parse(readText(AUTH_KEY, "{}"))); }
  catch (_) { throw failure("凭证配置无效，请重新打开活动页抓取，或检查 BoxJS 请求头 JSON"); }
  if (!hasAuth(headers)) throw failure("未获取完整凭证，请先启用重写并打开 Readify 七天读书打卡活动页");
  return Object.assign({}, DEFAULT_HEADERS, headers, {
    Accept: "application/json, text/plain, */*",
    Origin: ORIGIN,
    Referer: ORIGIN + "/activity/check-in/7DayChallenge",
  });
}

async function api(headers, campaign, path, method) {
  const options = { url: ORIGIN + path, method: method || "GET", headers: Object.assign({}, headers), timeout: 15000 };
  if (options.method === "POST") {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify({ campaignId: campaign });
  } else {
    options.url += "?campaignId=" + encodeURIComponent(campaign);
  }
  let response;
  const startedAt = Date.now();
  try { response = await $task.fetch(options); }
  catch (_) {
    log(options.method + " " + path + " | 网络请求失败或超时 | 耗时 " + (Date.now() - startedAt) + " ms");
    throw failure("网络请求失败或超时", true);
  }
  const status = Number(response && response.statusCode);
  log(options.method + " " + path + " | HTTP " + (status || "未知") + " | 耗时 " + (Date.now() - startedAt) + " ms");
  if (status === 401 || status === 403) throw failure("登录凭证失效或访问被拒绝，请重新打开活动页抓取");
  if (!(status >= 200 && status < 300)) throw failure("HTTP 请求失败" + (status ? " (" + status + ")" : ""), status >= 500);
  let result;
  try { result = JSON.parse(response.body); }
  catch (_) { throw failure("接口未返回有效 JSON", true); }
  if (!result || result.code !== 0) {
    const code = result && typeof result.code === "number" ? result.code : "未知";
    if (code === 200000) throw failure("登录凭证失效，请重新打开活动页抓取");
    if (code === 240010) throw failure("本轮已领奖，等待下一轮", false, code);
    throw failure("接口业务失败 (code=" + code + ")，请在活动页查看详情");
  }
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
    throw failure("接口缺少有效状态数据", true);
  }
  return result.data;
}

function validateState(data, campaign) {
  if (data.campaignId !== campaign || !Number.isInteger(data.currentDay) || data.currentDay < 0 || data.currentDay > 7 ||
      typeof data.canCheckIn !== "boolean" || typeof data.canClaim !== "boolean" || typeof data.streakedToday !== "boolean" ||
      typeof data.roundStatus !== "string") {
    throw failure("接口状态字段异常，未继续提交；请在活动页核实", true);
  }
  return data;
}

async function getState(headers, campaign) {
  return validateState(await api(headers, campaign, "/api/campaigns/streaks/status"), campaign);
}

function progress(data) {
  return "连续打卡 " + data.currentDay + "/7 天";
}

function logState(label, data) {
  log(label + " | " + progress(data) + " | " + (data.streakedToday ? "今日已签到" : "今日未签到") +
    " | 可签到=" + (data.canCheckIn ? "是" : "否") + " | 可领奖=" + (data.canClaim ? "是" : "否"));
}

function rewardDetails(data) {
  const details = [];
  if (typeof data.rewardCount === "number" && Number.isFinite(data.rewardCount)) details.push("奖励数量 " + data.rewardCount);
  if (typeof data.ultraHdDays === "number" && Number.isFinite(data.ultraHdDays)) details.push("超高清权益 " + data.ultraHdDays + " 天");
  return details.length ? details.join("，") : "奖励详情请在活动页查看";
}

async function finishReward(headers, campaign, data, outcome) {
  if (!data.canClaim) {
    log("[4/5] 领奖 | 当前无需领奖");
    notify(outcome, progress(data));
    return;
  }
  if (!readBoolean("readify_auto_claim", true)) {
    log("[4/5] 领奖 | 自动领奖已关闭，保留奖励供手动领取");
    notify(outcome + " | 待领奖", progress(data) + "；自动领奖已关闭，请到活动页领取。");
    return;
  }
  log("[4/5] 领奖 | 开始领取第七天奖励 | " + progress(data));
  try {
    const reward = await api(headers, campaign, "/api/campaigns/streaks/reward-claims", "POST");
    if (reward.campaignId !== campaign || typeof reward.claimResult !== "string" || !reward.claimResult) {
      throw failure("领奖响应字段异常", true);
    }
    log("领奖成功 | " + rewardDetails(reward));
    notify(outcome + " | 领奖成功", progress(data) + "；" + rewardDetails(reward));
  } catch (error) {
    log("领奖请求异常 | " + errorText(error) + (error.uncertain ? " | 准备查询确认" : ""));
    if (error.code === 240010) {
      try {
        log("领奖核验 | 已收到并发领取提示，不重发领奖请求");
        const confirmed = await getState(headers, campaign);
        logState("领奖核验结果", confirmed);
        if (confirmed.roundStatus === "CLAIMED_WAITING") {
          notify(outcome + " | 领奖已确认", progress(confirmed));
          return;
        }
      } catch (confirmationError) { log("领奖核验失败 | " + errorText(confirmationError)); }
    }
    // A lost POST response is ambiguous; GET can confirm it without claiming twice.
    if (error.uncertain) {
      try {
        log("领奖核验 | 查询最终状态，不重发领奖请求");
        const confirmed = await getState(headers, campaign);
        logState("领奖核验结果", confirmed);
        if (confirmed.roundStatus === "CLAIMED_WAITING") {
          notify(outcome + " | 领奖已确认", progress(data) + "；" + rewardDetails(confirmed));
          return;
        }
      } catch (confirmationError) { log("领奖核验失败 | " + errorText(confirmationError)); }
    }
    notify(outcome + " | 领奖失败", progress(data) + "；" + errorText(error) + (error.uncertain ? "，领奖结果未确认，请在活动页核实。" : ""));
  }
}

async function scheduledCheckIn() {
  log("任务开始");
  log("[1/5] 读取凭证");
  if (!readBoolean("readify_enabled", true)) {
    notify("跳过 | 签到已停用", "签到已在 BoxJS 中停用，本次未发送签到请求。");
    return;
  }
  if (typeof $task === "undefined") throw failure("请在 Quantumult X 定时任务中运行");
  const headers = loadAuth();
  log("凭证完整 | 已加载 3 项必要请求头");
  const campaign = readText("readify_campaign_id", DEFAULT_CAMPAIGN);
  log("[2/5] 查询签到状态");
  let data = await getState(headers, campaign);
  logState("查询结果", data);
  if (data.canClaim) {
    log("[3/5] 签到 | 已满足领奖条件，跳过签到提交");
    await finishReward(headers, campaign, data, data.streakedToday ? "今日已签到" : "七天打卡完成");
    return;
  }
  if (data.activityStatus === "ENDED" || data.roundStatus === "ENDED") {
    log("[3/5] 签到 | 活动已结束，跳过后续请求");
    notify("跳过 | 活动已结束", progress(data));
    return;
  }
  if (data.roundStatus === "CLAIMED_WAITING") {
    log("[3/5] 签到 | 已领奖等待下一轮，跳过后续请求");
    notify("跳过 | 已领奖，等待下一轮", progress(data));
    return;
  }
  if (data.streakedToday) {
    log("[3/5] 签到 | 今日已签到，不重复提交");
    notify("今日已签到", progress(data));
    return;
  }
  if (!data.canCheckIn) {
    log("[3/5] 签到 | 当前不可签到，跳过后续请求");
    notify("跳过 | 当前不可签到", progress(data) + "；请在活动页查看下一次开放时间。");
    return;
  }
  let outcome = "签到成功";
  log("[3/5] 提交签到 | " + progress(data));
  try {
    data = validateState(await api(headers, campaign, "/api/campaigns/streaks", "POST"), campaign);
    if (!data.streakedToday) throw failure("签到响应未确认今日打卡", true);
    if (data.checkInResult === "ALREADY_CHECKED_IN") outcome = "今日已签到";
    logState("签到已确认", data);
  } catch (error) {
    log("签到请求异常 | " + errorText(error));
    if (error.code === 240010) {
      try {
        log("签到核验 | 已收到并发领取提示，不重发签到请求");
        const confirmed = await getState(headers, campaign);
        logState("签到核验结果", confirmed);
        if (confirmed.roundStatus === "CLAIMED_WAITING") {
          notify("跳过 | 已领奖，等待下一轮", progress(confirmed));
          return;
        }
      } catch (confirmationError) { log("签到核验失败 | " + errorText(confirmationError)); }
    }
    if (!error.uncertain) throw error;
    let confirmed;
    try {
      log("签到核验 | 查询最终状态，不重发签到请求");
      confirmed = await getState(headers, campaign);
    }
    catch (confirmationError) {
      log("签到核验失败 | " + errorText(confirmationError));
      throw failure("签到结果未确认，请在活动页核实；本次未重发签到请求");
    }
    logState("签到核验结果", confirmed);
    if (!confirmed.streakedToday) throw failure("签到结果未确认，请在活动页核实；本次未重发签到请求");
    data = confirmed;
    outcome = "已确认今日签到";
  }
  await finishReward(headers, campaign, data, outcome);
}

async function main() {
  const capture = typeof $request !== "undefined";
  const startedAt = Date.now();
  try {
    if (capture) captureRequest($request);
    else await scheduledCheckIn();
  } catch (error) {
    notify(capture ? "凭证保存失败" : "签到失败", errorText(error));
  } finally {
    if (!capture) log("任务结束 | 总耗时 " + (Date.now() - startedAt) + " ms");
    if (typeof $done === "function") $done({});
  }
}

main();
