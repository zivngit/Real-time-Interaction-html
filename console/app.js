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
    if (e.target.closest("#panel")) return;
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
