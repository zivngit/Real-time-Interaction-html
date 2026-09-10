(function (root, factory) {
  "use strict";
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory();
  } else {
    root.Effects = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var EFFECTS = {
    particle: {
      name: "粒子爆散",
      params: { color: "#ff0044", count: 40, spread: 360, speed: 0.35, duration: 1200 },
    },
    ripple: {
      name: "漣漪圈",
      params: { color: "#44aaff", maxRadius: 200, duration: 1200 },
    },
    firework: {
      name: "煙火",
      params: { colors: ["#ff5252", "#ffd740", "#40c4ff", "#69f0ae"], count: 90, duration: 1800 },
    },
    text: {
      name: "浮現文字",
      params: { content: "Hello", size: 32, duration: 2000, color: "#ffffff" },
    },
  };

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function toPixels(x, y, w, h) {
    return { px: (x / 100) * w, py: (y / 100) * h };
  }

  function toPercent(px, py, w, h) {
    return { x: (px / w) * 100, y: (py / h) * 100 };
  }

  function rand(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }

  function mergeDefaults(type, params) {
    var base = (EFFECTS[type] && EFFECTS[type].params) || {};
    var out = {};
    Object.keys(base).forEach(function (k) {
      out[k] = base[k];
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

  function makeRipple(px, py, params) {
    var p = mergeDefaults("ripple", params);
    var t = 0;
    var rings = 3;
    var ringGap = 0.18;
    return {
      update: function (dt) {
        t += dt;
      },
      done: function () {
        return t >= p.duration;
      },
      draw: function (ctx) {
        var k = t / p.duration;
        for (var i = 0; i < rings; i++) {
          var rt = k - i * ringGap;
          if (rt < 0 || rt > 1) continue;
          var r = Math.max(1, rt * p.maxRadius);
          ctx.globalAlpha = (1 - rt) * 0.8;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, 4 * (1 - rt));
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      },
    };
  }

  function makeText(px, py, params) {
    var p = mergeDefaults("text", params);
    var t = 0;
    return {
      update: function (dt) {
        t += dt;
      },
      done: function () {
        return t >= p.duration;
      },
      draw: function (ctx) {
        var k = t / p.duration;
        var alpha = k < 0.2 ? k / 0.2 : k > 0.7 ? (1 - k) / 0.3 : 1;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color || "#ffffff";
        ctx.font = "600 " + p.size + "px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.content || "", px, py - 24 * k);
        ctx.globalAlpha = 1;
      },
    };
  }

  function stepEffect(effect, targetElapsed, maxStep) {
    maxStep = maxStep || 50;
    if (effect.elapsed == null) effect.elapsed = 0;
    var adv = targetElapsed - effect.elapsed;
    while (adv > 0) {
      var s = Math.min(maxStep, adv);
      effect.update(s);
      effect.elapsed += s;
      adv -= s;
    }
  }

  function createEffect(type, px, py, params) {
    params = params || {};
    switch (type) {
      case "particle": {
        var p = mergeDefaults("particle", params);
        return makeBurst({
          px: px,
          py: py,
          count: p.count,
          spread: p.spread,
          speed: p.speed,
          duration: p.duration,
          color: p.color,
        });
      }
      case "ripple":
        return makeRipple(px, py, params);
      case "firework": {
        var f = mergeDefaults("firework", params);
        return makeBurst({
          px: px,
          py: py,
          count: f.count,
          spread: 360,
          speed: 0.3,
          duration: f.duration,
          colors: f.colors,
          gravity: 0.0012,
          drag: 0.98,
        });
      }
      case "text":
        return makeText(px, py, params);
      default:
        throw new Error("unknown effect: " + type);
    }
  }

  return {
    EFFECTS: EFFECTS,
    createEffect: createEffect,
    stepEffect: stepEffect,
    toPixels: toPixels,
    toPercent: toPercent,
    clamp: clamp,
  };
});
