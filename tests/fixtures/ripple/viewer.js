(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  var DEFAULTS = { color: "#44aaff", maxRadius: 200, duration: 1200 };

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

  window.Effects.register("ripple", function (px, py, params) {
    var p = merge(params);
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
  });
})();
