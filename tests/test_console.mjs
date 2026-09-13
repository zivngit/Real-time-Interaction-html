import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "console", "app.js"), "utf8");
const iconsSrc = readFileSync(join(root, "console", "icons.js"), "utf8");
const css = readFileSync(join(root, "console", "style.css"), "utf8");

const DEFAULT_EFFECTS = {
  particle: {
    label: "粒子爆散",
    category: "burst",
    icon: "particle",
    viewerUrl: "/effects/particle/viewer.js",
    consoleUrl: "/effects/particle/console.js",
    params: {
      color: { type: "color", label: "顏色", default: "#ff0044" },
      count: { type: "integer", label: "數量", default: 40, min: 1, max: 400, step: 1 },
      spread: { type: "number", label: "散佈(度)", default: 360, min: 0, max: 360, step: 5 },
      speed: { type: "number", label: "速度", default: 0.35, min: 0.05, max: 2, step: 0.05 },
      duration: { type: "integer", label: "持續(ms)", default: 1200, min: 200, max: 8000, step: 100 },
    },
  },
  ripple: {
    label: "漣漪圈",
    category: "ripple",
    icon: "ripple",
    viewerUrl: "/effects/ripple/viewer.js",
    consoleUrl: "/effects/ripple/console.js",
    params: {
      color: { type: "color", label: "顏色", default: "#44aaff" },
      maxRadius: { type: "number", label: "最大半徑", default: 200, min: 20, max: 600, step: 10 },
      duration: { type: "integer", label: "持續(ms)", default: 1200, min: 200, max: 8000, step: 100 },
    },
  },
  firework: {
    label: "煙火",
    category: "burst",
    icon: "firework",
    viewerUrl: "/effects/firework/viewer.js",
    consoleUrl: null,
    params: {
      colors: {
        type: "array",
        items: "color",
        label: "顏色",
        default: ["#ff5252", "#ffd740", "#40c4ff", "#69f0ae"],
        minItems: 1,
        maxItems: 8,
        editable: false,
      },
      count: { type: "integer", label: "數量", default: 90, min: 1, max: 400, step: 1 },
      duration: { type: "integer", label: "持續(ms)", default: 1800, min: 200, max: 8000, step: 100 },
    },
  },
  text: {
    label: "浮現文字",
    category: "text",
    icon: "text",
    viewerUrl: "/effects/text/viewer.js",
    consoleUrl: "/effects/text/console.js",
    params: {
      content: { type: "string", label: "文字", default: "Hello", maxLength: 20 },
      color: { type: "color", label: "顏色", default: "#ffffff" },
      size: { type: "integer", label: "字級", default: 32, min: 8, max: 160, step: 2 },
      duration: { type: "integer", label: "持續(ms)", default: 2000, min: 200, max: 10000, step: 100 },
    },
  },
};

function hostList(value) {
  return JSON.parse(JSON.stringify(value));
}

async function makeEnv(opts = {}) {
  const created = new Map();
  const fetchCalls = [];
  const scriptLoads = [];
  const windowListeners = {};
  const store = { ...(opts.stored || {}) };

  const effectsPayload = "effects" in opts ? opts.effects : DEFAULT_EFFECTS;
  const effectsJson = "effectsJson" in opts ? opts.effectsJson : { effects: effectsPayload };
  const effectsOk = opts.effectsOk !== false;
  const effectsStatus = opts.effectsStatus ?? 200;
  const effectsFail = Boolean(opts.effectsFail);
  const config = opts.controlConfig || {};
  let script = null;
  if (opts.scriptSrc !== undefined || opts.scriptKey !== undefined) {
    script = {
      src: opts.scriptSrc || "",
      getAttribute: (name) => (name === "data-key" ? String(opts.scriptKey ?? "") : null),
    };
  }

  function makeEl(tag = "") {
    const el = {
      tagName: tag,
      _id: null,
      _classes: new Set(),
      _attrs: {},
      _parent: null,
      _children: [],
      _listeners: {},
      _innerHTML: "",
      style: {},
      value: "",
      textContent: "",
      offsetWidth: 0,
      offsetHeight: 0,
      setPointerCapture() {},
      releasePointerCapture() {},
    };
    Object.defineProperty(el, "id", {
      get: () => el._id,
      set: (v) => {
        el._id = v;
        if (v) created.set(v, el);
      },
    });
    Object.defineProperty(el, "className", {
      get: () => [...el._classes].join(" "),
      set: (v) => {
        el._classes = new Set(typeof v === "string" ? v.split(/\s+/).filter(Boolean) : []);
      },
    });
    Object.defineProperty(el, "innerHTML", {
      get: () => el._innerHTML,
      set: (v) => {
        el._innerHTML = v;
        el._children = [];
      },
    });
    el.classList = {
      add: (c) => el._classes.add(c),
      remove: (c) => el._classes.delete(c),
      contains: (c) => el._classes.has(c),
      toggle: (c, force) => {
        const want = force === undefined ? !el._classes.has(c) : Boolean(force);
        if (want) el._classes.add(c);
        else el._classes.delete(c);
        return want;
      },
    };
    el.addEventListener = (t, fn) => {
      (el._listeners[t] ??= []).push(fn);
    };
    el.setAttribute = (k, v) => {
      el._attrs[k] = String(v);
    };
    el.getAttribute = (k) => (k in el._attrs ? el._attrs[k] : null);
    el.appendChild = (c) => {
      if (c._parent && c._parent._children.includes(c)) {
        c._parent._children.splice(c._parent._children.indexOf(c), 1);
      }
      el._children.push(c);
      c._parent = el;
      return c;
    };
    el.contains = (node) => {
      let n = node;
      while (n) {
        if (n === el) return true;
        n = n._parent;
      }
      return false;
    };
    el.closest = (sel) => {
      if (!sel || sel[0] !== "#") return null;
      const want = sel.slice(1);
      let n = el;
      while (n) {
        if (n._id === want) return n;
        n = n._parent;
      }
      return null;
    };
    el._fire = (t, evt) => (el._listeners[t] || []).slice().forEach((fn) => fn(evt));
    return el;
  }

  const body = makeEl("body");
  const head = makeEl("head");

  const origHeadAppend = head.appendChild.bind(head);
  head.appendChild = (c) => {
    const result = origHeadAppend(c);
    if (c.tagName === "script" && c.src) {
      scriptLoads.push(c.src);
      setTimeout(() => {
        const fail = (opts.scriptFailPatterns || []).some((re) => re.test(c.src));
        if (fail) (c.onerror || (() => {}))();
        else (c.onload || (() => {}))();
      }, 0);
    }
    return result;
  };

  const document = {
    head,
    body,
    currentScript: script,
    getElementById: (id) => created.get(id) || null,
    createElement: (tag) => makeEl(tag),
  };

  const localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
  };

  const reloadJson = opts.reloadJson ?? { ok: true, changed: false, rev: "", effects: [] };
  const reloadOk = opts.reloadOk !== false;
  const reloadStatus = opts.reloadStatus ?? 200;
  const reloadFail = Boolean(opts.reloadFail);
  let currentEffectsJson = effectsJson;
  const fetch = async (url, options = {}) => {
    fetchCalls.push({ url, opts: options });
    if (url.endsWith("/api/effects/reload")) {
      if (reloadFail) throw new Error("reload down");
      return {
        ok: reloadOk,
        status: reloadStatus,
        json: async () => reloadJson,
        text: async () => JSON.stringify(reloadJson),
      };
    }
    if (url.endsWith("/api/effects")) {
      if (effectsFail) throw new Error("network down");
      return {
        ok: effectsOk,
        status: effectsStatus,
        json: async () => currentEffectsJson,
        text: async () => JSON.stringify(currentEffectsJson),
      };
    }
    return { ok: true, status: 200, text: async () => "", json: async () => ({ ok: true, changed: false, rev: "", effects: [] }) };
  };

  const window = {
    CONTROL_CONFIG: config,
    innerWidth: opts.innerWidth || 1000,
    innerHeight: opts.innerHeight || 500,
    addEventListener: (t, fn) => {
      (windowListeners[t] ??= []).push(fn);
    },
  };
  if (typeof opts.consoleRegistry === "function") {
    window.RTX_EFFECT_CONSOLE = opts.consoleRegistry(document);
  } else if (opts.consoleRegistry) {
    window.RTX_EFFECT_CONSOLE = opts.consoleRegistry;
  }

  const sandbox = {
    window,
    document,
    localStorage,
    fetch,
    console: { info() {}, error() {}, warn() {} },
    setTimeout,
    clearTimeout,
    URL,
  };
  vm.createContext(sandbox);
  if ("effectIcons" in opts) window.RTX_EFFECT_ICONS = opts.effectIcons;
  else vm.runInContext(iconsSrc, sandbox);

  if (opts.existingRoot) {
    const existing = makeEl("div");
    existing.id = "rtx-console";
    body.appendChild(existing);
  }

  vm.runInContext(src, sandbox);
  const ready = sandbox.window.__rtxConsoleReady || Promise.resolve();
  await ready;

  return {
    node: (id) => created.get(id) || null,
    el: (id) => created.get(id) || null,
    body,
    head,
    fetchCalls,
    scriptLoads,
    store,
    win: window,
    fireWindow: (t, evt) => (windowListeners[t] || []).slice().forEach((fn) => fn(evt)),
    runAgain: () => vm.runInContext(src, sandbox),
    setEffectsJson: (payload) => {
      currentEffectsJson = payload;
    },
  };
}

