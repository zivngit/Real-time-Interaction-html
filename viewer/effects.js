(function (root, factory) {
  "use strict";
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory();
  } else {
    root.Effects = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var registry = {};

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function toPixels(x, y, w, h) {
    return { px: (x / 100) * w, py: (y / 100) * h };
  }

  function toPercent(px, py, w, h) {
    return { x: (px / w) * 100, y: (py / h) * 100 };
  }

  function register(type, factory) {
    if (!type || typeof factory !== "function") {
      throw new Error("invalid effect registration: " + type);
    }
    registry[type] = factory;
  }

  function reset() {
    Object.keys(registry).forEach(function (key) {
      delete registry[key];
    });
    return registry;
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
    var factory = registry[type];
    if (!factory) throw new Error("unknown effect: " + type);
    return factory(px, py, params || {});
  }

  return {
    registry: registry,
    register: register,
    reset: reset,
    createEffect: createEffect,
    stepEffect: stepEffect,
    toPixels: toPixels,
    toPercent: toPercent,
    clamp: clamp,
  };
});
