(function () {
  "use strict";

  var cfg = window.EFFECT_DISPLAY || {};
  var script = document.currentScript;
  var origin = null;
  if (script && script.src) {
    try {
      var u = new URL(script.src);
      if (u.pathname === "/app.js") origin = u.origin;
    } catch (e) {}
  }
  var base = String(cfg.url || origin || "http://localhost:8000").replace(/\/+$/, "");
  var key = cfg.key || (script ? script.getAttribute("data-key") : "") || "";

  function boot() {
    if (typeof Effects === "undefined") {
      console.error("[effects] Effects (effects.js) 未載入");
      return;
    }

    var canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:" +
      (cfg.zIndex != null ? cfg.zIndex : 2147483647) +
      ";";
    (cfg.appendTo || document.body).appendChild(canvas);
    var ctx = canvas.getContext("2d");

    function resize() {
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener("resize", resize);
    resize();

    var active = [];
    var raf = null;
    var last = 0;

    function tick(now) {
      var dt = Math.min(50, now - last);
      last = now;
      for (var i = active.length - 1; i >= 0; i--) {
        var e = active[i];
        e.update(dt);
        if (e.done()) {
          active.splice(i, 1);
        } else {
          e.draw(ctx);
        }
      }
      if (active.length) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        raf = null;
      }
    }

    function spawn() {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    }

    function clearAll() {
      active = [];
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      console.info("[effects] cleared");
    }

    function handleEffect(msg) {
      try {
        var pt = Effects.toPixels(msg.x, msg.y, window.innerWidth, window.innerHeight);
        var fx = Effects.createEffect(msg.effect, pt.px, pt.py, msg.params || {});
        active.push(fx);
        spawn();
      } catch (err) {
        console.warn("[effects] 特效建立失敗", err);
      }
    }

    var esUrl = base + "/api/stream" + (key ? "?key=" + encodeURIComponent(key) : "");
    var es = new EventSource(esUrl);
    var lastPing = Date.now();

    es.addEventListener("open", function () {
      console.info("[effects] 已連線", base);
    });
    es.addEventListener("effect", function (ev) {
      handleEffect(JSON.parse(ev.data));
    });
    es.addEventListener("clear", function () {
      clearAll();
    });
    es.addEventListener("ping", function () {
      lastPing = Date.now();
    });
    es.addEventListener("error", function () {
      console.warn("[effects] 串流斷線，重連中…");
    });
    setInterval(function () {
      if (Date.now() - lastPing > 45000) {
        console.warn("[effects] 45 秒未收到 ping，可能離線");
      }
    }, 5000);
  }

  if (typeof Effects !== "undefined") {
    boot();
  } else {
    var s = document.createElement("script");
    s.src = base + "/effects.js";
    s.onload = boot;
    s.onerror = function () {
      console.error("[effects] effects.js 載入失敗", s.src);
    };
    document.head.appendChild(s);
  }
})();
