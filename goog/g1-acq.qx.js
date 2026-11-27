/* Google One & Gemini combined 2TB / Pro 5TB / Ultra 20TB / 30TB mappings for Shadowrocket.
 *
 * Attribution & Credits:
 *   - Based on the open-source project `crhywun/g1-acq` (https://github.com/crhywun/g1-acq) by @crhywun
 *   - v7.11.0 0.05-discount / 1-yuan Pro (`com.google.gemini.2tb.ai.m.3month_ip_99p`) preset contributed by @duwqijlk (PR #8)
 *   - Ultra 20TB/30TB 1-month free trial mapping contributed by @cehomecambodia-lang (PR #3)
 *   - Extended in v9.0 (g1-acq-plus) with:
 *       1) Full `com.google.gemini.*` / `com.google.one.*` / `g1.*` SKU namespace & custom rule engine
 *       2) 0.05折/0.1折 Pro (`com.google.gemini.2tb.ai.m.3month_ip_99p` -> IN ₹10≈$0.11/mo, ID Rp 3,000≈$0.18/mo, SG S$0.48≈$0.35/mo)
 *       3) Turkey Legacy Ultra 20TB (`g1.ios.20tb.m`, ₺1,989/mo) & 30TB (`g1.ios.30tb.m`, ₺2,949.99/mo) & 2TB Annual (`g1.ios.2tb.y`, ₺499.99/yr)
 *       4) 18M/15M/12M/6M $0 Free Trial SKUs (`g1.2tb.ai.18months_eft`, `g1.2tb.ai.12months_eft`, `g1.2tb.ai.subs_variant`)
 *       5) Dual support for both Google App (`/ai?`) and standalone Google One App (`batchexecute` / `/plans`)
 */
"use strict";


// ===== Quantumult X 存储适配层（由 convert_sgmodule.js 注入）=====
var QXStore = {
  read: function (key) {
    try { var v = $prefs.valueForKey(key); return (v === null || v === undefined) ? null : String(v); }
    catch (e) { return null; }
  },
  write: function (value, key) {
    try { return $prefs.setValueForKey(String(value), key) === true; }
    catch (e) { return false; }
  }
};
var $persistentStore = QXStore;
// ==================================================================

