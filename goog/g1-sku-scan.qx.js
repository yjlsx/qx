/* Passive product-ID collection for Shadowrocket; original responses pass through. */
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
  var STORE_KEY = "g1_acq_sku_scan";
  var LIMIT = 300;
  var url = typeof $request === "object" && $request ? $request.url : "";
  var body = typeof $response === "object" && $response ? $response.body : undefined;

  if (typeof url !== "string" || !/^https:\/\/one\.google\.com\//.test(url) ||
      /^https:\/\/one\.google\.com\/g1-sku-report\/?(?:\?|$)/.test(url) ||
      typeof body !== "string") {
    $done({});
    return;
  }

  var now = new Date().toISOString();
  var saved = {};
  try {
    if (typeof QXStore !== "undefined" && typeof QXStore.read === "function") {
      saved = JSON.parse(QXStore.read(STORE_KEY) || "{}");
    }
  } catch (error) {
    saved = {};
  }
  if (!saved || saved.schemaVersion !== 1) saved = {};

  var byId = Object.create(null);
  var ids = [];
  var validId = /^(?:g1\.|com\.google\.one\.)[A-Za-z0-9._-]{1,160}$/;
  var oldRows = Array.isArray(saved.skus) ? saved.skus : [];
  oldRows.slice(0, LIMIT).forEach(function (row) {
    if (!row || typeof row.id !== "string" || !validId.test(row.id) || byId[row.id]) return;
    var count = Number(row.count);
    byId[row.id] = {
      id: row.id,
      count: isFinite(count) && count > 0 ? Math.floor(count) : 0,
      lastSeen: typeof row.lastSeen === "string" ? row.lastSeen.slice(0, 32) : ""
    };
    ids.push(row.id);
  });

  // Decode escaped dots for discovery only. The response body is kept intact.
  var text = body.replace(/\\u002e|\\x2e|&#0*46;|&#x0*2e;|&period;/gi, ".");
  var token = /(^|[^A-Za-z0-9._@%-])((?:g1\.|com\.google\.one\.)[A-Za-z0-9._-]+)(?=$|[^A-Za-z0-9._-])/g;
  var match;
  var found = Object.create(null);
  var hitCount = 0;
  var truncated = saved.truncated === true;
  while ((match = token.exec(text)) !== null) {
    var id = match[2];
    if (!validId.test(id)) continue;
    found[id] = (found[id] || 0) + 1;
    hitCount += 1;
    if (!byId[id]) {
      if (ids.length >= LIMIT) {
        truncated = true;
        continue;
      }
      byId[id] = { id: id, count: 0, lastSeen: now };
      ids.push(id);
    }
    byId[id].count += 1;
    byId[id].lastSeen = now;
  }

  function priorCount(value) {
    var number = Number(value);
    return isFinite(number) && number > 0 ? Math.floor(number) : 0;
  }
  var state = {
    schemaVersion: 1,
    version: "pro-annual-test-v2",
    updatedAt: now,
    scannedResponses: priorCount(saved.scannedResponses) + 1,
    matchedResponses: priorCount(saved.matchedResponses) + (hitCount > 0 ? 1 : 0),
    limit: LIMIT,
    truncated: truncated,
    skus: ids.sort().map(function (id) { return byId[id]; })
  };
  var stored = false;
  try {
    if (typeof QXStore !== "undefined" && typeof QXStore.write === "function") {
      stored = QXStore.write(JSON.stringify(state), STORE_KEY);
    }
  } catch (error) {
    stored = false;
  }

  console.log("[g1-sku-scan] candidates=" + Object.keys(found).length +
    " occurrences=" + hitCount + " saved=" + (stored ? "yes" : "no"));
  Object.keys(found).sort().slice(0, LIMIT).forEach(function (id) {
    console.log("[g1-sku-scan] " + id + " x" + found[id]);
  });
  $done({});
})();
