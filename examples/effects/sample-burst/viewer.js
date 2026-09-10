(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  var DEFAULTS = {
    count: 40,
    spread: 360,
    speed: 0.35,
    duration: 1200,
    content: "Sample",
    color: "#ff5252",
    secondaryColor: "#ffd740",
    sparkle: true,
    style: "circle",
    palette: ["#ff5252", "#ffd740", "#40c4ff", "#69f0ae"],
  };

  var STYLES = { circle: true, square: true, ring: true };

  function rand(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function merge(params) {
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      out[k] = DEFAULTS[k];
    });
    Object.keys(params || {}).forEach(function (k) {
      if (params[k] != null) out[k] = params[k];
    });
    return out;
  }

  function makeBurst(px, py, p) {
    var n = clamp(Math.round(num(p.count, DEFAULTS.count)), 1, 400);
    var spreadRad = (clamp(num(p.spread, DEFAULTS.spread), 0, 360) * Math.PI) / 180;
    var speed = num(p.speed, DEFAULTS.speed);
    var duration = clamp(Math.round(num(p.duration, DEFAULTS.duration)), 200, 8000);
    var content = typeof p.content === "string" ? p.content : DEFAULTS.content;
    var style = STYLES[p.style] ? p.style : DEFAULTS.style;
    var sparkle = p.sparkle === true;
    var colors =
      p.palette && p.palette.length
        ? p.palette
        : [
            typeof p.color === "string" ? p.color : DEFAULTS.color,
            typeof p.secondaryColor === "string" ? p.secondaryColor : DEFAULTS.secondaryColor,
          ];
    var startAngle = rand(0, Math.PI * 2);
    var particles = [];
    for (var i = 0; i < n; i++) {
      var angle = startAngle + (i / n) * spreadRad + rand(-0.2, 0.2);
      particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed * rand(0.5, 1.2),
        vy: Math.sin(angle) * speed * rand(0.5, 1.2),
        r: rand(2, 4),
        life: 0,
        ttl: duration * rand(0.6, 1),
        color: colors[i % colors.length],
        phase: rand(0, Math.PI * 2),
      });
    }
    var elapsed = 0;
    return {
      update: function (dt) {
        elapsed += dt;
        for (var i = 0; i < particles.length; i++) {
          var q = particles[i];
          q.life += dt;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
        }
      },
      done: function () {
        return elapsed >= duration;
      },
      draw: function (ctx) {
        var i, q, alpha;
        for (i = 0; i < particles.length; i++) {
          q = particles[i];
          if (q.life >= q.ttl) continue;
          alpha = 1 - q.life / q.ttl;
          if (sparkle) alpha *= 0.7 + 0.3 * Math.sin(q.phase + q.life * 0.02);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = q.color;
          ctx.beginPath();
          if (style === "square") {
            ctx.fillRect(q.x - q.r, q.y - q.r, q.r * 2, q.r * 2);
          } else if (style === "ring") {
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = q.color;
            ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (content) {
          var k = clamp(elapsed / duration, 0, 1);
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = colors[0];
          ctx.font = "600 20px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(content, px, py - 24 - k * 32);
        }
        ctx.globalAlpha = 1;
      },
    };
  }

  window.Effects.register("sample-burst", function (px, py, params) {
    var p = merge(params);
    return makeBurst(px, py, p);
  });
})();
