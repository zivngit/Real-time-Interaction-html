(function () {
  "use strict";

  var cfg = window.CONTROL_CONFIG || {};
  var srvUrl = localStorage.getItem("rtx.srvUrl") || cfg.url || "http://localhost:8000";
  var srvKey = localStorage.getItem("rtx.srvKey") || cfg.key || "";

  var elUrl = document.getElementById("srvUrl");
  var elKey = document.getElementById("srvKey");
  elUrl.value = srvUrl;
  elKey.value = srvKey;

  function saveCfg() {
    srvUrl = elUrl.value.trim().replace(/\/+$/, "");
    srvKey = elKey.value.trim();
    localStorage.setItem("rtx.srvUrl", srvUrl);
    localStorage.setItem("rtx.srvKey", srvKey);
  }
  elUrl.addEventListener("change", saveCfg);
  elKey.addEventListener("change", saveCfg);

  var fab = document.getElementById("fab");
  var panel = document.getElementById("panel");
  var suppressClick = false;
  fab.addEventListener("click", function () {
    if (suppressClick) return;
    var open = panel.classList.toggle("open");
    fab.classList.toggle("active", open);
    fab.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // 按住 #fab 拖曳移動（位移 >8px 即啟動，無等待；panel 跟隨，fab/panel 皆限制於視窗內）；短按仍為展開/收合
  var DRAG_SLOP_PX = 8;
  var FAB_SIZE = 44;
  var FAB_GAP = 54;
  var fabPos = { x: 12, y: 12 };
  var drag = null;

  function applyFabPos() {
    fabPos.x = Math.max(0, Math.min(fabPos.x, window.innerWidth - FAB_SIZE));
    fabPos.y = Math.max(0, Math.min(fabPos.y, window.innerHeight - FAB_SIZE));
    fab.style.left = fabPos.x + "px";
    fab.style.top = fabPos.y + "px";
    var pw = panel.offsetWidth || 0;
    var ph = panel.offsetHeight || 0;
    var pLeft = Math.max(8, Math.min(fabPos.x, window.innerWidth - pw - 8));
    var pTop = fabPos.y + FAB_GAP;
    if (pTop + ph > window.innerHeight - 8) pTop = fabPos.y - ph - 10;
    pTop = Math.max(8, Math.min(pTop, window.innerHeight - ph - 8));
    panel.style.left = pLeft + "px";
    panel.style.top = pTop + "px";
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

  var PARAM_DEFS = {
    particle: [
      { key: "color", label: "顏色", type: "color", def: "#ff0044" },
      { key: "count", label: "數量", type: "number", def: 40, min: 1, max: 400, step: 1 },
      { key: "spread", label: "散佈(度)", type: "number", def: 360, min: 0, max: 360, step: 5 },
      { key: "speed", label: "速度", type: "number", def: 0.35, min: 0.05, max: 2, step: 0.05 },
      { key: "duration", label: "持續(ms)", type: "number", def: 1200, min: 200, max: 8000, step: 100 },
    ],
    firework: [
      { key: "count", label: "數量", type: "number", def: 90, min: 1, max: 400, step: 1 },
      { key: "duration", label: "持續(ms)", type: "number", def: 1800, min: 200, max: 8000, step: 100 },
    ],
    ripple: [
      { key: "color", label: "顏色", type: "color", def: "#44aaff" },
      { key: "maxRadius", label: "最大半徑", type: "number", def: 200, min: 20, max: 600, step: 10 },
      { key: "duration", label: "持續(ms)", type: "number", def: 1200, min: 200, max: 8000, step: 100 },
    ],
    text: [
      { key: "content", label: "文字", type: "text", def: "Hello" },
      { key: "color", label: "顏色", type: "color", def: "#ffffff" },
      { key: "size", label: "字級", type: "number", def: 32, min: 8, max: 160, step: 2 },
      { key: "duration", label: "持續(ms)", type: "number", def: 2000, min: 200, max: 10000, step: 100 },
    ],
  };

  var selected = "particle";
  var paramsBody = document.getElementById("paramsBody");

  function renderParams() {
    paramsBody.innerHTML = "";
    (PARAM_DEFS[selected] || []).forEach(function (d) {
      var row = document.createElement("div");
      row.className = "field";
      var label = document.createElement("label");
      label.textContent = d.label;
      var input = document.createElement("input");
      input.id = "p-" + d.key;
      input.type = d.type;
      input.value = d.def;
      if (d.type === "number") {
        input.min = d.min;
        input.max = d.max;
        input.step = d.step;
      }
      row.appendChild(label);
      row.appendChild(input);
      paramsBody.appendChild(row);
    });
  }

  var buttons = document.querySelectorAll("#fxButtons .fx");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      buttons.forEach(function (el) { el.classList.remove("selected"); });
      btn.classList.add("selected");
      selected = btn.getAttribute("data-fx");
      renderParams();
    });
  });

  function bindToggle(btnId, panelId) {
    var btn = document.getElementById(btnId);
    var box = document.getElementById(panelId);
    btn.addEventListener("click", function () {
      var open = box.classList.toggle("open");
      btn.classList.toggle("active", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) applyFabPos();
    });
  }
  bindToggle("paramsBtn", "paramsPanel");
  bindToggle("connBtn", "connPanel");
  renderParams();

  function headers() {
    var h = { "Content-Type": "application/json" };
    if (srvKey) h["X-Access-Key"] = srvKey;
    return h;
  }

  function paramsFor() {
    var out = {};
    (PARAM_DEFS[selected] || []).forEach(function (d) {
      var input = document.getElementById("p-" + d.key);
      if (!input) return;
      out[d.key] = d.type === "number" ? Number(input.value) : input.value;
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

  document.getElementById("clearBtn").addEventListener("click", function () {
    post("/api/clear", {});
  });

  window.addEventListener("click", function (e) {
    if (e.target.closest("#panel") || e.target.closest("#fab")) return;
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
