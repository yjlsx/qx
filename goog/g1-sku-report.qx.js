/* Local-only report served by a Shadowrocket http-request script. */
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

(function () {
  var ROOT = "https://one.google.com/g1-sku-report";
  var VERSION = "v9.6.0";
  var COLLECTOR_VERSION = "g1-acq-v9.6-mappings";
  var DEBUG_KEY = "g1_acq_debug_log";
  var MODE_NAMES = {
    discount75: "Ultra 三个月 75p（2.5折）",
    custom: "手动映射",
    trial: "Ultra 1个月免费试用优先（历史模式）",
    discount: "Ultra 三个月一折优先（历史模式）"
  };
  var DEFAULT_TARGET = "g1.2tb.ai.12months_ip_90p";
  var LEGACY_TARGET = "g1.2tb.ai.annual";
  var SCAN_KEY = "g1_acq_sku_scan";
  var TEST_KEY = "g1_acq_last_test";

  // BEGIN GENERATED MAPPING CONFIG
/* Shared local mapping configuration for the runtime and report controller. */
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
// END GENERATED MAPPING CONFIG

  var url = typeof $request === "object" && $request ? $request.url : "";
  if (typeof url !== "string" || !/^https:\/\/one\.google\.com\/g1-sku-report\/?(?:\?|$)/.test(url)) {
    $done({});
    return;
  }
  var headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-G1-Report-Version": VERSION,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action " + ROOT
  };
  var method = typeof $request.method === "undefined" ? "GET" : String($request.method).toUpperCase();
  if (method !== "GET" && method !== "POST") {
    headers.Allow = "GET, POST";
    problem(405, "映射修改请使用本页的保存、删除或恢复默认按钮。");
    return;
  }
  var exportJSON = method === "GET" && /(?:\?|&)format=json(?:&|$)/.test(url);
  var exportTXT = method === "GET" && /(?:\?|&)format=txt(?:&|$)/.test(url);
  var storage = typeof QXStore !== "undefined" ? QXStore : null;
  var storageAvailable = !!(storage && typeof storage.read === "function");
  var engine = createG1MappingConfig(storage);
  var config = engine.read();
  var presetCatalog = engine.presets();
  var responseStatus = 200;
  var actionError = "";
  var formDraft = null;
  var clearMessage = "";

  var hasGetAction = method === "GET" && query("action") !== null;
  if (method === "POST" || hasGetAction) {
    var body = "";
    if (method === "POST" && typeof $request.body === "string" && $request.body.length > 0) {
      body = $request.body;
    } else if (url.indexOf("?") >= 0) {
      body = url.slice(url.indexOf("?") + 1).split("#")[0];
    }
    if (typeof body !== "string" || !body) {
      problem(400, "没有收到表单数据；请在小火箭模块页左滑更新模块并重新打开管理页。");
      return;
    }
    try {
      if (body.length > 20000 || encodeURIComponent(body).replace(/%[0-9A-F]{2}/g, "x").length > 20000) {
        problem(413, "本次表单超过 20KB，请分条保存映射。");
        return;
      }
    } catch (error) {
      problem(400, "表单编码异常，请重新填写后提交。");
      return;
    }
    var parsed = parseForm(body);
    if (!parsed.ok) {
      problem(400, parsed.error);
      return;
    }
    var fields = parsed.fields;
    if (fields.action !== "upsert" && fields.action !== "delete" && fields.action !== "reset" && fields.action !== "preset") {
      problem(400, "表单操作未识别，请重新打开管理页。");
      return;
    }
    if (fields.action === "preset" ? Object.keys(fields).length !== 3 ||
        !Object.prototype.hasOwnProperty.call(fields, "revision") ||
        !Object.prototype.hasOwnProperty.call(fields, "preset") :
        Object.prototype.hasOwnProperty.call(fields, "preset")) {
      problem(400, "模板表单字段未识别，请重新打开管理页。");
      return;
    }
    var result = changeMapping(fields);
    if (result.ok) {
      headers.Location = ROOT + "?notice=" + (fields.action === "preset" ? "preset" :
        fields.action === "reset" ? "reset" : fields.action === "delete" ? "deleted" : "saved");
      $done({ status: 303, headers: headers, body: "" });
      return;
    }
    responseStatus = result.status;
    actionError = result.error;
    config = engine.read();
    if (responseStatus === 409) formDraft = null;
  } else if (!exportJSON && /(?:\?|&)clear=1(?:&|$)/.test(url)) {
    try {
      var scanCleared = storage.write("{}", SCAN_KEY);
      var testCleared = storage.write("{}", TEST_KEY);
      var debugCleared = storage.write("[]", DEBUG_KEY);
      clearMessage = scanCleared && testCleared && debugCleared ? "本工具的采集、测试与调试日志记录已清空，映射配置保持原样。" : "本地记录清空未完成。";
    } catch (error) {
      clearMessage = "本地存储接口暂未就绪。";
    }
  }

  function query(name) {
    var pieces = url.indexOf("?") < 0 ? [] : url.slice(url.indexOf("?") + 1).split("#")[0].split("&");
    for (var i = 0; i < pieces.length; i++) {
      var at = pieces[i].indexOf("=");
      try {
        if (decodeURIComponent((at < 0 ? pieces[i] : pieces[i].slice(0, at)).replace(/\+/g, " ")) === name) {
          return decodeURIComponent((at < 0 ? "" : pieces[i].slice(at + 1)).replace(/\+/g, " "));
        }
      } catch (error) { return null; }
    }
    return null;
  }
  function requestHeader(name) {
    var source = $request.headers;
    if (!source || typeof source !== "object") return undefined;
    var names = Object.keys(source).filter(function (key) { return key.toLowerCase() === name; });
    if (!names.length) return undefined;
    return names.length === 1 && typeof source[names[0]] === "string" ? source[names[0]] : null;
  }
  function problem(code, message) {
    headers["Content-Type"] = "application/json; charset=utf-8";
    $done({ status: code, headers: headers, body: JSON.stringify({ error: message }) });
  }
  function parseForm(value) {
    var out = Object.create(null);
    var allowed = ["action", "revision", "id", "match", "from", "to", "enabled", "preset"];
    var parts = value.split("&");
    for (var i = 0; i < parts.length; i++) {
      var at = parts[i].indexOf("=");
      var key;
      var val;
      try {
        key = decodeURIComponent((at < 0 ? parts[i] : parts[i].slice(0, at)).replace(/\+/g, " "));
        val = decodeURIComponent((at < 0 ? "" : parts[i].slice(at + 1)).replace(/\+/g, " "));
      } catch (error) { return { ok: false, error: "表单编码异常，请重新填写后提交。" }; }
      if (allowed.indexOf(key) === -1 || Object.prototype.hasOwnProperty.call(out, key)) {
        return { ok: false, error: "表单字段重复或未识别，请重新打开管理页。" };
      }
      out[key] = val;
    }
    return { ok: true, fields: out };
  }
  function changeMapping(fields) {
    if (fields.action === "preset") return engine.applyPreset(fields.revision, fields.preset);
    if (fields.revision !== config.revision) {
      return { ok: false, status: 409, error: "配置已变化，本次未保存；页面已载入最新规则，请重新编辑。" };
    }
    if (fields.action === "reset") return engine.save(fields.revision, [], true);
    if (config.status !== "default" && config.status !== "custom") {
      return { ok: false, status: config.status === "unavailable" ? 503 : 409,
        error: "当前映射配置未就绪，请恢复默认后重新编辑。" };
    }
    var id = fields.id || "";
    var index = -1;
    var rules = config.rules.slice();
    rules.forEach(function (rule, position) { if (rule.id === id) index = position; });
    if (id && index === -1) return { ok: false, status: 400, error: "这条规则已不存在，请刷新页面后重新编辑。" };
    if (fields.action === "delete") {
      if (index === -1) return { ok: false, status: 400, error: "请从已有规则的删除按钮提交。" };
      rules.splice(index, 1);
    } else {
      formDraft = {
        id: id, match: fields.match || "", from: typeof fields.from === "string" ? fields.from.trim() : "",
        to: typeof fields.to === "string" ? fields.to.trim() : "", enabled: fields.enabled === "1"
      };
      if (typeof fields.enabled !== "undefined" && fields.enabled !== "1") {
        return { ok: false, status: 400, error: "启用状态未识别，请重新勾选后保存。" };
      }
      var rule = { id: id || engine.newId(), match: formDraft.match, from: formDraft.from,
        to: formDraft.to, enabled: formDraft.enabled };
      if (index < 0) rules.push(rule); else rules[index] = rule;
    }
    return engine.save(fields.revision, rules, false);
  }

  function load(key) {
    if (!storageAvailable) return {};
    try {
      var value = JSON.parse(QXStore.read(key) || "{}");
      return value && value.schemaVersion === 1 ? value : {};
    } catch (error) {
      return {};
    }
  }
  function text(value, length) {
    return typeof value === "string" ? value.slice(0, length || 180) : "";
  }
  function mode(value) {
    return value === "discount75" || value === "custom" || value === "trial" || value === "discount" ? value : "";
  }
  function modeName(value) {
    return mode(value) ? MODE_NAMES[value] : "未记录";
  }
  function count(value) {
    var number = Number(value);
    return isFinite(number) && number > 0 ? Math.floor(number) : 0;
  }
  function sku(value) {
    return typeof value === "string" && /^(?:g1\.|com\.google\.(?:one|gemini)\.)[A-Za-z0-9._-]{1,160}$/.test(value) ? value : "";
  }
  function rows(value, withTime, defaultTarget) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 300).filter(function (row) {
      return row && typeof row.id === "string" &&
        /^(?:g1\.|com\.google\.(?:one|gemini)\.)[A-Za-z0-9._-]{1,160}$/.test(row.id);
    }).map(function (row) {
      var out = { id: row.id, count: count(row.count) };
      if (withTime) {
        out.lastSeen = text(row.lastSeen, 32);
      } else {
        out.to = sku(row.to) || (row.id.indexOf("g1.ios.2tb.") === 0 ? defaultTarget || "" : "");
        out.fallback = row.fallback === true;
      }
      return out;
    }).sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
  }

  var scanStatuses = {
    "new-skus": "发现并录入新编号",
    "known-skus": "收到响应，编号与已有记录重复",
    "no-skus": "收到文本响应，本次没有商品编号",
    "limit-reached": "收到新编号，已达采集容量上限",
    "non-text": "收到响应，正文不是可扫描文本"
  };
  var scanPaths = ["/", "/ai", "/plans", "/_/…/data/batchexecute", "[其他 one.google.com 路径]"];
  function recent(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(-10).filter(function (event) {
      return event && typeof event.at === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(event.at) &&
        (event.bodyType === "text" || event.bodyType === "non-text") &&
        Object.prototype.hasOwnProperty.call(scanStatuses, event.status);
    }).map(function (event) {
      return {
        at: event.at,
        path: scanPaths.indexOf(event.path) !== -1 ? event.path : "[其他 one.google.com 路径]",
        bodyType: event.bodyType,
        status: event.status,
        candidateCount: count(event.candidateCount),
        addedCount: count(event.addedCount),
        omittedCount: count(event.omittedCount)
      };
    });
  }

  var scanRaw = load(SCAN_KEY);
  var testRaw = load(TEST_KEY);
  var recordedTarget = sku(testRaw.target);
  if (!recordedTarget && /^(?:pro-annual-test-v[12]|g1-acq-v7(?:\.0|\.1)?)$/.test(testRaw.version || "")) {
    recordedTarget = LEGACY_TARGET;
  }
  var matchedFrom = rows(testRaw.matchedFrom, false, recordedTarget);
  if (!recordedTarget && !Object.prototype.hasOwnProperty.call(testRaw, "mappingRevision")) {
    matchedFrom.some(function (row) {
      if (row.id.indexOf("g1.ios.2tb.") === 0 && row.to) {
        recordedTarget = row.to;
        return true;
      }
      return false;
    });
  }
  var annualHitCount = typeof testRaw.annualHitCount === "number" ? count(testRaw.annualHitCount) :
    matchedFrom.reduce(function (total, row) {
      return total + (row.id.indexOf("g1.ios.2tb.") === 0 ? row.count : 0);
    }, 0);
  var storedOrigin = text(testRaw.targetOrigin, 32);
  var targetOrigin = recordedTarget && /^(?:user-specified|user-configured|pattern-derived|legacy)$/.test(storedOrigin) ?
    storedOrigin : recordedTarget === DEFAULT_TARGET ? "user-specified" :
      recordedTarget === LEGACY_TARGET ? "legacy" : "";
  var debugLogs = [];
  if (storageAvailable) {
    try {
      var rawDebug = JSON.parse(QXStore.read(DEBUG_KEY) || "[]");
      if (Array.isArray(rawDebug)) debugLogs = rawDebug.slice(-25);
    } catch (e) { debugLogs = []; }
  }
  var report = {
    schemaVersion: 1,
    reportVersion: VERSION,
    configuredMode: config.mode,
    configuredTarget: config.target,
    storageAvailable: storageAvailable,
    debugLogs: debugLogs,
    mappingConfig: {
      status: config.status, revision: config.revision, updatedAt: config.updatedAt,
      mode: config.mode, customized: config.customized, rules: config.rules,
      target: config.target, targetOrigin: config.targetOrigin, error: config.error, limit: engine.limit
    },
    scan: {
      version: text(scanRaw.version, 32),
      mode: mode(scanRaw.mode),
      updatedAt: text(scanRaw.updatedAt, 32),
      scannedResponses: count(scanRaw.scannedResponses),
      matchedResponses: count(scanRaw.matchedResponses),
      nonTextResponses: count(scanRaw.nonTextResponses),
      recentResponses: recent(scanRaw.recentResponses),
      truncated: scanRaw.truncated === true,
      limit: 300,
      skus: rows(scanRaw.skus, true)
    },
    test: {
      version: text(testRaw.version, 32),
      mode: mode(testRaw.mode),
      updatedAt: text(testRaw.updatedAt, 32),
      mappingRevision: text(testRaw.mappingRevision, 64),
      mappingUpdatedAt: text(testRaw.mappingUpdatedAt, 32),
      mappingStatus: ["default", "custom", "invalid", "unavailable"].indexOf(testRaw.mappingStatus) !== -1 ? testRaw.mappingStatus : "",
      sourcePrefix: "g1.ios.2tb.",
      target: recordedTarget,
      targetOrigin: targetOrigin,
      status: text(testRaw.status, 32),
      hitCount: count(testRaw.hitCount),
      annualHitCount: annualHitCount,
      matchedFrom: matchedFrom
    }
  };

  console.log("[g1-sku-report] " + VERSION + " " + (exportJSON ? "json" : exportTXT ? "txt" : "html") +
    " storage=" + (storageAvailable ? "ready" : "unavailable") + " candidates=" + report.scan.skus.length);
  if (exportJSON) {
    headers["Content-Type"] = "application/json; charset=utf-8";
    headers["Content-Disposition"] = 'attachment; filename="g1-sku-report.json"';
    $done({ status: 200, headers: headers, body: JSON.stringify(report, null, 2) });
    return;
  }
  if (exportTXT) {
    headers["Content-Type"] = "text/plain; charset=utf-8";
    headers["Content-Disposition"] = 'attachment; filename="g1-debug-log.txt"';
    var txtLines = [
      "====================================================================",
      "G1 ACQ Plus (" + VERSION + ") — iOS 实时抓包与改写调试日志报告",
      "导出时间 (UTC): " + new Date().toISOString(),
      "当前模式: " + modeName(report.configuredMode) + " | 2TB前缀目标: " + (report.configuredTarget || "无"),
      "====================================================================",
      "",
      "【一、当前启用的映射规则】"
    ];
    config.rules.forEach(function (r, idx) {
      txtLines.push((idx + 1) + ". [" + (r.enabled ? "启用" : "停用") + "][" + r.match + "] " + r.from + " -> " + r.to);
    });
    txtLines.push("", "【二、最近一次映射执行汇总】");
    txtLines.push("脚本版本: " + (report.test.version || "暂无") + " | 状态: " + (report.test.status || "暂无") +
      " | 总替换次数: " + report.test.hitCount + " | 2TB替换次数: " + report.test.annualHitCount +
      " | 执行时间: " + (report.test.updatedAt || "暂无"));
    report.test.matchedFrom.forEach(function (m) {
      txtLines.push("  * " + m.id + " -> " + (m.to || "") + " (x" + m.count + ")");
    });
    txtLines.push("", "【三、iOS 实时抓包与改写调试日志 (最近 " + debugLogs.length + " 条，按时间倒序)】");
    debugLogs.slice().reverse().forEach(function (item, idx) {
      txtLines.push("--------------------------------------------------------------------");
      txtLines.push("#" + (idx + 1) + " [" + (item.at || "") + "] HTTP " + (item.status || 200) + " " + (item.method || "GET") + " " + (item.url || ""));
      if (item.rpcids || item.country || item.currency) {
        txtLines.push("   RPC: " + (item.rpcids || "-") + " | 账号国家/地区: " + (item.country || "-") + " | 币种: " + (item.currency || "-"));
      }
      txtLines.push("   正文长度: " + item.bodyLen + " B (" + (item.contentType || "") + ") | 是否改写端点: " + (item.isTargetEndpoint ? "是" : "否"));
      txtLines.push("   发现原始 SKU: " + ((Array.isArray(item.foundSkus) && item.foundSkus.length) ? item.foundSkus.join(", ") : "无"));
      txtLines.push("   实际改写结果: " + ((Array.isArray(item.rewritten) && item.rewritten.length) ? item.rewritten.join(", ") : "0 命中 (启用规则数:" + (item.activeRulesCount || 0) + ")"));
      txtLines.push("   正文切片: " + (item.snippet || ""));
    });
    txtLines.push("", "【四、累计采集到的候选 SKU (" + report.scan.skus.length + " 个)】");
    report.scan.skus.forEach(function (s) {
      txtLines.push("  - " + s.id + " (x" + s.count + ", lastSeen=" + s.lastSeen + ")");
    });
    txtLines.push("", "====================================================================");
    txtLines.push("有问题联系推特：https://x.com/zixunclub");
    txtLines.push("====================================================================");
    $done({ status: 200, headers: headers, body: txtLines.join("\n") });
    return;
  }

  function escape(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }
  function fallbackName(row) {
    if (!row.fallback) return "否";
    var discount = /_ip_(\d+p)\.acq$/.exec(row.to || "");
    return discount ? discount[1] : "是";
  }
  function table(items, withTime) {
    if (!items.length) return "<p>暂无记录。</p>";
    return "<div class=scroll><table><thead><tr><th>完整商品编号</th><th>次数</th>" +
      (withTime ? "<th>最近发现时间（UTC）</th><th>新增映射</th>" : "<th>实际目标 SKU</th><th>备用档</th>") + "</tr></thead><tbody>" +
      items.map(function (row) {
        return "<tr><td><code>" + escape(row.id) + "</code></td><td>" + row.count + "</td>" +
          (withTime ? "<td>" + escape(row.lastSeen) + "</td><td><a href=\"" + ROOT + "?from=" + escape(encodeURIComponent(row.id)) + "#new-mapping\">用作源 SKU</a></td>" :
            "<td><code>" + escape(row.to || "未记录") + "</code></td><td>" + fallbackName(row) + "</td>") + "</tr>";
      }).join("") + "</tbody></table></div>";
  }
  function recentTable(events) {
    if (!events.length) return "<p>尚无逐次响应记录；旧版采集数据没有这项诊断。</p>";
    return "<div class=scroll><table><thead><tr><th>时间（UTC）</th><th>路径分类</th><th>本次结果</th><th>识别编号</th><th>新增录入</th><th>容量外编号</th></tr></thead><tbody>" +
      events.slice().reverse().map(function (event) {
        return "<tr><td>" + escape(event.at) + "</td><td>" + escape(event.path) +
          "</td><td>" + scanStatuses[event.status] + "</td><td>" + event.candidateCount +
          "</td><td>" + event.addedCount + "</td><td>" + event.omittedCount + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }
  function debugLogSection(logs) {
    if (!logs || !logs.length) {
      return "<section id=debug-logs><h2>🛠️ iOS 实时抓包与改写调试日志（最近 25 条）</h2>" +
        "<p class=error>⚠️ 当前尚未捕获到任何 <code>one.google.com</code> 的响应！</p>" +
        "<p class=note><strong>排查清单：</strong><br>1. 请确认小火箭顶部的 VPN 总开关已开启；<br>2. 请确认「配置 → (i) → HTTPS 解密」已开启，且证书已在「系统设置 → 通用 → 关于本机 → 证书信任设置」中勾选完全信任；<br>3. 请从手机后台<strong>彻底划掉 Google App / Google One App</strong>（清除页面缓存），然后重新打开进入升级方案页，再回来刷新本页查看调试日志。</p></section>";
    }
    return "<section id=debug-logs><h2>🛠️ iOS 实时抓包与改写调试日志（最近 " + logs.length + " 条）</h2>" +
      "<p class=note>实时记录每一条经过 <code>one.google.com</code> 的 HTTP 请求、RPC ID、正文长度、提取到的原始 SKU、实际改写结果及响应正文切片（点击导出 TXT / JSON 可一键发给开发者排查）。</p>" +
      "<div class=scroll><table><thead><tr><th>时间 / 状态</th><th>请求路径 &amp; RPC</th><th>发现的原始 SKU</th><th>实际改写结果</th><th>正文切片 / 长度</th></tr></thead><tbody>" +
      logs.slice().reverse().map(function (item) {
        var foundHtml = (Array.isArray(item.foundSkus) && item.foundSkus.length) ?
          item.foundSkus.map(function (s) { return "<code>" + escape(s) + "</code>"; }).join("<br>") : "<span class=note>无 SKU</span>";
        var rewHtml = (Array.isArray(item.rewritten) && item.rewritten.length) ?
          "<strong style=\"color:#176238\">" + item.rewritten.map(function (s) { return "<code>" + escape(s) + "</code>"; }).join("<br>") + "</strong>" :
          (item.isTargetEndpoint ? "<span style=\"color:#9b2420\">0 命中 (规则数:" + (item.activeRulesCount || 0) + ")</span>" : "<span class=note>非改写路径</span>");
        return "<tr><td>" + escape((item.at || "").replace("T", " ").slice(0, 19)) + "<br><span class=badge>HTTP " + escape(item.status || 200) + "</span></td>" +
          "<td><strong>" + escape(item.method || "GET") + "</strong> <code>" + escape(item.url || "") + "</code>" +
          (item.rpcids ? "<br><span class=badge style=\"background:#eef3ff;color:#1259be\">rpcids=" + escape(item.rpcids) + "</span>" : "") +
          ((item.country || item.currency) ? "<br><span class=badge style=\"background:#fff4e5;color:#9a5b13\">地区=" + escape(item.country || "?") + " / 币种=" + escape(item.currency || "?") + "</span>" : "") + "</td>" +
          "<td>" + foundHtml + "</td><td>" + rewHtml + "</td>" +
          "<td><span class=note>长度: " + escape(item.bodyLen) + " B (" + escape(item.contentType || "") + ")</span><br><code style=\"font-size:12px;color:#46556b\">" + escape(item.snippet || "") + "</code></td></tr>";
      }).join("") + "</tbody></table></div></section>";
  }
  function iosCampaignTrapper() {
    var links = [
      { name: "1. Gemini 反向免卡试用横幅", url: "https://one.google.com/ai?utm_source=g1&utm_medium=ios&utm_campaign=G1_GEMINI_REVERSE_TRIAL_UPSELL_BANNER&g1_landing_page=75&hl=zh_CN" },
      { name: "2. Gemini Pro 99% OFF (0.1折) 活动", url: "https://one.google.com/ai?utm_source=gemini&utm_medium=ios&utm_campaign=GEMINI_PRO_99P_PROMO&g1_landing_page=75&hl=zh_CN" },
      { name: "3. 相册老用户召回特惠 (Photos Winback)", url: "https://one.google.com/ai?utm_source=photos&utm_medium=ios&utm_campaign=PHOTOS_WINBACK_PROMO&g1_landing_page=6&hl=zh_CN" },
      { name: "4. 云端硬盘召回特惠 (Drive Winback)", url: "https://one.google.com/ai?utm_source=drive&utm_medium=ios&utm_campaign=DRIVE_WINBACK_PROMO&g1_landing_page=5&hl=zh_CN" },
      { name: "5. Gemini Advanced 专属升级通道", url: "https://one.google.com/ai?utm_source=gemini&utm_medium=ios&utm_campaign=GEMINI_ADVANCED_UPSELL&g1_landing_page=65&hl=zh_CN" },
      { name: "6. AI Ultra 5x/20x 推广横幅", url: "https://one.google.com/ai?utm_source=google_one&utm_medium=ios&utm_campaign=G1_AI_ULTRA_PROMO&g1_landing_page=75&hl=zh_CN" },
      { name: "7. 学生 AI Pro 专属促销入口", url: "https://one.google.com/ai?utm_source=g1&utm_medium=ios&utm_campaign=STUDENT_AI_PRO_PROMO&g1_landing_page=75&hl=zh_CN" },
      { name: "8. Google One 动态隐藏方案页 (/plans)", url: "https://one.google.com/plans?utm_source=g1&utm_medium=ios&utm_campaign=G1_DYNAMIC_PLANS_PROMO&g1_landing_page=2" }
    ];
    return "<section id=ios-campaign-trapper><h2>🚀 iOS 隐藏活动链接诱捕器（诱骗服务端吐出隐藏 SKU）</h2>" +
      "<p class=note>保持小火箭开启，在 Safari 点击下方任意一条带特殊 <code>utm_campaign</code> 参数的链接打开 Google One 方案页。若当前 Google 账号命中某条隐藏促销资格，Google 服务端会在响应里直接下发专属隐藏 iOS SKU，并自动被本脚本收入下方「候选 SKU 清单」与「调试日志」！</p>" +
      "<div class=preset-grid>" + links.map(function (item) {
        return "<div class=preset style=\"border:1px solid #d7e0ec;border-radius:10px;padding:12px;background:#fafbfd\">" +
          "<strong>" + escape(item.name) + "</strong><br><code style=\"font-size:12px;color:#46556b\">" + escape(item.url.replace("https://one.google.com", "")) + "</code>" +
          "<div style=\"margin-top:10px\"><a class=primary style=\"display:inline-block;padding:6px 12px;border-radius:6px;text-decoration:none;font-size:14px\" href=\"" + escape(item.url) + "\" target=\"_blank\" rel=\"noopener\">点击诱捕访问 →</a></div></div>";
      }).join("") + "</div></section>";
  }
  var validConfig = config.status === "default" || config.status === "custom";
  var writable = !!(storageAvailable && typeof storage.write === "function" && config.status !== "unavailable");
  var enabledCount = config.rules.filter(function (rule) { return rule.enabled; }).length;
  var applied = validConfig && report.test.version === COLLECTOR_VERSION &&
    report.test.mappingRevision === config.revision && report.test.mappingUpdatedAt === config.updatedAt &&
    report.test.mappingStatus === config.status;
  var notices = {
    preset: "模板已保存到本机；对应规则已启用，下一次匹配的方案页响应会读取新配置。",
    saved: "映射已保存到本机；下一次方案页响应会读取这些规则。",
    deleted: "映射规则已删除；采集和执行历史保持原样。",
    reset: "已恢复默认三条映射；采集和执行历史保持原样。"
  };
  var notice = query("notice");
  var noticeText = method === "GET" && config.updatedAt && Object.prototype.hasOwnProperty.call(notices, notice) ? notices[notice] : "";
  var prefill = query("from");
  var newRule = { id: "", match: "exact", from: engine.validSku(prefill) ? prefill : "", to: "", enabled: true };
  var orphanDraft = formDraft && formDraft.id && !config.rules.some(function (rule) { return rule.id === formDraft.id; });
  if (orphanDraft) {
    newRule = { id: "", match: formDraft.match, from: formDraft.from, to: formDraft.to, enabled: formDraft.enabled };
  }
  var candidates = Object.create(null);
  report.scan.skus.forEach(function (row) { if (engine.validSku(row.id)) candidates[row.id] = true; });
  var candidateRules = config.rules.concat(engine.defaults());
  presetCatalog.forEach(function (preset) { candidateRules = candidateRules.concat(preset.rules); });
  candidateRules.forEach(function (rule) {
    if (engine.validSku(rule.from)) candidates[rule.from] = true;
    if (engine.validSku(rule.to)) candidates[rule.to] = true;
  });
  function revisionInput() {
    return "<input type=hidden name=revision value=\"" + escape(config.revision) + "\">";
  }
  function presetTemplates() {
    return "<section id=mapping-presets><h2>预制映射模板</h2>" +
      "<p>点击“应用模板”直接保存：更新并启用相同匹配方式与原始 SKU 的规则，保留其他手动规则和历史记录。</p>" +
      "<p class=note>保存后重新进入方案页，下一次匹配响应使用新配置。“当前规则一致”只比较本地配置；实际执行结果见下方记录。</p>" +
      "<div class=preset-grid>" + presetCatalog.map(function (preset) {
        var matches = validConfig && preset.rules.every(function (target) {
          return config.rules.some(function (rule) {
            return rule.match === target.match && rule.from === target.from && rule.to === target.to && rule.enabled;
          });
        });
        var pairs = preset.rules.map(function (rule) {
          return "<div class=preset-pair><span class=note>" + (rule.match === "exact" ? "完整 SKU" : "SKU 前缀") +
            "</span><code>" + escape(rule.from) + "</code><span aria-label=替换为>↓</span><code>" + escape(rule.to) + "</code></div>";
        }).join("");
        return "<form class=preset method=get action=\"" + ROOT + "\"><fieldset" +
          (!writable || !validConfig ? " disabled" : "") + "><legend>" + escape(preset.title).replace(/&lt;s&gt;/g, "<s>").replace(/&lt;\/s&gt;/g, "</s>") + "</legend>" +
          revisionInput() + "<input type=hidden name=preset value=\"" + escape(preset.id) + "\">" +
          "<p class=note>" + escape(preset.description) + "</p>" + pairs +
          (matches ? "<p class=preset-state>当前规则一致</p>" : "") +
          "<button class=primary type=submit name=action value=preset>应用模板</button></fieldset></form>";
      }).join("") + "</div></section>";
  }
  function ruleForm(rule, isNew) {
    var draft = formDraft && formDraft.id === rule.id ? formDraft : rule;
    var disabled = !writable || !validConfig || (isNew && config.rules.length >= engine.limit);
    var select = "<option value=exact" + (draft.match === "exact" ? " selected" : "") + ">完整 SKU</option>" +
      "<option value=prefix" + (draft.match === "prefix" ? " selected" : "") + ">SKU 前缀（以点结尾）</option>";
    if (draft.match !== "exact" && draft.match !== "prefix") select = "<option value=\"\" selected>请选择匹配方式</option>" + select;
    return "<form class=rule method=get action=\"" + ROOT + "\"" + (isNew ? " id=new-mapping" : "") + ">" +
      "<fieldset" + (disabled ? " disabled" : "") + "><legend>" + (isNew ? "新增映射" : "编辑映射") + "</legend>" +
      revisionInput() + "<input type=hidden name=id value=\"" + escape(rule.id) + "\">" +
      "<div class=fields><label>匹配方式<select name=match required>" + select + "</select></label>" +
      "<label class=check><input type=checkbox name=enabled value=1" + (draft.enabled ? " checked" : "") + ">启用这条规则</label>" +
      "<label>原始 SKU<input name=from type=text list=sku-candidates required maxlength=175 pattern=\"(?:g1\\.|com\\.google\\.(?:one|gemini)\\.)[A-Za-z0-9._\\-]{1,160}\" autocomplete=off autocapitalize=none spellcheck=false value=\"" +
      escape(draft.from.slice(0, 300)) + "\" placeholder=\"g1.ios.20tb.m.v2\"></label>" +
      "<label>目标 SKU<input name=to type=text list=sku-candidates required maxlength=175 pattern=\"(?:g1\\.|com\\.google\\.(?:one|gemini)\\.)[A-Za-z0-9._\\-]{0,159}[A-Za-z0-9_\\-]\" autocomplete=off autocapitalize=none spellcheck=false value=\"" +
      escape(draft.to.slice(0, 300)) + "\" placeholder=\"g1.20tb.3months_ip_75p.acq\"></label></div>" +
      "<div class=actions><button class=primary type=submit name=action value=upsert>" + (isNew ? "添加并保存" : "保存这条映射") + "</button>" +
      (isNew ? "" : "<button class=delete type=submit name=action value=delete formnovalidate>删除这条映射</button>") + "</div></fieldset></form>";
  }
  function mappingEditor() {
    var parts = ["<section id=mapping-editor><h2>映射管理</h2>",
      "<p>修改原始 SKU、目标 SKU 或启用状态后，点击该条的保存按钮。</p>",
      "<p><strong>当前启用 " + enabledCount + " 条 / 共 " + config.rules.length + " 条</strong>，最多 " + engine.limit + " 条。</p>",
      "<p>配置保存时间（UTC）：" + escape(config.updatedAt || "正在使用内建默认值，尚未手动保存") + "</p>"];
    if (!validConfig) parts.push("<p class=error role=alert>" + escape(config.error) + "</p>");
    else if (applied) parts.push("<p class=success>最近一次映射执行已读取当前配置；当次改写 " + report.test.hitCount + " 次。</p>");
    else parts.push("<p class=note>等待下一次方案页响应读取当前配置；保存后重新进入 Google App 方案页，再刷新这里核对。</p>");
    if (validConfig && enabledCount === 0) parts.push("<p class=note>当前没有启用的规则：继续采集，响应正文保持原样。</p>");
    if (!writable) parts.push("<p class=error>本地映射存储暂未就绪，编辑按钮已停用。</p>");
    parts.push("<p class=note>完整 SKU 优先；前缀规则按更长的前缀优先，前缀需以点结尾。停用的规则不参与匹配；每个原始编号只替换一次，目标不会继续串联替换。</p>");
    parts.push("<datalist id=sku-candidates>" + Object.keys(candidates).sort().map(function (id) {
      return "<option value=\"" + escape(id) + "\"></option>";
    }).join("") + "</datalist>");
    config.rules.forEach(function (rule) { parts.push(ruleForm(rule, false)); });
    if (orphanDraft) parts.push("<p class=note>上次填写的保存结果尚未确认，内容已保留在新增框中；刷新核对当前规则后再保存。</p>");
    parts.push(ruleForm(newRule, true));
    if (config.rules.length >= engine.limit) parts.push("<p class=note>已达到规则上限，删除一条后即可新增。</p>");
    parts.push("<form class=reset method=get action=\"" + ROOT + "\">" + revisionInput() +
      "<button type=submit name=action value=reset" + (!writable ? " disabled" : "") + ">恢复默认映射</button></form>",
      "<p class=note>恢复默认会把当前规则替换为 2TB 12个月90p、20TB / 30TB 三个月75p三条内建规则；采集和执行历史保留。</p></section>");
    return parts.join("");
  }
  var latestScan = report.scan.recentResponses.length ?
    report.scan.recentResponses[report.scan.recentResponses.length - 1] : null;
  var scanVersionStatus = report.scan.version === COLLECTOR_VERSION ?
    "记录来自本版采集脚本；按响应时间与计数判断是否产生了新记录。" :
    report.scan.version ? "旧采集记录；尚未保存本版采集响应记录。" : "尚未保存本版采集响应记录。";
  var configuredOffers = config.mode === "discount75" ?
    "当前默认的 20TB / 30TB 使用 Ultra 三个月 75p（2.5折），没有备用档。" :
    config.mode === "custom" ? "当前使用手动映射，目标以映射管理中的启用规则为准。" : "当前映射配置未就绪，暂停改写。";
  var statuses = {
    "rewritten": "已执行字符串替换",
    "no-match": "本次响应未命中启用的映射规则",
    "non-text": "本次响应没有可处理的文本正文",
    "config-error": "映射配置读取异常，本次保持响应原样"
  };
  var status = Object.prototype.hasOwnProperty.call(statuses, report.test.status) ?
    statuses[report.test.status] : "暂无测试执行记录";
  if (report.test.version === "pro-annual-test-v1" && report.test.status === "no-match") {
    status = "旧 v1 记录：本次响应未命中 iOS 2TB 前缀";
  }
  var html = [
    "<!doctype html><html lang=zh-CN><meta charset=utf-8>",
    "<meta name=viewport content=\"width=device-width,initial-scale=1\"><title>Google One SKU 管理</title>",
    "<style>*{box-sizing:border-box}body{font:16px/1.6 -apple-system,BlinkMacSystemFont,sans-serif;max-width:960px;margin:24px auto;padding:0 18px;color:#1c2737;background:#f5f7fa}section{background:white;border:1px solid #dde3ec;border-radius:12px;padding:18px;margin:18px 0}h1{font-size:24px;margin-bottom:10px}h2{font-size:20px}code{overflow-wrap:anywhere}a{color:#1259be}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:9px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}.scroll{overflow:auto}.note{color:#46556b}.badge,.success{background:#e0f4e8;color:#176238;padding:8px 12px;border-radius:8px}.badge{display:inline-block}.error{background:#fff0ef;color:#9b2420;padding:12px;border-radius:8px;overflow-wrap:anywhere}.actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:18px 0}.actions form{margin:0}button,.actions a{font:inherit;padding:10px 16px;border:0;border-radius:8px;cursor:pointer;text-decoration:none}.actions a,button{background:#e4eaf3;color:#1c2737}.primary{background:#1259be;color:white}.delete{background:#fff0ef;color:#9b2420}fieldset{min-width:0;margin:0;border:1px solid #d7e0ec;border-radius:10px;padding:16px}legend{font-weight:600;padding:0 6px}.rule{margin:20px 0}.fields{display:grid;grid-template-columns:1fr 1fr;gap:16px}.fields label{font-weight:600;min-width:0}input[type=text],select{font:16px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;width:100%;padding:12px;margin-top:6px;border:1px solid #a7b5c8;border-radius:7px;background:white;color:#1c2737}input[type=text]{font-family:ui-monospace,SFMono-Regular,monospace}.check{display:flex;align-items:center;gap:10px;align-self:end;min-height:48px}.check input{width:20px;height:20px}.rule .actions{margin-bottom:0}button:disabled,fieldset:disabled{opacity:.55}button:disabled{cursor:default}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #568ae3;outline-offset:3px}.reset{margin-top:24px}.preset-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.preset{min-width:0;margin:0}.preset fieldset{height:100%;display:flex;flex-direction:column}.preset legend{max-width:100%;font-size:16px}.preset .note{font-size:14px}.preset-pair{padding:10px;margin:12px 0;background:#f5f7fa;border-radius:6px}.preset-pair code{display:block;font-size:13px;line-height:1.6}.preset-state{align-self:flex-start;font-size:13px;padding:5px 8px;margin:0 0 12px;background:#e0f4e8;color:#176238;border-radius:6px}.preset button{width:100%;margin-top:auto}@media(max-width:600px){body{padding:0 10px;margin:16px auto}section{padding:14px}fieldset{padding:12px}.fields,.preset-grid{grid-template-columns:1fr}.actions{gap:8px}button{padding:10px 12px}}</style>",
    "<h1>Google One SKU 管理</h1>",
    "<p class=badge>本机脚本已接管 · " + VERSION + "</p>",
    "<p><strong>当前报告入口：" + modeName(report.configuredMode) + "</strong></p>",
    "<nav class=actions aria-label=报告操作><form method=get action=\"" + ROOT + "\"><button class=primary type=submit name=format value=txt>📄 导出日志到 TXT 文本</button></form><form method=get action=\"" + ROOT + "\"><button type=submit name=format value=json>导出 JSON</button></form><a href=\"" + ROOT + "\">刷新报告</a></nav>",
    "<p class=note>此页由当前设备的 Shadowrocket 生成；地址栏沿用 one.google.com，映射配置与采集记录保存在当前设备。</p>",
    "<p class=note>保持一个 G1 ACQ 模块开启即可：先采集原始响应中的编号，再按已保存的规则改写。</p>",
    actionError ? "<p class=error role=alert>" + escape(actionError) + "</p>" : "",
    noticeText ? "<p class=success role=status>" + escape(noticeText) + "</p>" : "",
    clearMessage ? "<p>" + escape(clearMessage) + "</p>" : "",
    storageAvailable ? "" : "<p>本地存储接口暂未就绪；此页尚未读取到采集记录。</p>",
    presetTemplates(), iosCampaignTrapper(), debugLogSection(debugLogs), mappingEditor(),
    "<section><h2>采集运行记录</h2>",
    "<p>实际采集脚本：<code>" + escape(report.scan.version || "暂无记录") + "</code><br>实际采集模式：" + modeName(report.scan.mode) + "<br>" + scanVersionStatus + "</p>",
    "<p>已扫描文本响应：" + report.scan.scannedResponses + "；已记录非文本响应：" + report.scan.nonTextResponses +
      "；含商品编号的响应：" + report.scan.matchedResponses + "；累计编号：" + report.scan.skus.length + "</p>",
    "<p>最近保存时间（UTC）：" + escape(report.scan.updatedAt || "暂无") + "</p>",
    latestScan ? "<p><strong>最近一条：" + scanStatuses[latestScan.status] + "</strong><br>识别 " +
      latestScan.candidateCount + " 个不同编号，新增录入 " + latestScan.addedCount + " 个，容量外 " + latestScan.omittedCount + " 个。</p>" : "",
    "<p class=note>累计清单按编号去重；收到相同编号会更新次数，清单条数保持不变。先记录计数和时间，重新打开 Google App 方案页，再刷新本报告对照。</p>",
    "<h3>最近 10 次响应</h3>", recentTable(report.scan.recentResponses),
    "<p class=note>计数增加且显示重复编号，表示已收到响应；时间和计数保持原值，表示尚无新的匹配响应记录，可核对页面缓存、模块开关、HTTPS 解密、请求域名与脚本日志中的 saved=no。路径仅保存分类。</p></section>",
    "<section><h2>最近一次映射执行</h2>",
    "<p>当前配置的 2TB 前缀目标：<code>" + escape(report.configuredTarget || "未启用统一的 2TB 前缀规则") + "</code></p>",
    "<p class=note>精确规则可覆盖单个 2TB 编号，逐行实际目标见下表；实际商品、价格与扣款周期查看 App Store 购买面板。</p>",
    "<p>版本：" + escape(report.test.version || "暂无") + "<br>实际映射模式：" + modeName(report.test.mode) + "<br>状态：" + escape(status) + "；总替换次数：" + report.test.hitCount + "；其中 2TB：" + report.test.annualHitCount + "</p>",
    "<p>2TB 源前缀：<code>g1.ios.2tb.</code><br>该次记录的 2TB 目标：<code>" + escape(report.test.target || "暂无记录") + "</code><br>" + configuredOffers + " 下表保留该次记录的实际目标与备用状态；历史 75p / 90p 备用按原记录显示。<br>执行所用配置保存时间（UTC）：" + escape(report.test.mappingUpdatedAt || "内建默认或旧记录未记录") + "<br>执行时间（UTC）：" + escape(report.test.updatedAt || "暂无") + "</p>",
    "<p class=note>这里记录的是脚本执行结果；商品是否被 App Store 识别、价格和周期需查看购买面板。</p>",
    table(report.test.matchedFrom, false), "</section>",
    "<section><h2>浏览页面时采集到的候选 SKU</h2>",
    "<p>累计编号：" + report.scan.skus.length + "；同一编号合并计数，每次响应的新增与重复情况见上方采集运行记录。</p>",
    "<p class=note>编号在改写前从原始响应中提取，并非商店的完整商品目录；脚本生成的替换目标不会自动加入这份清单。</p>",
    report.scan.truncated ? "<p>记录已达到 300 个上限；清空后可重新采集目标页面。</p>" : "",
    table(report.scan.skus, true),
    "<p>更新时间（UTC）：" + escape(report.scan.updatedAt || "暂无") + "</p></section>",
    "<form method=get action=\"" + ROOT + "\"><button name=clear value=1>清空本工具的采集与测试记录</button></form>",
    "<p class=note>清空记录保留映射配置；浏览方案后刷新本页查看记录，独立采集器和历史改写副本保持停用。</p>",
    "<section style=\"text-align:center;border:2px solid #1259be;background:#f0f6ff\"><h2 style=\"font-size:22px;margin:6px 0\">📢 有问题联系推特：<a href=\"https://x.com/zixunclub\" target=\"_blank\" rel=\"noopener\">https://x.com/zixunclub</a></h2></section></html>"
  ].join("");
  $done({ status: responseStatus, headers: headers, body: html });
})();






