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
    var rafPending = false;
    var timer = null;

    function tick() {
      var now = performance.now();
      for (var i = active.length - 1; i >= 0; i--) {
        var e = active[i];
        Effects.stepEffect(e, now - e.born);
        if (e.done()) {
          active.splice(i, 1);
        } else {
          e.draw(ctx);
        }
      }
      if (active.length) {
        if (timer == null) timer = setInterval(tick, 100);
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(function () {
            rafPending = false;
            tick();
          });
        }
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        if (timer != null) {
          clearInterval(timer);
          timer = null;
        }
      }
    }

    function spawn() {
      if (timer == null && !rafPending) tick();
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
        fx.born = performance.now();
        fx.elapsed = 0;
        active.push(fx);
        spawn();
      } catch (err) {
        console.warn("[effects] 特效建立失敗", err);
      }
    }

    var esUrl = base + "/api/stream" + (key ? "?key=" + encodeURIComponent(key) : "");
    var es = new EventSource(esUrl);
    var lastPing = Date.now();
    var connected = false;
    var pingWarned = false;

    es.addEventListener("open", function () {
      if (!connected) {
        connected = true;
        pingWarned = false;
        console.info("[effects] 已連線", base);
      }
    });
    es.addEventListener("effect", function (ev) {
      handleEffect(JSON.parse(ev.data));
    });
    es.addEventListener("clear", function () {
      clearAll();
    });
    es.addEventListener("ping", function () {
      lastPing = Date.now();
      pingWarned = false;
    });
    es.addEventListener("error", function () {
      if (!connected) return;
      connected = false;
      if (es.readyState === EventSource.CLOSED) {
        console.warn("[effects] 串流已關閉");
      } else {
        console.warn("[effects] 串流斷線，重連中…");
      }
    });
    setInterval(function () {
      if (!pingWarned && Date.now() - lastPing > 45000) {
        pingWarned = true;
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
