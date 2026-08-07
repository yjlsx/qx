/*
 * GET SMS CODE 单文件 Quantumult X 重写脚本
 *
 * 功能 1：修改本地余额显示（/v1/account、/v1/account/balance）
 * 功能 2：自动捕获 app 每次真实点击购买时的 service_id/country_id，
 *         并在首次余额接口返回后重放这个“最近一次购买”的请求。
 *         因此不只支持 wa/41 或 ts/903，任何服务、国家都会用最后点击的参数。
 * 功能 3：开启 fake_buy_success 后，可把服务端“Balance is too low”响应
 *         伪装成本地成功。注意：不会真正扣费，也不会真正分配号码。
 *
 * 注意：修改余额只是本地显示，服务端真实余额不变；
 *       购买仍按服务端真实余额/真实接口扣费。
 *
 * Quantumult X 配置：
 * 请使用同目录 smscode.conf，或把下面两段合并进主配置：
 *
 [rewrite_local]
 ^https?:\/\/api\.get-sms-code\.com\/v1\/ url script-request-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/smscode.js
 ^https?:\/\/api\.get-sms-code\.com\/v1\/ url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/rewrite/smscode.js
 *
 [MITM]
 hostname = api.get-sms-code.com
 */

var config = {
  fake_balance: 99999,
  fake_unpause: true,
  fake_buy_success: false,
  automate_buy_once: true,
  buy: {
    endpoint: '/v1/activations/buy_number',
    auth: 'OAuth v_a53go_Z8aRIl3ANnOU-M3N'
  }
};

function getUrl() {
  return ($request && $request.url) || '';
}

function getPath(url) {
  return url.replace(/^https?:\/\/[^/]+/, '');
}

function readPrefs(key) {
  try {
    if (typeof $prefs !== 'undefined') {
      return $prefs.valueForKey(key);
    }
  } catch (e) {}
  return null;
}

function writePrefs(key, value) {
  try {
    if (typeof $prefs !== 'undefined') {
      $prefs.setValueForKey(value, key);
    }
  } catch (e) {}
}

function notify(title, subtitle, body) {
  try {
    if (typeof $notification !== 'undefined') {
      $notification.post(String(title), String(subtitle), String(body || ''));
    }
  } catch (e) {}
}

function parseForm(str) {
  var obj = {};
  if (!str) return obj;
  var parts = String(str).split('&');
  for (var i = 0; i < parts.length; i++) {
    var kv = parts[i].split('=');
    if (!kv || kv.length < 2) continue;
    var bodyKey = kv[0];
    var bodyVal = kv.slice(1).join('=');
    try {
      bodyVal = decodeURIComponent(bodyVal.replace(/\+/g, ' '));
    } catch (e) {}
    obj[bodyKey] = bodyVal;
  }
  return obj;
}

function headerValue(name) {
  try {
    var headers = $request.headers || {};
    var lower = String(name).toLowerCase();
    for (var key in headers) {
      if (String(key).toLowerCase() === lower) {
        return headers[key];
      }
    }
  } catch (e) {}
  return '';
}

function lastBuyRecord() {
  try {
    var raw = readPrefs('gms_buy_last_v2') || '';
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function isBuyNumberPath(path) {
  return /^\/v1\/activations\/buy_number($|\?)/.test(path);
}

function captureBuyRequest() {
  var url = getUrl();
  var path = getPath(url);
  if (!isBuyNumberPath(path)) {
    return;
  }

  var body = String($request.body || '');
  var params = parseForm(body);
  var country = params.country_id || params.country;
  var service = params.service_id || params.service;

  if (!service && !country) {
    return;
  }

  var record = {
    url: url,
    path: path,
    body: body,
    auth: headerValue('Authorization'),
    service: service,
    country: country,
    captured_at: Math.floor(Date.now() / 1000)
  };

  var old = lastBuyRecord();
  var changed = !old ||
    old.service !== record.service ||
    old.country !== record.country ||
    old.body !== record.body;

  writePrefs('gms_buy_last_v2', JSON.stringify(record));

  if (changed) {
    notify('GetSmsCode', '已记录本次购买参数', 'service=' + record.service + ' country=' + record.country);
  }
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

function buildBuyEndpoint(rec) {
  if (rec && rec.url) return rec.url;
  return 'https://api.get-sms-code.com' + config.buy.endpoint;
}

function maybeBuyFromLastCapture() {
  if (!config.automate_buy_once) {
    return;
  }

  if (readPrefs('gms_buy_v2_triggered') === '1') {
    return;
  }

  var rec = lastBuyRecord();
  if (!rec || !rec.service || !rec.country) {
    return;
  }

  var auth = rec.auth || config.buy.auth;
  var body = rec.body ||
    'country_id=' + encodeURIComponent(rec.country) + '&service_id=' + encodeURIComponent(rec.service);

  if (typeof $httpClient !== 'undefined') {
    $httpClient.post({
      url: buildBuyEndpoint(rec),
      headers: {
        Authorization: auth,
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'User-Agent': 'Activator/1.9.2 (app.getsmscode; build:1; iOS 17.0.0) Alamofire/5.10.2'
      },
      body: body
    }, function (error, response, data) {
      if (error) {
        notify('GetSmsCode Buy', '请求失败', error);
      } else {
        notify('GetSmsCode Buy', String(response && (response.status || response.statusCode)), data || '');
      }
    });
  }

  writePrefs('gms_buy_v2_triggered', '1');
}

function buyFailureBody(path, body) {
  if (!isBuyNumberPath(path)) {
    return null;
  }
  var text = JSON.stringify(body || {});
  if (text.indexOf('Balance is too low') >= 0 || text.indexOf('NO_FUNDS') >= 0) {
    if (config.fake_buy_success) {
      return JSON.stringify({
        msg: 'Locally accepted (fake)',
        local_fake_success: true,
        reminder: 'Real number was NOT purchased'
      });
    }
    notify('GetSmsCode Buy', '服务端余额不足', text);
  }
  return null;
}

function main() {
  if (typeof $response !== 'undefined') {
    var url = getUrl();
    var path = getPath(url);
    var bodyText = String($response.body || '');
    var bodyObj = null;

    try {
      bodyObj = JSON.parse(bodyText || 'null') || {};
    } catch (e) {
      $done({ body: bodyText });
      return;
    }

    var fakeSuccess = buyFailureBody(path, bodyObj);
    if (fakeSuccess) {
      $done({ body: fakeSuccess });
      return;
    }

    var changed = rewriteBalance(path, bodyObj);
    if (changed && /^\/v1\/account($|\?)/.test(path)) {
      maybeBuyFromLastCapture();
    }

    if (changed) {
      $done({ body: JSON.stringify(bodyObj) });
    } else {
      $done({});
    }
    return;
  }

  captureBuyRequest();
  $done({});
}

main();