function createG1MappingConfig(store) {
  var KEY = "g1_acq_mapping_cfg";
  var LIMIT = 30;
  var DEFAULT_REVISION = "defaults-v9-99p";
  var SOURCE_PREFIX = "g1.ios.2tb.";
  var READ_ERROR = "本地映射存储暂未就绪，本次保持响应原样。";
  var CONFIG_ERROR = "映射配置格式异常，当前暂停改写；请恢复默认后重新编辑。";
  var WRITE_ERROR = "保存结果未通过回读核对，请刷新页面查看当前配置。";
  var REVISION_ERROR = "配置已变化，本次未保存；页面已载入最新规则，请重新编辑。";
  var RULE_FIELDS = ["id", "match", "from", "to", "enabled"];
  var RECORD_FIELDS = ["schemaVersion", "revision", "updatedAt", "customized", "rules"];

  function defaults() {
    return [
      { id: "default-20tb", match: "exact", from: "g1.ios.20tb.m.v2", to: "com.google.gemini.2tb.ai.m.3month_ip_99p", enabled: true }
    ];
  }

  function presets() {
    return [
      {
        id: "pro-1yuan",
        title: "✅ [存活·默认启用] 🔥 0.05折 / $0.29 / 1元开 Pro 5TB（前三月 99% OFF）",
        description: "【2026-11-26 真机实测 100% 存活】仅把 Ultra 5x (20TB) 单独改写为 com.google.gemini.2tb.ai.m.3month_ip_99p（立减99%）。美区实测 $0.29/月、印度区 ₹10/月 ($0.11=0.05折)、印尼区 Rp 3,000/月 ($0.18=0.1折)、新加坡区 S$0.48/月！操作：进升级页点 Ultra 5x (20TB)，到手 Google AI Pro 5TB。",
        replaceAll: true,
        rules: [
          { match: "exact", from: "g1.ios.20tb.m.v2", to: "com.google.gemini.2tb.ai.m.3month_ip_99p", enabled: true }
        ]
      },
      {
        id: "pro-1yuan-from-2tb",
        title: "✅ [存活·备选入口] 🔥 0.05折 / $0.29 / 1元开 Pro 5TB（改 2TB AI 月付槽位）",
        description: "【2026-11-26 真机实测存活】仅把 Pro 月付 (g1.ios.2tb.ai.m) 单独改写为 com.google.gemini.2tb.ai.m.3month_ip_99p，不改年付避免同 ID 冲突。操作：进升级页选「按月」点 Pro 5TB。",
        replaceAll: true,
        rules: [
          { match: "exact", from: "g1.ios.2tb.ai.m", to: "com.google.gemini.2tb.ai.m.3month_ip_99p", enabled: true }
        ]
      },
      {
        id: "tr-ultra-legacy",
        title: "✅ [存活·土区真Ultra唯一低价] 🇹🇷 土区 Ultra 30TB (20x) & 20TB 老定价直购",
        description: "【2026-11-26 真机实测 100% 存活】剥离 .v2 与 .ai.pro 后缀，调用 Apple Store 未涨价老 SKU：土区 30TB 仅 ₺2,949.99/月（约¥585/月，3折），20TB 仅 ₺1,989.99/月（约¥395/月，4.1折）。（需土区 Apple ID，美区 ID 弹窗显示美区原价）",
        replaceAll: true,
        rules: [
          { match: "exact", from: "g1.ios.30tb.ai.pro.m", to: "g1.ios.30tb.m", enabled: true },
          { match: "exact", from: "g1.ios.20tb.m.v2", to: "g1.ios.20tb.m", enabled: true }
        ]
      },
      {
        id: "pro-12months-90p",
        title: "⚠️ [可弹窗但促销已停·回退原价] <s>2TB / Pro 5TB · 全年 12个月 1折 (90p)</s>",
        description: "【2026-11-26 实测：商品 ID 仍存在可弹窗，但 Apple Store 后台已关闭 $1.99 首年 1 折属性，弹窗显示原价 $19.99/月】仅把 g1.ios.2tb.ai.m 改写为 g1.2tb.ai.12months_ip_90p。",
        replaceAll: true,
        rules: [
          { match: "exact", from: "g1.ios.2tb.ai.m", to: "g1.2tb.ai.12months_ip_90p", enabled: true }
        ]
      },
      {
        id: "ultra-75p",
        title: "❌ [已拉闸下架] <s>真 Ultra 20TB / 30TB · 三个月 2.5折 (75p)</s>",
        description: "【2026-11-26 实测已拉闸：点击提示「购买交易未完成」】原 g1.20tb.3months_ip_75p.acq 与 g1.ai.ultra.3months_ip_75p.acq 已从 iOS App Store 下架，仅留档备查。",
        replaceAll: true,
        rules: [
          { match: "exact", from: "g1.ios.20tb.m.v2", to: "g1.20tb.3months_ip_75p.acq", enabled: true },
          { match: "exact", from: "g1.ios.30tb.ai.pro.m", to: "g1.ai.ultra.3months_ip_75p.acq", enabled: true }
        ]
      },
      {
        id: "ultra-1m-free",
        title: "❌ [已拉闸下架] <s>真 Ultra 20TB / 30TB · 1个月 $0 免费试用</s>",
        description: "【2026-11-26 实测已拉闸：点击提示「购买交易未完成」】原 g1.20tb.1month_eft.acq 与 g1.ai.ultra.1month_eft.acq 在 iOS 端已不可用，仅留档备查。",
        replaceAll: true,
        rules: [
          { match: "exact", from: "g1.ios.20tb.m.v2", to: "g1.20tb.1month_eft.acq", enabled: true },
          { match: "exact", from: "g1.ios.30tb.ai.pro.m", to: "g1.ai.ultra.1month_eft.acq", enabled: true }
        ]
      },
      {
        id: "probe-batch-3-ultra-gemini",
        title: "🕵️ 10槽位批量探测包 C（真 Ultra 20TB/30TB · com.google.gemini.* 99p/90p/免费家族）",
        description: "专测真 Ultra (20TB / 30TB) 在 com.google.gemini.* 命名空间下是否存在 0.1折(99p)、1折(90p) 或 1~3个月 $0 免费试用隐藏档！把 10 个候选 Ultra 编号分别塞进页面 10 个按钮，应用后挨个点「按月/包年」所有按钮看哪个能弹出 Apple 付款框！",
        replaceAll: true,
        rules: [
          { match: "exact", from: "g1.ios.20tb.m.v2", to: "com.google.gemini.20tb.m.3month_ip_99p", enabled: true },
          { match: "exact", from: "g1.ios.30tb.ai.pro.m", to: "com.google.gemini.30tb.ai.pro.m.3month_ip_99p", enabled: true },
          { match: "exact", from: "g1.ios.2tb.ai.m", to: "com.google.gemini.20tb.ai.m.3month_ip_99p", enabled: true },
          { match: "exact", from: "g1.ios.2tb.ai.a", to: "com.google.gemini.30tb.ai.m.3month_ip_99p", enabled: true },
          { match: "exact", from: "g1.ios.2tb.m", to: "com.google.gemini.ai.ultra.m.3month_ip_99p", enabled: true },
          { match: "exact", from: "g1.ios.2tb.a", to: "com.google.gemini.20tb.m.1month_eft", enabled: true },
          { match: "exact", from: "g1.ios.helium.m", to: "com.google.gemini.30tb.ai.pro.m.1month_eft", enabled: true },
          { match: "exact", from: "g1.ios.helium.a", to: "com.google.gemini.20tb.m.3month_ip_90p", enabled: true },
          { match: "exact", from: "g1.ios.100gb.m", to: "com.google.gemini.30tb.ai.pro.m.3month_ip_90p", enabled: true },
          { match: "exact", from: "g1.ios.100gb.a", to: "com.google.gemini.ai.ultra.m.1month_eft", enabled: true }
        ]
      },
      {
        id: "probe-batch-4-ultra-g1",
        title: "🕵️ 10槽位批量探测包 D（真 Ultra 20TB/30TB · g1.* & g1.ios.* 免费/折扣家族）",
        description: "专测真 Ultra (20TB / 30TB) 在 g1.* 与 g1.ios.* 命名空间下的 10 个候选优惠档（含 1month_eft.acq、3months_ip_75p.acq、3months_ip_80p、g1.ios.20tb.m、g1.ios.30tb.m 等）。应用后挨个点页面上 10 个按钮看哪个能弹出真 Ultra 低价收银台！",
        replaceAll: true,
        rules: [
          { match: "exact", from: "g1.ios.20tb.m.v2", to: "g1.20tb.1month_eft.acq", enabled: true },
          { match: "exact", from: "g1.ios.30tb.ai.pro.m", to: "g1.ai.ultra.1month_eft.acq", enabled: true },
          { match: "exact", from: "g1.ios.2tb.ai.m", to: "g1.20tb.3months_ip_75p.acq", enabled: true },
          { match: "exact", from: "g1.ios.2tb.ai.a", to: "g1.ai.ultra.3months_ip_75p.acq", enabled: true },
          { match: "exact", from: "g1.ios.2tb.m", to: "g1.20tb.3months_ip_80p", enabled: true },
          { match: "exact", from: "g1.ios.2tb.a", to: "g1.20tb.3months_ip_90p.acq", enabled: true },
          { match: "exact", from: "g1.ios.helium.m", to: "g1.ai.ultra.3months_ip_90p.acq", enabled: true },
          { match: "exact", from: "g1.ios.helium.a", to: "g1.ios.20tb.m.3month_ip_99p", enabled: true },
          { match: "exact", from: "g1.ios.100gb.m", to: "g1.ios.20tb.m", enabled: true },
          { match: "exact", from: "g1.ios.100gb.a", to: "g1.ios.30tb.m", enabled: true }
        ]
      },
      {
        id: "probe-batch-1-gemini",
        title: "🕵️ 10槽位批量探测包 A（com.google.gemini.* 99p/免费/1折家族）",
        description: "把页面上的 10 个套餐按钮分别替换成 10 个不同的 com.google.gemini.* 候选隐藏 ID！应用后打开升级页，挨个点击「按月/按年」的 100GB/400GB/2TB/Pro/Ultra 按钮：哪个按钮能弹出 Apple 付款框（不报交易未完成），说明该槽位对应的隐藏 ID 在 iOS 真实可购！",
        replaceAll: true,
        rules: [
          { match: "exact", from: "g1.ios.20tb.m.v2", to: "com.google.gemini.2tb.ai.m.3month_ip_99p", enabled: true },
          { match: "exact", from: "g1.ios.30tb.ai.pro.m", to: "com.google.gemini.2tb.ai.m.1month_ip_99p", enabled: true },
          { match: "exact", from: "g1.ios.2tb.ai.m", to: "com.google.gemini.2tb.ai.m.12month_ip_90p", enabled: true },
          { match: "exact", from: "g1.ios.2tb.ai.a", to: "com.google.gemini.2tb.ai.m.1month_eft", enabled: true },
          { match: "exact", from: "g1.ios.2tb.m", to: "com.google.gemini.2tb.ai.m.3month_eft", enabled: true },
          { match: "exact", from: "g1.ios.2tb.a", to: "com.google.gemini.2tb.ai.m.12month_eft", enabled: true },
          { match: "exact", from: "g1.ios.helium.m", to: "com.google.gemini.2tb.ai.m.3month_ip_90p", enabled: true },
          { match: "exact", from: "g1.ios.helium.a", to: "com.google.gemini.2tb.ai.m.3month_ip_75p", enabled: true },
          { match: "exact", from: "g1.ios.100gb.m", to: "com.google.gemini.2tb.ai.m", enabled: true },
          { match: "exact", from: "g1.ios.100gb.a", to: "com.google.gemini.2tb.ai.a", enabled: true }
        ]
      },
      {
        id: "probe-batch-2-g1ios",
        title: "🕵️ 10槽位批量探测包 B（g1.ios.* & com.google.one.* 隐藏促销家族）",
        description: "探测 g1.ios.* 与 com.google.one.* 命名空间下的 99p/90p/免费试用与老定价档（含 g1.ios.2tb.y 年付老档、g1.ios.20tb.m、g1.ios.30tb.m 等 10 个 ID）。同样挨个点页面按钮测试哪个能唤起 Apple 弹窗！",
        replaceAll: true,
        rules: [
          { match: "exact", from: "g1.ios.20tb.m.v2", to: "g1.ios.20tb.m", enabled: true },
          { match: "exact", from: "g1.ios.30tb.ai.pro.m", to: "g1.ios.30tb.m", enabled: true },
          { match: "exact", from: "g1.ios.2tb.ai.m", to: "g1.ios.2tb.ai.m.3month_ip_99p", enabled: true },
          { match: "exact", from: "g1.ios.2tb.ai.a", to: "g1.ios.2tb.ai.m.12month_ip_90p", enabled: true },
          { match: "exact", from: "g1.ios.2tb.m", to: "com.google.one.2tb.ai.m.3month_ip_99p", enabled: true },
          { match: "exact", from: "g1.ios.2tb.a", to: "g1.ios.2tb.y", enabled: true },
          { match: "exact", from: "g1.ios.helium.m", to: "g1.ios.2tb.ai.m.1month_eft", enabled: true },
          { match: "exact", from: "g1.ios.helium.a", to: "g1.ios.2tb.ai.m.3month_eft", enabled: true },
          { match: "exact", from: "g1.ios.100gb.m", to: "g1.2tb.ai.3months_ip_90p.acq", enabled: true },
          { match: "exact", from: "g1.ios.100gb.a", to: "g1.2tb.ai.12months_ip_75p", enabled: true }
        ]
      }
    ];
  }

  function validSku(value) {
    return typeof value === "string" &&
      /^(?:g1\.|com\.google\.(?:one|gemini)\.)[A-Za-z0-9._-]{0,159}[A-Za-z0-9_-]$(?![\s\S])/.test(value);
  }

  function validPrefix(value) {
    return typeof value === "string" &&
      /^(?:g1\.|com\.google\.(?:one|gemini)\.)[A-Za-z0-9._-]{1,159}\.$(?![\s\S])/.test(value);
  }

  function hasFields(value, fields, allowExtra) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return (allowExtra || Object.keys(value).length === fields.length) && fields.every(function (field) {
      return Object.prototype.hasOwnProperty.call(value, field);
    });
  }

  function invalidRules(error) {
    return { ok: false, rules: [], error: error };
  }

  function validateRules(value) {
    if (!Array.isArray(value) || value.length > LIMIT) {
      return invalidRules("映射需要规则列表，最多保存 30 条。");
    }
    var rules = [];
    var ids = Object.create(null);
    var sources = Object.create(null);
    for (var index = 0; index < value.length; index += 1) {
      var rule = value[index];
      if (!hasFields(rule, RULE_FIELDS) || typeof rule.id !== "string" ||
          !/^[a-z][a-z0-9-]{0,39}$(?![\s\S])/.test(rule.id) ||
          (rule.match !== "exact" && rule.match !== "prefix") ||
          !(rule.match === "exact" ? validSku(rule.from) : validPrefix(rule.from)) ||
          !validSku(rule.to) || typeof rule.enabled !== "boolean") {
        return invalidRules("请填写完整 SKU；前缀需以点结尾，目标需为 g1.、com.google.one. 或 com.google.gemini. 编号。");
      }
      if (rule.from === rule.to) return invalidRules("原始 SKU 与目标 SKU 相同，请填写不同的目标。");
      if (ids[rule.id]) return invalidRules("规则标识重复，请刷新管理页后重试。");
      var source = rule.match + ":" + rule.from;
      if (sources[source]) return invalidRules("相同匹配方式的原始 SKU 已存在，请编辑已有规则。");
      ids[rule.id] = true;
      sources[source] = true;
      rules.push({ id: rule.id, match: rule.match, from: rule.from, to: rule.to, enabled: rule.enabled });
    }
    return { ok: true, rules: rules, error: "" };
  }

  function randomHex(length) {
    var value = "";
    for (var index = 0; index < length; index += 1) value += Math.floor(Math.random() * 16).toString(16);
    return value;
  }

  function newId() {
    return "rule-" + randomHex(16);
  }

  function configState(status, revision, updatedAt, customized, rules, error) {
    var target = "";
    rules.some(function (rule) {
      if (rule.enabled && rule.match === "prefix" && rule.from === SOURCE_PREFIX) {
        target = rule.to;
        return true;
      }
      return false;
    });
    return {
      status: status,
      revision: revision,
      updatedAt: updatedAt,
      mode: status === "default" ? "discount75" : status === "custom" ? "custom" : "",
      customized: customized,
      rules: rules,
      target: target,
      targetOrigin: target ? customized ? "user-configured" : "user-specified" : "",
      error: error
    };
  }

  function failedState(status) {
    return configState(status, status, "", false, [], status === "invalid" ? CONFIG_ERROR : READ_ERROR);
  }

  function validTime(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$(?![\s\S])/.test(value) &&
      isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  }

  function read() {
    var raw;
    try {
      if (!store || typeof store.read !== "function") return failedState("unavailable");
      raw = store.read(KEY);
    } catch (error) {
      return failedState("unavailable");
    }
    if (raw === null || typeof raw === "undefined" || raw === "") {
      return configState("default", DEFAULT_REVISION, "", false, defaults(), "");
    }
    try {
      if (typeof raw !== "string") return failedState("invalid");
      var saved = JSON.parse(raw);
      if (!hasFields(saved, RECORD_FIELDS, true) || saved.schemaVersion !== 1 ||
          typeof saved.revision !== "string" || !/^[a-f0-9]{48}$(?![\s\S])/.test(saved.revision) ||
          !validTime(saved.updatedAt) || typeof saved.customized !== "boolean") {
        return failedState("invalid");
      }
      var checked = validateRules(saved.rules);
      if (!checked.ok || (!saved.customized && checked.rules.length !== 0)) return failedState("invalid");
      return configState(saved.customized ? "custom" : "default", saved.revision, saved.updatedAt,
        saved.customized, saved.customized ? checked.rules : defaults(), "");
    } catch (error) {
      return failedState("invalid");
    }
  }

  function saveResult(status, error, config) {
    return { ok: status === 200, status: status, error: error, config: config };
  }

  function save(expectedRevision, rules, restore) {
    var current = read();
    if (current.status === "unavailable") return saveResult(503, READ_ERROR, current);
    if (typeof expectedRevision !== "string" || expectedRevision !== current.revision) {
      return saveResult(409, REVISION_ERROR, current);
    }
    if (current.status === "invalid" && restore !== true) return saveResult(400, CONFIG_ERROR, current);
    var checked = restore === true ? { ok: true, rules: [] } : validateRules(rules);
    if (!checked.ok) return saveResult(400, checked.error, current);
    try {
      if (!store || typeof store.write !== "function") return saveResult(503, WRITE_ERROR, current);
    } catch (error) {
      return saveResult(503, WRITE_ERROR, current);
    }

    var revision = randomHex(48);
    if (revision === current.revision) {
      revision = revision.slice(0, 47) + ((parseInt(revision.charAt(47), 16) + 1) % 16).toString(16);
    }
    var saved = {
      schemaVersion: 1,
      revision: revision,
      updatedAt: new Date().toISOString(),
      customized: restore !== true,
      rules: checked.rules
    };
    var written = false;
    try {
      written = store.write(JSON.stringify(saved), KEY);
    } catch (error) {
      written = false;
    }
    var verified = read();
    var expectedRules = saved.customized ? saved.rules : defaults();
    if (!written || verified.status !== (saved.customized ? "custom" : "default") ||
        verified.revision !== saved.revision || verified.updatedAt !== saved.updatedAt ||
        verified.customized !== saved.customized || JSON.stringify(verified.rules) !== JSON.stringify(expectedRules)) {
      return saveResult(503, WRITE_ERROR, verified);
    }
    return saveResult(200, "", verified);
  }

  function applyPreset(expectedRevision, presetId) {
    var current = read();
    if (current.status === "unavailable") return saveResult(503, READ_ERROR, current);
    if (typeof expectedRevision !== "string" || expectedRevision !== current.revision) {
      return saveResult(409, REVISION_ERROR, current);
    }
    if (current.status === "invalid") return saveResult(400, CONFIG_ERROR, current);

    var selected = null;
    presets().some(function (preset) {
      if (preset.id !== presetId) return false;
      selected = preset;
      return true;
    });
    if (!selected) return saveResult(400, "映射模板不存在，请刷新管理页后重试。", current);

    var rules = selected.replaceAll ? [] : current.rules.slice();
    var ids = Object.create(null);
    var positions = Object.create(null);
    rules.forEach(function (rule, index) {
      ids[rule.id] = true;
      positions[rule.match + ":" + rule.from] = index;
    });
    selected.rules.forEach(function (rule) {
      var source = rule.match + ":" + rule.from;
      var position = positions[source];
      var id;
      if (typeof position === "number") {
        id = rules[position].id;
      } else {
        var base = newId();
        id = base;
        for (var suffix = 1; suffix <= rules.length && ids[id]; suffix += 1) id = base + "-" + suffix;
        ids[id] = true;
        position = rules.length;
        positions[source] = position;
      }
      rules[position] = { id: id, match: rule.match, from: rule.from, to: rule.to, enabled: true };
    });

    var checked = validateRules(rules);
    if (!checked.ok) return saveResult(400, checked.error, current);
    return save(expectedRevision, checked.rules, false);
  }

  function resolve(id, state) {
    if (!validSku(id) || !state || (state.status !== "default" && state.status !== "custom") ||
        !Array.isArray(state.rules)) return null;
    var selected = null;
    for (var index = 0; index < state.rules.length; index += 1) {
      var rule = state.rules[index];
      if (!rule.enabled) continue;
      if (rule.match === "exact" && rule.from === id) return rule;
      if (rule.match === "prefix" && id.length > rule.from.length && id.indexOf(rule.from) === 0 &&
          (!selected || rule.from.length > selected.from.length)) selected = rule;
    }
    return selected;
  }

  return {
    key: KEY,
    limit: LIMIT,
    defaults: defaults,
    presets: presets,
    validSku: validSku,
    validateRules: validateRules,
    newId: newId,
    read: read,
    save: save,
    applyPreset: applyPreset,
    resolve: resolve
  };
}