function lastEffectCall(env) {
  for (let i = env.fetchCalls.length - 1; i >= 0; i -= 1) {
    if (env.fetchCalls[i].url.endsWith("/api/effect")) return env.fetchCalls[i];
  }
  assert.fail("no /api/effect call");
}

function lastClearCall(env) {
  for (let i = env.fetchCalls.length - 1; i >= 0; i -= 1) {
    if (env.fetchCalls[i].url.endsWith("/api/clear")) return env.fetchCalls[i];
  }
  assert.fail("no /api/clear call");
}

function bodyClick(env, x, y) {
  env.fireWindow("click", { target: env.body, clientX: x, clientY: y });
}

function parsePx(v) {
  return Number(String(v).replace("px", ""));
}

function overlapArea(a, b) {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

test("uses external scoped style and unique ids", async () => {
  const env = await makeEnv();
  assert.ok(css.includes("#rtx-console { display: contents; }"));
  assert.equal(env.node("rtx-console-style"), null);
  assert.equal(env.node("rtx-console")._parent, env.body);
  for (const id of [
    "rtx-fab",
    "rtx-panel",
    "rtx-fx-layout",
    "rtx-fx-current",
    "rtx-fx-alternate",
    "rtx-fx-layout-btn",
    "rtx-params-btn",
    "rtx-conn-btn",
    "rtx-reload-btn",
    "rtx-clear-btn",
    "rtx-params-panel",
    "rtx-params-body",
    "rtx-conn-panel",
    "rtx-srv-url",
    "rtx-srv-key",
    "rtx-hint",
  ]) {
    assert.ok(env.node(id), id);
  }
  assert.ok(env.node("rtx-hint").textContent.includes("/api/effects"));
  const reloadBtn = env.node("rtx-reload-btn");
  assert.ok(reloadBtn.closest("#rtx-conn-panel"));
  assert.ok(reloadBtn.innerHTML.includes("<svg"));
  assert.equal(reloadBtn.textContent, "");
});

test("fx buttons use dual-zone fixed grid layout", async () => {
  const env = await makeEnv();
  assert.ok(css.includes(".rtx-fx-zone { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; min-height: 52px; max-height: 180px; overflow-y: auto; justify-items: center; align-items: center; scrollbar-width: thin; scrollbar-color: #33475a transparent; }"));
  assert.ok(css.includes("#rtx-fx-alternate { display: none; }"));
  assert.ok(css.includes("#rtx-fx-alternate.open { display: grid; margin-bottom: 8px; padding: 6px; background: rgba(110, 163, 216, 0.08); border: 1px dashed #6ea3d8; border-radius: 8px; }"));
  assert.ok(css.includes(".rtx-fx-zone::-webkit-scrollbar { width: 8px; }"));
  assert.ok(css.includes(".rtx-fx-zone::-webkit-scrollbar-track { background: transparent; }"));
  assert.ok(css.includes(".rtx-fx-zone::-webkit-scrollbar-thumb { background: #33475a; border-radius: 4px; border: 2px solid transparent; background-clip: content-box; }"));
  assert.ok(css.includes(".rtx-fx-zone::-webkit-scrollbar-thumb:hover { background: #4d6a86; border: 2px solid transparent; background-clip: content-box; }"));
  assert.ok(css.includes(".rtx-fx.dragging { opacity: 0.65; }"));
  assert.equal(env.node("rtx-fx-current")._children.length, 4);
  assert.equal(env.node("rtx-fx-alternate")._children.length, 0);
  assert.equal(env.node("rtx-fx-alternate").classList.contains("open"), false);
});

test("layout button toggles alternate zone", async () => {
  const env = await makeEnv();
  const btn = env.node("rtx-fx-layout-btn");
  const box = env.node("rtx-fx-alternate");
  assert.equal(btn.getAttribute("aria-controls"), "rtx-fx-alternate");
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  assert.equal(btn.classList.contains("active"), false);
  btn._fire("click");
  assert.equal(box.classList.contains("open"), true);
  assert.equal(btn.getAttribute("aria-expanded"), "true");
  assert.equal(btn.classList.contains("active"), true);
  btn._fire("click");
  assert.equal(box.classList.contains("open"), false);
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  assert.equal(btn.classList.contains("active"), false);
});

test("v2 payload renders current and alternate zones", async () => {
  const env = await makeEnv({
    effectsJson: {
      rev: "rev-v2",
      version: 2,
      currentEffects: ["particle", "ripple"],
      alternateEffects: ["firework", "text"],
      effects: DEFAULT_EFFECTS,
    },
  });
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getCurrent()), ["particle", "ripple"]);
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getAlternate()), ["firework", "text"]);
  assert.deepEqual(
    env.node("rtx-fx-current")._children.map((n) => n._id),
    ["rtx-fx-particle", "rtx-fx-ripple"]
  );
  assert.deepEqual(
    env.node("rtx-fx-alternate")._children.map((n) => n._id),
    ["rtx-fx-firework", "rtx-fx-text"]
  );
  assert.equal(env.node("rtx-fx-particle").classList.contains("selected"), true);
});

