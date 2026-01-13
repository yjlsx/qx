/**
 * @name 10 Minute English 会员解锁脚本
 * @desc 绕过收据验证，强制返回成功状态
[rewrite_local]

# 替换为实际的收据验证 URL 匹配规则
^https:\/\/.*\.cleverapps\.com\/.*\/validate_receipt url script-response-body https://raw.githubusercontent.com/yjlsx/qx/refs/heads/main/english.js

[mitm]
hostname = *.cleverapps.com


 */

let obj = JSON.parse($response.body);

// 伪造成功响应体
// 注意：具体的字段名需要根据 App 的成功响应模板微调，以下为通用成功结构
obj = {
  "status": "success",
  "data": {
    "is_premium": true,
    "vip_type": "yearly",
    "expire_time": 4070880000, // 2099年时间戳
    "user_id": "F10EEA3D-1E9D-4C85-8EA7-DECFC392207D",
    "has_active_subscription": true,
    "entitlements": ["all_access"]
  }
};

$done({ body: JSON.stringify(obj) });