(function () {
  var VERSION = "g1-acq-v9.6-mappings";
  var SOURCE_PREFIX = "g1.ios.2tb.";
  var TEST_KEY = "g1_acq_last_test";
  var SCAN_KEY = "g1_acq_sku_scan";
  var DEBUG_KEY = "g1_acq_debug_log";
  var DEBUG_LIMIT = 25;
  var SCAN_LIMIT = 300;
  var RECENT_LIMIT = 10;
  var MAX_EVENT_COUNT = 9007199254740991;
  var url = typeof $request === "object" && $request ? $request.url : "";

  if (typeof url !== "string" || !/^https:\/\/one\.google\.com\//.test(url) ||
      /^https:\/\/one\.google\.com\/g1-sku-report\/?(?:\?|$)/.test(url)) {
    $done({});
    return;
  }

  var mappingEngine = createG1MappingConfig(typeof QXStore === "undefined" ? null : QXStore);
  var mappingConfig = mappingEngine.read();
  var MODE = mappingConfig.mode;
  var configError = mappingConfig.status === "invalid" || mappingConfig.status === "unavailable";
  console.log("[g1-acq] " + VERSION + " mappingStatus=" + mappingConfig.status +
    " mappingRevision=" + mappingConfig.revision + " mode=" + MODE);

  var body = typeof $response === "object" && $response ? $response.body : undefined;
  var foundSkusInThisResp = [];
  try {
    foundSkusInThisResp = collectOriginalSkus(body) || [];
  } catch (error) {
    console.log("[g1-acq] SKU collection unavailable");
  }

  // Only rewrite on /ai? (or /plans /subscribe) so batchexecute RPCs don't overwrite the last mapping execution summary with 0 hits!
  var isTargetEndpoint = /^https:\/\/one\.google\.com\/(?:u\/\d+\/)?(?:ai|plans|subscribe|upsell|about\/plans)(?:[/?#]|$)/.test(url);

  var mappings = Object.create(null);
  var hits = 0;
  var annualHits = 0;
  var out = body;

  if (isTargetEndpoint && typeof body === "string" && !configError) {
    // Use strict token boundary (excluding backslash!) so trailing \" in WIZ_global_data JSON is NEVER swallowed!
    out = body.replace(
      /(^|[^A-Za-z0-9._@%-])((?:g1\.|com\.google\.(?:one|gemini)\.)[A-Za-z0-9._-]+)(?=$|[^A-Za-z0-9._-])/g,
      function (match, before, id) {
        var rule = mappingEngine.resolve(id, mappingConfig);
        if (!rule) return match;
        var isAnnual = id.indexOf(SOURCE_PREFIX) === 0 && id.length > SOURCE_PREFIX.length;
        if (!mappings[id]) mappings[id] = { id: id, to: rule.to, count: 0, fallback: false };
        mappings[id].count += 1;
        hits += 1;
        if (isAnnual) annualHits += 1;
        return before + rule.to;
      }
    );
  }

  var sources = Object.keys(mappings).sort().map(function (id) {
    return mappings[id];
  });

  // Always save live debug log entry for every one.google.com response
  try {
    saveDebugLog(url, body, isTargetEndpoint, foundSkusInThisResp, sources, hits, mappingConfig);
  } catch (e) {}

  if (!isTargetEndpoint) {
    $done({});
    return;
  }
  var record = {
    schemaVersion: 1,
    version: VERSION,
    mode: MODE,
    updatedAt: new Date().toISOString(),
    mappingRevision: mappingConfig.revision,
    mappingUpdatedAt: mappingConfig.updatedAt,
    mappingStatus: mappingConfig.status,
    sourcePrefix: SOURCE_PREFIX,
    target: mappingConfig.target,
    targetOrigin: mappingConfig.targetOrigin,
    hitCount: hits,
    annualHitCount: annualHits,
    matchedFrom: sources,
    status: configError ? "config-error" : typeof body !== "string" ? "non-text" : hits ? "rewritten" : "no-match"
  };

  try {
    if (typeof QXStore !== "undefined" &&
        typeof QXStore.write === "function") {
      if (!QXStore.write(JSON.stringify(record), TEST_KEY)) {
        console.log("[g1-acq] local record write failed");
      }
    }
  } catch (error) {
    console.log("[g1-acq] local record unavailable");
  }

  console.log("[g1-acq] " + VERSION + " hits=" + hits + " annualHits=" + annualHits + " mode=" + MODE);
  sources.forEach(function (source) {
    console.log("[g1-acq] " + source.id + " -> " + source.to + " x" + source.count);
  });
  $done(hits ? { body: out } : {});

  function collectOriginalSkus(originalBody) {
    var now = new Date().toISOString();
    var saved = {};
    try {
      if (typeof QXStore !== "undefined" && typeof QXStore.read === "function") {
        saved = JSON.parse(QXStore.read(SCAN_KEY) || "{}");
      }
    } catch (error) {
      saved = {};
    }
    if (!saved || saved.schemaVersion !== 1) saved = {};

    var byId = Object.create(null);
    var ids = [];
    var validId = /^(?:g1\.|com\.google\.(?:one|gemini)\.)[A-Za-z0-9._-]{1,160}$/;
    var oldRows = Array.isArray(saved.skus) ? saved.skus : [];
    oldRows.slice(0, SCAN_LIMIT).forEach(function (row) {
      if (!row || typeof row.id !== "string" || !validId.test(row.id) || byId[row.id]) return;
      var count = Number(row.count);
      byId[row.id] = {
        id: row.id,
        count: isFinite(count) && count > 0 ? Math.floor(count) : 0,
        lastSeen: typeof row.lastSeen === "string" ? row.lastSeen.slice(0, 32) : ""
      };
      ids.push(row.id);
    });

    var isText = typeof originalBody === "string";
    var found = Object.create(null);
    var hitCount = 0;
    var addedCount = 0;
    var omittedCount = 0;
    var truncated = saved.truncated === true;
    if (isText) {
      var text = originalBody.replace(/\\u002e|\\x2e|&#0*46;|&#x0*2e;|&period;/gi, ".");
      var token = /(^|[^A-Za-z0-9._@%-])((?:g1\.|com\.google\.(?:one|gemini)\.)[A-Za-z0-9._-]+)(?=$|[^A-Za-z0-9._-])/g;
      var match;
      while ((match = token.exec(text)) !== null) {
        var id = match[2];
        if (!validId.test(id)) continue;
        found[id] = (found[id] || 0) + 1;
        hitCount += 1;
        if (!byId[id]) {
          if (ids.length >= SCAN_LIMIT) {
            truncated = true;
            if (found[id] === 1) omittedCount += 1;
            continue;
          }
          byId[id] = { id: id, count: 0, lastSeen: now };
          ids.push(id);
          addedCount += 1;
        }
        byId[id].count += 1;
        byId[id].lastSeen = now;
      }
    }

    var candidateCount = Object.keys(found).length;
    var bodyType = isText ? "text" : "non-text";
    var status = responseStatus(bodyType, candidateCount, addedCount, omittedCount);
    var recentResponses = [];
    var oldResponses = Array.isArray(saved.recentResponses) ? saved.recentResponses : [];
    oldResponses.slice(-RECENT_LIMIT).forEach(function (row) {
      var event = priorResponse(row);
      if (event) recentResponses.push(event);
    });
    recentResponses.push({
      at: now,
      path: safeRoute(url),
      bodyType: bodyType,
      status: status,
      candidateCount: candidateCount,
      addedCount: addedCount,
      omittedCount: omittedCount
    });

    function priorCount(value) {
      var number = Number(value);
      return isFinite(number) && number > 0 ? Math.floor(number) : 0;
    }
    var state = {
      schemaVersion: 1,
      version: VERSION,
      mode: MODE,
      updatedAt: now,
      scannedResponses: priorCount(saved.scannedResponses) + (isText ? 1 : 0),
      matchedResponses: priorCount(saved.matchedResponses) + (hitCount > 0 ? 1 : 0),
      nonTextResponses: priorCount(saved.nonTextResponses) + (isText ? 0 : 1),
      recentResponses: recentResponses.slice(-RECENT_LIMIT),
      limit: SCAN_LIMIT,
      truncated: truncated,
      skus: ids.sort().map(function (id) { return byId[id]; })
    };
    var stored = false;
    try {
      if (typeof QXStore !== "undefined" && typeof QXStore.write === "function") {
        stored = QXStore.write(JSON.stringify(state), SCAN_KEY);
      }
    } catch (error) {
      stored = false;
    }

    console.log("[g1-acq] " + VERSION + " status=" + status + " addedCount=" + addedCount +
      " candidates=" + candidateCount + " omittedCount=" + omittedCount +
      " occurrences=" + hitCount + " saved=" + (stored ? "yes" : "no") + " mode=" + MODE);
    return Object.keys(found).sort().map(function (k) { return k + " (x" + found[k] + ")"; });
  }

  function saveDebugLog(reqUrl, respBody, isTarget, skusFound, rewSources, rewHits, cfg) {
    if (typeof QXStore === "undefined" || typeof QXStore.read !== "function") return;
    var logs = [];
    try {
      var parsed = JSON.parse(QXStore.read(DEBUG_KEY) || "[]");
      if (Array.isArray(parsed)) logs = parsed;
    } catch (e) { logs = []; }
    var statusCode = (typeof $response === "object" && $response && $response.statusCode) ? $response.status : 200;
    var ctype = "";
    try {
      if ($response && $response.headers) {
        var hkeys = Object.keys($response.headers);
        for (var i = 0; i < hkeys.length; i++) {
          if (hkeys[i].toLowerCase() === "content-type") { ctype = String($response.headers[hkeys[i]]); break; }
        }
      }
    } catch (e) {}
    var rpcMatch = /[?&]rpcids=([^&#]+)/.exec(reqUrl);
    var shortUrl = reqUrl.replace(/^https:\/\/one\.google\.com/, "");
    var isJsError = /^\/_\/[^?#]+\/jserror(?:\?|$)/.test(shortUrl);
    if (!isJsError && shortUrl.length > 220) shortUrl = shortUrl.slice(0, 220) + "...";
    var snippet = "";
    var country = "";
    var currency = "";
    if (isJsError) {
      try {
        snippet = "[JSERROR URL] " + decodeURIComponent(shortUrl);
        if ($request && typeof $request.body === "string" && $request.body) {
          snippet += " | [REQ BODY] " + decodeURIComponent($request.body).slice(0, 300);
        }
      } catch (e) {
        snippet = "[JSERROR] " + shortUrl;
      }
    } else if (typeof respBody === "string") {
      var cMatch = /\\?"([A-Z]{2,3})\\?",\[\[\\?"g1\.ios\./.exec(respBody) || /\[\[null,null,\\?"([A-Z]{2,3})\\?"/.exec(respBody);
      if (cMatch) country = cMatch[1];
      var curMatch = /\[\[\\?"g1\.ios\.[^"]+\\?"[^\]]*\],\[\\?"([A-Z]{3})\\?"/.exec(respBody);
      if (curMatch) currency = curMatch[1];
      var skuIdx = respBody.search(/g1\.|com\.google\.(?:one|gemini)\./);
      if (skuIdx >= 0) {
        snippet = respBody.slice(Math.max(0, skuIdx - 40), Math.min(respBody.length, skuIdx + 200));
      } else {
        snippet = respBody.slice(0, 180);
      }
      snippet = snippet.replace(/\s+/g, " ");
    }
    logs.push({
      at: new Date().toISOString(),
      method: (typeof $request === "object" && $request && $request.method) ? String($request.method) : "GET",
      status: statusCode,
      url: shortUrl,
      rpcids: rpcMatch ? decodeURIComponent(rpcMatch[1]) : "",
      country: country,
      currency: currency,
      contentType: ctype.slice(0, 60),
      bodyLen: typeof respBody === "string" ? respBody.length : -1,
      isTargetEndpoint: !!isTarget,
      foundSkus: skusFound.slice(0, 20),
      rewritten: rewSources.map(function (s) { return s.id + " -> " + s.to + " (x" + s.count + ")"; }),
      hitCount: rewHits,
      activeRulesCount: (cfg && Array.isArray(cfg.rules)) ? cfg.rules.filter(function (r) { return r.enabled; }).length : 0,
      snippet: snippet
    });
    if (logs.length > DEBUG_LIMIT) logs = logs.slice(-DEBUG_LIMIT);
    QXStore.write(JSON.stringify(logs), DEBUG_KEY);
  }

  function safeRoute(requestUrl) {
    var path = requestUrl.replace(/^https:\/\/one\.google\.com/, "").split(/[?#]/)[0];
    path = path.replace(/\/+$/, "") || "/";
    if (path === "/" || path === "/ai" || path === "/plans") return path;
    if (/^\/_\/[^?#]+\/data\/batchexecute$/.test(path)) return "/_/…/data/batchexecute";
    return "[其他 one.google.com 路径]";
  }

  function responseStatus(bodyType, candidateCount, addedCount, omittedCount) {
    if (bodyType === "non-text") return "non-text";
    if (addedCount > 0) return "new-skus";
    if (omittedCount > 0) return "limit-reached";
    return candidateCount > 0 ? "known-skus" : "no-skus";
  }

  function priorResponse(row) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    if (typeof row.at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.at) ||
        !isFinite(Date.parse(row.at)) || new Date(row.at).toISOString() !== row.at) return null;
    if (row.path !== "/" && row.path !== "/ai" && row.path !== "/plans" &&
        row.path !== "/_/…/data/batchexecute" && row.path !== "[其他 one.google.com 路径]") return null;
    if (row.bodyType !== "text" && row.bodyType !== "non-text") return null;

    function counter(value, maximum) {
      if (typeof value !== "number" || !isFinite(value)) return null;
      return Math.max(0, Math.min(maximum, Math.floor(value)));
    }
    var candidateCount = counter(row.candidateCount, MAX_EVENT_COUNT);
    if (candidateCount === null) return null;
    var addedCount = counter(row.addedCount, Math.min(SCAN_LIMIT, candidateCount));
    if (addedCount === null) return null;
    var omittedCount = counter(row.omittedCount, candidateCount - addedCount);
    if (omittedCount === null) return null;
    if (row.bodyType === "non-text" && (candidateCount || addedCount || omittedCount)) return null;
    if (row.status !== responseStatus(row.bodyType, candidateCount, addedCount, omittedCount)) return null;
    return {
      at: row.at,
      path: row.path,
      bodyType: row.bodyType,
      status: row.status,
      candidateCount: candidateCount,
      addedCount: addedCount,
      omittedCount: omittedCount
    };
  }
})();

