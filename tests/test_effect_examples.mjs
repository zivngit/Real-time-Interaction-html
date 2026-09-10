import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(file) {
  return readFileSync(join(root, file), "utf8");
}

function sampleSpec() {
  return JSON.parse(read("examples/effects/sample-burst/effects.json")).effects["sample-burst"];
}

test("both example manifests parse and use the expected effect ids", () => {
  const sample = JSON.parse(read("examples/effects/sample-burst/effects.json"));
  const iface = JSON.parse(read("examples/effects/effect-interface/effects.json"));
  assert.equal(sample.version, 1);
  assert.deepEqual(Object.keys(sample.effects), ["sample-burst"]);
  assert.equal(iface.version, 1);
  assert.deepEqual(Object.keys(iface.effects), ["effect-interface"]);
});

test("sample-burst manifest shows all optional manifest fields", () => {
  const spec = sampleSpec();
  assert.ok(typeof spec.label === "string" && spec.label);
  assert.ok(typeof spec.category === "string" && spec.category);
  assert.ok(typeof spec.icon === "string" && spec.icon);
  assert.equal(spec.viewer, "viewer.js");
  assert.equal(spec.console, "console.js");
});

test("sample-burst manifest integer params expose label/default/min/max/step", () => {
  const params = sampleSpec().params;
  for (const key of ["count", "duration"]) {
    const p = params[key];
    assert.equal(p.type, "integer");
    assert.ok(p.label);
    assert.ok("default" in p);
    assert.ok("min" in p);
    assert.ok("max" in p);
    assert.ok("step" in p);
  }
});

test("sample-burst manifest number params expose label/default/min/max/step", () => {
  const params = sampleSpec().params;
  for (const key of ["speed", "spread"]) {
    const p = params[key];
    assert.equal(p.type, "number");
    assert.ok(p.label);
    assert.ok("default" in p);
    assert.ok("min" in p);
    assert.ok("max" in p);
    assert.ok("step" in p);
  }
});

test("sample-burst manifest string param exposes label/default/maxLength", () => {
  const p = sampleSpec().params.content;
  assert.equal(p.type, "string");
  assert.ok(p.label);
  assert.equal(typeof p.default, "string");
  assert.ok(Number.isInteger(p.maxLength) && p.maxLength > 0);
});

test("sample-burst manifest shows two color params with label/default", () => {
  const params = sampleSpec().params;
  for (const key of ["color", "secondaryColor"]) {
    const p = params[key];
    assert.equal(p.type, "color");
    assert.ok(p.label);
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(p.default));
  }
});

test("sample-burst manifest boolean param is explicitly editable", () => {
  const p = sampleSpec().params.sparkle;
  assert.equal(p.type, "boolean");
  assert.ok(p.label);
  assert.equal(typeof p.default, "boolean");
  assert.equal(p.editable, true);
});

test("sample-burst manifest select param exposes options", () => {
  const p = sampleSpec().params.style;
  assert.equal(p.type, "select");
  assert.ok(p.label);
  assert.equal(typeof p.default, "string");
  assert.ok(Array.isArray(p.options) && p.options.length >= 2);
  for (const opt of p.options) {
    assert.equal(typeof opt.value, "string");
    assert.equal(typeof opt.label, "string");
  }
  assert.ok(p.options.some((o) => o.value === p.default));
});

test("sample-burst manifest array param exposes items/limits and editable false", () => {
  const p = sampleSpec().params.palette;
  assert.equal(p.type, "array");
  assert.equal(p.items, "color");
  assert.ok(p.label);
  assert.ok(Array.isArray(p.default) && p.default.length >= 1);
  assert.ok(Number.isInteger(p.minItems));
  assert.ok(Number.isInteger(p.maxItems));
  assert.equal(p.editable, false);
});

test("effect-interface manifest has minimal required fields", () => {
  const spec = JSON.parse(read("examples/effects/effect-interface/effects.json")).effects["effect-interface"];
  assert.equal(spec.viewer, "viewer.js");
  assert.equal(spec.console, "console.js");
  assert.equal(spec.params.duration.type, "integer");
  assert.ok("default" in spec.params.duration);
});

