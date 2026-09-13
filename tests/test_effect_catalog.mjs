import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const effectsDir = join(root, "effects");
const manifestPath = join(effectsDir, "effects.json");
const EFFECT_ID_RE = /^[A-Za-z0-9_-]+$/;
const PARAM_KEY_RE = /^[A-Za-z0-9_-]+$/;
const PARAM_TYPES = new Set(["integer", "number", "string", "color", "boolean", "select", "array"]);
const COLOR_RE = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;
const KNOWN_EFFECT_FIELDS = new Set(["label", "category", "icon", "viewer", "console", "params"]);
const KNOWN_PARAM_FIELDS = new Set([
  "type",
  "label",
  "default",
  "min",
  "max",
  "step",
  "editable",
  "maxLength",
  "options",
  "items",
  "minItems",
  "maxItems",
]);
const IGNORED_EFFECT_DIRS = new Set(["__pycache__", "temp", "node_modules"]);

function listEffectDirs() {
  if (!existsSync(effectsDir)) return [];
  return readdirSync(effectsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !IGNORED_EFFECT_DIRS.has(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function loadIcons() {
  const source = readFileSync(join(root, "console", "icons.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.RTX_EFFECT_ICONS || {};
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
  }
  return false;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractDefaultObject(source) {
  for (const name of ["DEFAULTS", "defaults"]) {
    const match = new RegExp(`(?:var|let|const)\\s+${name}\\s*=\\s*\\{`).exec(source);
    if (!match) continue;
    const start = source.indexOf("{", match.index);
    let depth = 0;
    let inString = null;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    for (let i = start; i < source.length; i += 1) {
      const ch = source[i];
      const next = source[i + 1];
      if (lineComment) {
        if (ch === "\n") lineComment = false;
        continue;
      }
      if (blockComment) {
        if (ch === "*" && next === "/") {
          blockComment = false;
          i += 1;
        }
        continue;
      }
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === inString) inString = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inString = ch;
        continue;
      }
      if (ch === "/" && next === "/") {
        lineComment = true;
        i += 1;
        continue;
      }
      if (ch === "/" && next === "*") {
        blockComment = true;
        i += 1;
        continue;
      }
      if (ch === "{") depth += 1;
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          const literal = source.slice(start, i + 1);
          try {
            return vm.runInNewContext(`(${literal})`);
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

function defaultsFromManifest(entry) {
  const params = entry && isPlainObject(entry.params) ? entry.params : {};
  const out = {};
  for (const [key, spec] of Object.entries(params)) {
    if (isPlainObject(spec) && "default" in spec) out[key] = spec.default;
  }
  return out;
}

function editableFieldsFromManifest(entry) {
  const params = entry && isPlainObject(entry.params) ? entry.params : {};
  const fields = [];
  for (const [key, spec] of Object.entries(params)) {
    if (!isPlainObject(spec)) continue;
    if (spec.editable === false) continue;
    if (spec.type === "array") continue;
    fields.push({
      key,
      label: spec.label || key,
      type: spec.type,
      def: spec.default,
      min: spec.min,
      max: spec.max,
      step: spec.step,
      maxLength: spec.maxLength,
      options: spec.options,
    });
  }
  return fields;
}

function validateParam(effectId, key, spec, fail, warn) {
  if (!PARAM_KEY_RE.test(key)) {
    fail(`${effectId}: param key ${key} must match ${PARAM_KEY_RE}`);
    return;
  }
  if (!isPlainObject(spec)) {
    fail(`${effectId}: param ${key} must be an object`);
    return;
  }
  for (const field of Object.keys(spec)) {
    if (!KNOWN_PARAM_FIELDS.has(field)) warn(`${effectId}: param ${key} has unknown field ${field}`);
  }
  if (!PARAM_TYPES.has(spec.type)) {
    fail(`${effectId}: param ${key} has unsupported type ${spec.type}`);
    return;
  }
  if (!("default" in spec)) {
    fail(`${effectId}: param ${key} missing default`);
    return;
  }
  if ("editable" in spec && typeof spec.editable !== "boolean") {
    fail(`${effectId}: param ${key} editable must be boolean`);
  }

  if (spec.type === "integer" || spec.type === "number") {
    if (typeof spec.default !== "number" || !Number.isFinite(spec.default)) {
      fail(`${effectId}: param ${key} default must be a finite number`);
    } else {
      if (spec.type === "integer" && !Number.isInteger(spec.default)) {
        fail(`${effectId}: param ${key} default must be an integer`);
      }
      if ("min" in spec && (typeof spec.min !== "number" || !Number.isFinite(spec.min) || spec.default < spec.min)) {
        fail(`${effectId}: param ${key} default is below min`);
      }
      if ("max" in spec && (typeof spec.max !== "number" || !Number.isFinite(spec.max) || spec.default > spec.max)) {
        fail(`${effectId}: param ${key} default is above max`);
      }
      if ("step" in spec && (typeof spec.step !== "number" || !Number.isFinite(spec.step) || spec.step <= 0)) {
        fail(`${effectId}: param ${key} step must be a positive number`);
      }
      if (
        "min" in spec &&
        "max" in spec &&
        typeof spec.min === "number" &&
        typeof spec.max === "number" &&
        spec.min > spec.max
      ) {
        fail(`${effectId}: param ${key} min must be less than or equal to max`);
      }
    }
  }

  if (spec.type === "string") {
    if (typeof spec.default !== "string") {
      fail(`${effectId}: param ${key} default must be a string`);
    } else if ("maxLength" in spec) {
      if (!Number.isInteger(spec.maxLength) || spec.maxLength <= 0) {
        fail(`${effectId}: param ${key} maxLength must be a positive integer`);
      } else if (spec.default.length > spec.maxLength) {
        fail(`${effectId}: param ${key} default exceeds maxLength`);
      }
    }
  }

  if (spec.type === "color") {
    if (typeof spec.default !== "string" || !COLOR_RE.test(spec.default)) {
      fail(`${effectId}: param ${key} default must be #rrggbb or #rrggbbaa`);
    }
  }

  if (spec.type === "boolean") {
    if (typeof spec.default !== "boolean") {
      fail(`${effectId}: param ${key} default must be boolean`);
    }
  }

  if (spec.type === "select") {
    if (!Array.isArray(spec.options) || spec.options.length === 0) {
      fail(`${effectId}: param ${key} select requires options`);
    } else {
      const values = new Set();
      for (const option of spec.options) {
        if (!isPlainObject(option) || !("value" in option)) {
          fail(`${effectId}: param ${key} option must be an object with value`);
          continue;
        }
        if (values.has(option.value)) {
          fail(`${effectId}: param ${key} option value ${option.value} is duplicated`);
        }
        values.add(option.value);
      }
      if (!values.has(spec.default)) {
        fail(`${effectId}: param ${key} default must be one of select options`);
      }
    }
  }

  if (spec.type === "array") {
    if (!Array.isArray(spec.default)) {
      fail(`${effectId}: param ${key} default must be an array`);
    } else {
      if ("items" in spec) {
        if (!PARAM_TYPES.has(spec.items)) {
          fail(`${effectId}: param ${key} items must be a supported param type`);
        } else {
          for (const item of spec.default) {
            if (spec.items === "color" && (typeof item !== "string" || !COLOR_RE.test(item))) {
              fail(`${effectId}: param ${key} contains invalid color item`);
            }
            if (spec.items === "integer" && !Number.isInteger(item)) {
              fail(`${effectId}: param ${key} contains invalid integer item`);
            }
            if (spec.items === "number" && (typeof item !== "number" || !Number.isFinite(item))) {
              fail(`${effectId}: param ${key} contains invalid number item`);
            }
            if (spec.items === "string" && typeof item !== "string") {
              fail(`${effectId}: param ${key} contains invalid string item`);
            }
            if (spec.items === "boolean" && typeof item !== "boolean") {
              fail(`${effectId}: param ${key} contains invalid boolean item`);
            }
          }
        }
      }
      if ("minItems" in spec && (!Number.isInteger(spec.minItems) || spec.minItems < 0)) {
        fail(`${effectId}: param ${key} minItems must be a non-negative integer`);
      }
      if ("maxItems" in spec && (!Number.isInteger(spec.maxItems) || spec.maxItems < 0)) {
        fail(`${effectId}: param ${key} maxItems must be a non-negative integer`);
      }
      if ("minItems" in spec && "maxItems" in spec && spec.minItems > spec.maxItems) {
        fail(`${effectId}: param ${key} minItems must be less than or equal to maxItems`);
      }
      if ("minItems" in spec && spec.default.length < spec.minItems) {
        fail(`${effectId}: param ${key} default length is below minItems`);
      }
      if ("maxItems" in spec && spec.default.length > spec.maxItems) {
        fail(`${effectId}: param ${key} default length is above maxItems`);
      }
    }
    if (spec.editable === true) warn(`${effectId}: param ${key} is an editable array param`);
  }
}

function validateManifest(manifest, fail, warn) {
  if (!isPlainObject(manifest)) {
    fail("effects.json must be a JSON object");
    return false;
  }
  if (manifest.version !== 1) {
    fail("effects.json version must be 1");
  }
  const effects = manifest.effects;
  if (!isPlainObject(effects) || Object.keys(effects).length === 0) {
    fail("effects.json must have a non-empty effects object");
    return false;
  }
  for (const [effectId, spec] of Object.entries(effects)) {
    if (!EFFECT_ID_RE.test(effectId)) {
      fail(`invalid effect id: ${effectId}`);
      continue;
    }
    if (!isPlainObject(spec)) {
      fail(`${effectId}: effect entry must be an object`);
      continue;
    }
    for (const field of Object.keys(spec)) {
      if (!KNOWN_EFFECT_FIELDS.has(field)) warn(`${effectId}: unknown effect field ${field}`);
    }
    if ("label" in spec && (typeof spec.label !== "string" || spec.label.length === 0)) {
      fail(`${effectId}: label must be a non-empty string`);
    }
    if ("category" in spec && typeof spec.category !== "string") {
      fail(`${effectId}: category must be a string`);
    }
    if ("icon" in spec && typeof spec.icon !== "string") {
      fail(`${effectId}: icon must be a string`);
    }
    if ("viewer" in spec) {
      if (typeof spec.viewer !== "string" || spec.viewer !== "viewer.js") {
        fail(`${effectId}: viewer must be viewer.js`);
      }
    }
    if ("console" in spec && (typeof spec.console !== "string" || spec.console !== "console.js")) {
      fail(`${effectId}: console must be console.js`);
    }
    const params = "params" in spec ? spec.params : {};
    if (!isPlainObject(params)) {
      fail(`${effectId}: params must be an object`);
    } else {
      for (const [key, paramSpec] of Object.entries(params)) {
        validateParam(effectId, key, paramSpec, fail, warn);
      }
    }
  }
  return true;
}

function makeCanvasCtx() {
  const gradient = { addColorStop() {} };
  const target = {
    canvas: { width: 800, height: 600 },
    fillStyle: "#000000",
    strokeStyle: "#000000",
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    globalCompositeOperation: "source-over",
    shadowBlur: 0,
    shadowColor: "#000000",
  };
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => gradient;
      if (prop === "measureText") return () => ({ width: 0 });
      if (typeof prop === "string" && prop !== "then" && prop !== "toJSON" && prop !== "utilInspect") {
        return () => {};
      }
      return undefined;
    },
    set(obj, prop, value) {
      obj[prop] = value;
      return true;
    },
  });
}

function makeDomMock() {
  const byId = new Map();
  function makeEl(tag) {
    let id = null;
    const el = {
      tagName: String(tag).toUpperCase(),
      children: [],
      parent: null,
      style: {},
      value: "",
      textContent: "",
      checked: false,
      className: "",
      type: "",
      addEventListener() {},
      setAttribute() {},
      getAttribute() {
        return null;
      },
      appendChild(child) {
        this.children.push(child);
        child.parent = this;
        if (child.id) byId.set(child.id, child);
        return child;
      },
      closest() {
        return null;
      },
    };
    Object.defineProperty(el, "id", {
      get: () => id,
      set: (value) => {
        id = value;
        if (value && el.parent) byId.set(value, el);
      },
    });
    return el;
  }
  const root = makeEl("div");
  const document = {
    createElement: makeEl,
    getElementById: (key) => byId.get(key) || null,
  };
  return { root, document };
}

function makeConsoleApi(effectId, entry, dom) {
  const fields = editableFieldsFromManifest(entry);
  const defaults = {};
  fields.forEach((field) => {
    defaults[field.key] = field.def;
  });
  return {
    type: effectId,
    params: isPlainObject(entry.params) ? entry.params : {},
    defaults,
    fields,
    getValue(key) {
      const el = dom.document.getElementById(`rtx-p-${key}`);
      if (!el) return undefined;
      return el.type === "checkbox" ? el.checked : el.value;
    },
    setValue(key, value) {
      const el = dom.document.getElementById(`rtx-p-${key}`);
      if (!el) return;
      if (el.type === "checkbox") el.checked = Boolean(value);
      else el.value = value;
    },
  };
}

function sourceWarnings(file, source, fail, warn) {
  const has = (re) => re.test(source);
  if (file.endsWith("viewer.js")) {
    if (has(/\bimport\b/)) warn(`${file}: uses import`);
    if (has(/\bexport\b/)) warn(`${file}: uses export`);
    if (has(/\brequire\s*\(/)) warn(`${file}: uses require`);
    if (has(/\bdocument\b/)) warn(`${file}: uses document`);
  } else {
    if (has(/\bimport\b/)) warn(`${file}: uses import`);
    if (has(/\bexport\b/)) warn(`${file}: uses export`);
    if (has(/\brequire\s*\(/)) warn(`${file}: uses require`);
  }
  if (has(/\bfetch\s*\(/)) warn(`${file}: uses fetch`);
  if (has(/XMLHttpRequest/)) warn(`${file}: uses XMLHttpRequest`);
  if (has(/\bWebSocket\b/)) warn(`${file}: uses WebSocket`);
}

function compareDefaultObject(effectId, label, extracted, entry, fail, warn) {
  if (extracted === null) {
    warn(`${effectId}: ${label} defaults could not be statically confirmed`);
    return;
  }
  if (!isPlainObject(extracted)) {
    warn(`${effectId}: ${label} defaults are not a plain object`);
    return;
  }
  const params = isPlainObject(entry.params) ? entry.params : {};
  for (const [key, value] of Object.entries(extracted)) {
    if (!(key in params)) {
      warn(`${effectId}: ${label} default ${key} is not present in manifest params`);
      continue;
    }
    if (!deepEqual(value, params[key].default)) {
      fail(`${effectId}: ${label} default for ${key} does not match manifest default`);
    }
  }
}

function validateViewerPlugin(effectId, source, entry, fail, warn) {
  sourceWarnings(`${effectId}/viewer.js`, source, fail, warn);
  let script;
  try {
    script = new vm.Script(source);
  } catch (error) {
    fail(`${effectId}: viewer.js syntax error: ${error.message}`);
    return;
  }

  try {
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    script.runInContext(sandbox);
    if (sandbox.window.Effects) fail(`${effectId}: viewer.js should not register when window.Effects is missing`);
  } catch (error) {
    fail(`${effectId}: viewer.js threw in no-registry sandbox: ${error.message}`);
    return;
  }

  const registrations = [];
  const window = {
    Effects: {
      register(id, factory) {
        registrations.push({ id, factory });
      },
    },
  };
  const sandbox = { window, console };
  vm.createContext(sandbox);
  try {
    script.runInContext(sandbox);
  } catch (error) {
    fail(`${effectId}: viewer.js threw in registry sandbox: ${error.message}`);
    return;
  }

  if (registrations.length !== 1) {
    fail(`${effectId}: viewer.js must call window.Effects.register exactly once`);
    return;
  }
  const { id, factory } = registrations[0];
  if (id !== effectId) {
    fail(`${effectId}: viewer.js registered id ${id}, expected ${effectId}`);
  }
  if (typeof factory !== "function") {
    fail(`${effectId}: viewer.js factory must be a function`);
    return;
  }

  let effect;
  try {
    effect = factory(0, 0, defaultsFromManifest(entry));
  } catch (error) {
    fail(`${effectId}: viewer.js factory threw: ${error.message}`);
    return;
  }
  if (!isPlainObject(effect)) {
    fail(`${effectId}: viewer.js factory must return an object`);
    return;
  }
  for (const fn of ["update", "draw", "done"]) {
    if (typeof effect[fn] !== "function") {
      fail(`${effectId}: viewer.js factory result missing ${fn} function`);
    }
  }
  if (typeof effect.update !== "function" || typeof effect.draw !== "function" || typeof effect.done !== "function") {
    return;
  }

  const ctx = makeCanvasCtx();
  try {
    effect.draw(ctx);
    let guard = 0;
    while (!effect.done() && guard < 10000) {
      effect.update(16);
      effect.draw(ctx);
      guard += 1;
    }
    if (!effect.done()) fail(`${effectId}: viewer.js smoke run did not finish after 10000 steps`);
  } catch (error) {
    fail(`${effectId}: viewer.js smoke run threw: ${error.message}`);
  }

  compareDefaultObject(effectId, "viewer", extractDefaultObject(source), entry, fail, warn);
}

function validateConsolePlugin(effectId, source, entry, icons, fail, warn) {
  sourceWarnings(`${effectId}/console.js`, source, fail, warn);
  let script;
  try {
    script = new vm.Script(source);
  } catch (error) {
    fail(`${effectId}: console.js syntax error: ${error.message}`);
    return;
  }

  const noRegistryDom = makeDomMock();
  try {
    const sandbox = { window: {}, document: noRegistryDom.document, console };
    vm.createContext(sandbox);
    script.runInContext(sandbox);
    if (sandbox.window.RTX_EFFECT_CONSOLE) {
      fail(`${effectId}: console.js should not register when window.RTX_EFFECT_CONSOLE is missing`);
    }
  } catch (error) {
    fail(`${effectId}: console.js threw in no-registry sandbox: ${error.message}`);
    return;
  }

  const dom = makeDomMock();
  const registrations = [];
  const window = {
    RTX_EFFECT_CONSOLE: {
      register(id, plugin) {
        registrations.push({ id, plugin });
      },
    },
  };
  const sandbox = { window, document: dom.document, console };
  vm.createContext(sandbox);
  try {
    script.runInContext(sandbox);
  } catch (error) {
    fail(`${effectId}: console.js threw in registry sandbox: ${error.message}`);
    return;
  }

  if (registrations.length !== 1) {
    fail(`${effectId}: console.js must call window.RTX_EFFECT_CONSOLE.register exactly once`);
    return;
  }
  const { id, plugin } = registrations[0];
  if (id !== effectId) {
    fail(`${effectId}: console.js registered id ${id}, expected ${effectId}`);
  }
  if (!isPlainObject(plugin)) {
    fail(`${effectId}: console.js plugin must be an object`);
    return;
  }
  if (typeof plugin.render !== "function") {
    fail(`${effectId}: console.js plugin missing render function`);
    return;
  }

  if ("iconID" in plugin) {
    if (typeof plugin.iconID !== "string" || !Object.prototype.hasOwnProperty.call(icons, plugin.iconID)) {
      warn(`${effectId}: console.js iconID is not a valid RTX_EFFECT_ICONS key`);
    }
  }
  if ("iconSVG" in plugin) {
    if (typeof plugin.iconSVG !== "string") {
      warn(`${effectId}: console.js iconSVG must be a string`);
    } else {
      const isSvg = /^\s*<svg[\s>]/.test(plugin.iconSVG) && /<\/svg>\s*$/i.test(plugin.iconSVG);
      if (!isSvg) {
        warn(`${effectId}: console.js iconSVG does not match isSvgString rules`);
      } else {
        if (!/viewBox/i.test(plugin.iconSVG)) warn(`${effectId}: console.js iconSVG missing viewBox`);
        if (!/aria-hidden/i.test(plugin.iconSVG)) warn(`${effectId}: console.js iconSVG missing aria-hidden`);
      }
    }
  }
  if ("icon" in entry && typeof entry.icon === "string" && !Object.prototype.hasOwnProperty.call(icons, entry.icon)) {
    warn(`${effectId}: manifest icon ${entry.icon} is not a valid RTX_EFFECT_ICONS key`);
  }

  const api = makeConsoleApi(effectId, entry, dom);
  try {
    plugin.render(dom.root, api);
  } catch (error) {
    fail(`${effectId}: console.js render threw: ${error.message}`);
    return;
  }

  const fields = editableFieldsFromManifest(entry);
  const params = isPlainObject(entry.params) ? entry.params : {};
  for (const field of fields) {
    const el = dom.document.getElementById(`rtx-p-${field.key}`);
    if (!el) {
      fail(`${effectId}: console.js render missing rtx-p-${field.key}`);
      continue;
    }

    if (field.type === "select") {
      if (el.tagName !== "SELECT") {
        fail(`${effectId}: console.js rtx-p-${field.key} should be a select`);
      } else {
        const optionValues = el.children.filter((child) => child.tagName === "OPTION").map((child) => child.value);
        for (const option of field.options || []) {
          if (!optionValues.includes(option.value)) {
            fail(`${effectId}: console.js rtx-p-${field.key} missing option ${option.value}`);
          }
        }
      }
    } else if (field.type === "boolean") {
      if (el.tagName !== "INPUT" || el.type !== "checkbox") {
        fail(`${effectId}: console.js rtx-p-${field.key} should be a checkbox`);
      }
    } else if (field.type === "color") {
      if (el.tagName !== "INPUT" || el.type !== "color") {
        fail(`${effectId}: console.js rtx-p-${field.key} should be a color input`);
      }
    } else if (field.type === "integer" || field.type === "number") {
      if (el.tagName !== "INPUT" || el.type !== "number") {
        fail(`${effectId}: console.js rtx-p-${field.key} should be a number input`);
      }
    } else if (field.type === "string") {
      if (el.tagName !== "INPUT" || (el.type !== "text" && el.type !== "" && el.type !== undefined)) {
        fail(`${effectId}: console.js rtx-p-${field.key} should be a text input`);
      }
    }

    if (field.type === "boolean") {
      if (el.checked !== field.def) {
        fail(`${effectId}: console.js rtx-p-${field.key} initial checked does not match manifest default`);
      }
    } else if (field.type === "integer" || field.type === "number") {
      const text = String(el.value ?? "");
      if (text.trim() === "" || Number(text) !== field.def) {
        fail(`${effectId}: console.js rtx-p-${field.key} initial value does not match manifest default`);
      }
    } else {
      if (String(el.value ?? "") !== String(field.def)) {
        fail(`${effectId}: console.js rtx-p-${field.key} initial value does not match manifest default`);
      }
    }
  }

  for (const [key, spec] of Object.entries(params)) {
    if (!isPlainObject(spec)) continue;
    if (spec.editable === false || spec.type === "array") {
      if (dom.document.getElementById(`rtx-p-${key}`)) {
        warn(`${effectId}: console.js render creates rtx-p-${key} for non-editable or array param`);
      }
    }
  }

  compareDefaultObject(effectId, "console", extractDefaultObject(source), entry, fail, warn);
}

test("effect catalog matches manifest, folders, viewer plugins, and console plugins", () => {
  const errors = [];
  const warnings = [];
  const fail = (message) => errors.push(message);
  const warn = (message) => warnings.push(message);

  let manifest = null;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`cannot read or parse effects/effects.json: ${error.message}`);
  }

  const effectDirs = listEffectDirs();
  let icons = {};
  try {
    icons = loadIcons();
  } catch (error) {
    fail(`cannot load console/icons.js: ${error.message}`);
  }

  if (manifest !== null && validateManifest(manifest, fail, warn)) {
    const manifestIds = Object.keys(manifest.effects);
    for (const id of manifestIds) {
      if (!effectDirs.includes(id)) fail(`manifest effect ${id} is missing effects/${id}/`);
    }
    for (const dir of effectDirs) {
      if (!manifestIds.includes(dir)) fail(`effects/${dir}/ exists but is not registered in effects.json`);
    }

    for (const id of manifestIds) {
      const entry = manifest.effects[id];
      if (!isPlainObject(entry)) continue;
      if (!effectDirs.includes(id)) continue;

      const dirPath = join(effectsDir, id);
      const viewerPath = join(dirPath, "viewer.js");
      const consolePath = join(dirPath, "console.js");

      if (!existsSync(viewerPath)) {
        fail(`${id}: missing effects/${id}/viewer.js`);
      } else {
        let source;
        try {
          source = readFileSync(viewerPath, "utf8");
        } catch (error) {
          fail(`${id}: cannot read viewer.js: ${error.message}`);
          source = null;
        }
        if (source !== null) validateViewerPlugin(id, source, entry, fail, warn);
      }

      if (existsSync(consolePath)) {
        let source;
        try {
          source = readFileSync(consolePath, "utf8");
        } catch (error) {
          fail(`${id}: cannot read console.js: ${error.message}`);
          source = null;
        }
        if (source !== null) validateConsolePlugin(id, source, entry, icons, fail, warn);
      }

      for (const fileName of readdirSync(dirPath)) {
        if (fileName.startsWith(".")) continue;
        if (fileName !== "viewer.js" && fileName !== "console.js") {
          warn(`${id}: unexpected file effects/${id}/${fileName}`);
        }
      }
    }
  }

  if (warnings.length > 0) {
    console.warn(warnings.join("\n"));
  }

  assert.equal(errors.length, 0, errors.join("\n"));
});
