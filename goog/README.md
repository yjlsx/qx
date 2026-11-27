# Gemini / Google One 高级商务（Advanced Commerce）重放链 — Quantumult X 工装

> 基于 `quantumult-x-2026-11-27-234743.har`（134 条请求）实测反推。
> 所有协议细节均来自抓包，凡未实测的一律标注 `Unverified`。
>
> **脚本仓库**：<https://github.com/yjlsx/qx> → `goog/`
> **raw 前缀**：`https://raw.githubusercontent.com/yjlsx/qx/main/goog/`

---

## 0. 远程引用（推荐）

**关键：远程脚本不能写在 `[rewrite_local]` 里。**

QX 官方 sample.conf 明确写：

> The scripts for script-request-header, script-request-body, script-response-header, script-response-body, script-echo-response and script-analyze-echo-response **should be saved in local** "On My iPhone - Quantumult X - Scripts" or "iCloud Drive - Quantumult X - Scripts".

即 `[rewrite_local]` 的脚本参数期望是**裸文件名**（`g1-acq.qx.js`）。直接写 `https://…` 会被判为格式错误，配置加载就报红。

远程脚本的正确位置是两个地方：

| 位置 | 形式 | 用途 |
|---|---|---|
| `[rewrite_remote]` | 引用 `.snippet` / `.conf` 文件 | 规则 + 远程脚本地址一起远程化 |
| `[task_local]` | 直接写 `https://…js` | 定时任务脚本 |

所以本工装把 rewrite 规则单独做成 [gemini-rewrite.snippet](D:\GitHub\qx\goog\gemini-rewrite.snippet)，用 `[rewrite_remote]` 引入。

完整配置见 [gemini-remote.conf](D:\GitHub\qx\goog\gemini-remote.conf)，核心只有三句话：

```ini
[mitm]
hostname = %APPEND% one.google.com, applecommerce-pa.googleapis.com, play.googleapis.com, accounts.google.com, www.googleapis.com, ogads-pa.clients6.google.com

[rewrite_remote]
https://raw.githubusercontent.com/yjlsx/qx/main/goog/gemini-rewrite.snippet, tag=Gemini-GoogleOne, opt-parser=true, update-interval=86400, enabled=true

[task_local]
*/6 * * * * https://raw.githubusercontent.com/yjlsx/qx/main/goog/gemini_adv_replay.js, tag=Gemini高级商务重放, enabled=false
```

`gemini-rewrite.snippet` 内部是这样（5 条规则）：

```ini
^https:\/\/one\.google\.com\/g1-sku-report\/?(\?.*)?$ url script-request-body https://raw.githubusercontent.com/yjlsx/qx/main/goog/g1-sku-report.qx.js reject
^https:\/\/one\.google\.com\/ url script-response-body https://raw.githubusercontent.com/yjlsx/qx/main/goog/g1-acq.qx.js
^https:\/\/applecommerce-pa\.googleapis\.com\/v1\/transactions:prepare url script-request-body https://raw.githubusercontent.com/yjlsx/qx/main/goog/gemini_prepare_capture.js reject-200
^https:\/\/applecommerce-pa\.googleapis\.com\/\$rpc\/google\.subscriptions\.apple\.commerce\.v1\.AppleCommerceService\/ListProducts url script-response-body https://raw.githubusercontent.com/yjlsx/qx/main/goog/gemini_sku_probe.js
^https:\/\/one\.google\.com\/_\/SubscriptionsManagementUi\/data\/batchexecute url script-request-body https://raw.githubusercontent.com/yjlsx/qx/main/goog/gemini_activate_capture.js
```

> 注意：snippet 文件里**不能有 `[section]` 头**，只写规则行。

### 全本地替代方案

不想用 remote，就把 7 个脚本拷到 `文件 App → On My iPhone → Quantumult X → Scripts`，然后 `[rewrite_local]` 里脚本参数只写文件名：

```ini
[rewrite_local]
^https:\/\/one\.google\.com\/g1-sku-report\/?(\?.*)?$ url script-request-body g1-sku-report.qx.js reject
^https:\/\/one\.google\.com\/ url script-response-body g1-acq.qx.js
```

本地版完整配置见 [quantumultx-g1acq.conf](D:\GitHub\qx\goog\quantumultx-g1acq.conf) 与 [quantumultx.conf](D:\GitHub\qx\goog\quantumultx.conf)。

