import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "console", "app.js"), "utf8");

function makeEnv(opts) {
  const els = new Map();
  const fetchCalls = [];

  function makeEl(id) {
    const el = {
      id, value: "", _listeners: {}, _classes: new Set(), _attrs: {}, _parent: null,
      style: {}, offsetHeight: 0,
      setPointerCapture() {}, releasePointerCapture() {},
    };
    el.classList = {
      add: (c) => el._classes.add(c),
      remove: (c) => el._classes.delete(c),
      contains: (c) => el._classes.has(c),
      toggle: (c, force) => {
        const want = force === undefined ? !el._classes.has(c) : !!force;
        if (want) el._classes.add(c); else el._classes.delete(c);
        return want;
      },
    };
    el.addEventListener = (t, fn) => { (el._listeners[t] ??= []).push(fn); };
    el.setAttribute = (k, v) => { el._attrs[k] = v; };
    el.getAttribute = (k) => (k in el._attrs ? el._attrs[k] : null);
    el.closest = (sel) => {
      const want = sel.slice(1);
      let n = el;
      while (n) { if (n.id === want) return n; n = n._parent; }
      return null;
    };
    el._fire = (t, evt) => (el._listeners[t] || []).forEach((fn) => fn(evt));
    return el;
  }

  function el(id) {
    if (!els.has(id)) els.set(id, makeEl(id));
    return els.get(id);
  }

  const fxBtns = ["particle", "ripple", "firework", "text"].map((fx) => {
    const b = el("fx-" + fx);
    b._attrs["data-fx"] = fx;
    return b;
  });

  const windowListeners = {};
  const sandbox = {
    window: {
      CONTROL_CONFIG: opts || {},
      innerWidth: 1000,
      innerHeight: 500,
      addEventListener: (t, fn) => { (windowListeners[t] ??= []).push(fn); },
    },
    document: {
      getElementById: (id) => el(id),
      querySelectorAll: (sel) => (sel === "#fxButtons .fx" ? fxBtns : []),
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
    fetch: async (url, opts) => {
      fetchCalls.push({ url, opts });
      return { ok: true, status: 200, text: async () => "" };
    },
    console: { info() {}, error() {} },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
  };
  vm.createContext(sandbox);
  el("fab")._attrs["aria-expanded"] = "false";
  vm.runInContext(src, sandbox);

  return {
    el,
    fetchCalls,
    fireWindow: (t, evt) => (windowListeners[t] || []).forEach((fn) => fn(evt)),
  };
}

test("panel starts collapsed (fab only)", () => {
  const env = makeEnv();
  assert.equal(env.el("panel")._classes.has("open"), false);
  assert.equal(env.el("fab")._attrs["aria-expanded"], "false");
});

test("fab click toggles panel open then closed", () => {
  const env = makeEnv();
  const fab = env.el("fab");
  const panel = env.el("panel");
  fab._fire("click");
  assert.equal(panel._classes.has("open"), true);
  assert.equal(fab._classes.has("active"), true);
  assert.equal(fab._attrs["aria-expanded"], "true");
  fab._fire("click");
  assert.equal(panel._classes.has("open"), false);
  assert.equal(fab._classes.has("active"), false);
  assert.equal(fab._attrs["aria-expanded"], "false");
});

test("click on body sends effect with 0-100 coords", () => {
  const env = makeEnv();
  env.el("color").value = "#ff0044";
  const body = env.el("body");
  env.fireWindow("click", { target: body, clientX: 500, clientY: 250 });
  assert.equal(env.fetchCalls.length, 1);
  assert.equal(env.fetchCalls[0].url, "http://localhost:8000/api/effect");
  assert.equal(env.fetchCalls[0].opts.method, "POST");
  assert.equal(env.fetchCalls[0].opts.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(env.fetchCalls[0].opts.body), {
    effect: "particle", x: 50, y: 50, params: { color: "#ff0044" },
  });
});

test("click on fab does not send effect", () => {
  const env = makeEnv();
  const before = env.fetchCalls.length;
  env.fireWindow("click", { target: env.el("fab"), clientX: 10, clientY: 10 });
  assert.equal(env.fetchCalls.length, before);
});

test("click inside panel does not send effect", () => {
  const env = makeEnv();
  const clearBtn = env.el("clearBtn");
  clearBtn._parent = env.el("panel");
  const before = env.fetchCalls.length;
  env.fireWindow("click", { target: clearBtn, clientX: 300, clientY: 300 });
  assert.equal(env.fetchCalls.length, before);
});

test("clear button posts /api/clear", () => {
  const env = makeEnv();
  env.el("clearBtn")._fire("click");
  assert.equal(env.fetchCalls.length, 1);
  assert.equal(env.fetchCalls[0].url, "http://localhost:8000/api/clear");
});

test("fx selection changes sent effect", () => {
  const env = makeEnv();
  const body = env.el("body");
  env.fireWindow("click", { target: body, clientX: 100, clientY: 100 });
  env.el("fx-text")._fire("click");
  env.el("text").value = "Hi";
  env.fireWindow("click", { target: body, clientX: 200, clientY: 100 });
  assert.equal(env.fetchCalls.length, 2);
  assert.equal(JSON.parse(env.fetchCalls[1].opts.body).effect, "text");
  assert.deepEqual(JSON.parse(env.fetchCalls[1].opts.body).params, { content: "Hi", color: "" });
});

const pdown = { button: 0, pointerId: 1, preventDefault() {} };

test("press + move drags fab and panel follows", () => {
  const env = makeEnv();
  const fab = env.el("fab");
  const panel = env.el("panel");
  fab._fire("pointerdown", { clientX: 34, clientY: 34, ...pdown });
  env.fireWindow("pointermove", { clientX: 134, clientY: 114, preventDefault() {} });
  assert.equal(fab.style.left, "112px");
  assert.equal(fab.style.top, "92px");
  assert.equal(panel.style.left, "112px");
  assert.equal(panel.style.top, "146px");
  env.fireWindow("pointerup", {});
  fab._fire("click");
  assert.equal(panel._classes.has("open"), false, "click after drag must not toggle");
});

test("quick click (no move) still toggles", () => {
  const env = makeEnv();
  const fab = env.el("fab");
  fab._fire("pointerdown", { clientX: 20, clientY: 20, ...pdown });
  env.fireWindow("pointerup", {});
  fab._fire("click");
  assert.equal(env.el("panel")._classes.has("open"), true);
});

test("movement under slop does not start drag", () => {
  const env = makeEnv();
  const fab = env.el("fab");
  fab._fire("pointerdown", { clientX: 30, clientY: 30, ...pdown });
  env.fireWindow("pointermove", { clientX: 34, clientY: 30, preventDefault() {} });
  env.fireWindow("pointerup", {});
  assert.equal(fab.style.left, undefined, "position must stay unchanged");
  fab._fire("click");
  assert.equal(env.el("panel")._classes.has("open"), true, "click must not be suppressed");
});

test("drag clamps fab and panel inside viewport", () => {
  const env = makeEnv();
  const fab = env.el("fab");
  const panel = env.el("panel");
  panel.offsetWidth = 280;
  panel.offsetHeight = 400;
  fab._fire("pointerdown", { clientX: 34, clientY: 34, ...pdown });
  env.fireWindow("pointermove", { clientX: 5000, clientY: 5000, preventDefault() {} });
  assert.equal(fab.style.left, "956px", "fab clamped to innerWidth - 44");
  assert.equal(fab.style.top, "456px", "fab clamped to innerHeight - 44");
  assert.equal(panel.style.left, "712px", "panel clamped right edge (1000-280-8)");
  assert.equal(panel.style.top, "46px", "panel flipped above fab, fits (456-400-10)");
  env.fireWindow("pointerup", {});
});
