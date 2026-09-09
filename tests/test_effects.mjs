import { test } from "node:test";
import assert from "node:assert/strict";
import Effects from "../shared/effects.js";

const { EFFECTS, createEffect, toPixels, toPercent, clamp } = Effects;

test("EFFECTS metadata has 4 types with params", () => {
  assert.deepEqual(Object.keys(EFFECTS).sort(), ["firework", "particle", "ripple", "text"]);
  for (const meta of Object.values(EFFECTS)) {
    assert.equal(typeof meta.name, "string");
    assert.ok(meta.params && typeof meta.params === "object");
    assert.ok(meta.params.duration > 0);
  }
});

test("toPixels / toPercent round-trip", () => {
  const p = toPixels(50, 25, 800, 600);
  assert.deepEqual(p, { px: 400, py: 150 });
  const q = toPercent(400, 150, 800, 600);
  assert.deepEqual(q, { x: 50, y: 25 });
});

test("clamp", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});

function runToDone(effect, stepMs = 16) {
  let t = 0;
  let guard = 0;
  while (!effect.done() && guard++ < 100000) {
    effect.update(stepMs);
    t += stepMs;
  }
  assert.ok(effect.done(), "effect should finish");
  return t;
}

test("particle finishes within duration window", () => {
  const e = createEffect("particle", 100, 100, { count: 20, duration: 800 });
  const t = runToDone(e);
  assert.ok(t >= 800 * 0.6 && t <= 800 + 16, `t=${t}`);
});

test("ripple finishes exactly at duration", () => {
  const e = createEffect("ripple", 100, 100, { duration: 1000 });
  const t = runToDone(e, 100);
  assert.equal(t, 1000);
});

test("firework uses colors and finishes", () => {
  const e = createEffect("firework", 50, 50, { colors: ["#123456", "#654321"], count: 30, duration: 900 });
  const t = runToDone(e);
  assert.ok(t >= 900 * 0.6);
});

test("text merges custom params and finishes", () => {
  const e = createEffect("text", 50, 50, { content: "hi", duration: 500 });
  const t = runToDone(e, 50);
  assert.equal(t, 500);
});

test("createEffect throws on unknown type", () => {
  assert.throws(() => createEffect("nope", 0, 0, {}), /unknown effect/);
});

test("stepEffect advances ripple to wall-clock target", () => {
  const e = createEffect("ripple", 0, 0, { duration: 1000 });
  Effects.stepEffect(e, 900);
  assert.equal(e.elapsed, 900);
  assert.equal(e.done(), false);
  Effects.stepEffect(e, 1000);
  assert.equal(e.elapsed, 1000);
  assert.equal(e.done(), true);
});

test("stepEffect no-ops when target already reached", () => {
  const e = createEffect("ripple", 0, 0, { duration: 1000 });
  Effects.stepEffect(e, 500);
  Effects.stepEffect(e, 500);
  assert.equal(e.elapsed, 500);
  assert.equal(e.done(), false);
});

test("stepEffect large catch-up jump (background tab simulation)", () => {
  const e = createEffect("ripple", 0, 0, { duration: 1000 });
  Effects.stepEffect(e, 16);
  Effects.stepEffect(e, 5000);
  assert.equal(e.elapsed, 5000);
  assert.equal(e.done(), true);
});

test("stepEffect completes particle on wall clock (max ttl = duration)", () => {
  const e = createEffect("particle", 100, 100, { count: 30, duration: 800 });
  Effects.stepEffect(e, 800);
  assert.equal(e.done(), true);
});

test("params merge over defaults (ripple color)", () => {
  const e = createEffect("ripple", 0, 0, { color: "#abc123" });
  assert.equal(e.done(), false);
  const ctx = {
    globalAlpha: 0,
    strokeStyle: null,
    lineWidth: 0,
    beginPath() {},
    arc() {},
    stroke() {},
  };
  e.update(100);
  e.draw(ctx);
  assert.equal(ctx.strokeStyle, "#abc123");
});
