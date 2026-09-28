(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  var DEFAULTS = { content: "Hello", color: "#ffffff", size: 32, duration: 2000 };

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

  window.Effects.register("text", function (px, py, params) {
    var p = merge(params);
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
  });
})();
