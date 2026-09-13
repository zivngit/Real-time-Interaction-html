(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  var DEFAULTS = {
    color: "#9fd8ff",
    count: 240,
    speed: 1.5,
    duration: 2000
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
      return { r: 159, g: 216, b: 255 };
    }
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function shadeColor(base, f) {
    var r = Math.min(255, Math.max(0, Math.round(base.r * f)));
    var g = Math.min(255, Math.max(0, Math.round(base.g * f)));
    var b = Math.min(255, Math.max(0, Math.round(base.b * f)));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  window.Effects.register("hyper-warp", function (px, py, params) {
    var p = merge(params);
    var base = parseColor(p.color);
    var count = Math.max(1, Math.round(Number(p.count) || DEFAULTS.count));
    var speed = Math.max(0.1, Number(p.speed) || DEFAULTS.speed);
    var t = 0;

    var stars = [];
    for (var i = 0; i < count; i++) {
      var roll = Math.random();
      stars.push({
        angle: Math.random() * Math.PI * 2,
        r0: 4 + Math.random() * 46,
        v: 0.12 + Math.random() * 0.33,
        w: 0.8 + Math.random() * 1.8,
        a: 0.45 + Math.random() * 0.55,
        color:
          roll < 0.65
            ? shadeColor(base, 0.8 + Math.random() * 0.5)
            : roll < 0.85
              ? "#ffffff"
              : shadeColor(base, 1.1 + Math.random() * 0.4)
      });
    }

    // 位移 = 積分(0.15 + 2.85k²)dt，k = t/duration
    function travel(tt) {
      return 0.15 * tt + (2.85 * tt * tt * tt) / (3 * p.duration * p.duration);
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
        var w = ctx.canvas.width || 0;
        var h = ctx.canvas.height || 0;
        var maxR = Math.max(120, Math.sqrt(w * w + h * h) * 0.6);

        var flashK = k >= 0.85 ? (k - 0.85) / 0.15 : 0;
        var flash = flashK > 0 ? Math.sin(flashK * Math.PI) * 0.9 : 0;
        var fieldAlpha = Math.max(0, 1 - flash);
        var vel = (0.15 + 2.85 * k * k) * speed;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";

        var j;
        for (j = 0; j < stars.length; j++) {
          var s = stars[j];
          var r = s.r0 + s.v * speed * travel(t);
          if (r <= 2 || r > maxR) continue;
          var cycle = Math.floor(r / maxR);
          var angle = s.angle + cycle * 2.39996;
          var cos = Math.cos(angle);
          var sin = Math.sin(angle);
          var len = Math.min(130, 4 + vel * s.v * 64);
          var r0 = Math.max(2, r - len);
          var alpha = s.a * (0.45 + 0.55 * k) * fieldAlpha;
          if (alpha <= 0.01) continue;

          ctx.beginPath();
          ctx.moveTo(px + cos * r0, py + sin * r0);
          ctx.lineTo(px + cos * r, py + sin * r);
          ctx.strokeStyle = s.color;
          ctx.lineWidth = s.w;
          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          ctx.stroke();
        }

        // 中心核心光暈
        if (fieldAlpha > 0.01) {
          var coreR = 8 + 42 * Math.min(1, k / 0.85);
          ctx.globalAlpha = fieldAlpha * 0.35;
          ctx.fillStyle = shadeColor(base, 1.2);
          ctx.beginPath();
          ctx.arc(px, py, coreR * 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = fieldAlpha * 0.9;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(px, py, coreR * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // 尾段閃白（warp out）
        if (flash > 0.01) {
          ctx.save();
          ctx.globalAlpha = flash;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
          ctx.restore();
        }
      },
    };
  });
})();