### 7 个运行时脚本对应的 raw URL

| 脚本 | raw URL |
|---|---|
| `g1-acq.qx.js` | `…/main/goog/g1-acq.qx.js` |
| `g1-sku-report.qx.js` | `…/main/goog/g1-sku-report.qx.js` |
| `gemini_prepare_capture.js` | `…/main/goog/gemini_prepare_capture.js` |
| `gemini_prepare_response.js` | `…/main/goog/gemini_prepare_response.js` |
| `gemini_sku_probe.js` | `…/main/goog/gemini_sku_probe.js` |
| `gemini_activate_capture.js` | `…/main/goog/gemini_activate_capture.js` |
| `gemini_adv_replay.js` | `…/main/goog/gemini_adv_replay.js` |

**7 个脚本全部自包含**：无 `require`、无 ES `import`、无 `fs`、无 `Buffer`、无 `__dirname`、无 `$httpClient`、无动态加载、不引用其它脚本。每个都只依赖 QX 原生全局（`$request` `$response` `$done` `$prefs` `$notify` `$task`）。

### 推送前自检

```bash
node validate_qx_syntax.js      # QX 语法合规（rewrite_local 参数形态 / section 名 / snippet）
node final_gate.js              # 发布闸门：纯沙箱启动 / $done 形态 / BOM / 交叉引用
node publish_check.js           # 自包含性 / 语法 / 配置引用 / 占位符残留
node verify_remote_manifest.js  # raw URL ↔ 本地文件一一对应
node qx_parity_test.js          # 高级商务构造器逐字节回归
node qx_simulate_test.js        # QX 运行时行为模拟
```

实测结果：

| 测试 | 结果 | 覆盖 |
|---|---|---|
| `validate_qx_syntax.js` | **17 / 17** | `[rewrite_local]` 脚本参数必须是裸文件名、section 名合法、snippet 无 section 头、正则可编译 |
| `final_gate.js` | **48 / 48** | 7 脚本纯沙箱启动、`$done` 形态、正则可编译、UTF-8 无 BOM、以 LF 换行、无交叉引用 |
| `publish_check.js` | **20 / 20** | 自包含性（无 require/fs/Buffer/import）、语法、配置↔文件对应、占位符残留 |
| `verify_remote_manifest.js` | **8 / 8** | raw URL 全部落在 `…/yjlsx/qx/main/goog/` 下、文件存在、含 `$done` |
| `qx_parity_test.js` | **8 / 8** | 请求体与 HAR 原始报文逐字节一致 |
| `qx_simulate_test.js` | **52 / 52** | 映射引擎与管理页在模拟 QX 沙箱里的真实行为 |


**已修的两个上线级问题：**

1. **UTF-8 BOM** —— 转换后两个 `.qx.js` 带 BOM（`EF BB BF`），QX 引擎会在首行报 `SyntaxError` 导致脚本整个不执行。已剥离，并把 `writeClean()` 写进转换器，复跑不会再出现。
2. **首行签名** —— `g1-acq.qx.js` 首行是注释，脚本靠 IIFE 自执行，QX 直接加载没问题；已确认 7 个脚本在纯沙箱（只给 QX 原生全局）里都能独立启动。

---

## 0. 先纠正一个前提

你截图里的那条 rewrite：

```
^https://one.google.com/ai\?.*$
```

**它拦不到任何票据。** 实测结论：

| 项 | 实测 |
|---|---|
| `one.google.com/ai` | 2 次，返回 `text/html` 1.25 MB，**页面导航请求** |
| 它的 body | 1232 字节 protobuf，内容是**产品列表**（15GB/100GB/2TB/AI Plus/AI Pro/AI Ultra） |
| 含票据吗 | **不含**。没有 receipt、没有 purchaseToken、没有 JWS |
| 拦它的后果 | 页面白屏，什么都拿不到 |

真正的交易入口在别处，见下。

顺带，原文正则的两个技术问题：
- `\?` 匹配的是**字面问号**，漏掉 `/ai` 与 `/ai/subscribe`
- `ai` 后面没边界，会误命中 `ai_plan`、`aim`

正确写法（如果确实要拦页面）：`^https:\/\/one\.google\.com\/ai(\/|\?|$)`

---

## 1. 实测链路（Observed）

### 1.1 三个真正的端点

