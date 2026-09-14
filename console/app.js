(function () {
  "use strict";

  if (document.getElementById("rtx-console")) return;

  var cfg = window.CONTROL_CONFIG || {};
  var script = document.currentScript;
  var origin = null;
  var scriptKey = "";
  if (script) {
    scriptKey = script.getAttribute ? (script.getAttribute("data-key") || "") : "";
    if (script.src) {
      try {
        var u = new URL(script.src);
        if (u.pathname === "/console/app.js") origin = u.origin;
      } catch (e) {}
    }
  }
  var storedUrl = localStorage.getItem("rtx.srvUrl");
  var storedKey = localStorage.getItem("rtx.srvKey");
  var srvUrl = String(cfg.url || origin || storedUrl || "http://localhost:8000").replace(/\/+$/, "");
  var srvKey = String(cfg.key || scriptKey || storedKey || "");

  function make(tag, id, className) {
    var n = document.createElement(tag);
    if (id) n.id = id;
    if (className) n.className = className;
    return n;
  }

  var root = make("div", "rtx-console");
  document.body.appendChild(root);

  var fab = make("button", "rtx-fab");
  fab.setAttribute("aria-expanded", "false");
  var uiIcons = window.RTX_UI_ICONS || {};
  function uiIcon(name) {
    return uiIcons[name] || "";
  }

  fab.setAttribute("aria-controls", "rtx-panel");
  fab.title = "展開/收合控制台";
  fab.innerHTML = uiIcon("fabOpen") + uiIcon("fabClose");
  root.appendChild(fab);

  var panel = make("div", "rtx-panel");
  root.appendChild(panel);

  var h1 = make("h1");
  h1.textContent = "控制端 (console)";
  panel.appendChild(h1);

  var fxLayout = make("div", "rtx-fx-layout", "rtx-fx-layout");
  var fxCurrent = make("div", "rtx-fx-current", "rtx-fx-zone");
  var fxAlternate = make("div", "rtx-fx-alternate", "rtx-fx-zone");
  fxLayout.appendChild(fxCurrent);
  fxLayout.appendChild(fxAlternate);
  panel.appendChild(fxLayout);

  var row = make("div", null, "rtx-row");
  panel.appendChild(row);

  var paramsBtn = make("button", "rtx-params-btn", "rtx-action");
  paramsBtn.setAttribute("aria-expanded", "false");
  paramsBtn.setAttribute("aria-controls", "rtx-params-panel");
  paramsBtn.title = "參數";
  paramsBtn.setAttribute("aria-label", "參數");
  paramsBtn.innerHTML = uiIcon("params");
  row.appendChild(paramsBtn);

  var connBtn = make("button", "rtx-conn-btn", "rtx-action");
  connBtn.setAttribute("aria-expanded", "false");
  connBtn.setAttribute("aria-controls", "rtx-conn-panel");
  connBtn.title = "連線設定";
  connBtn.setAttribute("aria-label", "連線設定");
  connBtn.innerHTML = uiIcon("conn");
  row.appendChild(connBtn);

  var clearBtn = make("button", "rtx-clear-btn");
  clearBtn.title = "清屏";
  clearBtn.setAttribute("aria-label", "清屏");
  clearBtn.innerHTML = uiIcon("clear");
  row.appendChild(clearBtn);

  var layoutBtn = make("button", "rtx-fx-layout-btn", "rtx-action");
  layoutBtn.setAttribute("aria-expanded", "false");
  layoutBtn.setAttribute("aria-controls", "rtx-fx-alternate");
  layoutBtn.title = "切換備用特效區";
  layoutBtn.setAttribute("aria-label", "切換備用特效區");
  layoutBtn.innerHTML = uiIcon("layout");
  row.appendChild(layoutBtn);

  var paramsPanel = make("div", "rtx-params-panel", "rtx-collapsible");
  var paramsBody = make("div", "rtx-params-body");
  paramsPanel.appendChild(paramsBody);
  panel.appendChild(paramsPanel);

  var connPanel = make("div", "rtx-conn-panel", "rtx-collapsible");
  var urlField = make("div", null, "rtx-field");
  var urlLabel = make("label");
  urlLabel.textContent = "中繼 server";
  var urlInput = make("input", "rtx-srv-url");
  urlInput.type = "url";
  urlInput.placeholder = "http://localhost:8000";
  urlField.appendChild(urlLabel);
  urlField.appendChild(urlInput);
  connPanel.appendChild(urlField);

  var keyField = make("div", null, "rtx-field");
  var keyLabel = make("label");
  keyLabel.textContent = "金鑰";
  var keyInput = make("input", "rtx-srv-key");
  keyInput.type = "password";
  keyInput.placeholder = "（可留空）";
  keyField.appendChild(keyLabel);
  keyField.appendChild(keyInput);
  connPanel.appendChild(keyField);

  var reloadField = make("div", null, "rtx-field");
  var reloadLabel = make("label");
  reloadLabel.textContent = "特效表";
  var reloadBtn = make("button", "rtx-reload-btn", "rtx-action");
  reloadBtn.title = "重載特效表";
  reloadBtn.setAttribute("aria-label", "重載特效表");
  reloadBtn.innerHTML = uiIcon("reload");
  reloadField.appendChild(reloadLabel);
  reloadField.appendChild(reloadBtn);
  connPanel.appendChild(reloadField);

  panel.appendChild(connPanel);

  var hint = make("div", "rtx-hint");
  hint.textContent = "選取特效後，點擊畫面任意位置發送。特效清單載入自 server /api/effects；未知特效以通用樣式與參數顯示。［參數］展開目前特效參數，［連線設定］展開 server、金鑰與特效表重載。點擊左上圓形按鈕可收合/展開面板，按住拖曳可移動位置。狀態僅記錄於 console。";
  panel.appendChild(hint);

  urlInput.value = srvUrl;
  keyInput.value = srvKey;

  function saveCfg() {
    srvUrl = urlInput.value.trim().replace(/\/+$/, "");
    srvKey = keyInput.value.trim();
    localStorage.setItem("rtx.srvUrl", srvUrl);
    localStorage.setItem("rtx.srvKey", srvKey);
  }
  urlInput.addEventListener("change", saveCfg);
  keyInput.addEventListener("change", saveCfg);

  var suppressClick = false;
  fab.addEventListener("click", function () {
    if (suppressClick) return;
    var open = panel.classList.toggle("open");
    fab.classList.toggle("active", open);
    fab.setAttribute("aria-expanded", open ? "true" : "false");
  });

  var DRAG_SLOP_PX = 8;
  var FX_DRAG_TRIGGER_PX = 30;
  var FAB_SIZE = 44;
  var GAP = 10;
  var VIEWPORT_MARGIN = 8;
  var PANEL_FALLBACK_WIDTH = 280;
  var PANEL_FALLBACK_HEIGHT = 200;
  var fabPos = { x: 12, y: 12 };
  var drag = null;

  function clampValue(v, min, max) {
    if (max < min) max = min;
    return Math.max(min, Math.min(v, max));
  }

  function overlapArea(a, b) {
    var x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    var y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return x * y;
  }

  function panelSize() {
    return { w: panel.offsetWidth || PANEL_FALLBACK_WIDTH, h: panel.offsetHeight || PANEL_FALLBACK_HEIGHT };
  }

  function clampPanelPos(x, y, w, h) {
    var maxX = window.innerWidth - w - VIEWPORT_MARGIN;
    var maxY = window.innerHeight - h - VIEWPORT_MARGIN;
    return {
      x: clampValue(x, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, maxX)),
      y: clampValue(y, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, maxY)),
    };
  }

  function panelCandidates() {
    var size = panelSize();
    var fabRect = { x: fabPos.x, y: fabPos.y, w: FAB_SIZE, h: FAB_SIZE };
    var raw = [
      { x: fabPos.x, y: fabPos.y + FAB_SIZE + GAP },
      { x: fabPos.x, y: fabPos.y - GAP - size.h },
      { x: fabPos.x + FAB_SIZE + GAP, y: fabPos.y },
      { x: fabPos.x - size.w - GAP, y: fabPos.y },
    ];
    var out = [];
    raw.forEach(function (c) {
      var pos = clampPanelPos(c.x, c.y, size.w, size.h);
      var rect = { x: pos.x, y: pos.y, w: size.w, h: size.h };
      out.push({ x: rect.x, y: rect.y, area: overlapArea(fabRect, rect) });
    });
    return out;
  }

  function applyFabPos() {
    fabPos.x = clampValue(fabPos.x, 0, Math.max(0, window.innerWidth - FAB_SIZE));
    fabPos.y = clampValue(fabPos.y, 0, Math.max(0, window.innerHeight - FAB_SIZE));
    fab.style.left = fabPos.x + "px";
    fab.style.top = fabPos.y + "px";
    var candidates = panelCandidates();
    var best = candidates[0];
    for (var i = 1; i < candidates.length; i += 1) {
      if (candidates[i].area < best.area) best = candidates[i];
    }
    panel.style.left = best.x + "px";
    panel.style.top = best.y + "px";
  }

  fab.addEventListener("pointerdown", function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    drag = {
      startX: e.clientX, startY: e.clientY,
      originX: fabPos.x, originY: fabPos.y,
      active: false,
    };
    if (fab.setPointerCapture) fab.setPointerCapture(e.pointerId);
  });

  window.addEventListener("pointermove", function (e) {
    if (!drag) return;
    if (!drag.active) {
      if (Math.abs(e.clientX - drag.startX) <= DRAG_SLOP_PX &&
          Math.abs(e.clientY - drag.startY) <= DRAG_SLOP_PX) return;
      drag.active = true;
      fab.classList.add("dragging");
    }
    fabPos.x = drag.originX + (e.clientX - drag.startX);
    fabPos.y = drag.originY + (e.clientY - drag.startY);
    applyFabPos();
    e.preventDefault();
  });

  window.addEventListener("pointerup", function () {
    if (!drag) return;
    var wasDrag = drag.active;
    drag = null;
    fab.classList.remove("dragging");
    if (wasDrag) {
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 0);
    }
  });

  window.addEventListener("resize", applyFabPos);

  var FALLBACK_ICON = "<svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='3'/></svg>";
  var externalIcons = window.RTX_EFFECT_ICONS || {};
  function isSvgString(v) {
    return typeof v === "string" && /^\s*<svg[\s>]/.test(v) && /<\/svg>\s*$/i.test(v);
  }
  function resolvedPluginIcon(type) {
    var plugin = consoleRegistry.registry[type];
    if (!plugin) return null;
    if (isSvgString(plugin.iconSVG)) return plugin.iconSVG;
    if (typeof plugin.iconID === "string" && externalIcons[plugin.iconID]) {
      return externalIcons[plugin.iconID];
    }
    return null;
  }
  function iconFor(type, meta) {
    var m = meta || {};
    return (
      resolvedPluginIcon(type) ||
      externalIcons[m.icon] ||
      externalIcons[type] ||
      externalIcons.generic ||
      FALLBACK_ICON
    );
  }
  function hasIconFor(type, meta) {
    var m = meta || {};
    return !!(resolvedPluginIcon(type) || externalIcons[m.icon] || externalIcons[type]);
  }

  var consoleRegistry =
    window.RTX_EFFECT_CONSOLE && typeof window.RTX_EFFECT_CONSOLE === "object"
      ? window.RTX_EFFECT_CONSOLE
      : { registry: {} };
  if (!window.RTX_EFFECT_CONSOLE) window.RTX_EFFECT_CONSOLE = consoleRegistry;
  consoleRegistry.registry = consoleRegistry.registry || {};
  if (typeof consoleRegistry.register !== "function") {
    consoleRegistry.register = function (type, plugin) {
      if (!type || !plugin || typeof plugin !== "object") return;
      consoleRegistry.registry[type] = plugin;
    };
  }

  var FALLBACK_EFFECTS = {
    particle: { name: "粒子爆散", params: { color: "#ff0044", count: 40, spread: 360, speed: 0.35, duration: 1200 } },
    ripple: { name: "漣漪圈", params: { color: "#44aaff", maxRadius: 200, duration: 1200 } },
    firework: { name: "煙火", params: { colors: ["#ff5252", "#ffd740", "#40c4ff", "#69f0ae"], count: 90, duration: 1800 } },
    text: { name: "浮現文字", params: { content: "Hello", size: 32, duration: 2000, color: "#ffffff" } },
  };

  var EFFECTS_META = FALLBACK_EFFECTS;
  var fxLayoutState = { current: Object.keys(FALLBACK_EFFECTS).slice(), alternate: [] };
  var fxButtonEls = [];
  var selected = Object.keys(EFFECTS_META)[0];
  var currentRev = "";
  var fxDrag = null;
  var fxClickSuppressed = false;
  var FX_LAYOUT_STORAGE_KEY = "rtx.fx.layout.v2";

  function fallbackLayout(effectKeys) {
    return { current: (effectKeys || []).slice(), alternate: [] };
  }

  function storedLayout() {
    try {
      var raw = localStorage.getItem(FX_LAYOUT_STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (!Array.isArray(parsed.current) || !Array.isArray(parsed.alternate)) return null;
      return { current: parsed.current, alternate: parsed.alternate };
    } catch (e) {
      return null;
    }
  }

  function saveLayout() {
    try {
      localStorage.setItem(
        FX_LAYOUT_STORAGE_KEY,
        JSON.stringify({
          version: 2,
          current: fxLayoutState.current,
          alternate: fxLayoutState.alternate,
        })
      );
    } catch (e) {}
  }

  function normalizeLayout(data) {
    if (!data || typeof data !== "object") return null;
    if (data.version === 1) return null;
    if (data.version !== 2) return null;
    if (!Array.isArray(data.currentEffects) || !Array.isArray(data.alternateEffects)) return null;
    return { current: data.currentEffects, alternate: data.alternateEffects };
  }

  function sanitizeLayout(layout, keys) {
    var effectKeys = keys || [];
    var fallback = fallbackLayout(effectKeys);
    if (!layout || typeof layout !== "object") return fallback;
    if (!Array.isArray(layout.current) || !Array.isArray(layout.alternate)) return fallback;
    var currentSeen = {};
    var alternateSeen = {};
    var current = [];
    var alternate = [];
    (layout.current || []).forEach(function (id) {
      if (typeof id !== "string" || !EFFECTS_META[id] || currentSeen[id]) return;
      currentSeen[id] = true;
      current.push(id);
    });
    (layout.alternate || []).forEach(function (id) {
      if (typeof id !== "string" || !EFFECTS_META[id] || currentSeen[id] || alternateSeen[id]) return;
      alternateSeen[id] = true;
      alternate.push(id);
    });
    if (!current.length && !alternate.length) return fallback;
    if (!current.length) {
      current = alternate;
      alternate = [];
      current.forEach(function (id) {
        currentSeen[id] = true;
      });
    }
    effectKeys.forEach(function (id) {
      if (!currentSeen[id] && !alternateSeen[id]) {
        alternateSeen[id] = true;
        alternate.push(id);
      }
    });
    return { current: current, alternate: alternate };
  }

  function zoneTypes(zone) {
    var out = [];
    var nodes = zone.children || zone._children || [];
    for (var i = 0; i < nodes.length; i += 1) {
      var n = nodes[i];
      if (!n || typeof n.getAttribute !== "function") continue;
      var id = n.getAttribute("data-fx");
      if (EFFECTS_META[id]) out.push(id);
    }
    return out;
  }

  var fxMoveMs = 180;

  function fxReducedMotion() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function fxCaptureRects() {
    var rects = {};
    fxButtonEls.forEach(function (btn) {
      var id = btn.getAttribute("data-fx");
      if (id && typeof btn.getBoundingClientRect === "function") {
        rects[id] = btn.getBoundingClientRect();
      }
    });
    return rects;
  }

  function fxLayoutRect(btn) {
    if (btn && btn.__fxLayoutRect) return btn.__fxLayoutRect;
    if (btn && typeof btn.getBoundingClientRect === "function") return btn.getBoundingClientRect();
    return null;
  }

  function fxMeasureLayoutRect(btn) {
    if (!btn || typeof btn.getBoundingClientRect !== "function") return null;
    var prevTransform = btn.style.transform;
    btn.style.transform = "none";
    var r = btn.getBoundingClientRect();
    if (prevTransform === undefined) delete btn.style.transform;
    else btn.style.transform = prevTransform;
    return {
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      right: r.right,
      bottom: r.bottom,
    };
  }

  function fxStoreLayoutRects() {
    fxButtonEls.forEach(function (btn) {
      var r = fxMeasureLayoutRect(btn);
      if (r) btn.__fxLayoutRect = r;
    });
  }

  function fxNextFrame(fn) {
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(fn);
      });
    } else {
      setTimeout(fn, 0);
    }
  }

  function fxPlayMove(rects, skipBtn) {
    if (!rects || fxReducedMotion()) return;
    fxButtonEls.forEach(function (btn) {
      if (btn === skipBtn) return;
      var id = btn.getAttribute("data-fx");
      var oldRect = rects[id];
      if (!oldRect || typeof btn.getBoundingClientRect !== "function") return;
      var prevTransition = btn.style.transition;
      var prevTransform = btn.style.transform;
      btn.style.transition = "none";
      btn.style.transform = "none";
      var newRect = btn.getBoundingClientRect();
      btn.__fxLayoutRect = {
        left: newRect.left,
        top: newRect.top,
        width: newRect.width,
        height: newRect.height,
        right: newRect.right,
        bottom: newRect.bottom,
      };
      var dx = oldRect.left - newRect.left;
      var dy = oldRect.top - newRect.top;
      if (!dx && !dy) {
        if (prevTransition === undefined) delete btn.style.transition;
        else btn.style.transition = prevTransition;
        if (prevTransform === undefined) delete btn.style.transform;
        else btn.style.transform = prevTransform;
        return;
      }
      var seq = (btn.__fxMoveSeq = (btn.__fxMoveSeq || 0) + 1);
      btn.style.transform = "translate(" + dx + "px," + dy + "px)";
      void btn.offsetWidth;
      fxNextFrame(function () {
        if (btn.__fxMoveSeq !== seq) return;
        btn.style.transition = "transform " + fxMoveMs + "ms cubic-bezier(0.22, 0.8, 0.36, 1)";
        btn.style.transform = "";
        function clear() {
          if (btn.__fxMoveSeq === seq) btn.style.transition = "";
        }
        btn.addEventListener("transitionend", clear);
        setTimeout(clear, fxMoveMs + 100);
      });
    });
  }

  function syncLayoutFromDom(preRects) {
    fxLayoutState = sanitizeLayout(
      { current: zoneTypes(fxCurrent), alternate: zoneTypes(fxAlternate) },
      Object.keys(EFFECTS_META)
    );
    saveLayout();
    renderFxZone(preRects);
    selectEffect(selected);
  }

  function moveEffect(effectId, targetBlock, beforeId) {
    if (!EFFECTS_META[effectId]) return false;
    if (targetBlock !== "current" && targetBlock !== "alternate") return false;
    var current = fxLayoutState.current.filter(function (id) {
      return id !== effectId;
    });
    var alternate = fxLayoutState.alternate.filter(function (id) {
      return id !== effectId;
    });
    function insert(list, before) {
      if (before == null) {
        list.push(effectId);
        return true;
      }
      var idx = list.indexOf(before);
      if (idx === -1) return false;
      list.splice(idx, 0, effectId);
      return true;
    }
    if (targetBlock === "current") {
      if (!insert(current, beforeId)) return false;
    } else {
      if (!insert(alternate, beforeId)) return false;
    }
    fxLayoutState = sanitizeLayout({ current: current, alternate: alternate }, Object.keys(EFFECTS_META));
    saveLayout();
    renderFxZone();
    selectEffect(selected);
    return true;
  }

  function makeFxButton(type, zone) {
    var e = EFFECTS_META[type] || {};
    var name = e.name || type;
    var hasIcon = hasIconFor(type, e);
    var btn = make("button", "rtx-fx-" + type, "rtx-fx" + (hasIcon ? "" : " generic"));
    btn.setAttribute("data-fx", type);
    btn.title = name;
    btn.setAttribute("aria-label", name);
    btn.innerHTML = iconFor(type, e);
    btn.addEventListener("click", function () {
      if (fxClickSuppressed) return;
      selectEffect(type);
    });
    btn.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      fxDrag = {
        btn: btn,
        id: type,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
      };
      if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
    });
    zone.appendChild(btn);
    fxButtonEls.push(btn);
    return btn;
  }

  function renderFxZone(preRects) {
    var oldRects = preRects || fxCaptureRects();
    fxButtonEls = [];
    fxCurrent.innerHTML = "";
    fxAlternate.innerHTML = "";
    fxLayoutState.current.forEach(function (type) {
      makeFxButton(type, fxCurrent);
    });
    fxLayoutState.alternate.forEach(function (type) {
      makeFxButton(type, fxAlternate);
    });
    fxStoreLayoutRects();
    fxPlayMove(oldRects);
  }

  function isSchema(params) {
    if (!params || typeof params !== "object" || Array.isArray(params)) return false;
    var keys = Object.keys(params);
    if (!keys.length) return true;
    return keys.every(function (key) {
      var v = params[key];
      return v && typeof v === "object" && !Array.isArray(v) && typeof v.type === "string";
    });
  }

  function genericFields(params) {
    var out = [];
    Object.keys(params || {}).forEach(function (key) {
      var v = params[key];
      if (typeof v === "number") {
        out.push({ key: key, label: key, type: "number", def: v });
      } else if (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)) {
        out.push({ key: key, label: key, type: "color", def: v });
      } else if (typeof v === "string") {
        out.push({ key: key, label: key, type: "text", def: v });
      } else if (typeof v === "boolean") {
        out.push({ key: key, label: key, type: "text", def: String(v), coerce: "boolean" });
      }
    });
    return out;
  }

  function schemaFields(params) {
    var out = [];
    Object.keys(params || {}).forEach(function (key) {
      var d = params[key];
      if (!d || typeof d !== "object" || typeof d.type !== "string") return;
      if (d.editable === false) return;
      if (d.type === "array") return;
      out.push({
        key: key,
        label: d.label || key,
        type: d.type,
        def: d.default,
        min: d.min,
        max: d.max,
        step: d.step,
        maxLength: d.maxLength,
        options: d.options,
      });
    });
    return out;
  }

  function fieldDefs(type) {
    var meta = EFFECTS_META[type] || {};
    var params = meta.params || {};
    return isSchema(params) ? schemaFields(params) : genericFields(params);
  }

  function consoleApi(type) {
    var meta = EFFECTS_META[type] || {};
    var defaults = {};
    fieldDefs(type).forEach(function (d) {
      defaults[d.key] = d.def;
    });
    return {
      type: type,
      params: meta.params || {},
      defaults: defaults,
      fields: fieldDefs(type),
      getValue: function (key) {
        var input = document.getElementById("rtx-p-" + key);
        if (!input) return undefined;
        return input.type === "checkbox" ? input.checked : input.value;
      },
      setValue: function (key, value) {
        var input = document.getElementById("rtx-p-" + key);
        if (!input) return;
        if (input.type === "checkbox") input.checked = Boolean(value);
        else input.value = value;
      },
    };
  }

  function renderField(d) {
    var field = make("div", null, "rtx-field");
    var label = make("label");
    label.textContent = d.label;
    var input;
    if (d.type === "select") {
      input = make("select", "rtx-p-" + d.key);
      (d.options || []).forEach(function (opt) {
        var o = make("option");
        o.value = opt.value;
        o.textContent = opt.label != null ? opt.label : String(opt.value);
        input.appendChild(o);
      });
      input.value = d.def != null ? d.def : "";
    } else {
      input = make("input", "rtx-p-" + d.key);
      if (d.type === "boolean") {
        input.type = "checkbox";
        input.checked = d.def === true;
      } else {
        input.type =
          d.type === "integer" || d.type === "number"
            ? "number"
            : d.type === "color"
              ? "color"
              : "text";
        input.value = d.def != null ? d.def : "";
        if (d.type === "integer" || d.type === "number") {
          if (d.min != null) input.min = d.min;
          if (d.max != null) input.max = d.max;
          if (d.step != null) input.step = d.step;
        }
        if (d.maxLength != null) input.maxLength = d.maxLength;
      }
    }
    field.appendChild(label);
    field.appendChild(input);
    paramsBody.appendChild(field);
  }

  function renderParams() {
    paramsBody.innerHTML = "";
    var plugin = consoleRegistry.registry[selected];
    if (plugin && typeof plugin.render === "function") {
      try {
        plugin.render(paramsBody, consoleApi(selected));
        return;
      } catch (err) {
        console.warn("[control] console 插件 render 失敗，改用 schema 渲染", err);
        paramsBody.innerHTML = "";
      }
    }
    fieldDefs(selected).forEach(renderField);
  }

  function selectEffect(type) {
    if (!EFFECTS_META[type]) {
      type = fxLayoutState.current[0] || fxLayoutState.alternate[0] || Object.keys(EFFECTS_META)[0];
    }
    selected = type;
    fxButtonEls.forEach(function (btn) {
      var on = btn.getAttribute("data-fx") === selected;
      btn.classList.remove("selected");
      if (on) btn.classList.add("selected");
    });
    renderParams();
  }

  function renderEffects(meta, payload, persist) {
    EFFECTS_META = meta;
    var effectKeys = Object.keys(EFFECTS_META);
    var stored = storedLayout();
    var payloadLayout = normalizeLayout(payload);
    fxLayoutState = sanitizeLayout(stored || payloadLayout || null, effectKeys);
    if (persist) saveLayout();
    renderFxZone();
    selectEffect(selected);
  }

  function normalizeEffects(data) {
    if (!data || typeof data !== "object") return null;
    var effects = data.effects;
    if (!effects || typeof effects !== "object" || Array.isArray(effects)) return null;
    var keys = Object.keys(effects);
    if (!keys.length) return null;
    var out = {};
    keys.forEach(function (key) {
      var e = effects[key] || {};
      out[key] = {
        name: e.label || e.name || key,
        category: e.category,
        icon: e.icon,
        viewerUrl: e.viewerUrl,
        consoleUrl: e.consoleUrl || null,
        params: e.params && typeof e.params === "object" && !Array.isArray(e.params) ? e.params : {},
      };
    });
    return out;
  }

  function loadScriptTag(url) {
    return new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = url;
      s.onload = function () {
        resolve(true);
      };
      s.onerror = function () {
        resolve(false);
      };
      document.head.appendChild(s);
    });
  }

  function loadConsolePlugins(meta, rev) {
    var jobs = [];
    Object.keys(meta).forEach(function (type) {
      var url = meta[type] && meta[type].consoleUrl;
      if (!url) return;
      var suffix = rev ? "?v=" + encodeURIComponent(rev) : "";
      jobs.push(
        loadScriptTag(srvUrl + url + suffix).then(function (ok) {
          if (!ok) console.warn("[control] console 插件載入失敗，使用 schema 渲染", srvUrl + url + suffix);
        })
      );
    });
    return Promise.all(jobs);
  }

  async function applyManifest(meta, rev, payload, resetRegistry) {
    if (rev && rev === currentRev) return;
    if (resetRegistry) {
      Object.keys(consoleRegistry.registry).forEach(function (key) {
        delete consoleRegistry.registry[key];
      });
    }
    await loadConsolePlugins(meta, rev);
    renderEffects(meta, payload, true);
    if (rev) {
      currentRev = rev;
    }
  }

  async function loadEffects() {
    try {
      var r = await fetch(srvUrl + "/api/effects");
      if (!r.ok) throw new Error("status " + r.status);
      var data = await r.json();
      var meta = normalizeEffects(data);
      if (meta) {
        await applyManifest(meta, (data && data.rev) || "", data, false);
      }
    } catch (err) {
      console.warn("[control] 特效表載入失敗，使用內建清單", err);
    }
  }

  async function reloadEffectsTable() {
    if (reloadBtn.disabled) return;
    reloadBtn.disabled = true;
    try {
      var r = await fetch(srvUrl + "/api/effects/reload", {
        method: "POST",
        headers: headers(),
        body: "{}",
      });
      if (r.status === 401) {
        console.error("[control] 401 金鑰錯誤");
        return;
      }
      if (!r.ok) {
        console.error("[control] 重載特效表失敗", r.status, await r.text());
        return;
      }
      var resp = await r.json();
      var metaResp = await fetch(srvUrl + "/api/effects");
      if (!metaResp.ok) {
        console.error("[control] 重載後特效表讀取失敗", metaResp.status);
        return;
      }
      var data = await metaResp.json();
      var meta = normalizeEffects(data);
      if (meta) {
        await applyManifest(meta, (data && data.rev) || "", data, true);
      }
      console.info("[control] 特效表已重載", resp);
    } catch (err) {
      console.error("[control] 重載特效表失敗", err);
    } finally {
      reloadBtn.disabled = false;
    }
  }

  renderEffects(FALLBACK_EFFECTS, null, false);
  applyFabPos();
  window.__rtxConsoleReady = loadEffects();

  function fxElementFromPoint(x, y) {
    return document.elementFromPoint ? document.elementFromPoint(x, y) : null;
  }

  function fxZoneAt(x, y) {
    var el = fxElementFromPoint(x, y);
    if (el && el.closest) {
      var zone = el.closest(".rtx-fx-zone");
      if (zone === fxCurrent || zone === fxAlternate) return zone;
    }
    var currentRect = fxCurrent.getBoundingClientRect();
    if (x >= currentRect.left && x < currentRect.right && y >= currentRect.top && y < currentRect.bottom) {
      return fxCurrent;
    }
    var alternateRect = fxAlternate.getBoundingClientRect();
    if (x >= alternateRect.left && x < alternateRect.right && y >= alternateRect.top && y < alternateRect.bottom) {
      return fxAlternate;
    }
    return null;
  }

  function fxInsertionRef(zone, x, y, dragged) {
    var items = [];
    fxButtonEls.forEach(function (btn) {
      if (!zone.contains || !zone.contains(btn)) return;
      var r = fxLayoutRect(btn);
      if (!r) return;
      items.push({
        btn: btn,
        dragged: btn === dragged,
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width || 52,
        height: r.height || 52,
      });
    });
    if (!items.length) return null;
    items.sort(function (a, b) {
      return a.top - b.top || a.left - b.left;
    });
    var draggedIndex = -1;
    var nearest = null;
    var nearestIndex = -1;
    var nearestDist = Infinity;
    for (var ni = 0; ni < items.length; ni += 1) {
      if (items[ni].btn === dragged) draggedIndex = ni;
      if (items[ni].dragged) continue;
      var nearCenterX = items[ni].left + items[ni].width / 2;
      var nearCenterY = items[ni].top + items[ni].height / 2;
      var nearDx = x - nearCenterX;
      var nearDy = y - nearCenterY;
      var nearDist = Math.sqrt(nearDx * nearDx + nearDy * nearDy);
      if (nearDist < nearestDist) {
        nearestDist = nearDist;
        nearest = items[ni];
        nearestIndex = ni;
      }
    }
    var draggedId = dragged.getAttribute("data-fx");
    var currentOrder = zoneTypes(zone);
    var draggedPos = currentOrder.indexOf(draggedId);
    function refKeepingCurrentPosition() {
      if (draggedPos === -1 || draggedPos === currentOrder.length - 1) return null;
      var nextId = currentOrder[draggedPos + 1];
      for (var ci = 0; ci < items.length; ci += 1) {
        if (items[ci].btn.getAttribute("data-fx") === nextId) return items[ci].btn;
      }
      return null;
    }
    if (draggedIndex !== -1) {
      if (nearest && nearestDist <= FX_DRAG_TRIGGER_PX) {
        var nextAfter = null;
        for (var na = nearestIndex + 1; na < items.length; na += 1) {
          if (!items[na].dragged) {
            nextAfter = items[na].btn;
            break;
          }
        }
        var beforeRef = nearest.btn;
        var sideRef = x < nearest.left + nearest.width / 2 ? beforeRef : nextAfter;
        var otherIds = currentOrder.filter(function (id) {
          return id !== draggedId;
        });
        var insertAt = sideRef ? otherIds.indexOf(sideRef.getAttribute("data-fx")) : -1;
        if (insertAt === -1) insertAt = otherIds.length;
        otherIds.splice(insertAt, 0, draggedId);
        if (otherIds.join("\u0000") !== currentOrder.join("\u0000")) return sideRef;
        return sideRef === beforeRef ? nextAfter : beforeRef;
      }
      return refKeepingCurrentPosition();
    }
    var rows = [];
    items.forEach(function (item) {
      var last = rows[rows.length - 1];
      var tol = Math.max(8, item.height / 2);
      if (!last || Math.abs(item.top - last.top) > tol) {
        last = { top: item.top, bottom: item.bottom, items: [] };
        rows.push(last);
      }
      last.items.push(item);
      if (item.bottom > last.bottom) last.bottom = item.bottom;
    });
    var rowIndex = 0;
    var bestDist = Infinity;
    rows.forEach(function (row, i) {
      var mid = (row.top + row.bottom) / 2;
      var dist = Math.abs(y - mid);
      if (dist < bestDist) {
        bestDist = dist;
        rowIndex = i;
      }
    });
    var rowButtons = rows[rowIndex].items.filter(function (item) {
      return !item.dragged;
    });
    var col = rowButtons.length;
    for (var i = 0; i < rowButtons.length; i += 1) {
      var center = rowButtons[i].left + rowButtons[i].width / 2;
      if (x < center) {
        col = i;
        break;
      }
    }
    if (col < rowButtons.length) return rowButtons[col].btn;
    for (var next = rowIndex + 1; next < rows.length; next += 1) {
      for (var j = 0; j < rows[next].items.length; j += 1) {
        if (!rows[next].items[j].dragged) return rows[next].items[j].btn;
      }
    }
    return null;
  }

  function fxReorderTo(x, y) {
    if (!fxDrag || !fxDrag.active) return;
    var dragged = fxDrag.btn;
    var zone = fxZoneAt(x, y);
    if (!zone) return;
    var ref = fxInsertionRef(zone, x, y, dragged);
    var draggedId = fxDrag.id;
    var current = zoneTypes(zone);
    var target = current.filter(function (id) {
      return id !== draggedId;
    });
    var insertAt = ref ? target.indexOf(ref.getAttribute("data-fx")) : -1;
    if (insertAt === -1) insertAt = target.length;
    target.splice(insertAt, 0, draggedId);
    if (current.join("\u0000") === target.join("\u0000")) return;
    var oldRects = fxCaptureRects();
    zone.insertBefore(dragged, ref || null);
    fxStoreLayoutRects();
    fxPlayMove(oldRects, dragged);
  }

  function fxFollowCursor(x, y) {
    var btn = fxDrag.btn;
    var r = fxMeasureLayoutRect(btn);
    if (!r) return;
    btn.__fxLayoutRect = r;
    var dx = x - (r.left + r.width / 2);
    var dy = y - (r.top + r.height / 2);
    btn.style.transform = "translate(" + dx + "px," + dy + "px) scale(1.08)";
  }

  function fxReleaseDrag() {
    if (!fxDrag) return;
    var btn = fxDrag.btn;
    var oldRects = fxCaptureRects();
    btn.classList.remove("dragging");
    btn.style.zIndex = "";
    btn.style.pointerEvents = "";
    btn.style.transform = "";
    fxDrag = null;
    syncLayoutFromDom(oldRects);
  }

  function fxEndPointer() {
    if (!fxDrag) return;
    var wasDrag = fxDrag.active;
    if (wasDrag) {
      fxReleaseDrag();
      fxClickSuppressed = true;
      setTimeout(function () {
        fxClickSuppressed = false;
      }, 0);
    } else {
      fxDrag = null;
    }
  }

  window.addEventListener("pointermove", function (e) {
    if (!fxDrag) return;
    if (!fxDrag.active) {
      if (
        Math.abs(e.clientX - fxDrag.startX) <= DRAG_SLOP_PX &&
        Math.abs(e.clientY - fxDrag.startY) <= DRAG_SLOP_PX
      ) {
        return;
      }
      fxDrag.active = true;
      fxDrag.btn.classList.add("dragging");
      fxDrag.btn.style.zIndex = "30";
       fxDrag.btn.style.pointerEvents = "none";
    }
    fxStoreLayoutRects();
    fxReorderTo(e.clientX, e.clientY);
    fxFollowCursor(e.clientX, e.clientY);
    e.preventDefault();
  });
  window.addEventListener("pointerup", fxEndPointer);
  window.addEventListener("pointercancel", fxEndPointer);

  window.__rtxConsoleLayout = {
    getCurrent: function () {
      return fxLayoutState.current.slice();
    },
    getAlternate: function () {
      return fxLayoutState.alternate.slice();
    },
    move: moveEffect,
  };

  function bindToggle(btn, box) {
    btn.addEventListener("click", function () {
      var open = box.classList.toggle("open");
      btn.classList.toggle("active", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) applyFabPos();
    });
  }
  bindToggle(paramsBtn, paramsPanel);
  bindToggle(connBtn, connPanel);
  bindToggle(layoutBtn, fxAlternate);

  function headers() {
    var h = { "Content-Type": "application/json" };
    if (srvKey) h["X-Access-Key"] = srvKey;
    return h;
  }

  function paramsFor() {
    var out = {};
    fieldDefs(selected).forEach(function (d) {
      var input = document.getElementById("rtx-p-" + d.key);
      if (!input) return;
      if (d.coerce === "boolean") {
        out[d.key] = input.value === "true";
      } else if (d.type === "boolean") {
        out[d.key] = input.checked === true;
      } else if (d.type === "integer" || d.type === "number") {
        var n = Number(input.value);
        if (isNaN(n)) out[d.key] = d.def;
        else if (d.type === "integer") out[d.key] = Math.round(n);
        else out[d.key] = n;
      } else out[d.key] = input.value;
    });
    return out;
  }

  async function post(path, body) {
    try {
      var r = await fetch(srvUrl + path, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body || {}),
      });
      if (r.status === 401) {
        console.error("[control] 401 金鑰錯誤");
        return;
      }
      if (!r.ok) {
        console.error("[control] 請求失敗", r.status, await r.text());
        return;
      }
      console.info("[control] 已發送", path, body);
    } catch (err) {
      console.error("[control] 中繼連線中斷", err);
    }
  }

  clearBtn.addEventListener("click", function () {
    post("/api/clear", {});
  });

  reloadBtn.addEventListener("click", reloadEffectsTable);

  window.addEventListener("click", function (e) {
    if (e.target.closest("#rtx-panel") || e.target.closest("#rtx-fab")) return;
    var x = (e.clientX / window.innerWidth) * 100;
    var y = (e.clientY / window.innerHeight) * 100;
    post("/api/effect", {
      effect: selected,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      params: paramsFor(),
    });
  });
})();