function runViewerPlugin(file, id) {
  const registry = {};
  const effects = {
    registry,
    register(type, factory) {
      registry[type] = factory;
    },
  };
  const sandbox = { window: { Effects: effects }, console };
  vm.createContext(sandbox);
  vm.runInContext(read(file), sandbox);
  assert.equal(typeof registry[id], "function", `${id} registered`);
  return effects;
}

function fakeCtx() {
  const ctx = {
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    lineWidth: 1,
  };
  ["beginPath", "arc", "fill", "stroke", "rect", "fillRect", "clearRect", "fillText"].forEach((name) => {
    ctx[name] = () => {};
  });
  return ctx;
}

function makeFactory(effects, id, params) {
  const fx = effects.registry[id](100, 100, params || {});
  assert.equal(typeof fx.update, "function");
  assert.equal(typeof fx.draw, "function");
  assert.equal(typeof fx.done, "function");
  fx.update(16);
  fx.draw(fakeCtx());
  assert.equal(typeof fx.done(), "boolean");
  return fx;
}

test("sample-burst viewer plugin runs and factory effect completes", () => {
  const effects = runViewerPlugin("examples/effects/sample-burst/viewer.js", "sample-burst");
  const fx = makeFactory(effects, "sample-burst", {});
  let guard = 0;
  while (!fx.done() && guard++ < 100000) fx.update(16);
  assert.equal(fx.done(), true);
});

test("effect-interface viewer plugin runs and factory effect completes", () => {
  const effects = runViewerPlugin("examples/effects/effect-interface/viewer.js", "effect-interface");
  const fx = makeFactory(effects, "effect-interface", { duration: 300 });
  let guard = 0;
  while (!fx.done() && guard++ < 100000) fx.update(16);
  assert.equal(fx.done(), true);
});

test("example viewer plugins no-op without window.Effects", () => {
  for (const file of [
    "examples/effects/sample-burst/viewer.js",
    "examples/effects/effect-interface/viewer.js",
  ]) {
    const sandbox = { console };
    vm.createContext(sandbox);
    vm.runInContext(read(file), sandbox);
    assert.equal(sandbox.window, undefined);
  }
});

function makeDom() {
  const elements = [];
  const document = {
    createElement(tag) {
      const el = {
        tagName: tag,
        id: "",
        type: "",
        value: "",
        checked: false,
        min: null,
        max: null,
        step: null,
        maxLength: null,
        className: "",
        textContent: "",
        _children: [],
        appendChild(c) {
          this._children.push(c);
          return c;
        },
      };
      elements.push(el);
      return el;
    },
  };
  return { document, elements };
}

function byId(elements, id) {
  return elements.find((el) => el.id === id) || null;
}

function makeApi() {
  return {
    type: "sample-burst",
    params: {},
    defaults: {
      count: 40,
      spread: 360,
      speed: 0.35,
      duration: 1200,
      content: "Sample",
      color: "#ff5252",
      secondaryColor: "#ffd740",
      sparkle: true,
      style: "circle",
    },
    fields: [
      { key: "count", label: "數量", type: "integer", def: 40, min: 1, max: 400, step: 1 },
      { key: "spread", label: "散佈(度)", type: "number", def: 360, min: 0, max: 360, step: 5 },
      { key: "speed", label: "速度", type: "number", def: 0.35, min: 0.05, max: 2, step: 0.05 },
      { key: "duration", label: "持續(ms)", type: "integer", def: 1200, min: 200, max: 8000, step: 100 },
      { key: "content", label: "文字", type: "string", def: "Sample", maxLength: 12 },
      { key: "color", label: "顏色", type: "color", def: "#ff5252" },
      { key: "secondaryColor", label: "副色", type: "color", def: "#ffd740" },
      { key: "sparkle", label: "閃爍", type: "boolean", def: true },
      {
        key: "style",
        label: "樣式",
        type: "select",
        def: "circle",
        options: [
          { value: "circle", label: "圓點" },
          { value: "square", label: "方塊" },
          { value: "ring", label: "圓環" },
        ],
      },
    ],
    getValue: () => undefined,
    setValue: () => {},
  };
}

