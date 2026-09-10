(function () {
  "use strict";

  var cfg = window.EFFECT_DISPLAY || {};
  var script = document.currentScript;
  var origin = null;
  if (script && script.src) {
    try {
      var u = new URL(script.src);
      if (u.pathname === "/viewer/app.js") origin = u.origin;
    } catch (e) {}
  }
  var base = String(cfg.url || origin || "http://localhost:8000").replace(/\/+$/, "");
  var key = cfg.key || (script ? script.getAttribute("data-key") : "") || "";

  function loadScript(src) {
    return new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () {
        resolve(true);
      };
      s.onerror = function () {
        resolve(false);
      };
      document.head.appendChild(s);
    });
  }

  function boot() {
    console.info("[effects] v4 已載入（manifest 動態載入特效插件）", (script && script.src) || "(inline)");

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
      var i, e;
      for (i = active.length - 1; i >= 0; i--) {
        e = active[i];
        Effects.stepEffect(e, now - e.born);
        if (e.done()) active.splice(i, 1);
      }
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (i = 0; i < active.length; i++) {
        active[i].draw(ctx);
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
      } else if (timer != null) {
        clearInterval(timer);
        timer = null;
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

  async function start() {
    if (typeof Effects === "undefined") {
      var coreOk = await loadScript(base + "/viewer/effects.js");
      if (!coreOk || typeof Effects === "undefined") {
        console.error("[effects] Effects (viewer/effects.js) 載入失敗");
        return;
      }
    }

    var effects = {};
    try {
      var r = await fetch(base + "/api/effects");
      if (!r.ok) throw new Error("status " + r.status);
      var manifest = await r.json();
      effects = (manifest && manifest.effects) || {};
    } catch (err) {
      console.error("[effects] /api/effects 載入失敗", err);
    }

    var urls = Object.keys(effects)
      .map(function (id) {
        return effects[id] && effects[id].viewerUrl;
      })
      .filter(Boolean);
    if (urls.length) {
      var results = await Promise.all(
        urls.map(function (u) {
          return loadScript(base + u);
        })
      );
      urls.forEach(function (u, i) {
        if (!results[i]) console.warn("[effects] 特效插件載入失敗，略過", u);
      });
    }

    boot();
  }

  start();
})();
