/*

[rewrite_local]
^https:\/\/gw\.xiaocantech\.com\/rpc$ url script-request-header https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/xc_rpc.js

[mitm]
hostname = gw.xiaocantech.com


*/



/**
 * 仅拦截：
 * - methodname = TransferAccountService.YunSignAgreementUrl
 * - servername = External
 * 其余 /rpc 请求全部放行
 */

const url = $request.url || "";
const h = $request.headers || {};

if (!/^https:\/\/gw\.xiaocantech\.com\/rpc$/i.test(url)) {
  $done({});
  return;
}

function getHeader(name) {
  const keys = Object.keys(h);
  const hit = keys.find(k => k.toLowerCase() === name.toLowerCase());
  return hit ? String(h[hit]) : "";
}

const methodname = getHeader("methodname");
const servername = getHeader("servername");

const hit =
  methodname === "TransferAccountService.YunSignAgreementUrl" &&
  servername === "External";

if (hit) {
  console.log(`[XC_BLOCK] Blocked: ${servername} | ${methodname}`);
  $done({
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: "Blocked by Quantumult X"
  });
  return;
}

$done({});