function runConsolePlugin(file, id, doc) {
  const registry = {};
  const api = {
    registry,
    register(type, plugin) {
      registry[type] = plugin;
    },
  };
  const sandbox = doc
    ? { window: { RTX_EFFECT_CONSOLE: api }, document: doc, console }
    : { window: { RTX_EFFECT_CONSOLE: api }, console };
  vm.createContext(sandbox);
  vm.runInContext(read(file), sandbox);
  assert.ok(registry[id], `${id} registered`);
  assert.equal(typeof registry[id].render, "function");
  return registry[id];
}

test("sample-burst console plugin registers and render creates rtx-p inputs", () => {
  const registry = {};
  const api = {
    registry,
    register(type, plugin) {
      registry[type] = plugin;
    },
  };
  const { document, elements } = makeDom();
  const sandbox = { window: { RTX_EFFECT_CONSOLE: api }, document, console };
  vm.createContext(sandbox);
  vm.runInContext(read("examples/effects/sample-burst/console.js"), sandbox);
  const plugin = registry["sample-burst"];
  assert.ok(plugin, "sample-burst registered");
  assert.equal(typeof plugin.render, "function");
  assert.equal(plugin.iconID, "particle");
  assert.equal(typeof plugin.iconSVG, "string");
  assert.equal(plugin.iconSVG.indexOf("<svg"), 0);
  assert.ok(plugin.iconSVG.includes("</svg>"));
  assert.ok(plugin.iconSVG.includes("viewBox='0 0 24 24'"));
  assert.ok(plugin.iconSVG.includes("aria-hidden='true'"));
  const container = {
    _children: [],
    appendChild(c) {
      this._children.push(c);
      return c;
    },
  };
  plugin.render(container, makeApi());
  for (const key of [
    "count",
    "spread",
    "speed",
    "duration",
    "content",
    "color",
    "secondaryColor",
    "sparkle",
    "style",
  ]) {
    assert.ok(byId(elements, `rtx-p-${key}`), `rtx-p-${key}`);
  }
  assert.equal(byId(elements, "rtx-p-palette"), null);
  assert.equal(byId(elements, "rtx-p-count").type, "number");
  assert.equal(byId(elements, "rtx-p-content").type, "text");
  assert.equal(byId(elements, "rtx-p-color").type, "color");
  assert.equal(byId(elements, "rtx-p-sparkle").type, "checkbox");
  const style = byId(elements, "rtx-p-style");
  assert.equal(style.tagName, "select");
  assert.deepEqual(
    style._children.map((o) => o.value),
    ["circle", "square", "ring"]
  );
});

test("effect-interface console plugin registers with iconSVG and renders duration input", () => {
  const { document, elements } = makeDom();
  const plugin = runConsolePlugin(
    "examples/effects/effect-interface/console.js",
    "effect-interface",
    document
  );
  assert.equal(typeof plugin.iconSVG, "string");
  assert.equal(plugin.iconSVG.indexOf("<svg"), 0);
  assert.ok(plugin.iconSVG.includes("</svg>"));
  assert.ok(plugin.iconSVG.includes("viewBox='0 0 24 24'"));
  assert.ok(plugin.iconSVG.includes("aria-hidden='true'"));
  const container = { _children: [], appendChild() {} };
  const api = {
    type: "effect-interface",
    fields: [{ key: "duration", label: "持續(ms)", type: "integer", def: 1000 }],
    getValue: () => undefined,
    setValue: () => {},
  };
  plugin.render(container, api);
  const duration = byId(elements, "rtx-p-duration");
  assert.ok(duration, "rtx-p-duration");
  assert.equal(duration.type, "number");
  assert.equal(duration.value, 1000);
});

test("example console plugins no-op without window.RTX_EFFECT_CONSOLE", () => {
  for (const file of [
    "examples/effects/sample-burst/console.js",
    "examples/effects/effect-interface/console.js",
  ]) {
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(read(file), sandbox);
    assert.equal(sandbox.window.RTX_EFFECT_CONSOLE, undefined);
  }
});