| 端点 | 方法 | 作用 | HAR 出现次数 |
|---|---|---|---|
| `applecommerce-pa.googleapis.com/v1/transactions:prepare` | POST | **创建交易**，返回 JWS | 3（#77 #81 #127） |
| `applecommerce-pa.googleapis.com/$rpc/.../AppleCommerceService/ListProducts` | POST | 拉 SKU 与定价 | 3（#7 #13 #90） |
| `one.google.com/_/SubscriptionsManagementUi/data/batchexecute` | POST | 订阅管理 RPC | 6（只读 rpcid） |

### 1.2 transactions:prepare 完整报文结构

请求体 279 字节（以 `g1.ios.20tb.m.v2` 为例），protobuf 五字段：

```
f1 = 交易 UUID   "C471BCB8-76BA-4A73-B5A1-E1310E318293"   ← 大写，跨 SKU 复用同值
f2 = bundle      "com.google.gemini.generic"
f3 = DeveloperPayload（两层嵌套，142 字节）
       f1 = "type.googleapis.com/subscriptions.common.proto.SubscriptionsDeveloperPayload"
       f2 = 内层（62 字节）
              f1 = 最内层（60 字节）
                     f1 = 0x1c (28)
                     f2 = 1000
                     f3 = 3
                     f5 = "1.2026.1870010.1.2026.1870010.0"   IAP 版本
                     f7 = "/dynamic-plans"
                     f11 = 75
                     f12 = 8
f4 = 版本（42 字节）
       f1 = IAP 版本串
       f2 = "17.0"        iOS 版本
       f3 = 0x01
f5 = SKU（17 字节）
       f1 = "g1.ios.20tb.m.v2"
       f3 = "USA"
```

响应体：`f1` = Apple 交易 UUID，`f2` = **ES256 JWS**。

JWS 解出来：

```json
{
  "header":  { "kid": "XK534WVGC3", "alg": "ES256", "typ": "JWT" },
  "payload": {
    "iss": "69a6de6e-3f63-47e3-e053-5b8c7c11a4d1",
    "iat": 1795794515,
    "aud": "advanced-commerce-api",
    "bid": "com.google.gemini",
    "nonce": "e7794b5d-9387-4446-abc3-0d735dca924f",
    "request": "<base64 的 JSON>",
    "price": "99990",
    "productId": "g1.ios.20tb.m.v2"
  }
}
```

`request` 解码后：

```json
{
  "currency": "USD",
  "descriptors": { "description": "Google One 存储空间", "displayName": "20 TB" },
  "items": [{ "SKU": "g1.ios.20tb.m.v2", "price": "99990" }],
  "operation": "CREATE_SUBSCRIPTION",
  "period": "P1M",
  "requestInfo": {
    "appAccountToken": "a2b78455-b849-41e0-86ba-1b591d50ae58",
    "requestReferenceId": "047d571b-953e-45c2-bc22-2104b312c764"
  },
  "storefront": "USA",
  "taxCode": "C003-00-1",
  "version": "1"
}
```

### 1.3 命门：`appAccountToken` 是客户端自造的 UUID

三条不同 SKU 的请求（20 TB 月付 / AI Ultra 月付 / AI Pro 年付）：

| SKU | txUUID | appAccountToken |
|---|---|---|
| `g1.ios.20tb.m.v2` | `C471BCB8-...` | 同一个值 |
| `g1.ios.30tb.ai.pro.m` | `C471BCB8-...` | 同一个值 |
| `g1.ios.2tb.ai.a` | `C471BCB8-...` | 同一个值 |

**交易 UUID 与 appAccountToken 在整个会话里恒定不变**，跨 SKU 复用，由客户端生成，无签名、无服务端随机、无密码学绑定。它被塞进 `advancedCommerceData` 随收据交到 Apple，再由 Google 侧回读来决定「这笔交易给谁开通」。

结论（Observed）：归属标识由客户端决定，服务端无法从票据本身区分「谁买的」与「谁在用」。

### 1.4 全部 SKU 清单（ListProducts 实测）