test("v2 payload appends omitted enabled effects to alternate", async () => {
  const env = await makeEnv({
    effectsJson: {
      rev: "rev-v2",
      version: 2,
      currentEffects: ["particle"],
      alternateEffects: ["ripple"],
      effects: DEFAULT_EFFECTS,
    },
  });
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getCurrent()), ["particle"]);
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getAlternate()), ["ripple", "firework", "text"]);
});

test("v1 or invalid v2 payload falls back to all enabled effects in current", async () => {
  for (const payload of [
    { rev: "r1", effects: DEFAULT_EFFECTS },
    { rev: "r2", version: 2, currentEffects: "particle", alternateEffects: [], effects: DEFAULT_EFFECTS },
    { rev: "r3", version: 2, currentEffects: ["nope"], alternateEffects: [], effects: DEFAULT_EFFECTS },
  ]) {
    const env = await makeEnv({ effectsJson: payload });
    assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getCurrent()), ["particle", "ripple", "firework", "text"]);
    assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getAlternate()), []);
  }
});

test("stored layout wins over v2 payload and persists sanitized state", async () => {
  const env = await makeEnv({
    stored: {
      "rtx.fx.layout.v2": JSON.stringify({
        version: 2,
        current: ["text", "particle"],
        alternate: ["ripple", "firework"],
      }),
    },
    effectsJson: {
      rev: "rev-v2",
      version: 2,
      currentEffects: ["particle", "ripple"],
      alternateEffects: ["firework", "text"],
      effects: DEFAULT_EFFECTS,
    },
  });
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getCurrent()), ["text", "particle"]);
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getAlternate()), ["ripple", "firework"]);
  assert.deepEqual(JSON.parse(env.store["rtx.fx.layout.v2"]), {
    version: 2,
    current: ["text", "particle"],
    alternate: ["ripple", "firework"],
  });
});

test("layout move hook reorders zones and persists layout", async () => {
  const env = await makeEnv({
    effectsJson: {
      rev: "rev-v2",
      version: 2,
      currentEffects: ["particle", "ripple"],
      alternateEffects: ["firework", "text"],
      effects: DEFAULT_EFFECTS,
    },
  });
  assert.equal(env.win.__rtxConsoleLayout.move("firework", "current", null), true);
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getCurrent()), ["particle", "ripple", "firework"]);
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getAlternate()), ["text"]);
  assert.deepEqual(JSON.parse(env.store["rtx.fx.layout.v2"]), {
    version: 2,
    current: ["particle", "ripple", "firework"],
    alternate: ["text"],
  });
  assert.equal(env.node("rtx-fx-firework").closest("#rtx-fx-current"), env.node("rtx-fx-current"));

  assert.equal(env.win.__rtxConsoleLayout.move("text", "current", "ripple"), true);
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getCurrent()), ["particle", "text", "ripple", "firework"]);
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getAlternate()), []);

  assert.equal(env.win.__rtxConsoleLayout.move("particle", "alternate", null), true);
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getCurrent()), ["text", "ripple", "firework"]);
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getAlternate()), ["particle"]);

  assert.equal(env.win.__rtxConsoleLayout.move("nope", "current", null), false);
  assert.equal(env.win.__rtxConsoleLayout.move("particle", "nope", null), false);
  assert.equal(env.win.__rtxConsoleLayout.move("particle", "current", "nope"), false);
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getCurrent()), ["text", "ripple", "firework"]);
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getAlternate()), ["particle"]);
});

test("dragging fx buttons reorders zones and persists layout", async () => {
  const env = await makeEnv({
    effectsJson: {
      rev: "rev-v2",
      version: 2,
      currentEffects: ["particle", "ripple"],
      alternateEffects: ["firework", "text"],
      effects: DEFAULT_EFFECTS,
    },
  });
  const dragEvent = () => ({
    preventDefault() {},
    clientX: 0,
    clientY: 0,
    dataTransfer: {
      setData() {},
      dropEffect: "",
    },
  });

  const particle = env.node("rtx-fx-particle");
  particle._fire("dragstart", dragEvent());
  assert.equal(particle.classList.contains("dragging"), true);
  env.node("rtx-fx-current")._fire("dragover", dragEvent());
  env.node("rtx-fx-current")._fire("drop", dragEvent());
  particle._fire("dragend");
  assert.equal(particle.classList.contains("dragging"), false);
  assert.deepEqual(
    env.node("rtx-fx-current")._children.map((n) => n._id),
    ["rtx-fx-ripple", "rtx-fx-particle"]
  );
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getCurrent()), ["ripple", "particle"]);

  const firework = env.node("rtx-fx-firework");
  firework._fire("dragstart", dragEvent());
  env.node("rtx-fx-current")._fire("dragover", dragEvent());
  env.node("rtx-fx-current")._fire("drop", dragEvent());
  firework._fire("dragend");
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getCurrent()), ["ripple", "particle", "firework"]);
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getAlternate()), ["text"]);
  assert.equal(firework.closest("#rtx-fx-current"), env.node("rtx-fx-current"));
  assert.deepEqual(
    env.node("rtx-fx-alternate")._children.map((n) => n._id),
    ["rtx-fx-text"]
  );

  const ripple = env.node("rtx-fx-ripple");
  ripple._fire("dragstart", dragEvent());
  env.node("rtx-fx-alternate")._fire("dragover", dragEvent());
  env.node("rtx-fx-alternate")._fire("drop", dragEvent());
  ripple._fire("dragend");
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getCurrent()), ["particle", "firework"]);
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getAlternate()), ["text", "ripple"]);
  assert.deepEqual(JSON.parse(env.store["rtx.fx.layout.v2"]), {
    version: 2,
    current: ["particle", "firework"],
    alternate: ["text", "ripple"],
  });
});

