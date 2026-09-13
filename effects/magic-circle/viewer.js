(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  var DEFAULTS = { 
    color1: "#ffaa00", 
    color2: "#ffffff", 
    ringColors: ["#ffaa00", "#ffeedd", "#ffffff"], 
    radius: 200, 
    duration: 3000 
  };

  function merge(params) {
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = DEFAULTS[k]; });
    Object.keys(params || {}).forEach(function (k) { out[k] = params[k]; });
    return out;
  }

  // 純粹建構六芒星路徑 (不包含繪製指令，以利後續多層疊加)
  function buildHexagramPath(ctx, r) {
    var i, a;
    for (i = 0; i < 3; i++) {
      a = i * (Math.PI * 2 / 3) - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();

    for (i = 0; i < 3; i++) {
      a = i * (Math.PI * 2 / 3) + Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  }

  // 純粹建構刻度路徑
  function buildTicksPath(ctx, r, count, len) {
    for (var i = 0; i < count; i++) {
      var a = i * Math.PI * 2 / count;
      var c = Math.cos(a), s = Math.sin(a);
      ctx.moveTo(c * (r - len), s * (r - len));
      ctx.lineTo(c * r, s * r);
    }
  }

  window.Effects.register("magic-circle", function (px, py, params) {
    var p = merge(params);
    var t = 0;

    // 稍微減少粒子數量以確保極致順暢
    var particles = [];
    for (var i = 0; i < 30; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        dist: Math.random() * p.radius,
        vy: - (Math.random() * 0.08 + 0.02), 
        size: Math.random() * 2.5 + 1,
        delay: Math.random() * p.duration * 0.5
      });
    }

    return {
      update: function (dt) { t += dt; },
      done: function () { return t >= p.duration; },
      draw: function (ctx) {
        var k = t / p.duration;
        var scale = k < 0.15 ? 1 - Math.pow(1 - (k / 0.15), 3) : 1;
        var alpha = k < 0.1 ? k / 0.1 : (k > 0.8 ? (1 - k) / 0.2 : 1);

        ctx.save();
        ctx.translate(px, py);
        ctx.scale(scale, scale);
        
        ctx.globalCompositeOperation = "screen";

        // === Layered Alpha 疊加繪製引擎 (取代 shadowBlur) ===
        function drawGlow(color, baseAlpha, buildPathFn) {
            ctx.beginPath();
            buildPathFn();
            
            ctx.strokeStyle = color;
            
            // 外層大暈光 (最粗、最透明)
            ctx.lineWidth = 12;
            ctx.globalAlpha = Math.max(0, baseAlpha * 0.15);
            ctx.stroke();
            
            // 中層暈光
            ctx.lineWidth = 5;
            ctx.globalAlpha = Math.max(0, baseAlpha * 0.4);
            ctx.stroke();
            
            // 內層實心光束 (最細、不透明)
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = Math.max(0, baseAlpha);
            ctx.stroke();
        }

        // === 1. 繪製外環 (順時針) ===
        ctx.save();
        ctx.rotate(t * 0.0005);
        drawGlow(p.ringColors[0] || p.color1, alpha, function() {
            ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
            ctx.moveTo(p.radius * 0.95, 0);
            ctx.arc(0, 0, p.radius * 0.95, 0, Math.PI * 2);
            buildTicksPath(ctx, p.radius, 24, 10);
        });
        ctx.restore();

        // === 2. 繪製六芒星 (逆時針) ===
        ctx.save();
        ctx.rotate(-t * 0.0008);
        drawGlow(p.color1, alpha, function() {
            buildHexagramPath(ctx, p.radius * 0.85);
        });
        ctx.restore();

        // === 3. 繪製內圈核心 (順時針快速) ===
        ctx.save();
        ctx.rotate(t * 0.0015);
        drawGlow(p.color2, alpha, function() {
            ctx.arc(0, 0, p.radius * 0.45, 0, Math.PI * 2);
            buildHexagramPath(ctx, p.radius * 0.4);
            buildTicksPath(ctx, p.radius * 0.45, 12, 15);
        });
        ctx.restore();

        // === 4. 繪製發光魔法粒子 ===
        ctx.fillStyle = p.color2;
        for (var j = 0; j < particles.length; j++) {
          var pt = particles[j];
          if (t > pt.delay) {
            var activeTime = t - pt.delay;
            var pX = Math.cos(pt.angle) * pt.dist;
            var pY = Math.sin(pt.angle) * pt.dist + (activeTime * pt.vy);
            
            ctx.beginPath();
            // 粒子外暈
            ctx.arc(pX, pY, pt.size * 2.5, 0, Math.PI * 2);
            ctx.globalAlpha = Math.max(0, alpha * 0.25);
            ctx.fill();
            
            ctx.beginPath();
            // 粒子實心
            ctx.arc(pX, pY, pt.size, 0, Math.PI * 2);
            ctx.globalAlpha = Math.max(0, alpha * 0.9);
            ctx.fill();
          }
        }

        ctx.restore();
      }
    };
  });
})();