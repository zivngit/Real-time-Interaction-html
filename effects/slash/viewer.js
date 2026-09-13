(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  var DEFAULTS = { 
    color: "#ffffff", 
    length: 300, 
    thickness: 12, 
    angle: 45, 
    duration: 400 
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

  window.Effects.register("slash", function (px, py, params) {
    var p = merge(params);
    var t = 0;
    // 將角度轉換為弧度
    var rad = (p.angle * Math.PI) / 180;

    return {
      update: function (dt) {
        t += dt;
      },
      done: function () {
        return t >= p.duration;
      },
      draw: function (ctx) {
        var k = t / p.duration; // 進度 0 到 1
        
        // 使用 Ease-Out 讓斬擊長度瞬間展開
        var progress = 1 - Math.pow(1 - k, 3); 
        
        // 前 10% 時間快速出現，之後逐漸消散
        var alpha = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rad);

        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;
        
        // 增強發光效果
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.thickness * 1.5;

        // 計算當下的長短與厚度
        var halfLen = (p.length * progress) / 2;
        var thick = p.thickness * (1 - k * 0.4); // 軌跡會隨時間變細

        // 繪製月牙型斬擊形狀
        ctx.beginPath();
        ctx.moveTo(-halfLen, 0); // 起點
        // 上半部弧線
        ctx.quadraticCurveTo(0, -thick, halfLen, 0); 
        // 下半部弧線 (較扁，形成利刃感)
        ctx.quadraticCurveTo(0, -thick * 0.2, -halfLen, 0); 
        ctx.fill();

        ctx.restore();
      },
    };
  });
})();