| SKU | 名称 | 容量 | 周期 | 价格(USD分) |
|---|---|---|---|---|
| `g1.ios.100gb.m` | Google One 100 GB | 100 GB | 月 | — |
| `g1.ios.100gb.a` | Google One 100 GB | 100 GB | 年 | — |
| `g1.ios.helium.m` | Google AI Plus | 400 GB | 月 | — |
| `g1.ios.helium.a` | Google AI Plus | 400 GB | 年 | — |
| `g1.ios.2tb.m` | Google One 2 TB | 2 TB | 月 | — |
| `g1.ios.2tb.a` | Google One 2 TB | 2 TB | 年 | — |
| `g1.ios.2tb.ai.m` | Google AI Pro (5 TB) | 5 TB | 月 | 199990 |
| `g1.ios.2tb.ai.a` | Google AI Pro (5 TB) | 5 TB | 年 | 199990 |
| `g1.ios.20tb.m.v2` | Google One 20 TB | 20 TB | 月 | 99990 |
| `g1.ios.30tb.ai.pro.m` | **Google AI Ultra** | 20 TB | 月 | 199990 |

注意 `.a` 结尾是**年付**，不是另一档套餐。

---

## 2. 文件清单

```
<repo>/goog/                       ← https://github.com/yjlsx/qx/tree/main/goog
├── README.md                     ← 本文件
├── gemini-remote.conf       ← ★ 远程脚本版配置，直接用这个
├── quantumultx.conf              ← 本地脚本版（高级商务链）
├── quantumultx-g1acq.conf        ← 本地脚本版（G1 ACQ Plus）
│
│  ── G1 ACQ Plus（sgmodule 转换而来，QX 运行时必需）──
├── g1-acq.qx.js                  ← ① SKU 映射引擎（http-response）
├── g1-sku-report.qx.js           ← ② 管理页 + TXT/JSON 导出（http-request）
│
│  ── 高级商务链（QX 运行时必需）──
├── gemini_prepare_capture.js     ← ③ 拦 prepare 请求，抽 txId/SKU
├── gemini_prepare_response.js    ← ③' 解析 prepare 响应，抽 JWS + appAccountToken
├── gemini_sku_probe.js           ← ④ 解析 ListProducts，落 SKU 目录
├── gemini_activate_capture.js    ← ⑤ 探测激活写操作 rpcid
├── gemini_adv_replay.js          ← ⑥ 批量重放引擎（task_local）
│
│  ── 工具与测试（仅供本地，QX 不加载）──
├── convert_sgmodule.js           ← 转换器：sgmodule 脚本 → QX 脚本
├── gemini_common.js              ← Node 公共库（proto/JWS/存储/构造器）
├── gemini_checkout_harness.js    ← HAR 离线分析 + 请求体自检
├── qx_parity_test.js             ← QX 与 Node 实现一致性回归（8/8）
├── qx_simulate_test.js           ← QX 运行时模拟测试（52/52）
├── final_gate.js                 ← ★ 发布闸门（48/48）
├── publish_check.js              ← 推送前自检（20/20）
├── verify_remote_manifest.js     ← raw URL ↔ 本地文件校验（8/8）
├── .gitignore                    ← 挡住 _upstream/
└── _upstream/                    ← 上游原件（不推送，含脱敏占位符）
    ├── g1-acq.js
    └── g1-sku-report.js
```

**推送后会进仓库的 19 个文件**（`git add -n` 实测）：

```
goog/.gitignore                    goog/gemini_prepare_capture.js
goog/README.md                     goog/gemini_prepare_response.js
goog/convert_sgmodule.js           goog/gemini_sku_probe.js
goog/final_gate.js                 goog/publish_check.js
goog/g1-acq.qx.js                  goog/quantumultx-g1acq.conf
goog/g1-sku-report.qx.js           goog/gemini-remote.conf
goog/gemini_activate_capture.js    goog/quantumultx.conf
goog/gemini_adv_replay.js          goog/qx_parity_test.js
goog/gemini_checkout_harness.js    goog/qx_simulate_test.js
goog/gemini_common.js              goog/verify_remote_manifest.js
```

**分界线**：前 7 个 `.js` 会被 QX 加载，必须自包含；其余是 Node 工具，用 `require`/`fs` 是正常的，但**不会被 QX 拉取**，所以不要把它们写进 `[rewrite_local]` / `[task_local]`。

---

## 2.5 G1 ACQ Plus 转换说明

上游 `g1-acq-v8.sgmodule` 是 Shadowrocket/Surge 格式，三个组件：