test("dragging fx button into alternate then back to current persists layout", async () => {
  const env = await makeEnv({
    effectsJson: {
      rev: "rev-v2",
      version: 2,
      currentEffects: ["particle", "ripple"],
      alternateEffects: ["firework", "text"],
      effects: DEFAULT_EFFECTS,
    },
  });
  const dragEvent = () => ({
    preventDefault() {},
    clientX: 0,
    clientY: 0,
    dataTransfer: {
      setData() {},
      dropEffect: "",
    },
  });
  let particle = env.node("rtx-fx-particle");

  particle._fire("dragstart", dragEvent());
  env.node("rtx-fx-alternate")._fire("dragover", dragEvent());
  env.node("rtx-fx-alternate")._fire("drop", dragEvent());
  particle._fire("dragend");
  particle = env.node("rtx-fx-particle");
  assert.equal(particle.classList.contains("dragging"), false);
  assert.equal(particle.closest("#rtx-fx-alternate"), env.node("rtx-fx-alternate"));
  assert.deepEqual(
    env.node("rtx-fx-current")._children.map((n) => n._id),
    ["rtx-fx-ripple"]
  );
  assert.deepEqual(
    env.node("rtx-fx-alternate")._children.map((n) => n._id),
    ["rtx-fx-firework", "rtx-fx-text", "rtx-fx-particle"]
  );
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getCurrent()), ["ripple"]);
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getAlternate()), ["firework", "text", "particle"]);
  assert.deepEqual(JSON.parse(env.store["rtx.fx.layout.v2"]), {
    version: 2,
    current: ["ripple"],
    alternate: ["firework", "text", "particle"],
  });

  particle._fire("dragstart", dragEvent());
  env.node("rtx-fx-current")._fire("dragover", dragEvent());
  env.node("rtx-fx-current")._fire("drop", dragEvent());
  particle._fire("dragend");
  particle = env.node("rtx-fx-particle");
  assert.equal(particle.classList.contains("dragging"), false);
  assert.equal(particle.closest("#rtx-fx-current"), env.node("rtx-fx-current"));
  assert.deepEqual(
    env.node("rtx-fx-current")._children.map((n) => n._id),
    ["rtx-fx-ripple", "rtx-fx-particle"]
  );
  assert.deepEqual(
    env.node("rtx-fx-alternate")._children.map((n) => n._id),
    ["rtx-fx-firework", "rtx-fx-text"]
  );
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getCurrent()), ["ripple", "particle"]);
  assert.deepEqual(hostList(env.win.__rtxConsoleLayout.getAlternate()), ["firework", "text"]);
  assert.deepEqual(JSON.parse(env.store["rtx.fx.layout.v2"]), {
    version: 2,
    current: ["ripple", "particle"],
    alternate: ["firework", "text"],
  });
});

test("missing selected effect falls back to first current effect after reload", async () => {
  const env = await makeEnv({
    effectsJson: {
      rev: "rev-v2",
      version: 2,
      currentEffects: ["particle"],
      alternateEffects: ["text"],
      effects: DEFAULT_EFFECTS,
    },
  });
  env.node("rtx-fx-text")._fire("click");
  env.setEffectsJson({
    rev: "rev-v3",
    effects: {
      particle: DEFAULT_EFFECTS.particle,
      ripple: DEFAULT_EFFECTS.ripple,
    },
  });
  env.node("rtx-reload-btn")._fire("click");
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(env.node("rtx-fx-particle").classList.contains("selected"), true);
  assert.ok(!env.node("rtx-fx-current")._children.some((n) => n._id === "rtx-fx-text"));
  assert.ok(!env.node("rtx-fx-alternate")._children.some((n) => n._id === "rtx-fx-text"));
});

function effectsWithCount(count) {
  const effects = {};
  for (let i = 1; i <= count; i += 1) {
    effects[`fx-${String(i).padStart(2, "0")}`] = {
      label: `Fx ${i}`,
      params: {},
    };
  }
  return effects;
}

test("fx buttons are clickable for 1, 8, 20, and 50 effects", async () => {
  for (const count of [1, 8, 20, 50]) {
    const env = await makeEnv({ effects: effectsWithCount(count) });
    const fxButtons = env.node("rtx-fx-current");
    assert.equal(fxButtons._children.length, count, `renders ${count} fx buttons`);
    for (let i = 0; i < count; i += 1) {
      const btn = fxButtons._children[i];
      btn._fire("click");
      const selected = fxButtons._children.filter((b) => b.classList.contains("selected"));
      assert.ok(btn.classList.contains("selected"), `${count} fx button ${i} is selected after click`);
      assert.equal(selected.length, 1, `${count} fx button ${i} keeps a single selected button`);
      assert.equal(selected[0], btn, `${count} fx button ${i} is the selected button`);
    }
  }
});

test("does not initialize twice", async () => {
  const env = await makeEnv({ existingRoot: true });
  assert.equal(env.node("rtx-console"), env.body._children[0]);
  assert.equal(env.node("rtx-fab"), null);
  assert.equal(env.fetchCalls.length, 0);
});

test("re-running script does not duplicate effects fetch", async () => {
  const env = await makeEnv();
  const before = env.fetchCalls.length;
  env.runAgain();
  assert.equal(env.fetchCalls.length, before);
});

test("loads effects from server and renders buttons", async () => {
  const env = await makeEnv();
  const call = env.fetchCalls[0];
  assert.equal(call.url, "http://localhost:8000/api/effects");
  assert.equal(call.opts.headers, undefined);
  assert.equal(env.node("rtx-fx-current")._children.length, 4);
  for (const id of ["rtx-fx-particle", "rtx-fx-ripple", "rtx-fx-firework", "rtx-fx-text"]) {
    assert.ok(env.node(id), id);
  }
});

