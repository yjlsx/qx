/*
[rewrite_local]
^https:\/\/app\.candashi\.cn\/api\/api\/v2\/user\/api_user_info_one url script-request-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/task/candada.js

[mitm]
hostname = app.candashi.cn


*/


const KEY = "cdd_info_raw";
const SIGN_URL = "https://app.candashi.cn/api/api/v2/user/api_user_sign_in";

const $ = {
  isRequest: typeof $request !== "undefined",
  notify: (t,s,m)=>$notify(t,s,m),
  get: (k)=>$prefs.valueForKey(k),
  set: (v,k)=>$prefs.setValueForKey(v,k),
  log: (m)=>console.log(m),
  done: (o)=>$done(o),
};


/******** ① 抓包写入 info 参数 ********/
if ($.isRequest) {
  const data = {
    headers: $request.headers,
    body: $request.body || ""
  };
  $.set(JSON.stringify(data), KEY);
  $.notify("餐大大", "参数抓取成功", "已记录 info 参数");
  $.done({});
  return;
}


/******** ② 定时签到任务 ********/
(async () => {
  const raw = $.get(KEY);
  if (!raw) {
    $.notify("餐大大", "未找到 info 参数", "请先抓包一次 /api_user_info_one");
    return $.done();
  }

  const info = JSON.parse(raw);

  // headers/body 直接复制
  const headers = { ...info.headers };
  const body = info.body;

  // timestamp 自动更新
  headers.timestamp = Date.now().toString();

  const req = {
    url: SIGN_URL,
    method: "POST",
    headers,
    body
  };

  try {
    const resp = await $task.fetch(req);
    $.notify("餐大大", "签到结果", resp.body);
    $.done();
  } catch (e) {
    $.notify("餐大大", "签到失败", String(e));
    $.done();
  }
})();
