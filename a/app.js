(function () {
  "use strict";

  var cfg = window.CONTROL_CONFIG || {};
  var cUrl = localStorage.getItem("rtx.cUrl") || cfg.url || "http://localhost:8000";
  var cKey = localStorage.getItem("rtx.cKey") || cfg.key || "";

  var elUrl = document.getElementById("cUrl");
  var elKey = document.getElementById("cKey");
  elUrl.value = cUrl;
  elKey.value = cKey;

  function saveCfg() {
    cUrl = elUrl.value.trim().replace(/\/+$/, "");
    cKey = elKey.value.trim();
    localStorage.setItem("rtx.cUrl", cUrl);
    localStorage.setItem("rtx.cKey", cKey);
  }
  elUrl.addEventListener("change", saveCfg);
  elKey.addEventListener("change", saveCfg);

  var selected = "particle";
  var buttons = document.querySelectorAll("#fxButtons .fx");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      buttons.forEach(function (b) { b.classList.remove("selected"); });
      btn.classList.add("selected");
      selected = btn.getAttribute("data-fx");
    });
  });

  function headers() {
    var h = { "Content-Type": "application/json" };
    if (cKey) h["X-Access-Key"] = cKey;
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
      var r = await fetch(cUrl + path, {
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