test("known effect buttons are not generic", async () => {
  const env = await makeEnv();
  for (const id of ["rtx-fx-particle", "rtx-fx-ripple", "rtx-fx-firework", "rtx-fx-text"]) {
    assert.equal(env.node(id).classList.contains("generic"), false);
  }
});

test("uses external icons.js for effect icons", async () => {
  const env = await makeEnv();
  assert.ok(env.win.RTX_EFFECT_ICONS);
  assert.ok(env.win.RTX_EFFECT_ICONS.particle);
  assert.ok(env.win.RTX_EFFECT_ICONS.generic);
  assert.ok(env.node("rtx-fx-particle").innerHTML.includes("<svg"));
});

test("uses external icons.js for console UI icons", async () => {
  const env = await makeEnv();
  assert.ok(env.win.RTX_UI_ICONS);
  assert.ok(env.win.RTX_UI_ICONS.fabOpen);
  assert.ok(env.win.RTX_UI_ICONS.fabClose);
  assert.ok(env.win.RTX_UI_ICONS.params);
  assert.ok(env.win.RTX_UI_ICONS.conn);
  assert.ok(env.win.RTX_UI_ICONS.layout);
  assert.ok(env.win.RTX_UI_ICONS.reload);
  assert.ok(env.win.RTX_UI_ICONS.clear);
  assert.ok(env.node("rtx-fab").innerHTML.includes("<svg"));
  assert.ok(env.node("rtx-params-btn").innerHTML.includes("<svg"));
  assert.ok(env.node("rtx-conn-btn").innerHTML.includes("<svg"));
  assert.ok(env.node("rtx-fx-layout-btn").innerHTML.includes("<svg"));
  assert.ok(env.node("rtx-reload-btn").innerHTML.includes("<svg"));
  assert.ok(env.node("rtx-clear-btn").innerHTML.includes("<svg"));
});

test("unknown effect renders generic button and generic params", async () => {
  const env = await makeEnv({
    effects: {
      spark: {
        name: "Spark",
        params: {
          count: 2,
          color: "#123456",
          label: "hi",
          enabled: true,
          colors: ["#123456"],
          meta: { a: 1 },
        },
      },
    },
  });
  assert.equal(env.node("rtx-fx-current")._children.length, 1);
  assert.ok(env.node("rtx-fx-spark"));
  assert.equal(env.node("rtx-fx-spark").classList.contains("generic"), true);
  assert.equal(env.node("rtx-fx-spark").classList.contains("selected"), true);
  assert.equal(env.node("rtx-params-body")._children.length, 4);
  assert.equal(env.node("rtx-p-count").type, "number");
  assert.equal(env.node("rtx-p-color").type, "color");
  assert.equal(env.node("rtx-p-label").type, "text");
  assert.equal(env.node("rtx-p-enabled").type, "text");
  assert.equal(env.node("rtx-p-enabled").value, "true");
  bodyClick(env, 10, 10);
  const body = JSON.parse(lastEffectCall(env).opts.body);
  assert.equal(body.effect, "spark");
  assert.deepEqual(body.params, { count: 2, color: "#123456", label: "hi", enabled: true });
});

test("unknown boolean param coerces back to boolean", async () => {
  const env = await makeEnv({
    effects: {
      spark: { name: "Spark", params: { enabled: true } },
    },
  });
  env.node("rtx-p-enabled").value = "false";
  bodyClick(env, 10, 10);
  const body = JSON.parse(lastEffectCall(env).opts.body);
  assert.equal(body.params.enabled, false);
});

test("fallback on network failure", async () => {
  const env = await makeEnv({
    effectsFail: true,
    effects: { spark: { name: "Spark", params: {} } },
  });
  assert.equal(env.fetchCalls[0].url, "http://localhost:8000/api/effects");
  assert.equal(env.node("rtx-fx-particle").classList.contains("selected"), true);
  assert.equal(env.node("rtx-fx-spark"), null);
});

test("fallback on non-ok effects response", async () => {
  const env = await makeEnv({
    effectsOk: false,
    effectsStatus: 500,
    effects: { spark: { name: "Spark", params: {} } },
  });
  assert.equal(env.node("rtx-fx-particle").classList.contains("selected"), true);
  assert.equal(env.node("rtx-fx-spark"), null);
});

test("fallback on invalid effects payload", async () => {
  for (const payload of [{ effects: [] }, { effects: {} }, { effects: "x" }, null]) {
    const env = await makeEnv({
      effectsJson: payload,
      effects: { spark: { name: "Spark", params: {} } },
    });
    assert.equal(env.node("rtx-fx-particle").classList.contains("selected"), true);
    assert.equal(env.node("rtx-fx-spark"), null);
  }
});

test("dynamic effect list includes custom and known effects", async () => {
  const env = await makeEnv({
    effects: { ...DEFAULT_EFFECTS, spark: { name: "Spark", params: { count: 1 } } },
  });
  assert.equal(env.node("rtx-fx-current")._children.length, 5);
  assert.ok(env.node("rtx-fx-spark"));
});

test("fx selection changes sent effect", async () => {
  const env = await makeEnv();
  bodyClick(env, 100, 100);
  assert.equal(JSON.parse(lastEffectCall(env).opts.body).effect, "particle");
  env.node("rtx-fx-text")._fire("click");
  env.node("rtx-p-content").value = "Hi";
  bodyClick(env, 200, 100);
  const body = JSON.parse(lastEffectCall(env).opts.body);
  assert.equal(body.effect, "text");
  assert.deepEqual(body.params, { content: "Hi", color: "#ffffff", size: 32, duration: 2000 });
});

test("params fields render per selected effect", async () => {
  const env = await makeEnv();
  const body = env.node("rtx-params-body");
  assert.equal(body._children.length, 5);
  assert.equal(env.node("rtx-p-color").value, "#ff0044");
  assert.equal(env.node("rtx-p-count").value, 40);
  env.node("rtx-fx-ripple")._fire("click");
  assert.equal(body._children.length, 3);
  assert.equal(env.node("rtx-p-maxRadius").value, 200);
  env.node("rtx-fx-firework")._fire("click");
  assert.equal(body._children.length, 2);
  assert.equal(env.node("rtx-p-count").value, 90);
});

test("number input constraints are set", async () => {
  const env = await makeEnv();
  const count = env.node("rtx-p-count");
  assert.equal(count.min, 1);
  assert.equal(count.max, 400);
  assert.equal(count.step, 1);
});

