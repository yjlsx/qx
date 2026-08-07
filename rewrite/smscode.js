/*
 * GET SMS CODE 单文件 Quantumult X 重写脚本
 *
 * 功能 1：修改本地余额显示（/v1/account、/v1/account/balance）
 * 功能 2：可选自动执行“购买号码”请求，触发点放在 /v1/account 返回后
 *
 * 注意：修改余额只是本地显示，服务端真实余额不变；
 *       购买仍按服务端真实余额/真实接口扣费。
 *
 * Quantumult X 配置：
 * 请导入同目录 smscode.conf，或把下面两段合并进主配置：
 *
 * [Script]
 * GetSmsCode_balance = type=http-response, pattern=^https?://api\.get-sms-code\.com/v1/(account|account/balance), requires-body=1, max-size=2097152, script-path=https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/smscode.js
 *
 * [mitm]
 * hostname = api.get-sms-code.com
 */

var config = {
  fake_balance: 99999,            // 本地显示的余额
  fake_unpause: true,           // 同时隐藏 NO_FUNDS 暂停状态

  // 是否在首次 /v1/account 返回后触发一次购买请求
  // true = 开启，false = 关闭；触发后记在 $prefs 里避免重复购买
  auto_buy_once: true,

  // 购买请求参数（来自 2026-08-08-013317 抓包）
  buy: {
    endpoint: '/v1/activations/buy_number',
    auth: 'OAuth v_a53go_Z8aRIl3ANnOU-M3N',
    service: 'wa',                    // service_id=wa（WhatsApp）
    country: 41,                      // country_id=41，国家 id
    duration_days: 7                  // 留作没用到，普通号码不传
  }
};

function getUrl() {
  return ($request && $request.url) || '';
}

function getPath(url) {
  return url.replace(/^https?:\/\/[^/]+/, '');
}

function rewriteBalance(path, body) {
  if (/^\/v1\/account\/balance/.test(path)) {
    body.balance = config.fake_balance;
    body.frozen = 0;
    return true;
  }

  if (/^\/v1\/account($|\?)/.test(path) && body.account) {
    body.account.balance = config.fake_balance;
    if (config.fake_unpause) {
      body.account.paused = false;
      body.account.pause_reason = null;
    }
    return true;
  }

  return false;
}

function buildRequestBody() {
  var b = config.buy;
  if (!b || !b.endpoint || b.auth.indexOf('your_token_here') >= 0) {
    return null;
  }

  var isRent = /\/rent(\/|$)/.test(b.endpoint);
  if (isRent) {
    return JSON.stringify({
      service: b.service,
      country: b.country,
      duration_days: b.duration_days
    });
  }

  return 'country_id=' + encodeURIComponent(b.country) + '&service_id=' + encodeURIComponent(b.service);
}

function buyUrl() {
  var ep = config.buy.endpoint;
  if (/^https?:\/\//.test(ep)) {
    return ep;
  }
  return 'https://api.get-sms-code.com' + ep;
}

function maybeBuyOnce() {
  if (!config.auto_buy_once) {
    return;
  }

  var already = false;
  if (typeof $prefs !== 'undefined') {
    already = $prefs.valueForKey('gms_buy_v2_triggered') === '1';
  }

  if (already) {
    return;
  }

  var body = buildRequestBody();
  if (body === null) {
    $notification.post('Gets SMS Code', '购买未启用', '请先填写 buy.endpoint 和 buy.auth');
    return;
  }

  if (typeof $httpClient !== 'undefined') {
    $httpClient.post({
      url: buyUrl(),
      headers: {
        Authorization: config.buy.auth,
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'User-Agent': 'Activator/1.9.2 (app.getsmscode; build:1; iOS 17.0.0) Alamofire/5.10.2'
      },
      body: body
    }, function (error, response, data) {
      if (error) {
        $notification.post('GetSmsCode Buy', '请求失败', error);
      } else {
        $notification.post('GetSmsCode Buy', String(response && response.statusCode), data || '');
      }
    });
  }

  try {
    $prefs.setValueForKey('1', 'gms_buy_v2_triggered');
  } catch (e) {}
}

if (typeof $response !== 'undefined') {
  var url = getUrl();
  var path = getPath(url);
  var bodyObj = {};

  try {
    bodyObj = JSON.parse($response.body || 'null') || {};
  } catch (e) {
    $done({ body: $response.body });
    return;
  }

  var changed = rewriteBalance(path, bodyObj);
  if (changed && /^\/v1\/account($|\?)/.test(path)) {
    maybeBuyOnce();
  }

  if (changed) {
    $done({ body: JSON.stringify(bodyObj) });
  } else {
    $done({});
  }
} else {
  $done({});
}
