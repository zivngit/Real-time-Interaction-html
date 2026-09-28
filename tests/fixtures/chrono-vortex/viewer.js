(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  var DEFAULTS = {
    coreColor: "#111111",
    ringColor: "#ffffff",
    glitchColor1: "#00ff88",
    glitchColor2: "#ff44ff",
    maxRadius: 350,
    streakCount: 24,
    flash: 0.95,
    duration: 2200
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

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function easeOutCubic(x) {
    var y = 1 - x;
    return 1 - y * y * y;
  }

  function easeInCubic(x) {
    return x * x * x;
  }

  function windowEnv(k, a, b, c, d) {
    if (k <= a || k >= d) return 0;
    if (k < b) return (k - a) / (b - a);
    if (k < c) return 1;
    return (d - k) / (d - c);
  }

  window.Effects.register("chrono-vortex", function (px, py, params) {
    var p = merge(params);
    var maxR = clamp(Number(p.maxRadius) || DEFAULTS.maxRadius, 100, 800);
    var count = Math.round(clamp(Number(p.streakCount) || 0, 0, 60));
    var flashMax = clamp(Number(p.flash) == null ? DEFAULTS.flash : Number(p.flash), 0, 1);
    var duration = Math.max(300, Number(p.duration) || DEFAULTS.duration);

    var t = 0;
    var rot = 0;

    var streaks = [];
    for (var i = 0; i < count; i++) {
      streaks.push({
        angle: (i / Math.max(1, count)) * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
        width: 1.2 + Math.random() * 2.4,
        reach: 1.02 + Math.random() * 0.22
      });
    }

    function flashAt(k) {
      var fk = (k - 0.58) / 0.32;
      if (fk <= 0 || fk >= 1) return 0;
      return flashMax * Math.sin(fk * Math.PI);
    }

    function drawGlowSet(ctx, ox, oy, color, alphaScale, R) {
      var rRing = Math.max(2, R * 0.62);

      ctx.strokeStyle = color;
      ctx.globalAlpha = clamp(0.3 * alphaScale, 0, 1);
      ctx.lineWidth = Math.max(2, R * 0.34);
      ctx.beginPath();
      ctx.arc(ox, oy, rRing, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = clamp(0.9 * alphaScale, 0, 1);
      ctx.lineWidth = Math.max(1, R * 0.06);
      ctx.beginPath();
      ctx.arc(ox, oy, rRing, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineCap = "round";
      for (var j = 0; j < streaks.length; j++) {
        var s = streaks[j];
        var a = s.angle + rot;
        var flick = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.018 + s.phase));
        var rIn = rRing * 0.92;
        var rOut = R * s.reach * (0.94 + 0.06 * Math.sin(t * 0.011 + s.phase));
        ctx.globalAlpha = clamp(flick * alphaScale, 0, 1);
        ctx.lineWidth = s.width;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(ox + Math.cos(a) * rIn, oy + Math.sin(a) * rIn);
        ctx.lineTo(ox + Math.cos(a) * rOut, oy + Math.sin(a) * rOut);
        ctx.stroke();
      }
    }

    return {
      update: function (dt) {
        t += dt;
        rot += dt * 0.0016 * (1 + 4 * Math.min(1, t / duration));
      },
      done: function () {
        return t >= duration;
      },
      draw: function (ctx) {
        var k = clamp(t / duration, 0, 1);
        var w = ctx.canvas.width || 0;
        var h = ctx.canvas.height || 0;

        var grow = easeOutCubic(Math.min(1, k / 0.22));
        var recede = k > 0.86 ? 1 - easeInCubic((k - 0.86) / 0.14) : 1;
        var R = Math.max(1, maxR * grow * recede);
        var fade = Math.min(1, recede * 1.4);
        var flash = flashAt(k);

        // 1. 背景壓暗
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = clamp(0.3 * grow * recede * (1 - flash), 0, 1);
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, w, h);
        ctx.restore();

        // 2. 核心光暈（環色漸層）
        if (fade > 0.01) {
          var haloR = Math.max(2, R * 1.3);
          var grad = ctx.createRadialGradient(px, py, R * 0.5, px, py, haloR);
          grad.addColorStop(0, p.ringColor);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.35 * fade;
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(px, py, haloR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 3. 白環 + 放射光線（含綠/品紅色彩失真層）
        var ab =
          6 *
          windowEnv(k, 0.28, 0.36, 0.78, 0.9) *
          (0.65 + 0.35 * Math.sin(t * 0.045) * Math.sin(t * 0.013 + 1));
        var alphaScale = fade * (0.85 + 0.15 * Math.sin(t * 0.03));

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        if (ab > 0.05) {
          drawGlowSet(ctx, px + ab, py, p.glitchColor1, alphaScale, R);
          drawGlowSet(ctx, px - ab, py, p.glitchColor2, alphaScale, R);
        }
        drawGlowSet(ctx, px, py, p.ringColor, alphaScale, R);
        ctx.restore();

        // 4. 黑洞核心
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = clamp(0.95 * fade, 0, 1);
        ctx.fillStyle = p.coreColor;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1, R * 0.52), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 5. 全場白熲
        if (flash > 0.02) {
          ctx.save();
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = clamp(flash, 0, 1);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);

          var glowR = Math.max(2, R * 1.8);
          var fg = ctx.createRadialGradient(px, py, 0, px, py, glowR);
          fg.addColorStop(0, "#ffffff");
          fg.addColorStop(1, "rgba(255,255,255,0)");
          ctx.globalAlpha = clamp(flash * 0.8, 0, 1);
          ctx.fillStyle = fg;
          ctx.fillRect(0, 0, w, h);

          if (flash > 0.4) {
            var ringR = Math.max(2, R * 0.62);
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = clamp(flash * 0.9, 0, 1);
            ctx.strokeStyle = p.glitchColor1;
            ctx.lineWidth = Math.max(1, R * 0.05);
            ctx.beginPath();
            ctx.arc(px + ab * 0.6, py, ringR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = p.glitchColor2;
            ctx.beginPath();
            ctx.arc(px - ab * 0.6, py, ringR, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
      },
    };
  });
})();