| 原组件 | 内容 | QX 处理 |
|---|---|---|
| `[Rule]` | `AND,((PROTOCOL,UDP),(DEST-PORT,443)),REJECT-NO-DROP` | **无法直接转换**。QX 没有 AND 逻辑操作符，也没有 REJECT-NO-DROP。改用「全局关 HTTP/3」达成同一目的，见 conf 注释 |
| `[Script]` | `g1-acq` http-response，匹配 `^https://one.google.com/` | → `g1-acq.qx.js`，`script-response-body` |
| `[Script]` | `g1-sku-report` http-request，匹配 `/g1-sku-report` | → `g1-sku-report.qx.js`，`script-request-body` + `reject` |
| `[MITM]` | `one.google.com` | 并入 QX 的 `[mitm]` |

### 脚本层转换的 API 差异

| 功能 | SG / Surge | Quantumult X |
|---|---|---|
| 持久化读 | `$persistentStore.read(k)` | `$prefs.valueForKey(k)` |
| 持久化写 | `$persistentStore.write(v, k)` | `$prefs.setValueForKey(v, k)` |
| 返回伪造响应 | `$done({ response: { status, headers, body } })` | `$done({ status, headers, body })` |
| 响应状态码 | `$response.status` | `$response.statusCode` |
| 存储对象 | 可为 `undefined` | 不存在，需适配层 |

转换器 `convert_sgmodule.js` 做的四件事：

1. **脱敏 key 归一**：`g1.sku.mappings.v1` → `g1_acq_mapping_cfg` 等 4 个可读 key
2. **注入 QX 存储适配层**：定义一个 `QXStore` 对象并赋给 `$persistentStore`，保住上游所有 `typeof $persistentStore === "undefined"` 的可用性判断
3. **`$done` 结构化解包**：扫描 `$done({ response: { ... } })`，做括号配平后取出内部对象，重写成 QX 的扁平形式（不是字符串替换，不会破坏嵌套 `{}`）
4. **`$response.status` → `$response.statusCode`**

改了上游逻辑吗？**没有**。映射规则、预设、探测包、去重、revision 校验、20KB 表单限制全部原样保留。

### 复跑转换

```bash
node convert_sgmodule.js           # 重新生成 .qx.js
node convert_sgmodule.js --check   # 只检查不写文件
```

---

## 3. 部署步骤

### 3.1 放进 QX

把 7 个 QX 脚本拷到 Quantumult X 的脚本目录：

```
g1-acq.qx.js          ← G1 映射引擎
g1-sku-report.qx.js   ← 管理页
gemini_prepare_capture.js
gemini_prepare_response.js
gemini_sku_probe.js
gemini_activate_capture.js
gemini_adv_replay.js
```

然后按 `quantumultx-g1acq.conf`（G1 部分）+ `quantumultx.conf`（高级商务部分）合并进主配置。

**关键约束 1：QX 同一 URL 只能生效一条 rewrite。**

G1 的两条是先宽后窄，顺序不能反：

```ini
# 先窄（管理页），命中即停
^https:\/\/one\.google\.com\/g1-sku-report\/?(\?.*)?$ url script-request-body g1-sku-report.qx.js reject
# 后宽（其余 one.google.com）
^https:\/\/one\.google\.com\/ url script-response-body g1-acq.qx.js
```

**关键约束 2：QUIC 必须关。**

原 sgmodule 用 `AND,((PROTOCOL,UDP),(DEST-PORT,443)),REJECT-NO-DROP` 拦 UDP 443 逼流量走 TCP，QX 没有 AND 操作符，做不到。等价做法：

- 设置 → 其他设置 → 关闭 **HTTP/3 (QUIC)**，或
- 让节点服务端禁用 UDP

不关的话 `one.google.com` 走 QUIC，MITM 看不到明文，两个脚本都不会触发。

**关键约束 3：高级商务的 prepare 请求/响应仍旧二选一。**

想同时拿请求体与响应体，三种做法：

| 方案 | 配置 | 能拿到 | 代价 |
|---|---|---|---|
| A | 挂 `gemini_prepare_response.js` | JWS、appAccountToken、价格 | 客户端真进 Apple 支付页 |
| B | 挂 `gemini_prepare_capture.js` + `reject-200` | txId、SKU、storefront | 拿不到 JWS |
| C | 分两次跑 | 全都要 | 先 A 跑一遍备份 `$prefs`，再切 B |

### 3.2 装证书

```
[mitm]
hostname = %APPEND% applecommerce-pa.googleapis.com, one.google.com, play.googleapis.com, accounts.google.com, www.googleapis.com
```

设置 → MitM → 生成证书 → 装描述文件 → 在「关于本机 → 证书信任设置」里打开完全信任。

