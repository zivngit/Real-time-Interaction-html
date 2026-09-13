(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  var DEFAULTS = {
    color: "#40c4ff",
    blockSize: 16,
    radius: 240,
    gravity: 1.2,
    duration: 1800
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
      return { r: 64, g: 196, b: 255 };
    }
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function shadeColor(base, f) {
    var r = Math.min(255, Math.max(0, Math.round(base.r * f)));
    var g = Math.min(255, Math.max(0, Math.round(base.g * f)));
    var b = Math.min(255, Math.max(0, Math.round(base.b * f)));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  window.Effects.register("pixel-melt", function (px, py, params) {
    var p = merge(params);
    var base = parseColor(p.color);
    var t = 0;
    var step = Math.max(4, Number(p.blockSize) || DEFAULTS.blockSize);
    var radius = Math.max(10, Number(p.radius) || DEFAULTS.radius);
    var gAccel = (Number(p.gravity) || 0) * 0.0009;

    var blocks = [];
    var maxDelay = 0;
    var i;
    for (var gx = Math.ceil(-radius / step); gx * step <= radius; gx++) {
      for (var gy = Math.ceil(-radius / step); gy * step <= radius; gy++) {
        var ox = gx * step + step / 2 + (Math.random() - 0.5) * step * 0.3;
        var oy = gy * step + step / 2 + (Math.random() - 0.5) * step * 0.3;
        var dist = Math.sqrt(ox * ox + oy * oy);
        if (dist > radius * (0.85 + Math.random() * 0.25)) continue;
        var nx = dist > 0.001 ? ox / dist : (Math.random() - 0.5) * 2;
        var ny = dist > 0.001 ? oy / dist : (Math.random() - 0.5) * 2;
        var burst = 0.05 + Math.random() * 0.22;
        var delay = dist * 0.25 + Math.random() * 60;
        if (delay > maxDelay) maxDelay = delay;
        var f = 0.6 + Math.random() * 0.8;
        blocks.push({
          x: ox,
          y: oy,
          vx: nx * burst + (Math.random() - 0.5) * 0.06,
          vy: ny * burst * 0.55 - 0.04,
          rot: 0,
          vrot: (Math.random() - 0.5) * 0.012,
          size: step * (0.55 + Math.random() * 0.75),
          delay: delay,
          color: shadeColor(base, f),
          glitch: Math.random()
        });
      }
    }
    for (i = 0; i < blocks.length; i++) {
      if (blocks[i].delay > p.duration - 150) {
        blocks[i].delay = Math.max(0, p.duration - 150 - Math.random() * 80);
      }
    }

    return {
      update: function (dt) {
        t += dt;
        var j;
        for (j = 0; j < blocks.length; j++) {
          var b = blocks[j];
          if (t < b.delay) continue;
          b.vy += gAccel * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.rot += b.vrot * dt;
        }
      },
      done: function () {
        return t >= p.duration;
      },
      draw: function (ctx) {
        // 開場白閃
        if (t < 140) {
          ctx.save();
          ctx.globalAlpha = (1 - t / 140) * 0.55;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(px, py, Math.max(1, radius * 0.5 * (0.4 + t / 140)), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 震波環
        if (t < 550) {
          ctx.save();
          ctx.globalAlpha = (1 - t / 550) * 0.7;
          ctx.strokeStyle = shadeColor(base, 1.2);
          ctx.lineWidth = 3 + (1 - t / 550) * 5;
          ctx.beginPath();
          ctx.arc(px, py, Math.max(1, radius * 1.15 * (t / 550)), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        var j;
        for (j = 0; j < blocks.length; j++) {
          var b = blocks[j];
          var life = t - b.delay;
          if (life <= 0) continue;
          var lifeK = Math.min(1, life / Math.max(1, p.duration - b.delay));
          var alpha = lifeK < 0.55 ? 1 : 1 - (lifeK - 0.55) / 0.45;
          if (alpha <= 0.02) continue;
          var scale = 1 - 0.65 * lifeK;
          var size = Math.max(0.5, b.size * scale);

          // 碎裂初期的 glitch 抖動與反色
          var jx = 0;
          var jy = 0;
          var fill = b.color;
          if (life < 220 && b.glitch < 0.5) {
            var gk = 1 - life / 220;
            jx = (Math.random() - 0.5) * b.size * 0.9 * gk;
            jy = (Math.random() - 0.5) * b.size * 0.9 * gk;
            if (Math.random() < 0.18 * gk) fill = "#ffffff";
          }

          ctx.save();
          ctx.translate(px + b.x + jx, py + b.y + jy);
          ctx.rotate(b.rot);
          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          ctx.fillStyle = fill;
          ctx.fillRect(-size / 2, -size / 2, size, size);
          ctx.restore();
        }
      },
    };
  });
})();
