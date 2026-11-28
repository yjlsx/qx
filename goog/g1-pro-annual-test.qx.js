/* Google AI Pro annual product test for Shadowrocket. */
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
  var VERSION = "pro-annual-test-v2";
  var SOURCE_PREFIX = "g1.ios.2tb.";
  var TARGET = "g1.2tb.ai.annual";
  var SKU_MAP = {
    "g1.ios.20tb.m.v2": "g1.20tb.3months_ip_90p.acq",
    "g1.ios.30tb.ai.pro.m": "g1.ai.ultra.3months_ip_90p.acq"
  };
  var FALLBACK = {
    "g1.20tb.3months_ip_90p.acq": "g1.20tb.3months_ip_75p.acq",
    "g1.ai.ultra.3months_ip_90p.acq": "g1.ai.ultra.3months_ip_75p.acq"
  };
  var STORE_KEY = "g1_acq_last_test";
  var url = typeof $request === "object" && $request ? $request.url : "";

  if (typeof url !== "string" || !/^https:\/\/one\.google\.com\/ai\?/.test(url)) {
    $done({});
    return;
  }

  var body = typeof $response === "object" && $response ? $response.body : undefined;
  var mappings = Object.create(null);
  var hits = 0;
  var annualHits = 0;
  var out = body;

  if (typeof body === "string") {
    // Preserve v6's 20TB/30TB fallback rule using the original response.
    // These are observed strings, not a verified store catalog.
    var observed = body.match(/g1\.[a-z0-9._]{2,60}acq/g) || [];
    // Match complete tokens before selecting 2TB or the two existing source IDs.
    out = body.replace(
      /(^|[^A-Za-z0-9._@%-])(g1\.[A-Za-z0-9._-]+)(?=$|[^A-Za-z0-9._-])/g,
      function (match, before, id) {
        var isAnnual = id.indexOf(SOURCE_PREFIX) === 0 && id.length > SOURCE_PREFIX.length;
        var to;
        var fallback = false;
        if (isAnnual) {
          to = TARGET;
        } else if (Object.prototype.hasOwnProperty.call(SKU_MAP, id)) {
          to = SKU_MAP[id];
          if (observed.indexOf(to) === -1 && FALLBACK[to] && observed.indexOf(FALLBACK[to]) !== -1) {
            to = FALLBACK[to];
            fallback = true;
          }
        } else {
          return match;
        }
        if (!mappings[id]) mappings[id] = { id: id, to: to, count: 0, fallback: fallback };
        mappings[id].count += 1;
        hits += 1;
        if (isAnnual) annualHits += 1;
        return before + to;
      }
    );
  }

  var sources = Object.keys(mappings).sort().map(function (id) {
    return mappings[id];
  });
  var record = {
    schemaVersion: 1,
    version: VERSION,
    updatedAt: new Date().toISOString(),
    sourcePrefix: SOURCE_PREFIX,
    target: TARGET,
    hitCount: hits,
    annualHitCount: annualHits,
    matchedFrom: sources,
    status: typeof body !== "string" ? "non-text" : hits ? "rewritten" : "no-match"
  };

  try {
    if (typeof QXStore !== "undefined" &&
        typeof QXStore.write === "function") {
      if (!QXStore.write(JSON.stringify(record), STORE_KEY)) {
        console.log("[g1-pro-annual-test] local record write failed");
      }
    }
  } catch (error) {
    console.log("[g1-pro-annual-test] local record unavailable");
  }

  console.log("[g1-pro-annual-test] " + VERSION + " hits=" + hits + " annualHits=" + annualHits);
  sources.forEach(function (source) {
    console.log("[g1-pro-annual-test] " + source.id + " -> " + source.to + " x" + source.count +
      (source.fallback ? " fallback=75p" : ""));
  });
  $done(hits ? { body: out } : {});
})();
