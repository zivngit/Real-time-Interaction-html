(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  var DEFAULTS = {
    color: "#ff6a1f",
    size: 1,
    speed: 1,
    sparks: 60,
    duration: 4000
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
      return { r: 255, g: 106, b: 31 };
    }
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function mix(c1, c2, f) {
    f = Math.max(0, Math.min(1, f));
    return {
      r: Math.round(c1.r + (c2.r - c1.r) * f),
      g: Math.round(c1.g + (c2.g - c1.g) * f),
      b: Math.round(c1.b + (c2.b - c1.b) * f)
    };
  }

  function rgba(c, a) {
    return "rgba(" + c.r + "," + c.g + "," + c.b + "," + Math.max(0, Math.min(1, a)) + ")";
  }

  window.Effects.register("fire-dragon", function (px, py, params) {
    var p = merge(params);
    var base = parseColor(p.color);
    var size = Math.max(0.3, Number(p.size) || DEFAULTS.size);
    var speed = Math.max(0.2, Number(p.speed) || DEFAULTS.speed);
    var maxSparks = Math.max(0, Math.round(Number(p.sparks) || 0));
    var t = 0;

    var headCol = mix(base, { r: 255, g: 255, b: 255 }, 0.7);
    var midCol = base;
    var tailCol = { r: Math.round(base.r * 0.45), g: Math.round(base.g * 0.4), b: Math.round(base.b * 0.4) };

    var N = 26;
    var DELAY = 18;

    function headPos(tt) {
      tt = Math.max(0, tt);
      var s = tt * speed;
      var kp = Math.min(1, tt / p.duration);
      var climb = Math.pow(kp, 0.75) * 320;
      var ang = s * 0.0042;
      var rad = 60 + 26 * Math.sin(s * 0.0016 + 1.2);
      return {
        x: px + Math.cos(ang) * rad,
        y: py - climb + Math.sin(ang) * rad * 0.55
      };
    }

    function segColor(f) {
      return f < 0.35 ? mix(headCol, midCol, f / 0.35) : mix(midCol, tailCol, (f - 0.35) / 0.65);
    }

    var sparks = [];
    var spawnAcc = 0;

    return {
      update: function (dt) {
        t += dt;

        spawnAcc += (dt * maxSparks) / p.duration;
        while (spawnAcc >= 1) {
          spawnAcc -= 1;
          if (t < p.duration - 400 && sparks.length < maxSparks) {
            var i = Math.floor(Math.pow(Math.random(), 1.6) * N);
            var pos = headPos(t - i * DELAY);
            sparks.push({
              x: pos.x + (Math.random() - 0.5) * 10 * size,
              y: pos.y + (Math.random() - 0.5) * 10 * size,
              vx: (Math.random() - 0.5) * 0.06,
              vy: -(0.015 + Math.random() * 0.09),
              age: 0,
              life: 350 + Math.random() * 600,
              r: (0.8 + Math.random() * 2.2) * size,
              col: mix(base, { r: 255, g: 220, b: 120 }, Math.random() * 0.5)
            });
          }
        }

        for (var j = sparks.length - 1; j >= 0; j--) {
          var sp = sparks[j];
          sp.age += dt;
          sp.x += sp.vx * dt;
          sp.y += sp.vy * dt;
          if (sp.age >= sp.life) sparks.splice(j, 1);
        }
      },
      done: function () {
        return t >= p.duration;
      },
      draw: function (ctx) {
        var k = Math.min(1, t / p.duration);
        var env = k < 0.08 ? k / 0.08 : k > 0.85 ? Math.max(0, (1 - k) / 0.15) : 1;
        if (env <= 0.01) return;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";

        var j;
        for (j = 0; j < sparks.length; j++) {
          var sp = sparks[j];
          var sa = (1 - sp.age / sp.life) * 0.8 * env;
          if (sa <= 0.02) continue;
          ctx.globalAlpha = sa;
          ctx.fillStyle = rgba(sp.col, 1);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // 身體：由尾往首繪製
        var i;
        for (i = N - 1; i >= 0; i--) {
          var pos = headPos(t - i * DELAY);
          var f = i / N;
          var taper = Math.pow(1 - f, 0.9);
          var flicker = 1 + 0.12 * Math.sin(t * 0.03 * (1 + i * 0.13) + i * 1.7);
          var r = Math.max(1, 9 * size * (0.25 + 0.75 * taper) * flicker);
          var col = segColor(f);
          var alpha = (1 - f * 0.55) * env;

          ctx.globalAlpha = alpha;
          ctx.fillStyle = rgba(col, 1);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r * 1.9, 0, Math.PI * 2);
          ctx.globalAlpha = alpha * 0.35;
          ctx.fill();
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // 龍頭：光暈＋核心
        var hp = headPos(t);
        var hr = 9 * size * (0.9 + 0.12 * Math.sin(t * 0.045));
        var glow = ctx.createRadialGradient(hp.x, hp.y, 0, hp.x, hp.y, hr * 3);
        glow.addColorStop(0, rgba(headCol, 0.85 * env));
        glow.addColorStop(0.4, rgba(base, 0.4 * env));
        glow.addColorStop(1, rgba(base, 0));
        ctx.globalAlpha = 1;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(hp.x, hp.y, hr * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = env;
        ctx.fillStyle = rgba(headCol, 1);
        ctx.beginPath();
        ctx.arc(hp.x, hp.y, hr * 0.75, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      },
    };
  });
})();
