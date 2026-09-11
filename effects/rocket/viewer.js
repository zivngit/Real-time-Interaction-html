(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  var DEFAULTS = { 
    bodyColor: "#dddddd", 
    fireColor: "#ff5500", 
    speed: 0.6, 
    duration: 1500 
  };

  function merge(params) {
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = DEFAULTS[k]; });
    Object.keys(params || {}).forEach(function (k) { out[k] = params[k]; });
    return out;
  }

  window.Effects.register("rocket", function (px, py, params) {
    var p = merge(params);
    var t = 0;
    var particles = [];
    var currentY = py;

    return {
      update: function (dt) {
        t += dt;
        
        // 依照速度往上升空 (Y座標遞減)
        var moveY = p.speed * dt;
        if (t < p.duration) {
          currentY -= moveY;
        }

        // 只要火箭還在飛，就不斷噴射火焰粒子
        if (t < p.duration) {
           for (var i = 0; i < 2; i++) {
             particles.push({
               x: px + (Math.random() - 0.5) * 8, // 在引擎噴嘴附近隨機產生
               y: currentY + 15, // 火箭底部
               vx: (Math.random() - 0.5) * 0.1,
               vy: Math.random() * 0.2 + 0.1, // 粒子有微微向下掉落的慣性
               life: 0,
               maxLife: 300 + Math.random() * 300,
               size: 3 + Math.random() * 5
             });
           }
        }

        // 更新所有粒子的生命週期與位置
        for (var j = 0; j < particles.length; j++) {
          var pt = particles[j];
          pt.life += dt;
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
        }
        
        // 過濾掉壽命結束的粒子
        particles = particles.filter(function(pt) { return pt.life < pt.maxLife; });
      },
      done: function () {
        // 等到火箭飛完，且所有煙霧粒子都消散後才結束特效
        return t >= p.duration && particles.length === 0;
      },
      draw: function (ctx) {
        // --- 1. 繪製火焰與煙霧粒子 ---
        ctx.globalCompositeOperation = "screen";
        for (var j = 0; j < particles.length; j++) {
          var pt = particles[j];
          var alpha = 1 - (pt.life / pt.maxLife); // 越老越透明
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.fillStyle = p.fireColor;
          ctx.beginPath();
          // 粒子隨著壽命縮小
          ctx.arc(pt.x, pt.y, pt.size * alpha, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";

        // --- 2. 繪製火箭本體 ---
        if (t < p.duration) {
          // 快結束時讓火箭稍微淡出
          var rkAlpha = t > p.duration - 200 ? (p.duration - t) / 200 : 1;
          ctx.globalAlpha = Math.max(0, rkAlpha);
          
          ctx.save();
          ctx.translate(px, currentY);

          // 火箭機身
          ctx.fillStyle = p.bodyColor;
          ctx.beginPath();
          ctx.moveTo(0, -25); // 尖端
          ctx.lineTo(8, -5);
          ctx.lineTo(8, 15);
          ctx.lineTo(-8, 15);
          ctx.lineTo(-8, -5);
          ctx.fill();

          // 駕駛艙窗戶
          ctx.fillStyle = "#88ccff";
          ctx.beginPath();
          ctx.arc(0, -2, 4, 0, Math.PI * 2);
          ctx.fill();

          // 紅色側翼
          ctx.fillStyle = "#ff2222";
          // 右翼
          ctx.beginPath();
          ctx.moveTo(8, 5);
          ctx.lineTo(15, 15);
          ctx.lineTo(8, 15);
          ctx.fill();
          // 左翼
          ctx.beginPath();
          ctx.moveTo(-8, 5);
          ctx.lineTo(-15, 15);
          ctx.lineTo(-8, 15);
          ctx.fill();

          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    };
  });
})();