test("editable:false array param is not rendered", async () => {
  const env = await makeEnv();
  env.node("rtx-fx-firework")._fire("click");
  assert.equal(env.node("rtx-p-colors"), null);
  assert.ok(env.node("rtx-p-count"));
  assert.ok(env.node("rtx-p-duration"));
});

test("string maxLength is applied to text input", async () => {
  const env = await makeEnv();
  env.node("rtx-fx-text")._fire("click");
  assert.equal(env.node("rtx-p-content").type, "text");
  assert.equal(env.node("rtx-p-content").maxLength, 20);
});

test("schema boolean and select fields render and convert", async () => {
  const env = await makeEnv({
    effects: {
      spark: {
        name: "Spark",
        params: {
          enabled: { type: "boolean", label: "啟用", default: true },
          mode: {
            type: "select",
            label: "模式",
            default: "a",
            options: [
              { value: "a", label: "A" },
              { value: "b", label: "B" },
            ],
          },
        },
      },
    },
  });
  const enabled = env.node("rtx-p-enabled");
  assert.equal(enabled.type, "checkbox");
  assert.equal(enabled.checked, true);
  const mode = env.node("rtx-p-mode");
  assert.equal(mode.tagName, "select");
  assert.equal(mode._children.length, 2);
  assert.equal(mode._children[1].value, "b");
  assert.equal(mode.value, "a");
  env.node("rtx-p-enabled").checked = false;
  env.node("rtx-p-mode").value = "b";
  bodyClick(env, 10, 10);
  const body = JSON.parse(lastEffectCall(env).opts.body);
  assert.deepEqual(body.params, { enabled: false, mode: "b" });
});

test("integer param is rounded by paramsFor", async () => {
  const env = await makeEnv();
  env.node("rtx-p-count").value = "40.6";
  bodyClick(env, 10, 10);
  const body = JSON.parse(lastEffectCall(env).opts.body);
  assert.equal(body.params.count, 41);
});

test("loads console plugins from consoleUrl and falls back to schema render", async () => {
  const env = await makeEnv();
  assert.deepEqual(env.scriptLoads, [
    "http://localhost:8000/effects/particle/console.js",
    "http://localhost:8000/effects/ripple/console.js",
    "http://localhost:8000/effects/text/console.js",
  ]);
  env.node("rtx-fx-particle")._fire("click");
  assert.ok(env.node("rtx-p-count"));
  assert.ok(env.node("rtx-p-color"));
});

test("manual reload button posts reload and applies changed manifest", async () => {
  const env = await makeEnv({
    effectsJson: { effects: DEFAULT_EFFECTS },
    reloadJson: { ok: true, changed: true, rev: "rev-2", effects: ["particle", "ripple", "text"] },
  });
  const reloadBtn = env.node("rtx-reload-btn");
  assert.ok(reloadBtn);
  const reloaded = {
    particle: { ...DEFAULT_EFFECTS.particle, label: "Reloaded Particle" },
    ripple: DEFAULT_EFFECTS.ripple,
    text: DEFAULT_EFFECTS.text,
  };
  env.setEffectsJson({ rev: "rev-2", effects: reloaded });
  reloadBtn._fire("click");
  await new Promise((r) => setTimeout(r, 50));
  const reloadCall = env.fetchCalls.find((c) => c.url.endsWith("/api/effects/reload"));
  assert.ok(reloadCall);
  assert.equal(reloadCall.opts.method, "POST");
  const fxButtons = env.node("rtx-fx-current");
  assert.ok(!fxButtons._children.some((c) => c._id === "rtx-fx-firework"));
  assert.ok(fxButtons._children.some((c) => c._id === "rtx-fx-particle"));
  assert.ok(env.scriptLoads[env.scriptLoads.length - 1].includes("?v=rev-2"));
});

test("console plugin load failure keeps schema rendering", async () => {
  const env = await makeEnv({
    scriptFailPatterns: [/effects\/particle\/console\.js/],
  });
  assert.ok(env.node("rtx-p-count"));
  assert.ok(env.node("rtx-p-color"));
  assert.ok(env.node("rtx-p-duration"));
});

test("registered console plugin overrides schema render", async () => {
  const env = await makeEnv({
    consoleRegistry: (doc) => {
      const registry = { registry: {} };
      registry.register = (t, p) => {
        registry.registry[t] = p;
      };
      registry.registry.particle = {
        iconID: "particle",
        render(container, api) {
          const field = doc.createElement("div");
          field.className = "rtx-field";
          const label = doc.createElement("label");
          label.textContent = "自訂數量";
          const input = doc.createElement("input");
          input.id = "rtx-p-count";
          input.type = "number";
          input.value = api.defaults.count;
          field.appendChild(label);
          field.appendChild(input);
          container.appendChild(field);
        },
      };
      return registry;
    },
  });
  const body = env.node("rtx-params-body");
  assert.equal(body._children.length, 1);
  const label = body._children[0]._children[0];
  assert.equal(label.textContent, "自訂數量");
  const input = body._children[0]._children[1];
  assert.equal(input.value, 40);
  input.value = "77";
  bodyClick(env, 10, 10);
  const sent = JSON.parse(lastEffectCall(env).opts.body);
  assert.equal(sent.params.count, 77);
});

test("console plugin valid iconSVG is used and button is not generic", async () => {
  const rawSvg = "<svg viewBox='0 0 24 24' aria-hidden='true'><rect x='4' y='4' width='16' height='16'/></svg>";
  const env = await makeEnv({
    consoleRegistry: (doc) => {
      const registry = { registry: {} };
      registry.register = (t, p) => {
        registry.registry[t] = p;
      };
      registry.registry.particle = { iconSVG: rawSvg };
      return registry;
    },
  });
  const btn = env.node("rtx-fx-particle");
  assert.equal(btn.innerHTML, rawSvg);
  assert.equal(btn.classList.contains("generic"), false);
});

test("console plugin valid iconID resolves through RTX_EFFECT_ICONS", async () => {
  const env = await makeEnv({
    consoleRegistry: (doc) => {
      const registry = { registry: {} };
      registry.register = (t, p) => {
        registry.registry[t] = p;
      };
      registry.registry.ripple = { iconID: "firework" };
      return registry;
    },
  });
  const btn = env.node("rtx-fx-ripple");
  assert.equal(btn.innerHTML, env.win.RTX_EFFECT_ICONS.firework);
  assert.equal(btn.classList.contains("generic"), false);
});

