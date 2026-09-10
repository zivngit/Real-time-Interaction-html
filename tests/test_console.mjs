import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "console", "app.js"), "utf8");

const DEFAULT_EFFECTS = {
  particle: {
    name: "粒子爆散",
    params: { color: "#ff0044", count: 40, spread: 360, speed: 0.35, duration: 1200 },
  },
  ripple: {
    name: "漣漪圈",
    params: { color: "#44aaff", maxRadius: 200, duration: 1200 },
  },
  firework: {
    name: "煙火",
    params: { colors: ["#ff5252", "#ffd740", "#40c4ff", "#69f0ae"], count: 90, duration: 1800 },
  },
  text: {
    name: "浮現文字",
    params: { content: "Hello", size: 32, duration: 2000, color: "#ffffff" },
  },
};

async function makeEnv(opts = {}) {
  const created = new Map();
  const fetchCalls = [];
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
      el._children.push(c);
      c._parent = el;
      return c;
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

  const fetch = async (url, options = {}) => {
    fetchCalls.push({ url, opts: options });
    if (url.endsWith("/api/effects")) {
      if (effectsFail) throw new Error("network down");
      return {
        ok: effectsOk,
        status: effectsStatus,
        json: async () => effectsJson,
        text: async () => JSON.stringify(effectsJson),
      };
    }
    return { ok: true, status: 200, text: async () => "" };
  };

  const window = {
    CONTROL_CONFIG: config,
    innerWidth: opts.innerWidth || 1000,
    innerHeight: opts.innerHeight || 500,
    addEventListener: (t, fn) => {
      (windowListeners[t] ??= []).push(fn);
    },
  };

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
    store,
    fireWindow: (t, evt) => (windowListeners[t] || []).slice().forEach((fn) => fn(evt)),
    runAgain: () => vm.runInContext(src, sandbox),
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

test("injects scoped style and unique ids", async () => {
  const env = await makeEnv();
  const style = env.node("rtx-console-style");
  assert.ok(style);
  assert.ok(style.textContent.includes("#rtx-console { display: contents; }"));
  assert.equal(env.node("rtx-console")._parent, env.body);
  for (const id of [
    "rtx-fab",
    "rtx-panel",
    "rtx-fx-buttons",
    "rtx-params-btn",
    "rtx-conn-btn",
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
  assert.equal(env.node("rtx-fx-buttons")._children.length, 4);
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
  assert.equal(env.node("rtx-fx-buttons")._children.length, 1);
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
  assert.equal(env.node("rtx-fx-buttons")._children.length, 5);
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

test("window click sends current input values", async () => {
  const env = await makeEnv();
  env.node("rtx-p-count").value = "77";
  env.node("rtx-p-speed").value = "0.9";
  bodyClick(env, 100, 50);
  const body = JSON.parse(lastEffectCall(env).opts.body);
  assert.equal(body.params.count, 77);
  assert.equal(body.params.speed, 0.9);
  assert.equal(body.params.color, "#ff0044");
});

test("panel starts collapsed", async () => {
  const env = await makeEnv();
  assert.equal(env.node("rtx-panel").classList.contains("open"), false);
  assert.equal(env.node("rtx-fab").getAttribute("aria-expanded"), "false");
});

test("fab click toggles panel open then closed", async () => {
  const env = await makeEnv();
  const fab = env.node("rtx-fab");
  const panel = env.node("rtx-panel");
  fab._fire("click");
  assert.equal(panel.classList.contains("open"), true);
  assert.equal(fab.classList.contains("active"), true);
  assert.equal(fab.getAttribute("aria-expanded"), "true");
  fab._fire("click");
  assert.equal(panel.classList.contains("open"), false);
  assert.equal(fab.classList.contains("active"), false);
  assert.equal(fab.getAttribute("aria-expanded"), "false");
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
    scriptSrc: "http://script:8010/console.js",
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

test("script origin is used only for /console.js", async () => {
  const env1 = await makeEnv({ scriptSrc: "http://script:8010/console.js" });
  assert.equal(env1.node("rtx-srv-url").value, "http://script:8010");
  const env2 = await makeEnv({ scriptSrc: "http://script:8010/app.js" });
  assert.equal(env2.node("rtx-srv-url").value, "http://localhost:8000");
});

test("script data-key is used when no CONTROL_CONFIG key", async () => {
  const env = await makeEnv({
    scriptSrc: "http://script:8010/console.js",
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
  const env = await makeEnv();
  const css = env.node("rtx-console-style").textContent;
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
