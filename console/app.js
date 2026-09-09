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

  var selected = "particle";
  var buttons = document.querySelectorAll("#fxButtons .fx");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      buttons.forEach(function (el) { el.classList.remove("selected"); });
      btn.classList.add("selected");
      selected = btn.getAttribute("data-fx");
    });
  });

  function headers() {
    var h = { "Content-Type": "application/json" };
    if (srvKey) h["X-Access-Key"] = srvKey;
    return h;
  }

  function paramsFor() {
    var color = document.getElementById("color").value;
    var text = document.getElementById("text").value;
    switch (selected) {
      case "particle":
        return { color: color };
      case "ripple":
        return { color: color };
      case "firework":
        return {};
      case "text":
        return { content: text || "Hello", color: color };
      default:
        return {};
    }
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