test("console plugin iconSVG takes priority over iconID", async () => {
  const rawSvg = "<svg viewBox='0 0 24 24' aria-hidden='true'><rect x='4' y='4' width='16' height='16'/></svg>";
  const env = await makeEnv({
    consoleRegistry: (doc) => {
      const registry = { registry: {} };
      registry.register = (t, p) => {
        registry.registry[t] = p;
      };
      registry.registry.particle = { iconSVG: rawSvg, iconID: "firework" };
      return registry;
    },
  });
  const btn = env.node("rtx-fx-particle");
  assert.equal(btn.innerHTML, rawSvg);
  assert.equal(btn.classList.contains("generic"), false);
});

test("legacy plugin icon field no longer affects icon resolution", async () => {
  const env = await makeEnv({
    consoleRegistry: (doc) => {
      const registry = { registry: {} };
      registry.register = (t, p) => {
        registry.registry[t] = p;
      };
      registry.registry.particle = { icon: "firework" };
      return registry;
    },
  });
  const btn = env.node("rtx-fx-particle");
  assert.equal(btn.innerHTML, env.win.RTX_EFFECT_ICONS.particle);
  assert.equal(btn.classList.contains("generic"), false);
});

test("invalid plugin iconSVG and iconID fall back to manifest and generic icons", async () => {
  const env = await makeEnv({
    effects: {
      spark: { name: "Spark", icon: "particle", params: { count: 1 } },
      ghost: { name: "Ghost", params: {} },
    },
    consoleRegistry: (doc) => {
      const registry = { registry: {} };
      registry.register = (t, p) => {
        registry.registry[t] = p;
      };
      registry.registry.spark = { iconSVG: 42 };
      registry.registry.ghost = { iconID: "no-such-icon" };
      return registry;
    },
  });
  assert.equal(env.node("rtx-fx-spark").innerHTML, env.win.RTX_EFFECT_ICONS.particle);
  assert.equal(env.node("rtx-fx-spark").classList.contains("generic"), false);
  assert.equal(env.node("rtx-fx-ghost").innerHTML, env.win.RTX_EFFECT_ICONS.generic);
  assert.equal(env.node("rtx-fx-ghost").classList.contains("generic"), true);
});

test("invalid plugin iconID falls back to built-in fallback icon without icon table", async () => {
  const env = await makeEnv({
    effectIcons: {},
    effects: { ghost: { name: "Ghost", params: {} } },
    consoleRegistry: (doc) => {
      const registry = { registry: {} };
      registry.register = (t, p) => {
        registry.registry[t] = p;
      };
      registry.registry.ghost = { iconID: "no-such-icon" };
      return registry;
    },
  });
  const btn = env.node("rtx-fx-ghost");
  assert.equal(
    btn.innerHTML,
    "<svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='3'/></svg>"
  );
  assert.equal(btn.classList.contains("generic"), true);
});

test("console plugin source no-ops without RTX_EFFECT_CONSOLE", async () => {
  const pluginSrc = readFileSync(join(root, "effects", "particle", "console.js"), "utf8");
  const sandbox = { window: {}, console: { info() {}, warn() {} } };
  vm.createContext(sandbox);
  vm.runInContext(pluginSrc, sandbox);
  assert.equal(sandbox.window.RTX_EFFECT_CONSOLE, undefined);
});

