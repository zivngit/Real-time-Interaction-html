(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  var DEFAULTS = { colors: ["#ff5252", "#ffd740", "#40c4ff", "#69f0ae"], count: 90, duration: 1800 };

  function rand(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

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

  function makeBurst(opts) {
    var n = clamp(opts.count | 0, 1, 400);
    var spreadRad = (clamp(opts.spread, 0, 360) * Math.PI) / 180;
    var startAngle = rand(0, Math.PI * 2);
    var colors = opts.colors && opts.colors.length ? opts.colors : [opts.color || "#ffffff"];
    var gravity = opts.gravity != null ? opts.gravity : 0.0004;
    var drag = opts.drag != null ? opts.drag : 0.985;
    var particles = [];
    for (var i = 0; i < n; i++) {
      var angle = startAngle + (i / n) * spreadRad + rand(-0.2, 0.2);
      var speed = opts.speed * rand(0.5, 1.2);
      particles.push({
        x: opts.px,
        y: opts.py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: rand(1.5, 3.5),
        life: 0,
        ttl: opts.duration * rand(0.6, 1.0),
        color: colors[i % colors.length],
      });
    }
    return {
      update: function (dt) {
        var dragF = Math.pow(drag, dt);
        for (var i = 0; i < particles.length; i++) {
          var q = particles[i];
          q.life += dt;
          q.vy += gravity * dt;
          q.vx *= dragF;
          q.vy *= dragF;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
        }
      },
      done: function () {
        for (var i = 0; i < particles.length; i++) {
          if (particles[i].life < particles[i].ttl) return false;
        }
        return true;
      },
      draw: function (ctx) {
        for (var i = 0; i < particles.length; i++) {
          var q = particles[i];
          if (q.life >= q.ttl) continue;
          ctx.globalAlpha = 1 - q.life / q.ttl;
          ctx.fillStyle = q.color;
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
    };
  }

  window.Effects.register("firework", function (px, py, params) {
    var p = merge(params);
    return makeBurst({
      px: px,
      py: py,
      count: p.count,
      spread: 360,
      speed: 0.3,
      duration: p.duration,
      colors: p.colors,
      gravity: 0.0012,
      drag: 0.98,
    });
  });
})();