### 3.3 灌数据

两个 `$prefs` key（QX → 调试 → 存储 → 手动写入，或自己写个脚本灌）：

**`gemini_adv_targets`** — 待补单队列：
```json
[
  {
    "email": "a@x.com",
    "cookie": "SID=...; HSID=...; SSID=...; SAPISID=...; __Secure-3PSID=...",
    "authorization": "Bearer ya29....",
    "aat": "C471BCB8-76BA-4A73-B5A1-E1310E318293",
    "sku": "g1.ios.2tb.ai.a"
  }
]
```

**`gemini_adv_cfg`** — 运行参数：
```json
{
  "perRound": 4,
  "gapMin": 8000,
  "gapMax": 20000,
  "dryRun": true,
  "reuseTxId": true,
  "endpoint": "https://applecommerce-pa.googleapis.com/v1/transactions:prepare",
  "activateEndpoint": null,
  "activateBodyTemplate": null,
  "defaultSku": "g1.ios.2tb.ai.a",
  "maxFailStreak": 3
}
```

`dryRun: true` 时只发 prepare，不发激活。**先 dryRun 跑通再关。**

---

## 4. 验证流程

### 4.1 离线（不碰真机）

```bash
cd D:\GitHub\qx\goog

# G1 部分：QX 运行时模拟（52 项断言）
node qx_simulate_test.js

# 高级商务部分：HAR 离线解析 + 重放可行性判定
node gemini_checkout_harness.js "C:\Users\yjlsx\Downloads\quantumult-x-2026-11-27-234743.har"

# 高级商务部分：请求体构造器自检
node gemini_checkout_harness.js --build g1.ios.2tb.ai.a USA

# 高级商务部分：QX 脚本与 Node 库的一致性回归
node qx_parity_test.js

# 需要重新生成 QX 版 G1 脚本时
node convert_sgmodule.js
```

实测输出：

```
=== QX / Node 一致性回归 ===
PASS  common.js / g1.ios.20tb.m.v2           279/279
PASS  common.js / g1.ios.30tb.ai.pro.m       283/283
PASS  common.js / g1.ios.2tb.ai.a            278/278
PASS  replay.js / g1.ios.20tb.m.v2           279/279
PASS  replay.js / g1.ios.30tb.ai.pro.m       283/283
PASS  replay.js / g1.ios.2tb.ai.a            278/278
PASS  ListProducts builder                   158
PASS  JWS 解析
合计: 8 通过, 0 失败
```

```
=== Quantumult X 运行时模拟测试 ===
...
合计: 52 通过, 0 失败
```

**三种 SKU 的请求体与 HAR 原始报文逐字节完全一致**；G1 的映射引擎、管理页、TXT/JSON 导出、预设切换、预设生效后的改写行为，全部在模拟 QX 沙箱里跑通。

`qx_simulate_test.js` 验证的具体项：

| 组 | 断言 |
|---|---|
| `$prefs` 语义 | 写入返回 true、读回一致、缺失 key 返回 null |
| `g1-acq` 改写 | 不抛异常、`$done` 只调一次、默认规则命中、未匹配 SKU 不动、无 SG 的 `response` 包层 |
| `g1-acq` 放行 | 非目标端点返回 `{}`、report 路径返回 `{}` |
| `g1-sku-report` | 不抛异常、扁平结构、text/html、含表单、含默认规则 |
| 导出 | TXT 纯文本、JSON 可解析、含 mappingConfig/scan/test 段 |
| 预设 | 默认态 revision=`defaults-v9-99p`、POST 应用预设返回 303、规则落库、改写随即生效 |
| 环境纯净 | 两个脚本都不含 `Buffer`/`require`/`?.`/`??=` |

### 4.2 真机

1. 开 QX，装证书，挂 rewrite
2. 打开 Gemini App，进 Google One 订阅页，点一次订阅（用最低档，比如 100GB）
3. 看通知：
   - `Gemini prepare 已截获` → 请求侧通了
   - `Gemini JWS 已回填` → 响应侧通了
   - `Gemini SKU 目录已更新` → ListProducts 通了
   - `发现非只读 RPC` → 抓到激活写操作，**这是最后一块拼图**
4. 打开 QX → 调试 → 存储 → `gemini_adv_vault`，确认里面有 `jws`、`appAccountToken`、`txId` 三个字段

---

## 5. 还缺的一块：激活写入 RPC