test("console plugin source registers into existing RTX_EFFECT_CONSOLE", async () => {
  const pluginSrc = readFileSync(join(root, "effects", "particle", "console.js"), "utf8");
  const registry = { registry: {} };
  registry.register = (t, p) => {
    registry.registry[t] = p;
  };
  const sandbox = {
    window: { RTX_EFFECT_CONSOLE: registry },
    console: { info() {}, warn() {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(pluginSrc, sandbox);
  assert.equal(typeof registry.registry.particle, "object");
  assert.equal(typeof registry.registry.particle.render, "function");
  assert.equal(registry.registry.particle.iconID, "particle");
});

test("click on body sends effect with 0-100 coords", async () => {
  const env = await makeEnv();
  bodyClick(env, 500, 250);
  const call = lastEffectCall(env);
  assert.equal(call.url, "http://localhost:8000/api/effect");
  assert.equal(call.opts.method, "POST");
  assert.equal(call.opts.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(call.opts.body), {
    effect: "particle",
    x: 50,
    y: 50,
    params: { color: "#ff0044", count: 40, spread: 360, speed: 0.35, duration: 1200 },
  });
});

test("click on fab does not send effect", async () => {
  const env = await makeEnv();
  const before = env.fetchCalls.length;
  env.fireWindow("click", { target: env.node("rtx-fab"), clientX: 10, clientY: 10 });
  assert.equal(env.fetchCalls.length, before);
});

test("click inside panel does not send effect", async () => {
  const env = await makeEnv();
  const before = env.fetchCalls.length;
  env.fireWindow("click", { target: env.node("rtx-clear-btn"), clientX: 300, clientY: 300 });
  assert.equal(env.fetchCalls.length, before);
});

test("clear button posts /api/clear", async () => {
  const env = await makeEnv();
  env.node("rtx-clear-btn")._fire("click");
  const call = lastClearCall(env);
  assert.equal(call.url, "http://localhost:8000/api/clear");
  assert.equal(call.opts.method, "POST");
});

test("params button toggles params panel", async () => {
  const env = await makeEnv();
  const btn = env.node("rtx-params-btn");
  const box = env.node("rtx-params-panel");
  btn._fire("click");
  assert.equal(box.classList.contains("open"), true);
  assert.equal(btn.classList.contains("active"), true);
  assert.equal(btn.getAttribute("aria-expanded"), "true");
  btn._fire("click");
  assert.equal(box.classList.contains("open"), false);
  assert.equal(btn.getAttribute("aria-expanded"), "false");
});

test("conn button toggles conn panel", async () => {
  const env = await makeEnv();
  const btn = env.node("rtx-conn-btn");
  const box = env.node("rtx-conn-panel");
  btn._fire("click");
  assert.equal(box.classList.contains("open"), true);
  assert.equal(btn.getAttribute("aria-expanded"), "true");
  btn._fire("click");
  assert.equal(box.classList.contains("open"), false);
});

test("access key is sent when configured", async () => {
  const env = await makeEnv({ controlConfig: { url: "http://key:8000", key: "k1" } });
  bodyClick(env, 10, 10);
  const call = lastEffectCall(env);
  assert.equal(call.url, "http://key:8000/api/effect");
  assert.equal(call.opts.headers["X-Access-Key"], "k1");
});

test("no access key header when key is empty", async () => {
  const env = await makeEnv();
  bodyClick(env, 10, 10);
  const call = lastEffectCall(env);
  assert.equal(call.opts.headers["X-Access-Key"], undefined);
});

test("CONTROL_CONFIG overrides script origin and localStorage", async () => {
  const env = await makeEnv({
    controlConfig: { url: "http://config:8080/", key: "cfg" },
    scriptSrc: "http://script:8010/console/app.js",
    scriptKey: "script",
    stored: { "rtx.srvUrl": "http://stored:8011/", "rtx.srvKey": "stored" },
  });
  assert.equal(env.node("rtx-srv-url").value, "http://config:8080");
  assert.equal(env.node("rtx-srv-key").value, "cfg");
  bodyClick(env, 10, 10);
  const call = lastEffectCall(env);
  assert.equal(call.url, "http://config:8080/api/effect");
  assert.equal(call.opts.headers["X-Access-Key"], "cfg");
});

test("script origin is used only for /console/app.js", async () => {
  const env1 = await makeEnv({ scriptSrc: "http://script:8010/console/app.js" });
  assert.equal(env1.node("rtx-srv-url").value, "http://script:8010");
  const env2 = await makeEnv({ scriptSrc: "http://script:8010/viewer/app.js" });
  assert.equal(env2.node("rtx-srv-url").value, "http://localhost:8000");
});

test("script data-key is used when no CONTROL_CONFIG key", async () => {
  const env = await makeEnv({
    scriptSrc: "http://script:8010/console/app.js",
    scriptKey: "scriptKey",
  });
  assert.equal(env.node("rtx-srv-key").value, "scriptKey");
});

test("localStorage settings are used when no higher priority config", async () => {
  const env = await makeEnv({
    stored: { "rtx.srvUrl": "http://stored:8011/", "rtx.srvKey": "storedKey" },
  });
  assert.equal(env.node("rtx-srv-url").value, "http://stored:8011");
  assert.equal(env.node("rtx-srv-key").value, "storedKey");
});

test("connection inputs save to localStorage on change", async () => {
  const env = await makeEnv();
  const url = env.node("rtx-srv-url");
  const key = env.node("rtx-srv-key");
  url.value = "http://saved:9000/";
  key.value = "savedKey";
  url._fire("change");
  assert.equal(env.store["rtx.srvUrl"], "http://saved:9000");
  assert.equal(env.store["rtx.srvKey"], "savedKey");
});

const pdown = { button: 0, pointerId: 1, preventDefault() {} };

test("press + move drags fab and panel follows", async () => {
  const env = await makeEnv();
  const fab = env.node("rtx-fab");
  const panel = env.node("rtx-panel");
  fab._fire("pointerdown", { clientX: 34, clientY: 34, ...pdown });
  env.fireWindow("pointermove", { clientX: 134, clientY: 114, preventDefault() {} });
  assert.equal(fab.style.left, "112px");
  assert.equal(fab.style.top, "92px");
  assert.equal(panel.style.left, "112px");
  assert.equal(panel.style.top, "146px");
  env.fireWindow("pointerup", {});
  fab._fire("click");
  assert.equal(panel.classList.contains("open"), false);
});

test("quick click (no move) still toggles", async () => {
  const env = await makeEnv();
  const fab = env.node("rtx-fab");
  fab._fire("pointerdown", { clientX: 20, clientY: 20, ...pdown });
  env.fireWindow("pointerup", {});
  fab._fire("click");
  assert.equal(env.node("rtx-panel").classList.contains("open"), true);
});

test("movement under slop does not start drag", async () => {
  const env = await makeEnv();
  const fab = env.node("rtx-fab");
  fab._fire("pointerdown", { clientX: 30, clientY: 30, ...pdown });
  env.fireWindow("pointermove", { clientX: 34, clientY: 30, preventDefault() {} });
  env.fireWindow("pointerup", {});
  assert.equal(fab.style.left, "12px");
  assert.equal(fab.style.top, "12px");
  fab._fire("click");
  assert.equal(env.node("rtx-panel").classList.contains("open"), true);
});

test("drag clamps fab and panel inside viewport", async () => {
  const env = await makeEnv();
  const fab = env.node("rtx-fab");
  const panel = env.node("rtx-panel");
  panel.offsetWidth = 280;
  panel.offsetHeight = 400;
  fab._fire("pointerdown", { clientX: 34, clientY: 34, ...pdown });
  env.fireWindow("pointermove", { clientX: 5000, clientY: 5000, preventDefault() {} });
  assert.equal(fab.style.left, "956px");
  assert.equal(fab.style.top, "456px");
  assert.equal(panel.style.left, "712px");
  assert.equal(panel.style.top, "46px");
  env.fireWindow("pointerup", {});
});

test("fab renders above panel in scoped style", async () => {
  const fabMatch = css.match(/#rtx-fab \{[^}]*z-index: (\d+);/);
  const panelMatch = css.match(/#rtx-panel \{[^}]*z-index: (\d+);/);
  assert.ok(fabMatch);
  assert.ok(panelMatch);
  assert.ok(Number(fabMatch[1]) > Number(panelMatch[1]));
});

test("panel prefers below when there is room", async () => {
  const env = await makeEnv();
  const fab = env.node("rtx-fab");
  const panel = env.node("rtx-panel");
  fab._fire("pointerdown", { clientX: 34, clientY: 34, ...pdown });
  env.fireWindow("pointermove", { clientX: 334, clientY: 146, preventDefault() {} });
  assert.equal(fab.style.left, "312px");
  assert.equal(fab.style.top, "124px");
  assert.equal(panel.style.left, "312px");
  assert.equal(panel.style.top, "178px");
  env.fireWindow("pointerup", {});
});

test("panel avoids fab by moving above when below has no room", async () => {
  const env = await makeEnv();
  const fab = env.node("rtx-fab");
  const panel = env.node("rtx-panel");
  panel.offsetWidth = 280;
  panel.offsetHeight = 400;
  fab._fire("pointerdown", { clientX: 34, clientY: 34, ...pdown });
  env.fireWindow("pointermove", { clientX: 466, clientY: 450, preventDefault() {} });
  assert.equal(fab.style.left, "444px");
  assert.equal(fab.style.top, "428px");
  assert.equal(panel.style.left, "444px");
  assert.equal(panel.style.top, "18px");
  const fabRect = { x: parsePx(fab.style.left), y: parsePx(fab.style.top), w: 44, h: 44 };
  const panelRect = { x: parsePx(panel.style.left), y: parsePx(panel.style.top), w: 280, h: 400 };
  assert.equal(overlapArea(fabRect, panelRect), 0);
  env.fireWindow("pointerup", {});
});
