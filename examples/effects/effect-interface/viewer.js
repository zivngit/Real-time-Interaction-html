(function () {
  "use strict";

  if (typeof window === "undefined" || !window.Effects) return;

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  window.Effects.register("effect-interface", function (px, py, params) {
    var duration = num(params && params.duration, 1000);
    var elapsed = 0;
    return {
      update: function (dt) {
        elapsed += dt;
      },
      done: function () {
        return elapsed >= duration;
      },
      draw: function (ctx) {
        if (ctx && typeof ctx.fillRect === "function") ctx.fillRect(px, py, 8, 8);
      },
    };
  });
})();