HAR 里 `batchexecute` 只出现了两个 rpcid，**都是只读**：

| rpcid | f.req | 作用 |
|---|---|---|
| `AW88xc` | `[["AW88xc","[\"/ai\"]",null,"1"]]` | 拉 /ai 页面配置 |
| `GI6Jdd` | `[["GI6Jdd","[]",null,"generic"]]` | 拉订阅列表 |

`/_/SubscriptionsManagementUi/idv/` 是身份校验（`f_uid=115006309055363767199`），也不是写入。

**真正的「把权益写进账号」的 rpcid 没在本次抓包里出现**，因为这次没完成付款。

`gemini_activate_capture.js` 就是干这个的：非白名单 rpcid 一律记录 + 通知。付款成功那一刻抓到的那个 rpcid 和它的 `f.req`，就是收据搬运的落点。

拿到之后：

```json
{
  "activateEndpoint": "https://one.google.com/_/SubscriptionsManagementUi/data/batchexecute?rpcids=<新RPCID>&...",
  "activateBodyTemplate": "f.req=<把 {{JWS}} / {{AAT}} / {{TxID}} 填进去的 urlencoded 结构>&at=..."
}
```

`gemini_adv_replay.js` 会自动替换这三个占位符并带目标账号的 Cookie 提交。

---

## 6. 两条重放路径

### 路径 A：会话重放（`reuseTxId: true`）

复用原票据的 `txId` + `appAccountToken`，走新的 prepare → 新 JWS → 付款 → 激活。

- 前提：能接受每次都从号池里挑一个新的 App Store 账号付款，或者有余额
- 优势：服务端看到的是「同一笔交易继续」，最不异常
- 风险：iOS 版本号、`17.0` 写死，需要跟真机对齐

### 路径 B：收据搬运（`reuseTxId: true`，跳过付款）

一张已支付的收据，直接把 JWS 喂给激活 RPC，`appAccountToken` 沿用购买时的值。

- 前提：**激活 RPC 不比对 `appAccountToken` ↔ 当前登录账号**（Unverified，这正是待验证的核心假设）
- 优势：一张票开 N 个号，边际成本≈0
- 验证方式：拿同一张票对第 2 个号打，看返回是不是 `already used` 或 403

---

## 7. 会被拦的三个点

| 检测维度 | 拦的特征 | 脚本里的应对 |
|---|---|---|
| `purchaseToken`/`txId` 去重 | 同一票据第二次提交 | `usedTargets` 记录已用账号；返回 `already` 即标 `dead` |
| IP / 设备指纹 | 大量请求同源 | `gapMin/gapMax` 8–20 秒抖动 |
| `appAccountToken` 绑定 | 票据 aat 与当前账号不匹配 | 路径 B 的死穴，只能实测 |

`maxFailStreak: 3`：连续 3 次失败立即停本轮，避免把票打死。

---

## 8. 未验证项（Unverified）

以下全部标 `Unverified`，是下一步要实测的：

1. **激活写操作的 rpcid** —— 本次抓包未出现，需付款后重抓
2. **服务端是否比对 `appAccountToken` 与当前登录账号** —— 决定路径 B 成立与否
3. **`userAgent` 里的 `iPhone14_5` / `D17AP` 是否参与校验** —— 目前沿用 HAR 原值
4. **`17.0` iOS 版本写死是否会因版本不符被拒** —— 需要真机版本对齐
5. **`one.google.com/ai` 首屏 protobuf 里是否含当前账号 tier** —— 可作为开通成功的旁证，未深挖

---

## 9. 快捷排错

| 现象 | 原因 | 处理 |
|---|---|---|
| 通知「未解析到 purchaseToken」 | 抓错 URL 了 | 确认是 `applecommerce-pa.googleapis.com/v1/transactions:prepare` |
| `NO_JWS` | 响应里没 JWS，多半是 4xx | 看 `gemini_adv_vault` 里对应记录的 raw 响应 |
| `AUTH_INVALID` | 目标账号 Cookie/Bearer 失效 | 重新导 Cookie |
| `RATE_LIMITED` | 429 | 调大 `gapMin/gapMax`，降 `perRound` |
| prepare 请求体长度不对 | protobuf 嵌套层写错 | 跑 `node qx_parity_test.js`，应当 8/8 通过 |
| 页面白屏 | 拦了 `/ai` 页面导航 | 删掉那条 rewrite |
