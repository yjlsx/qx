/*
[rewrite_local]
^https:\/\/app\.candashi\.cn\/api\/api\/v2\/user\/api_user_info_one url script-request-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/candada.js

[mitm]
hostname = app.candashi.cn


*/

/*
 * 餐大大（自动抓参数 + 自动签到）
 * 抓包接口：api_user_info_one
 * 签到接口：api_user_sign_in
 */

const STORE_KEY = "cdd_sign_data";
const TITLE = "餐大大签到";

function Env() {
  return {
    isQX: typeof $task !== "undefined",
    isRequest: typeof $request !== "undefined",
    get: (k) => $prefs.valueForKey(k),
    set: (v, k) => $prefs.setValueForKey(v, k),
    notify: (t, s, m) => $notify(t, s, m),
    log: (m) => console.log(m),
    done: (o) => $done(o)
  };
}

const $ = Env();

// ========== 抓包阶段 ==========
if ($.isRequest) {
  const data = {
    headers: $request.headers,
    body: $request.body
  };

  $.set(JSON.stringify(data), STORE_KEY);
  $.notify(TITLE, "参数抓取成功", "已写入参数，可关闭抓包");
  $.log(`[抓取成功]：\n${JSON.stringify(data, null, 2)}`);
  $.done();
  return;
}

// ========== 定时签到阶段 ==========
(async () => {
  const raw = $.get(STORE_KEY);
  if (!raw) {
    $.notify(TITLE, "未发现参数", "请先抓包一次 /api_user_info_one");
    $.done();
    return;
  }

  const data = JSON.parse(raw);

  //  自动生成时间戳（毫秒）
  const ts = Date.now().toString();

  // 在 headers 中更新 timestamp（其它不动）
  const headers = data.headers;
  if (headers.timestamp) headers.timestamp = ts;

  // JSON body 通常也是加密字符串，不要改，只替换 timestamp
  let body = data.body;
  body = body.replace(/"timestamp"\s*:\s*"\d+"/, `"timestamp":"${ts}"`);
  body = body.replace(/"timestamp"\s*:\s*\d+/, `"timestamp":${ts}`);

  const req = {
    url: "https://app.candashi.cn/api/api/v2/user/api_user_sign_in",
    method: "POST",
    headers: headers,
    body: body
  };

  $.log(`开始签到，timestamp=${ts}`);

  try {
    const res = await $task.fetch(req);
    $.notify(TITLE, "签到完成", res.body);
    $.log(`[返回结果]\n${res.body}`);
  } catch (e) {
    $.notify(TITLE, "签到失败", e);
    $.log(`[错误] ${e}`);
  }

  $.done();
})();
