import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import Effects from "../viewer/effects.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { createEffect, toPixels, toPercent, clamp } = Effects;

function runPlugin(file, sandboxOverrides = {}) {
  const src = readFileSync(join(root, file), "utf8");
  const sandbox = Object.assign({ window: { Effects: Effects }, console }, sandboxOverrides);
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox;
}

test("viewer plugins no-op when window.Effects is missing", () => {
  const src = readFileSync(join(root, "tests", "fixtures", "particle", "viewer.js"), "utf8");
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  assert.equal(sandbox.window, undefined);
});

test("viewer plugins register all 4 effects", () => {
  for (const id of ["particle", "ripple", "firework", "text"]) {
    runPlugin(join("tests", "fixtures", id, "viewer.js"));
  }
  assert.deepEqual(Object.keys(Effects.registry).sort(), ["firework", "particle", "ripple", "text"]);
  for (const id of Object.keys(Effects.registry)) {
    assert.equal(typeof Effects.registry[id], "function");
  }
});

test("register rejects invalid registration", () => {
  assert.throws(() => Effects.register(null, () => ({})), /invalid effect registration/);
  assert.throws(() => Effects.register("x", "not-a-function"), /invalid effect registration/);
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

test("particle plugin defaults from local manifest values", () => {
  const e = createEffect("particle", 0, 0, {});
  Effects.stepEffect(e, 1200);
  assert.equal(e.done(), true);
});

test("text plugin draw uses merged params", () => {
  const e = createEffect("text", 10, 10, { content: "abc", size: 24 });
  const ctx = {
    globalAlpha: 0,
    fillStyle: null,
    font: "",
    textAlign: "",
    textBaseline: "",
    fillText() {},
  };
  e.update(100);
  e.draw(ctx);
  assert.equal(ctx.font, "600 24px system-ui, sans-serif");
});

test("Effects.reset clears registry but keeps registry identity", () => {
  const registryBefore = Effects.registry;
  Effects.register("reset-test", () => ({ update() {}, draw() {}, done() { return true; } }));
  assert.equal(typeof Effects.registry["reset-test"], "function");
  Effects.reset();
  assert.equal(Effects.registry["reset-test"], undefined);
  assert.equal(Effects.registry, registryBefore);
  for (const id of ["particle", "ripple", "firework", "text"]) {
    runPlugin(join("tests", "fixtures", id, "viewer.js"));
  }
});

test("editor viewer template registers a working effect", () => {
  const editorSrc = readFileSync(join(root, "server", "editor.py"), "utf8");
  const match = editorSrc.match(/VIEWER_TEMPLATE = """([\s\S]*?)"""/);
  assert.ok(match, "VIEWER_TEMPLATE not found in server/editor.py");
  Effects.reset();
  const sandbox = { window: { Effects: Effects }, console };
  vm.createContext(sandbox);
  vm.runInContext(match[1].replaceAll("__ID__", "tpl-fx"), sandbox);
  assert.equal(typeof Effects.registry["tpl-fx"], "function");
  const e = createEffect("tpl-fx", 10, 10, { duration: 400 });
  assert.equal(e.done(), false);
  const ctx = {
    globalAlpha: 0,
    fillStyle: null,
    rect: false,
    save() {},
    restore() {},
    fillRect() {
      this.rect = true;
    },
  };
  Effects.stepEffect(e, 200);
  e.draw(ctx);
  assert.equal(ctx.rect, true);
  assert.ok(ctx.globalAlpha > 0 && ctx.globalAlpha < 1);
  Effects.stepEffect(e, 400);
  assert.equal(e.done(), true);
});
