(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  var DEFAULTS = {
    color: "#59ffb0",
    color2: "#b459ff",
    bandWidth: 480,
    height: 260,
    shimmer: 1,
    duration: 5000
  };

  function merge(params) {
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      out[k] = DEFAULTS[k];
    });
    Object.keys(params || {}).forEach(function (k) {
      out[k] = params[k];
    });
    return out;
  }

  function parseColor(hex) {
    var h = String(hex == null ? "" : hex).replace("#", "");
    if (h.length === 8) h = h.slice(0, 6);
    var n = parseInt(h, 16);
    if (h.length !== 6 || isNaN(n)) {
      return { r: 89, g: 255, b: 176 };
    }
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(c, a) {
    return "rgba(" + c.r + "," + c.g + "," + c.b + "," + Math.max(0, Math.min(1, a)) + ")";
  }

  window.Effects.register("aurora", function (px, py, params) {
    var p = merge(params);
    var low = parseColor(p.color);
    var high = parseColor(p.color2);
    var bandWidth = Math.max(40, Number(p.bandWidth) || DEFAULTS.bandWidth);
    var height = Math.max(40, Number(p.height) || DEFAULTS.height);
    var shimmer = Math.max(0, Number(p.shimmer) || 0);
    var t = 0;

    var N = 48;
    var strips = [];
    for (var i = 0; i < N; i++) {
      strips.push({
        u: i / (N - 1),
        ph1: Math.random() * Math.PI * 2,
        ph2: Math.random() * Math.PI * 2,
        ph3: Math.random() * Math.PI * 2,
        ph4: Math.random() * Math.PI * 2
      });
    }

    return {
      update: function (dt) {
        t += dt;
      },
      done: function () {
        return t >= p.duration;
      },
      draw: function (ctx) {
        var k = Math.min(1, t / p.duration);
        // 淡入 10%、淡出 15%
        var env = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
        if (env <= 0.01) return;
        var ts = t / 1000;
        var sw = (bandWidth / N) * 1.6;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        // 地面光暈
        var glowR = bandWidth * 0.62;
        var glow = ctx.createRadialGradient(px, py, 0, px, py, glowR);
        glow.addColorStop(0, rgba(low, 0.28 * env));
        glow.addColorStop(1, rgba(low, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(px - glowR, py - glowR, glowR * 2, glowR * 2);

        // 光幕條帶
        var j;
        for (j = 0; j < N; j++) {
          var s = strips[j];
          var baseX = px + (s.u - 0.5) * bandWidth;
          var x =
            baseX +
            (18 * Math.sin(ts * 0.9 + s.u * 4.2 + s.ph1) +
              10 * Math.sin(ts * 1.7 + s.u * 7.7 + s.ph2)) *
              shimmer;
          var h = height * (0.72 + 0.28 * Math.sin(ts * 0.6 + s.u * 3.1 + s.ph3));
          var bright = 0.55 + 0.45 * Math.sin(ts * 1.1 - s.u * 5 + s.ph4);
          var a = bright * env * 0.5;

          var grad = ctx.createLinearGradient(0, py, 0, py - h);
          grad.addColorStop(0, rgba(low, a * 0.9));
          grad.addColorStop(0.55, rgba(high, a * 0.5));
          grad.addColorStop(1, rgba(high, 0));
          ctx.fillStyle = grad;
          ctx.fillRect(x - sw / 2, py - h, sw, h);
        }

        ctx.restore();
      },
    };
  });
})();
