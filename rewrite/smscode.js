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
 * [rewrite_local]
 ^https?:\/\/api\.get-sms-code\.com\/v1\/(account|account\/balance) url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/smscode.js
 *
 * [mitm]
 * hostname = api.get-sms-code.com
 */

var config = {
  fake_balance: 100,            // 本地显示的余额
  fake_unpause: true,           // 同时隐藏 NO_FUNDS 暂停状态

  // 是否在首次 /v1/account 返回后触发一次购买请求
  // 现在默认关闭：抓包里还没有真实“购买号码”接口/参数，填完下面 buy 后再改为 true
  auto_buy_once: false,

  // 购买请求参数（需要按真实抓包填写）
  buy: {
    endpoint: '/v1/activations',       // 占位：请填实际购买接口
    auth: 'OAuth v_your_token_here',   // 占位：请填实际 OAuth token
    service: 'fb',                     // 服务 id，例如 fb / whatsapp / telegram
    country: 94,                       // 国家 id，来自国家列表接口
    duration_days: 7                   // 租赁才需要，普通购买可能不需要
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
  var body = {
    service: b.service,
    country: b.country
  };

  if (isRent) {
    return JSON.stringify({
      service: b.service,
      country: b.country,
      duration_days: b.duration_days
    });
  }

  return JSON.stringify(body);
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
    already = $prefs.valueForKey('gms_buy_once_triggered') === '1';
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
        'Content-Type': 'application/json',
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
    $prefs.setValueForKey('1', 'gms_buy_once_triggered');
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
