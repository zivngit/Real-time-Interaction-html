(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  var DEFAULTS = { 
    coreColor: "#ffffff", 
    beamColor: "#00d4ff", 
    radius: 250, 
    duration: 850 
  };

  function merge(params) {
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = DEFAULTS[k]; });
    Object.keys(params || {}).forEach(function (k) { out[k] = params[k]; });
    return out;
  }

  window.Effects.register("orbital-strike", function (px, py, params) { //
    var p = merge(params);
    var t = 0;

    // 預先生成衝擊火花 (向四周圓形爆發)
    var sparks = [];
    for (var i = 0; i < 45; i++) {
      var ang = Math.random() * Math.PI * 2;
      var speed = Math.random() * 8 + 3;
      sparks.push({
        x: 0,
        y: 0,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        size: Math.random() * 4 + 2,
        life: 0,
        ttl: p.duration * (0.3 + Math.random() * 0.6)
      });
    }

    // 預先生成伴隨主光束落下的高能殘影線條
    var streaks = [];
    for (var j = 0; j < 15; j++) {
      streaks.push({
        x: (Math.random() - 0.5) * 100, // 散佈在光束寬度內
        y: -1000 - Math.random() * 1000, // 從畫面極高處落下
        len: Math.random() * 200 + 100,
        speed: Math.random() * 20 + 20,
        delay: Math.random() * (p.duration * 0.2) // 隨機延遲落下
      });
    }

    return {
      update: function (dt) { //
        t += dt;
        
        // 更新火花位置與空氣阻力
        for (var i = 0; i < sparks.length; i++) {
          var s = sparks[i];
          s.life += dt;
          s.x += s.vx * (dt / 16);
          s.y += s.vy * (dt / 16);
          s.vx *= 0.90; // 阻力減速
          s.vy *= 0.90;
        }
        
        // 更新落下殘影
        for (var j = 0; j < streaks.length; j++) {
          var st = streaks[j];
          if (t > st.delay) {
            st.y += st.speed * (dt / 16);
          }
        }
      },
      done: function () { return t >= p.duration; }, //
      draw: function (ctx) { 
        var k = t / p.duration;
        
        // 前 12.5% 時間爆發，之後逐漸消散
        var impactK = Math.min(1, k * 8); 
        impactK = 1 - Math.pow(1 - impactK, 3);
        
        // 後 40% 的時間整體淡出
        var fade = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;

        ctx.save();
        ctx.translate(px, py); // 將原點設為雷射撞擊點
        ctx.globalCompositeOperation = "screen";

        // === 1. 地面衝擊波 (Shockwave) ===
        var currentRadius = Math.max(0.1, p.radius * Math.pow(k, 0.35));
        
        // 外圍擴散光環
        ctx.beginPath();
        ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
        ctx.lineWidth = 20 * (1 - k) * fade;
        ctx.strokeStyle = p.beamColor;
        ctx.globalAlpha = Math.max(0, fade);
        ctx.stroke();

        // 中心高溫閃光 (瞬間亮起後快速縮小消失)
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.4 * impactK * (1 - k), 0, Math.PI * 2);
        ctx.fillStyle = p.coreColor;
        ctx.globalAlpha = Math.max(0, fade * 0.8);
        ctx.fill();

        // === 2. 垂直軌道雷射 (Orbital Beam) ===
        // 寬度隨時間收束，模擬雷射發射結束的殘餘能量
        var beamScale = impactK * (1 - k * 0.85); 
        var maxBeamWidth = 140; 
        var currentWidth = maxBeamWidth * beamScale;

        if (currentWidth > 0.5) {
          // 繪製外圍暈光
          ctx.globalAlpha = Math.max(0, fade * 0.7);
          ctx.fillStyle = p.beamColor;
          ctx.fillRect(-currentWidth / 2, -3000, currentWidth, 3000); // 向上延伸3000px出鏡

          // 繪製極度高亮的純白核心
          var coreWidth = currentWidth * 0.35;
          ctx.globalAlpha = Math.max(0, fade);
          ctx.fillStyle = p.coreColor;
          ctx.fillRect(-coreWidth / 2, -3000, coreWidth, 3000);
        }

        // === 3. 伴隨落下的能量殘影線條 ===
        ctx.globalAlpha = Math.max(0, fade * 0.8);
        ctx.fillStyle = p.coreColor;
        for (var j = 0; j < streaks.length; j++) {
          var st = streaks[j];
          if (t > st.delay && st.y < 0) { // 不畫到地面以下
            var drawY = Math.min(0, st.y);
            var tailY = Math.min(0, st.y - st.len);
            if (tailY < 0) {
              ctx.fillRect(st.x, tailY, 2 + Math.random() * 3, drawY - tailY);
            }
          }
        }

        // === 4. 四散的撞擊火花 ===
        for (var sp_idx = 0; sp_idx < sparks.length; sp_idx++) {
          var s = sparks[sp_idx];
          if (s.life >= s.ttl) continue;
          var sFade = 1 - (s.life / s.ttl);
          ctx.globalAlpha = Math.max(0, sFade * fade);
          // 火花顏色在核心色與光束色間交替
          ctx.fillStyle = (sp_idx % 2 === 0) ? p.coreColor : p.beamColor;
          
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * sFade, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    };
  });
})();