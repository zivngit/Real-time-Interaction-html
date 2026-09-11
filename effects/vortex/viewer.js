(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  var DEFAULTS = {
    coreColor: "#111111",
    ringColor1: "#ff55ff",
    ringColor2: "#00ff44",
    maxRadius: 350,
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

  window.Effects.register("vortex", function (px, py, params) {
    var p = merge(params);
    var t = 0;
    
    var streaks = [];
    for (var i = 0; i < 12; i++) {
      streaks.push({
        angle: Math.random() * Math.PI * 2,
        distance: Math.random() * 0.4 + 0.6,
        speed: Math.random() * 8 + 4,
        length: Math.random() * Math.PI + 0.5,
        width: Math.random() * 5 + 2,
        color: i % 2 === 0 ? p.ringColor1 : p.ringColor2
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
        var k = t / p.duration;
        var scale = Math.sin(Math.pow(k, 0.8) * Math.PI); 
        var alpha = k > 0.8 ? (1 - k) / 0.2 : 1;
        var currentRadius = Math.max(1, p.maxRadius * scale);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(k * Math.PI * 3);
        
        ctx.globalCompositeOperation = "screen";
        
        // 1. 繪製外圍光環
        for (var i = 0; i < streaks.length; i++) {
          var s = streaks[i];
          var currentAngle = s.angle + k * s.speed;
          var dist = currentRadius * (s.distance + k * 0.3); 
          var radius = Math.max(1, dist);

          ctx.beginPath();
          ctx.arc(0, 0, radius, currentAngle, currentAngle + s.length);
          ctx.strokeStyle = s.color;

          // 模擬發光外圈 (粗、半透明)
          ctx.lineWidth = s.width * scale * 2.5;
          ctx.globalAlpha = Math.max(0, alpha * 0.25);
          ctx.stroke();

          // 實體光線內核 (細、不透明)
          ctx.lineWidth = s.width * scale;
          ctx.globalAlpha = Math.max(0, alpha * 0.9);
          ctx.stroke();
        }

        // 2. 繪製黑洞核心
        ctx.globalCompositeOperation = "source-over";
        var coreR = Math.max(1, currentRadius * 0.7);

        // 模擬黑洞周圍的發光暈散 (取代原本的 shadowBlur)
        ctx.beginPath();
        ctx.arc(0, 0, coreR * 1.15, 0, Math.PI * 2);
        ctx.fillStyle = p.ringColor1;
        ctx.globalAlpha = Math.max(0, alpha * 0.15);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, coreR * 1.05, 0, Math.PI * 2);
        ctx.fillStyle = p.ringColor1;
        ctx.globalAlpha = Math.max(0, alpha * 0.4);
        ctx.fill();

        // 繪製黑洞本體
        ctx.beginPath();
        ctx.arc(0, 0, coreR, 0, Math.PI * 2);
        ctx.fillStyle = p.coreColor;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fill();

        ctx.restore();
      },
    };
  });
})();