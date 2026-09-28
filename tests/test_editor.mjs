// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Effects from '../viewer/effects.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_JS = fs.readFileSync(path.join(here, '..', 'editor', 'app.js'), 'utf8');

const LS_KEY = 'rtx.editor.srvKey';

const DEFAULT_MANIFEST = {
  rev: 'a'.repeat(64),
  manifest: {
    version: 1,
    effects: {
      particle: { label: 'Particle burst', enabled: true, params: {} },
      ripple: { label: 'Ripple', enabled: true, params: {} },
      firework: { label: 'Firework', enabled: true, params: {} },
      text: { label: 'Text rain', enabled: true, params: {} }
    }
  }
};

const M2 = {
  rev: 'b'.repeat(64),
  manifest: {
    version: 2,
    effects: {
      'fx-a': { label: 'Alpha', enabled: true, icon: 'burst', params: {} },
      'fx-b': { label: 'Beta', enabled: false, icon: 'ring', params: {} },
      'fx-c': { label: 'Gamma', params: {} },
      'fx-d': { label: 'Delta', params: {} }
    },
    currentEffects: ['fx-a', 'fx-b'],
    alternateEffects: ['fx-c']
  }
};

const M3 = {
  rev: 'c'.repeat(64),
  manifest: {
    version: 2,
    effects: {
      'fx-a': {
        label: 'Alpha',
        enabled: true,
        category: 'burst',
        icon: 'burst',
        params: {
          count: { type: 'integer', label: 'Count', default: 8, min: 1, max: 64, step: 1 },
          note: { type: 'string', label: 'Note', default: 'hi', maxLength: 12 },
          mode: { type: 'select', label: 'Mode', default: 'auto', options: ['auto', 'manual'] },
          cols: { type: 'array', label: 'Cols', default: [2, 3], items: { type: 'integer' }, minItems: 1, maxItems: 8 }
        }
      },
      'fx-b': { label: 'Beta', enabled: false, params: {} }
    },
    currentEffects: ['fx-a'],
    alternateEffects: ['fx-b']
  }
};

const MC = {
  rev: 'e'.repeat(64),
  manifest: {
    version: 2,
    effects: {
      'fx-c': {
        label: 'Color',
        enabled: true,
        params: {
          bg: { type: 'color', label: 'BG', default: '#ff4d4d' },
          count: { type: 'integer', label: 'Count', default: 3, min: 1, max: 9, step: 1 }
        }
      }
    },
    currentEffects: ['fx-c'],
    alternateEffects: []
  }
};

const M1P = {
  rev: 'd'.repeat(64),
  manifest: {
    version: 1,
    effects: {
      solo: { label: 'Solo', enabled: true, params: { count: { type: 'integer', label: 'Count', default: 5, min: 1, max: 9, step: 1 } } }
    }
  }
};

function camelize(k) {
  return k.split('-').map((p, i) => (i ? p[0].toUpperCase() + p.slice(1) : p)).join('');
}

class FakeClassList {
  constructor() {
    this._set = new Set();
  }
  add(...cs) {
    cs.forEach((c) => String(c).split(' ').filter(Boolean).forEach((x) => this._set.add(x)));
  }
  remove(...cs) {
    cs.forEach((c) => String(c).split(' ').filter(Boolean).forEach((x) => this._set.delete(x)));
  }
  toggle(c, force) {
    const want = force === undefined ? !this._set.has(c) : !!force;
    if (want) this._set.add(c);
    else this._set.delete(c);
    return want;
  }
  contains(c) {
    return this._set.has(c);
  }
}

function makeEl(tag) {
  const cls = new FakeClassList();
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [],
    parentNode: null,
    _attrs: {},
    _listeners: {},
    dataset: {},
    _text: '',
    _html: '',
    hidden: false,
    title: '',
    type: '',
    checked: false,
    value: '',
    style: {}
  };
  el.classList = cls;
  Object.defineProperty(el, 'className', {
    get() {
      return [...cls._set].join(' ');
    },
    set(v) {
      cls._set = new Set(String(v).split(' ').filter(Boolean));
    }
  });
  // 同步 id 屬性與屬性（真實瀏覽器行為）→ querySelector('#id')／[id="…"] 可匹配
  Object.defineProperty(el, 'id', {
    get() {
      return el._attrs.id || '';
    },
    set(v) {
      el._attrs.id = String(v);
    }
  });
  Object.defineProperty(el, 'textContent', {
    get() {
      return el._text;
    },
    set(v) {
      el._text = String(v);
    }
  });
  Object.defineProperty(el, 'innerHTML', {
    get() {
      return el._html;
    },
    set(v) {
      el._html = String(v);
    }
  });
  Object.defineProperty(el, 'lastChild', {
    get() {
      return el.children[el.children.length - 1] || null;
    }
  });
  Object.defineProperty(el, 'nextSibling', {
    get() {
      if (!el.parentNode) return null;
      const i = el.parentNode.children.indexOf(el);
      return el.parentNode.children[i + 1] || null;
    }
  });
  el.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
  el.appendChild = (child) => {
    if (child.parentNode) {
      const i = child.parentNode.children.indexOf(child);
      if (i >= 0) child.parentNode.children.splice(i, 1);
    }
    child.parentNode = el;
    el.children.push(child);
  };
  el.removeChild = (child) => {
    const i = el.children.indexOf(child);
    if (i >= 0) el.children.splice(i, 1);
    child.parentNode = null;
    return child;
  };
  el.insertBefore = (newNode, refNode) => {
    if (newNode.parentNode) {
      const i = newNode.parentNode.children.indexOf(newNode);
      if (i >= 0) newNode.parentNode.children.splice(i, 1);
    }
    let idx = refNode ? el.children.indexOf(refNode) : -1;
    if (idx < 0) idx = el.children.length;
    newNode.parentNode = el;
    el.children.splice(idx, 0, newNode);
    return newNode;
  };
  el.replaceChild = (newNode, oldNode) => {
    const i = el.children.indexOf(oldNode);
    if (i < 0) return null;
    if (newNode.parentNode) {
      const j = newNode.parentNode.children.indexOf(newNode);
      if (j >= 0) newNode.parentNode.children.splice(j, 1);
    }
    el.children[i] = newNode;
    newNode.parentNode = el;
    oldNode.parentNode = null;
    return oldNode;
  };
  el.contains = (node) => {
    for (let n = node; n; n = n.parentNode) {
      if (n === el) return true;
    }
    return false;
  };
  el.setAttribute = (k, v) => {
    el._attrs[k] = String(v);
    if (k.startsWith('data-')) el.dataset[camelize(k.slice(5))] = String(v);
  };
  el.getAttribute = (k) => (k in el._attrs ? el._attrs[k] : null);
  el.removeAttribute = (k) => {
    delete el._attrs[k];
  };
  el.addEventListener = (type, fn) => {
    (el._listeners[type] = el._listeners[type] || []).push(fn);
  };
  el.removeEventListener = (type, fn) => {
    el._listeners[type] = (el._listeners[type] || []).filter((f) => f !== fn);
  };
  el._fire = (type, ev = {}) => {
    (el._listeners[type] || []).slice().forEach((fn) => fn(ev));
  };
  el.click = () => el._fire('click', {});
  el.querySelectorAll = (sel) => collect(el, sel);
  el.querySelector = (sel) => collect(el, sel)[0] || null;
  return el;
}

function eachEl(node, cb) {
  node.children.forEach((c) => {
    cb(c);
    eachEl(c, cb);
  });
}

function matchSel(el, sel) {
  sel = sel.trim();
  if (sel.startsWith('#')) return el._attrs.id === sel.slice(1);
  if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
  if (sel.startsWith('[')) {
    const m = sel.match(/^\[([a-zA-Z-]+)(?:="(.*)")?\]$/);
    if (!m) return false;
    const [, attr, val] = m;
    if (val === undefined) return attr in el._attrs;
    return el._attrs[attr] === val;
  }
  if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(sel)) return el.tagName === sel.toUpperCase();
  return false;
}

function collect(rootEl, sel) {
  const out = [];
  eachEl(rootEl, (c) => {
    if (matchSel(c, sel)) out.push(c);
  });
  return out;
}

function buildTree() {
  const html = makeEl('html');
  const head = makeEl('head');
  const body = makeEl('body');
  html.appendChild(head);
  html.appendChild(body);

  const editor = makeEl('div');
  editor.setAttribute('id', 'rtx-editor');
  editor.className = 'editor';
  body.appendChild(editor);

  function sub(tag, id, cls, attrs) {
    const e = makeEl(tag);
    if (id) e.setAttribute('id', id);
    if (cls) e.className = cls;
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    }
    editor.appendChild(e);
    return e;
  }

  const els = {
    badge: sub('span', 'ed-badge', 'badge'),
    chipVersion: sub('span', 'ed-chip-version', 'chip'),
    chipRev: sub('span', 'ed-chip-rev', 'chip'),
    chipCount: sub('span', 'ed-chip-count', 'chip'),
    conn: sub('span', 'ed-conn', 'ui-ico', { 'data-ui-icon': 'conn' }),
    keyInput: sub('input', 'ed-srv-key', ''),
    reloadBtn: sub('button', 'ed-reload-btn', 'btn small'),
    zoneCur: sub('div', 'ed-zone-cur', 'fx-zone'),
    zoneAlt: sub('div', 'ed-zone-alt', 'fx-zone'),
    zonePending: sub('div', 'ed-zone-pending', 'fx-zone pending'),
    dirty: sub('span', 'ed-dirty', 'sync'),
    batchCount: sub('span', 'ed-batch-count', 'batch-count'),
    metaTitle: sub('span', 'ed-meta-title', 'meta-title'),
    tabsHint: sub('span', 'ed-tabs-hint', 'hint tabs-hint'),
    saveBtn: sub('button', 'ed-save-btn', 'btn primary'),
    metaId: sub('input', 'ed-meta-id', ''),
    metaLabel: sub('input', 'ed-meta-label', ''),
    metaIcon: sub('input', 'ed-meta-icon', ''),
    chkEnabled: sub('input', 'chk-enabled', ''),
    pRows: sub('div', 'ed-p-rows', 'p-rows'),
    addParam: sub('button', 'ed-add-param', 'btn small'),
    codeGutter: sub('div', 'ed-code-gutter', 'code-gutter'),
    code: sub('textarea', 'ed-code', 'code'),
    codeHl: sub('pre', 'ed-code-highlight', 'code-hl'),
    codeHlCode: sub('code', 'ed-code-highlight-code', ''),
    tabs: sub('div', 'ed-tabs', 'tabs'),
    saveFile: sub('button', 'ed-save-file', 'btn small primary'),
    importFile: sub('button', 'ed-import-file', 'btn small'),
    exportFile: sub('button', 'ed-export-file', 'btn small'),
    previewHint: sub('span', 'ed-preview-hint', 'hint'),
    previewLabel: sub('span', 'ed-preview-label', 'plabel'),
    previewCanvas: sub('canvas', 'ed-preview-canvas', ''),
    previewStart: sub('button', 'ed-preview-start', 'btn small primary'),
    previewTest: sub('button', 'ed-preview-test', 'btn small'),
    opsResult: sub('div', 'ed-ops-result', 'ops-result'),
    previewClear: sub('button', 'ed-preview-clear', 'btn small'),
    previewReset: sub('button', 'ed-preview-reset', 'btn small'),
    previewRate: sub('input', 'ed-preview-rate', '', { type: 'range', min: '0.25', max: '4', step: '0.25' }),
    previewRateVal: sub('span', 'ed-preview-rate-val', 'pv-rate-val'),
    previewPause: sub('button', 'ed-preview-pause', 'btn small'),
    previewReplay: sub('button', 'ed-preview-replay', 'btn small'),
    miniFab: sub('button', 'ed-mini-fab', 'mini-fab'),
    miniConsole: sub('div', 'ed-mini-console', 'mini-console'),
    miniFx: sub('button', 'ed-mini-fx', 'mini-fx'),
    miniFxIcon: sub('span', 'ed-mini-fx-icon', 'mini-fx-icon'),
    miniFxName: sub('span', 'ed-mini-fx-name', 'mini-fx-name'),
    miniParams: sub('button', 'ed-mini-params', 'mini-params-btn'),
    miniParamsBody: sub('div', 'ed-mini-params-body', 'mini-params'),
    fileImportFile: sub('input', 'ed-file-import-file', ''),
    fileImportEffects: sub('input', 'ed-file-import-effects', '')
  };
  els.keyInput.type = 'text';
  els.dirty.dataset.state = 'clean';
  els.dirty.textContent = '已同步';
  els.chkEnabled.type = 'checkbox';
  els.fileImportFile.type = 'file';
  els.fileImportFile.accept = '.json';
  els.fileImportEffects.type = 'file';
  els.opsResult.textContent = '操作結果：尚未執行';
  const gutterInner = makeEl('div');
  gutterInner.setAttribute('id', 'ed-code-gutter-inner');
  gutterInner.className = 'code-gutter-inner';
  els.codeGutter.appendChild(gutterInner);
  els.codeGutterInner = gutterInner;
  els.codeGutterInner.textContent = '1';
  els.code.value = '';
  els.previewCanvas.width = 800;
  els.previewCanvas.height = 450;
  els.previewCanvas._ctx = {
    _clears: 0,
    _transforms: 0,
    _marks: 0,
    _translate: 0,
    _scales: [],
    clearRect() { this._clears++; },
    setTransform() { this._transforms++; },
    save() { this._marks++; },
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    arc() {},
    fill() {},
    fillRect() {},
    translate() { this._translate++; },
    scale(x, y) { this._scales.push([x, y]); }
  };
  els.previewCanvas.getContext = () => els.previewCanvas._ctx;
  els.previewCanvas.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    right: 800,
    bottom: 450,
    width: 800,
    height: 450
  });
  els.previewHint.textContent = '——（選定）';
  els.previewLabel.textContent = '——（選定）· 800×450';
  els.previewRate.type = 'range';
  els.previewRate.value = '1';
  els.previewRate.disabled = false;
  els.previewRateVal.textContent = '1×';
  // 7h：transport 圖示按鈕（重播/暫停/清屏 各含 .ui-ico span，同真實 HTML）
  const withIco = (btn, key) => {
    const s = makeEl('span');
    s.className = 'ui-ico';
    s.setAttribute('data-ui-icon', key);
    btn.appendChild(s);
    return s;
  };
  els.previewReplayIco = withIco(els.previewReplay, 'replay');
  els.previewPauseIco = withIco(els.previewPause, 'pause');
  els.previewClearIco = withIco(els.previewClear, 'end');
  els.previewReplay.setAttribute('aria-label', '重播');
  els.previewPause.setAttribute('aria-label', '暫停');
  els.previewClear.setAttribute('aria-label', '清屏');
  els.previewPause.disabled = true;
  els.previewReplay.disabled = true;
  els.previewClear.disabled = true;
  ['manifest', 'console', 'viewer'].forEach((name) => {
    const tab = makeEl('div');
    tab.className = name === 'manifest' ? 'tab active' : 'tab';
    tab.setAttribute('data-tab', name);
    tab.textContent = name;
    els.tabs.appendChild(tab);
  });

  const zoneCurHead = makeEl('div');
  zoneCurHead.setAttribute('id', 'ed-zone-cur-head');
  zoneCurHead.className = 'zone-head';
  els.zoneCur.appendChild(zoneCurHead);
  els.zoneCurHead = zoneCurHead;
  const zoneAltHead = makeEl('div');
  zoneAltHead.setAttribute('id', 'ed-zone-alt-head');
  zoneAltHead.className = 'zone-head';
  els.zoneAlt.appendChild(zoneAltHead);
  els.zoneAltHead = zoneAltHead;
  const zonePendingHead = makeEl('div');
  zonePendingHead.setAttribute('id', 'ed-zone-pending-head');
  zonePendingHead.className = 'zone-head pending';
  els.zonePending.appendChild(zonePendingHead);
  els.zonePendingHead = zonePendingHead;

  sub('div', '', 'rsz', { 'data-rsz': '1' });
  sub('div', '', 'rsz', { 'data-rsz': '2' });

  const main = makeEl('div');
  main.className = 'main';
  body.appendChild(main);

  return { html, head, body, editor, els };
}

function makeWindow() {
  const w = {
    _listeners: {},
    RTCustomEvent: function (type, opts) {
      this.type = type;
      Object.assign(this, opts || {});
    }
  };
  w.addEventListener = (type, fn) => {
    (w._listeners[type] = w._listeners[type] || []).push(fn);
  };
  w.removeEventListener = (type, fn) => {
    w._listeners[type] = (w._listeners[type] || []).filter((f) => f !== fn);
  };
  w._fire = (type, ev) => {
    (w._listeners[type] || []).slice().forEach((fn) => fn(ev));
  };
  // 預設對話框：confirm 自動接受（測試若需攔截/記錄會另設 env.window.confirm）
  w.confirm = () => true;
  w.prompt = () => null;
  w.alert = () => {};
  return w;
}

function makeLocalStorage(init = {}) {
  const store = { ...init };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
    _store: store
  };
}

function makeRes(status, headers, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k) => {
        for (const hk of Object.keys(headers)) {
          if (hk.toLowerCase() === k.toLowerCase()) return headers[hk];
        }
        return null;
      }
    },
    json: async () => {
      if (payload === null || payload === undefined) throw new Error('no body');
      return payload;
    },
    text: async () => {
      if (payload === null || payload === undefined) return '';
      if (typeof payload === 'string') return payload;
      throw new Error('no text body');
    }
  };
}

class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.readyState = 1;
    this._listeners = {};
    FakeEventSource.instances.push(this);
  }
  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }
  removeEventListener(type, fn) {
    this._listeners[type] = (this._listeners[type] || []).filter((f) => f !== fn);
  }
  close() {
    this.readyState = 2;
  }
  _emit(type, data) {
    const ev = { type, data };
    (this._listeners[type] || []).slice().forEach((fn) => fn(ev));
  }
}
FakeEventSource.instances = [];

function makeEnv(opts = {}) {
  const { html, head, body, editor, els } = buildTree();
  const doc = {
    documentElement: html,
    head,
    body,
    createElement: (t) => makeEl(t),
    getElementById: (id) => {
      const out = [];
      eachEl(html, (c) => {
        if (c._attrs.id === id) out.push(c);
      });
      return out[0] || null;
    },
    querySelectorAll: (sel) => collect(html, sel),
    querySelector: (sel) => collect(html, sel)[0] || null
  };
  const window = makeWindow();
  window.RTX_UI_ICONS = (opts.icons && opts.icons.ui) || {};
  window.RTX_EFFECT_ICONS = (opts.icons && opts.icons.fx) || {};
  const ls = makeLocalStorage(opts.store || {});
  const env = {
    doc,
    window,
    ls,
    editor,
    els,
    manifest: {
      payload: opts.manifest ? JSON.parse(JSON.stringify(opts.manifest)) : JSON.parse(JSON.stringify(DEFAULT_MANIFEST)),
      fail: !!opts.manifestFail,
      fetcher: typeof opts.manifestFetcher === 'function' ? opts.manifestFetcher : null
    },
    reloadSeq: (opts.reloadSeq || []).map((r) => JSON.parse(JSON.stringify(r))),
    putSeq: (opts.putSeq || []).map((r) => JSON.parse(JSON.stringify(r))),
    fileGet: Object.assign({ status: 200 }, opts.fileGet ? JSON.parse(JSON.stringify(opts.fileGet)) : {}),
    fileGetSeq: (opts.fileGetSeq || []).map((r) => JSON.parse(JSON.stringify(r))),
    fileTemplate: opts.fileTemplate ? JSON.parse(JSON.stringify(opts.fileTemplate)) : {},
    filePutSeq: (opts.filePutSeq || []).map((r) => JSON.parse(JSON.stringify(r))),
    importSeq: (opts.importSeq || []).map((r) => JSON.parse(JSON.stringify(r))),
    eventSourceOn: opts.eventSource !== false,
    fetchCalls: [],
    rafQueue: [],
    nowMs: 0,
    effectPostSeq: (opts.effectPostSeq || []).map((r) => JSON.parse(JSON.stringify(r))),
    clearPostSeq: (opts.clearPostSeq || []).map((r) => JSON.parse(JSON.stringify(r)))
  };
  env.setNow = (t) => {
    env.nowMs = t;
  };
  const fetchFn = async (url, o = {}) => {
    const method = (o.method || 'GET').toUpperCase();
    env.fetchCalls.push({ url: String(url), method, headers: o.headers || {}, body: o.body || null });
    if (method === 'GET' && String(url).startsWith('/api/editor/manifest')) {
      if (env.manifest.fail) return makeRes(0, {}, null);
      if (env.manifest.fetcher) return env.manifest.fetcher(env, makeRes);
      return makeRes(200, {}, JSON.parse(JSON.stringify(env.manifest.payload)));
    }
    if (method === 'POST' && String(url) === '/api/effects/reload') {
      const r = env.reloadSeq.length
        ? env.reloadSeq.shift()
        : { status: 200, payload: { ok: true, changed: false, rev: 'rev-1', effects: [] } };
      return makeRes(r.status, r.headers || {}, r.payload);
    }
    if (method === 'PUT' && String(url) === '/api/editor/manifest') {
      const r = env.putSeq.length
        ? env.putSeq.shift()
        : { status: 200, payload: { ok: true, changed: true, rev: 'e'.repeat(64), created: [], effects: [], warnings: [] } };
      return makeRes(r.status, r.headers || {}, r.payload);
    }
    if (method === 'GET' && /^\/api\/editor\/effect\/[^/]+\/(viewer|console)\.js$/.test(String(url))) {
      const r = env.fileGetSeq.length ? env.fileGetSeq.shift() : env.fileGet;
      return makeRes(r.status, r.headers || {}, r.payload);
    }
    if (method === 'GET' && /^\/api\/editor\/effect\/[^/]+\/(viewer|console)\.js\?template=true$/.test(String(url))) {
      const m = String(url).match(/^\/api\/editor\/effect\/([^/]+)\//);
      const effId = m ? decodeURIComponent(m[1]) : '';
      const ft = env.fileTemplate || {};
      const payload =
        ft.payload != null ? ft.payload : 'window.Effects.register("' + effId + '", function(){})';
      return makeRes(ft.status != null ? ft.status : 200, ft.headers || {}, payload);
    }
    if (method === 'PUT' && /^\/api\/editor\/effect\/[^/]+\/(viewer|console)\.js$/.test(String(url))) {
      const r = env.filePutSeq.length
        ? env.filePutSeq.shift()
        : { status: 200, payload: { ok: true, changed: true, rev: 'g'.repeat(64), warnings: [] } };
      return makeRes(r.status, r.headers || {}, r.payload);
    }
    if (method === 'PUT' && /^\/api\/editor\/effect\/[^/]+\/file$/.test(String(url))) {
      const r = env.filePutSeq.length
        ? env.filePutSeq.shift()
        : { status: 200, payload: { ok: true, changed: true, rev: 'g'.repeat(64), warnings: [] } };
      return makeRes(r.status, r.headers || {}, r.payload);
    }
    if (method === 'POST' && String(url).startsWith('/api/editor/import')) {
      const r = env.importSeq.length
        ? env.importSeq.shift()
        : {
            status: 200,
            payload: {
              ok: true,
              dryRun: true,
              importedEffects: {},
              importedLayout: null,
              files: {},
              baseRev: 'e'.repeat(64)
            }
          };
      return makeRes(r.status, r.headers || {}, r.payload);
    }
    if (method === 'POST' && String(url) === '/api/effect') {
      const r = env.effectPostSeq.length
        ? env.effectPostSeq.shift()
        : { status: 200, payload: { ok: true, id: 'uuid-1' } };
      return makeRes(r.status, r.headers || {}, r.payload);
    }
    if (method === 'POST' && String(url) === '/api/clear') {
      const r = env.clearPostSeq.length
        ? env.clearPostSeq.shift()
        : { status: 200, payload: { ok: true, id: 'uuid-c' } };
      return makeRes(r.status, r.headers || {}, r.payload);
    }
    return makeRes(404, {}, null);
  };
  env.fetch = fetchFn;
  return env;
}

async function loadEnv(opts) {
  const env = makeEnv(opts);
  env.window.requestAnimationFrame = (fn) => {
    env.rafQueue.push(fn);
    return env.rafQueue.length;
  };
  env.window.cancelAnimationFrame = () => {
    env.rafQueue.length = 0;
  };
  env.consoleWarn = [];
  const simulateScript = (child) => {
    if (child.tagName === 'SCRIPT') {
      Promise.resolve().then(() => {
        if (typeof child.onload === 'function') child.onload();
      });
    }
  };
  const origBodyAppend = env.doc.body.appendChild.bind(env.doc.body);
  env.doc.body.appendChild = (child) => {
    origBodyAppend(child);
    simulateScript(child);
    return child;
  };
  const origHeadAppend = env.doc.head.appendChild.bind(env.doc.head);
  env.doc.head.appendChild = (child) => {
    origHeadAppend(child);
    simulateScript(child);
    return child;
  };
  class FakeFormData {
    constructor() {
      this._entries = [];
    }
    append(k, v) {
      this._entries.push([k, v]);
    }
  }
  const sandbox = {
    document: env.doc,
    window: env.window,
    localStorage: env.ls,
    fetch: env.fetch,
    FormData: FakeFormData,
    getComputedStyle: () => ({ gridTemplateColumns: '300px 8px 480px 8px 600px' }),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance: { now: () => env.nowMs },
    console: {
      error: () => {},
      log: () => {},
      warn: (...args) => env.consoleWarn.push(args.map(String).join(' '))
    }
  };
  if (env.eventSourceOn) {
    FakeEventSource.instances.length = 0;
    sandbox.EventSource = FakeEventSource;
  }
  vm.createContext(sandbox);
  vm.runInContext(APP_JS, sandbox);
  await env.window.__rtxEditorReady;
  return env;
}

async function settle(n = 8) {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
}

function makeFakeEffects(env) {
  const calls = [];
  const steps = [];
  env.window.Effects = {
    createEffect: (type, px, py, params) => {
      const fx = {
        elapsed: 0,
        update() {},
        draw() {},
        done: () => false
      };
      calls.push({ type, px, py, params: params || null, fx });
      return fx;
    },
    stepEffect: (fx, t) => {
      steps.push({ fx, t });
      fx.elapsed = Math.max(fx.elapsed, t);
    },
    register: () => {}
  };
  return { calls, steps };
}

function makeRecordingCtx() {
  const state = { calls: [] };
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined;
      if (prop in target) return target[prop];
      return function () {
        state.calls.push(prop);
        return undefined;
      };
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
  return {
    ctx,
    calls: () => state.calls,
    reset: () => {
      state.calls.length = 0;
    }
  };
}

function registerRealEffect(core, id) {
  const src = fs.readFileSync(path.join(here, '..', 'tests', 'fixtures', id, 'viewer.js'), 'utf8');
  const sandbox = {
    window: { Effects: core },
    console: { error() {}, log() {}, warn() {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  assert.equal(typeof core.registry[id], 'function', id + ' 未註冊到真實 Effects core');
}

function bodyScripts(env) {
  const out = [];
  eachEl(env.doc.body, (c) => {
    if (c.tagName === 'SCRIPT') out.push(c);
  });
  return out;
}

function headScripts(env) {
  const out = [];
  eachEl(env.doc.head, (c) => {
    if (c.tagName === 'SCRIPT') out.push(c);
  });
  return out;
}

function itemById(env, id) {
  const els = env.els;
  return itemsIn(els.zoneCur).concat(itemsIn(els.zoneAlt)).find((c) => c.getAttribute('data-fx') === id) || null;
}

function itemsIn(zoneEl) {
  return zoneEl.children.filter((c) => c.classList.contains('fx-item'));
}

function itemIds(zoneEl) {
  return itemsIn(zoneEl).map((c) => c.getAttribute('data-fx'));
}

function itemRmBtn(item) {
  return item.children.find((c) => c.classList.contains('rm'));
}

function itemSwitchInput(item) {
  const sw = item.children.find((c) => c.classList.contains('switch'));
  return sw ? sw.children[0] : null;
}

function makeUnloadEvent() {
  const ev = { returnValue: undefined };
  ev.preventDefault = () => {
    ev.prevented = true;
  };
  return ev;
}

test('v1 manifest：主區 4 特效依 manifest 順序、次區空、chips/badge/連線狀態正確', async () => {
  const env = await loadEnv({ icons: { ui: { conn: '<svg conn>', reload: '<svg reload>' } } });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(ed.state.rev, DEFAULT_MANIFEST.rev);
  assert.equal(ed.state.baseRev, DEFAULT_MANIFEST.rev);
  assert.equal(els.chipVersion.textContent, 'version 1');
  assert.equal(els.chipRev.textContent, 'rev ' + 'a'.repeat(10) + '（base）');
  assert.equal(els.chipCount.textContent, '4 / 4 特效啟用');
  assert.equal(els.badge.textContent, '已連線 · v1 唯讀');
  assert.ok(els.conn.classList.contains('ok'));
  assert.equal(els.conn.title, '已連線');
  assert.equal(els.conn.innerHTML, '<svg conn>');
  assert.deepEqual(itemIds(els.zoneCur), ['particle', 'ripple', 'firework', 'text']);
  assert.equal(els.zoneCur.children.length, 5);
  assert.equal(els.zoneCurHead.textContent, '主區 · 已啟用（4）');
  assert.equal(itemsIn(els.zoneAlt).length, 0);
  assert.equal(els.zoneAlt.children.length, 1);
  assert.equal(els.zoneAltHead.textContent, '次區 · 未啟用（0）');
  assert.equal(ed.state.dirty, false);
  assert.equal(els.dirty.dataset.state, 'clean');
  assert.equal(ed.state.selected, 'particle');
  assert.ok(els.zoneCur.children[1].classList.contains('selected'));
  assert.equal(els.metaTitle.textContent, 'Meta · particle');
  // 首次 GET 無 srvKey 時不附 X-Access-Key
  assert.equal(env.fetchCalls.length, 1);
  assert.equal(env.fetchCalls[0].url, '/api/editor/manifest');
  assert.equal(env.fetchCalls[0].headers['X-Access-Key'], undefined);
  assert.equal(FakeEventSource.instances.length, 1);
  assert.equal(FakeEventSource.instances[0].url, '/api/stream');
});

test('v2 manifest：currentEffects/alternateEffects 分區、未分組 append 次區、disabled [未啟用]+switch 未勾、子元素順序', async () => {
  const env = await loadEnv({
    manifest: M2,
    icons: { fx: { burst: '<svg burst>', ring: '<svg ring>', generic: '<svg g>' } }
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(els.chipVersion.textContent, 'version 2');
  assert.equal(els.chipRev.textContent, 'rev ' + 'b'.repeat(10) + '（base）');
  assert.equal(els.chipCount.textContent, '3 / 4 特效啟用');
  assert.equal(els.badge.textContent, '已連線 · v2');
  assert.deepEqual(itemIds(els.zoneCur), ['fx-a', 'fx-b']);
  assert.deepEqual(itemIds(els.zoneAlt), ['fx-c', 'fx-d']);
  assert.equal(els.zoneCurHead.textContent, '主區 · currentEffects（2）');
  assert.equal(els.zoneAltHead.textContent, '次區 · alternateEffects（2）');

  const itemA = els.zoneCur.children[1];
  assert.equal(itemA.getAttribute('data-fx'), 'fx-a');
  const tagClass = (c) => `${c.tagName}:${c.className}`;
  assert.deepEqual(
    itemA.children.map(tagClass),
    ['INPUT:fx-chk', 'SPAN:grip', 'SPAN:name', 'LABEL:switch sm', 'BUTTON:rm']
  );
  assert.equal(itemA.children[2].textContent, 'Alpha');
  assert.equal(itemA.children[3].querySelector('input').checked, true);

  const itemB = els.zoneCur.children[2];
  assert.ok(itemB.classList.contains('disabled'));
  const off = itemB.children.find((c) => c.classList.contains('off-tag'));
  assert.ok(off);
  assert.equal(off.textContent, '[未啟用]');
  assert.equal(itemB.children[4].querySelector('input').checked, false);

  const itemC = els.zoneAlt.children[1];
  assert.equal(itemC.classList.contains('disabled'), false);
  assert.equal(itemC.children.find((c) => c.classList.contains('off-tag')), undefined);
  assert.equal(itemC.children[3].querySelector('input').checked, true);

  // 點擊 name 選中；點擊 rm 不選中
  itemC._fire('click', { target: itemC.children[2] });
  assert.equal(ed.state.selected, 'fx-c');
  assert.ok(itemC.classList.contains('selected'));
  assert.equal(els.metaTitle.textContent, 'Meta · fx-c');
  itemC._fire('click', { target: itemC.children[4] });
  assert.equal(ed.state.selected, 'fx-c');
  itemC._fire('click', { target: itemC.children[3].querySelector('input') });
  assert.equal(ed.state.selected, 'fx-c');
});

test('srvKey：localStorage 回填、change 儲存並重開 SSE、X-Access-Key header、SSE query param', async () => {
  const env = await loadEnv({ store: { [LS_KEY]: 'k1' } });
  const els = env.els;
  assert.equal(els.keyInput.value, 'k1');
  assert.equal(env.fetchCalls[0].headers['X-Access-Key'], 'k1');
  assert.equal(FakeEventSource.instances.length, 1);
  assert.equal(FakeEventSource.instances[0].url, '/api/stream?key=k1');

  els.keyInput.value = 'k2';
  els.keyInput._fire('change', {});
  assert.equal(env.ls.getItem(LS_KEY), 'k2');
  assert.equal(FakeEventSource.instances.length, 2);
  assert.equal(FakeEventSource.instances[1].url, '/api/stream?key=k2');
  assert.equal(FakeEventSource.instances[0].readyState, 2);

  els.keyInput.value = '';
  els.keyInput._fire('change', {});
  assert.equal(FakeEventSource.instances.length, 3);
  assert.equal(FakeEventSource.instances[2].url, '/api/stream');
});

test('dirty：setDirty 顯示/隱藏標示、beforeunload 僅 dirty 時攔截', async () => {
  const env = await loadEnv({});
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(els.dirty.dataset.state, 'clean');
  ed.setDirty(true);
  assert.equal(ed.state.dirty, true);
  assert.equal(els.dirty.dataset.state, 'dirty');
  let ev = makeUnloadEvent();
  env.window._fire('beforeunload', ev);
  assert.equal(ev.prevented, true);
  assert.ok(ev.returnValue);
  ed.setDirty(false);
  assert.equal(els.dirty.dataset.state, 'clean');
  ev = makeUnloadEvent();
  env.window._fire('beforeunload', ev);
  assert.equal(ev.prevented, undefined);
});

test('U7 狀態指標：已同步／未保存變更／保存中＋按鈕改名（7d 加未暫存變更，見 7d 測試）', async () => {
  const env = await loadEnv({});
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(els.dirty.dataset.state, 'clean');
  assert.equal(els.dirty.textContent, '已同步');
  ed.setDirty(true);
  assert.equal(els.dirty.dataset.state, 'dirty');
  assert.equal(els.dirty.textContent, '未保存變更');
  ed.state.saving = true;
  ed.setDirtyUI();
  assert.equal(els.dirty.dataset.state, 'saving');
  assert.equal(els.dirty.textContent, '保存中…');
  ed.state.saving = false;
  ed.setDirty(false);
  assert.equal(els.dirty.dataset.state, 'clean');
  assert.equal(els.dirty.textContent, '已同步');
});

test('[重載]：POST /api/effects/reload 後再 GET /api/editor/manifest 重繪', async () => {
  const env = await loadEnv({});
  const els = env.els;
  const before = env.fetchCalls.length;
  els.reloadBtn._fire('click', { target: els.reloadBtn });
  await settle();
  const calls = env.fetchCalls.slice(before);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].url, '/api/effects/reload');
  assert.equal(calls[1].method, 'GET');
  assert.equal(calls[1].url, '/api/editor/manifest');
  assert.equal(env.window.__rtxEditor.state.rev, DEFAULT_MANIFEST.rev);
  assert.equal(itemsIn(els.zoneCur).length, 4);
});

test('[重載] 429：依 Retry-After 重試一次後成功並重抓 manifest', async () => {
  const env = await loadEnv({
    reloadSeq: [
      { status: 429, headers: { 'Retry-After': '0' } },
      { status: 200, payload: { ok: true, changed: false, rev: 'rev-2', effects: [] } }
    ]
  });
  const els = env.els;
  const before = env.fetchCalls.length;
  els.reloadBtn._fire('click', {});
  await settle();
  const calls = env.fetchCalls.slice(before);
  assert.deepEqual(
    calls.map((c) => c.method + ' ' + c.url),
    ['POST /api/effects/reload', 'POST /api/effects/reload', 'GET /api/editor/manifest']
  );
});

test('SSE manifest 事件：rev 不同才重抓 manifest（baseRev 同步）', async () => {
  const env = await loadEnv({});
  const es = FakeEventSource.instances[0];
  assert.ok(es);
  const before = env.fetchCalls.length;
  const newRev = 'c'.repeat(64);
  const newPayload = JSON.parse(JSON.stringify(DEFAULT_MANIFEST));
  newPayload.rev = newRev;
  env.manifest.payload = newPayload;
  es._emit('manifest', JSON.stringify({ rev: newRev }));
  await settle();
  const calls = env.fetchCalls.slice(before);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/editor/manifest');
  assert.equal(env.window.__rtxEditor.state.baseRev, newRev);
  assert.equal(env.window.__rtxEditor.state.rev, newRev);

  const before2 = env.fetchCalls.length;
  es._emit('manifest', JSON.stringify({ rev: newRev }));
  await settle();
  assert.equal(env.fetchCalls.length, before2);
});

test('manifest 載入失敗：連線狀態 err、badge 斷線、列表空、不開 SSE', async () => {
  const env = await loadEnv({ manifestFail: true });
  const els = env.els;
  const ed = env.window.__rtxEditor;
  assert.ok(els.conn.classList.contains('err'));
  assert.equal(els.conn.title, '未連線');
  assert.equal(els.badge.textContent, '斷線');
  assert.equal(ed.state.baseRev, null);
  assert.equal(itemsIn(els.zoneCur).length, 0);
  assert.equal(FakeEventSource.instances.length, 0);
});

test('U13 SSE 斷流不轉紅：icon 跟隨 manifest 連線、streamOk 獨立追蹤', async () => {
  const env = await loadEnv({});
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const es = FakeEventSource.instances[0];
  assert.ok(es, 'manifest 連線成功應開 SSE');
  assert.ok(els.conn.classList.contains('ok'));
  // SSE manifest 事件→streamOk=true
  const rev1 = 'c'.repeat(64);
  const p1 = JSON.parse(JSON.stringify(DEFAULT_MANIFEST));
  p1.rev = rev1;
  env.manifest.payload = p1;
  es._emit('manifest', JSON.stringify({ rev: rev1 }));
  await settle();
  assert.equal(ed.state.streamOk, true, 'SSE manifest 事件→streamOk=true');
  assert.ok(els.conn.classList.contains('ok'));
  // SSE 斷流（error）→ manifest 連線不受影響（不轉紅）、streamOk=false
  es._emit('error');
  assert.equal(ed.state.conn, true, 'SSE 斷流不應把 manifest 連線轉 false');
  assert.ok(els.conn.classList.contains('ok'), 'SSE 斷流 icon 不應轉 err');
  assert.ok(!els.conn.classList.contains('err'));
  assert.equal(els.conn.title, '已連線');
  assert.equal(ed.state.streamOk, false, 'SSE 斷流→streamOk=false');
});

test('U9 badge 過渡態：loadManifest 期間 badge=「連線中…」、成功後回「已連線 · vN」', async () => {
  const env = await loadEnv({});
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(els.badge.textContent, '已連線 · v1 唯讀');
  // deferred manifest fetch：SSE manifest 事件→loadManifest（可觀察過渡態）
  let resolveManifest;
  const deferred = new Promise((r) => {
    resolveManifest = r;
  });
  env.manifest.fetcher = (e, mkRes) =>
    deferred.then(() => mkRes(200, {}, JSON.parse(JSON.stringify(e.manifest.payload))));
  const newRev = 'd'.repeat(64);
  const p2 = JSON.parse(JSON.stringify(DEFAULT_MANIFEST));
  p2.rev = newRev;
  env.manifest.payload = p2;
  const es = FakeEventSource.instances[0];
  es._emit('manifest', JSON.stringify({ rev: newRev }));
  await settle(3);
  assert.equal(els.badge.textContent, '連線中…', 'loadManifest 進行中 badge 應顯示過渡態');
  resolveManifest();
  await settle();
  assert.equal(els.badge.textContent, '已連線 · v1 唯讀', 'loadManifest 成功後 badge 回 已連線');
  assert.equal(ed.state.baseRev, newRev);
});

test('2c v1 manifest：編輯控件禁用、param card 欄位完整、warnings 預設、save 不動作', async () => {
  const env = await loadEnv({ manifest: M1P });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(ed.state.editable, false);
  assert.equal(els.saveBtn.disabled, true);
  assert.equal(els.addParam.disabled, true);
  assert.equal(els.metaLabel.disabled, true);
  assert.equal(els.metaIcon.disabled, true);
  assert.equal(els.chkEnabled.disabled, true);
  assert.equal(els.tabsHint.textContent, 'manifest read-only (v1)');
  assert.equal(els.opsResult.textContent, '操作結果：尚未執行');
  assert.equal(els.metaLabel.value, 'Solo');
  assert.equal(els.chkEnabled.checked, true);
  const cards = els.pRows.querySelectorAll('.p-card');
  assert.equal(cards.length, 1);
  const card = cards[0];
  assert.equal(card.querySelector('.p-key').value, 'count');
  assert.equal(card.querySelector('.p-type').value, 'integer');
  assert.equal(card.querySelector('.p-label').value, 'Count');
  assert.equal(card.querySelector('.p-default').value, '5');
  assert.equal(card.querySelector('.p-editable').checked, true);
  assert.equal(card.querySelector('.p-min').value, '1');
  assert.equal(card.querySelector('.p-max').value, '9');
  assert.equal(card.querySelector('.p-step').value, '1');
  card.querySelectorAll('input').forEach((i) => assert.equal(i.disabled, true));
  card.querySelectorAll('select').forEach((i) => assert.equal(i.disabled, true));
  card.querySelectorAll('button').forEach((i) => assert.equal(i.disabled, true));
  const before = env.fetchCalls.length;
  els.saveBtn._fire('click', {});
  await settle();
  assert.equal(env.fetchCalls.length, before);
});

test('2c v2 manifest：可編輯控件、meta/param card 渲染（array items 物件形）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(ed.state.editable, true);
  assert.equal(els.saveBtn.disabled, false);
  assert.equal(els.addParam.disabled, false);
  assert.equal(els.tabsHint.textContent, 'manifest editable (v2)');
  assert.equal(els.metaLabel.value, 'Alpha');
  assert.equal(els.metaIcon.value, 'burst');
  assert.equal(els.chkEnabled.checked, true);

  const cards = els.pRows.querySelectorAll('.p-card');
  assert.equal(cards.length, 4);
  assert.equal(cards[0].querySelector('.p-key').value, 'count');
  assert.equal(cards[1].querySelector('.p-key').value, 'note');
  assert.equal(cards[2].querySelector('.p-key').value, 'mode');
  assert.equal(cards[3].querySelector('.p-key').value, 'cols');
  assert.equal(cards[0].querySelector('.p-default').value, '8');
  assert.equal(cards[1].querySelector('.p-maxlen').value, '12');
  assert.equal(cards[2].querySelector('.p-opts').querySelectorAll('.p-opt-row').length, 2);
  const optVals = cards[2].querySelectorAll('.p-opt-row').map((r) => r.querySelector('input').value);
  assert.deepEqual(optVals, ['auto', 'manual']);
  // 7k：array default 為子項列（非 JSON 文字框）
  const colsRows = cards[3].querySelector('.p-opts').querySelectorAll('.p-opt-row');
  assert.equal(colsRows.length, 2);
  assert.deepEqual(colsRows.map((r) => r.querySelector('input').value), ['2', '3']);
  assert.equal(cards[3].querySelector('.p-add-opt').textContent, '+ item');
  assert.equal(cards[3].querySelector('.p-items').value, 'integer');
  assert.equal(cards[3].querySelector('.p-minitems').value, '1');
  assert.equal(cards[3].querySelector('.p-maxitems').value, '8');
  assert.ok(cards[0].className.includes('cA'));
  assert.ok(cards[1].className.includes('cB'));
});

test('2c v2 save：PUT body 含完整 manifest/baseRev/deleteRemoved、成功後重抓並清 dirty', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const next = JSON.parse(JSON.stringify(M3));
  next.rev = 'e'.repeat(64);
  next.manifest.effects['fx-a'].label = 'Alpha 2';
  next.manifest.effects['fx-a'].params.count.default = 12;
  env.manifest.payload = next;

  const countCard = els.pRows.querySelectorAll('.p-card')[0];
  const defInp = countCard.querySelector('.p-default');
  defInp.value = '12';
  defInp._fire('input', {});
  els.metaLabel.value = 'Alpha 2';
  els.metaLabel._fire('input', {});
  assert.equal(els.dirty.dataset.state, 'unstaged', '7m：欄位編輯 → 未暫存變更');

  els.saveBtn._fire('click', {});
  await settle(16);
  const calls = env.fetchCalls.slice(1);
  assert.deepEqual(calls.map((c) => c.method), ['PUT', 'GET']);
  const putBody = JSON.parse(calls[0].body);
  assert.equal(putBody.baseRev, M3.rev);
  assert.equal(putBody.deleteRemoved, false);
  assert.equal(putBody.manifest.version, 2);
  assert.equal(putBody.manifest.effects['fx-a'].label, 'Alpha 2');
  const countSpec = putBody.manifest.effects['fx-a'].params.count;
  assert.equal(countSpec.type, 'integer');
  assert.equal(countSpec.label, 'Count');
  assert.equal(countSpec.default, 12);
  assert.equal(countSpec.editable, true);
  assert.equal(countSpec.min, 1);
  assert.equal(countSpec.max, 64);
  assert.equal(countSpec.step, 1);
  assert.equal(putBody.manifest.effects['fx-b'].label, 'Beta');
  assert.deepEqual(putBody.manifest.effects['fx-b'].params, {});
  assert.equal(ed.state.baseRev, 'e'.repeat(64));
  assert.equal(ed.state.dirty, false);
  assert.equal(els.dirty.dataset.state, 'clean');
  assert.equal(els.opsResult.textContent, '保存成功');
  assert.ok(els.opsResult.classList.contains('ok'));
  assert.equal(els.metaLabel.value, 'Alpha 2');
});

test('2c save 429：Retry-After 後重試一次並成功', async () => {
  const env = await loadEnv({
    manifest: M3,
    putSeq: [{ status: 429, headers: { 'Retry-After': '0' } }]
  });
  const els = env.els;
  els.metaLabel.value = 'X';
  els.metaLabel._fire('input', {});
  els.saveBtn._fire('click', {});
  await settle(16);
  const calls = env.fetchCalls.slice(1);
  assert.deepEqual(calls.map((c) => c.method + ' ' + c.url), [
    'PUT /api/editor/manifest',
    'PUT /api/editor/manifest',
    'GET /api/editor/manifest'
  ]);
  assert.equal(els.opsResult.textContent, '保存成功');
});

test('2c save 409：衝突後重抓 manifest、顯示 409 提示、dirty 清除', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const ext = JSON.parse(JSON.stringify(M3));
  ext.rev = 'f'.repeat(64);
  ext.manifest.effects['fx-a'].label = 'external';
  env.manifest.payload = ext;
  env.putSeq = [{ status: 409, payload: { detail: 'baseRev mismatch' } }];

  els.metaLabel.value = 'mine';
  els.metaLabel._fire('input', {});
  els.saveBtn._fire('click', {});
  await settle(16);
  const calls = env.fetchCalls.slice(1);
  assert.deepEqual(calls.map((c) => c.method), ['PUT', 'GET']);
  assert.equal(els.opsResult.textContent, '409 衝突：manifest 已被修改，已重抓最新');
  assert.ok(els.opsResult.classList.contains('err'));
  assert.equal(ed.state.baseRev, 'f'.repeat(64));
  assert.equal(els.metaLabel.value, 'external');
  assert.equal(els.dirty.dataset.state, 'clean');
});

test('2c save 400：顯示 detail、不重抓 manifest', async () => {
  const env = await loadEnv({
    manifest: M3,
    putSeq: [{ status: 400, payload: { detail: 'invalid effect id: bad' } }]
  });
  const els = env.els;
  els.metaLabel.value = 'X';
  els.metaLabel._fire('input', {});
  els.saveBtn._fire('click', {});
  await settle(16);
  const calls = env.fetchCalls.slice(1);
  assert.deepEqual(calls.map((c) => c.method), ['PUT']);
  assert.equal(els.opsResult.textContent, '保存失敗 400：invalid effect id: bad');
  assert.ok(els.opsResult.classList.contains('err'));
  assert.equal(els.dirty.dataset.state, 'unstaged', '7m：欄位編輯未保存失敗 → 仍是未暫存變更');
});

test('2c params：新增/刪除、type 切換重建 r3、空 key 不進 collectParams', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;

  els.addParam._fire('click', {});
  assert.equal(els.pRows.querySelectorAll('.p-card').length, 5);
  const newCard = els.pRows.children[4];
  assert.equal(newCard.querySelector('.p-key').value, '');
  assert.equal(newCard.querySelector('.p-type').value, 'string');
  assert.ok(newCard.querySelector('.p-maxlen'));

  const typeSel = newCard.querySelector('.p-type');
  typeSel.value = 'select';
  typeSel._fire('change', {});
  assert.equal(newCard.querySelector('.p-opts').querySelectorAll('.p-opt-row').length, 0);
  assert.ok(newCard.querySelector('.p-add-opt'));
  assert.equal(newCard.querySelector('.p-default').value, '');

  typeSel.value = 'integer';
  typeSel._fire('change', {});
  assert.ok(newCard.querySelector('.p-min'));
  assert.ok(newCard.querySelector('.p-max'));
  assert.ok(newCard.querySelector('.p-step'));
  assert.equal(newCard.querySelector('.p-opts'), null);

  newCard.querySelector('.p-rm')._fire('click', {});
  assert.equal(els.pRows.querySelectorAll('.p-card').length, 4);

  els.addParam._fire('click', {});
  assert.equal(els.pRows.querySelectorAll('.p-card').length, 5);
  assert.deepEqual(Object.keys(ed.collectParams()), ['count', 'note', 'mode', 'cols']);
});

test('2c buildManifest：只合併 selected effect 的 meta/params、不改其他 effect 與分區', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  ed.selectItem('fx-b');
  assert.equal(els.metaLabel.value, 'Beta');
  els.metaLabel.value = 'Beta new';
  els.chkEnabled.checked = true;
  const m = ed.buildManifest();
  assert.equal(m.version, 2);
  assert.equal(m.effects['fx-b'].label, 'Beta new');
  assert.equal(m.effects['fx-b'].enabled, true);
  assert.equal(Object.keys(m.effects['fx-b'].params).length, 0);
  assert.equal(m.effects['fx-a'].label, 'Alpha');
  assert.equal(m.effects['fx-a'].params.count.default, 8);
  assert.equal(m.currentEffects.length, 1);
  assert.equal(m.currentEffects[0], 'fx-a');
  assert.equal(m.alternateEffects.length, 1);
  assert.equal(m.alternateEffects[0], 'fx-b');
});

test('3a tabs：預設 effects.json tab 顯示選定 effect 單項 JSON、viewer/console tab GET 載入檔案與行號', async () => {
  const env = await loadEnv({ manifest: M3, fileGet: { payload: 'line1\nline2\nline3' } });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(ed.activeTab(), 'manifest');
  assert.ok(els.code.value.includes('"label": "Alpha"'));
  assert.ok(els.code.value.includes('"burst"'));
  assert.ok(!els.code.value.includes('"version"'));
  assert.ok(!els.code.value.includes('Beta'));
  assert.equal(els.code.readOnly, true);
  const tabs = els.tabs.querySelectorAll('.tab');
  const viewerTab = tabs.find((t) => t.getAttribute('data-tab') === 'viewer');
  viewerTab._fire('click', {});
  await settle(4);
  assert.equal(ed.activeTab(), 'viewer');
  assert.equal(env.fetchCalls[env.fetchCalls.length - 1].url, '/api/editor/effect/fx-a/viewer.js');
  assert.equal(els.code.value, 'line1\nline2\nline3');
  assert.equal(els.code.readOnly, false);
  assert.equal(els.codeGutterInner.textContent, '1\n2\n3');
  const consoleTab = tabs.find((t) => t.getAttribute('data-tab') === 'console');
  consoleTab._fire('click', {});
  await settle(4);
  assert.equal(env.fetchCalls[env.fetchCalls.length - 1].url, '/api/editor/effect/fx-a/console.js');
});

test('3a 未選定特效：viewer tab 不發請求、顯示提示', async () => {
  const env = await loadEnv({ manifestFail: true });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(ed.state.selected, null);
  const viewerTab = els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer');
  viewerTab._fire('click', {});
  await settle(4);
  const fileCalls = env.fetchCalls.filter((c) => c.url.startsWith('/api/editor/effect/'));
  assert.equal(fileCalls.length, 0);
  assert.equal(els.code.value, '');
  assert.equal(els.opsResult.textContent, '請先選擇特效');
  assert.ok(els.opsResult.classList.contains('err'));
});

test('3a 存檔：[存檔] staged（無 PUT、dirty）＋[保存] 寫 manifest（含 files）、清 pendingCode', async () => {
  const env = await loadEnv({
    manifest: M3,
    fileGet: { payload: 'a\nb' },
    filePutSeq: [{ status: 200, payload: { ok: true, changed: true, rev: 'g'.repeat(64), warnings: [] } }]
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  els.code.value = 'a\nb\n// edited';
  els.saveFile._fire('click', {});
  await settle(4);
  assert.equal(ed.state.dirty, true);
  assert.equal(els.opsResult.textContent, 'code 已暫存（按 [保存至伺服器] 寫入伺服器）');
  assert.ok(els.opsResult.classList.contains('ok'));
  const staged = ed.state.pendingCode['fx-a/viewer.js'];
  assert.equal(staged.content, 'a\nb\n// edited');
  assert.equal(staged.filename, 'viewer.js');
  assert.equal(env.fetchCalls.filter((c) => c.method === 'PUT').length, 0);
  els.saveBtn._fire('click', {});
  await settle(12);
  const putCalls = env.fetchCalls.filter((c) => c.method === 'PUT');
  assert.deepEqual(putCalls.map((c) => c.url), ['/api/editor/manifest']);
  assert.deepEqual(JSON.parse(putCalls[0].body).files, [
    { effectId: 'fx-a', filename: 'viewer.js', content: 'a\nb\n// edited' }
  ]);
  assert.equal(ed.state.dirty, false);
  assert.equal(ed.state.pendingCode['fx-a/viewer.js'], undefined);
  assert.equal(els.opsResult.textContent, '保存成功');
  assert.equal(els.code.value, 'a\nb', '7d：保存成功後編輯框回到 server 內容');
  assert.equal(els.dirty.dataset.state, 'clean', '7d：保存成功後指標「已同步」');
});

test('3a [保存] warnings：server 回傳 warnings 時非阻斷顯示', async () => {
  const env = await loadEnv({
    manifest: M3,
    fileGet: { payload: 'a' },
    putSeq: [{ status: 200, payload: { ok: true, changed: true, rev: 'e'.repeat(64), created: [], effects: [], warnings: ['viewer.js 缺少 window.Effects.register('] } }]
  });
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  els.saveFile._fire('click', {});
  await settle(4);
  els.saveBtn._fire('click', {});
  await settle(10);
  assert.equal(els.opsResult.textContent, '預警：viewer.js 缺少 window.Effects.register(');
  assert.ok(els.opsResult.classList.contains('ok') === false);
});

test('3a [保存] 409：manifest 409 時不寫入（pendingCode 保留）、顯示 409', async () => {
  const env = await loadEnv({
    manifest: M3,
    fileGet: { payload: 'a' },
    putSeq: [{ status: 409, payload: { detail: 'baseRev mismatch' } }]
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  els.code.value = 'mine';
  els.saveFile._fire('click', {});
  await settle(4);
  assert.ok(ed.state.pendingCode['fx-a/viewer.js']);
  els.saveBtn._fire('click', {});
  await settle(8);
  assert.equal(env.fetchCalls.filter((c) => c.method === 'PUT' && c.url.endsWith('/file')).length, 0);
  assert.ok(ed.state.pendingCode['fx-a/viewer.js']);
  assert.equal(els.opsResult.textContent, '409 衝突：manifest 已被修改，已重抓最新');
  assert.ok(els.opsResult.classList.contains('err'));
});

test('3a [保存] 429：Retry-After 後重試一次並成功（manifest 含 files）', async () => {
  const env = await loadEnv({
    manifest: M3,
    fileGet: { payload: 'a' },
    putSeq: [
      { status: 429, headers: { 'Retry-After': '0' } },
      { status: 200, payload: { ok: true, changed: true, rev: 'e'.repeat(64), created: [], effects: [], warnings: [] } }
    ]
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  els.code.value = 'edited';
  els.saveFile._fire('click', {});
  await settle(4);
  els.saveBtn._fire('click', {});
  await settle(16);
  assert.equal(env.fetchCalls.filter((c) => c.method === 'PUT' && c.url === '/api/editor/manifest').length, 2);
  assert.equal(ed.state.pendingCode['fx-a/viewer.js'], undefined);
  assert.equal(els.opsResult.textContent, '保存成功');
});

test('3a 匯入：file input 讀取 .js 內容並 staged（[保存] 寫入 manifest.files）', async () => {
  const env = await loadEnv({
    manifest: M3,
    fileGet: { payload: 'old' },
    filePutSeq: [{ status: 200, payload: { ok: true, changed: true, rev: 'g'.repeat(64), warnings: [] } }]
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  els.fileImportFile.files = [{ name: 'my.js', text: async () => 'imported code' }];
  els.fileImportFile._fire('change', {});
  await settle(8);
  assert.equal(els.code.value, 'imported code');
  assert.equal(els.fileImportFile.value, '');
  assert.equal(ed.state.dirty, true);
  // U12：匯入 .js 後自動跑該檔格式檢查（staged、不 fetch）
  assert.ok(els.opsResult.textContent.includes('匯入 fx-a/viewer.js（staged，按[保存至伺服器]寫入）'));
  assert.ok(els.opsResult.textContent.includes('檢查格式'));
  assert.ok(els.opsResult.textContent.includes('viewer.js'));
  assert.equal(env.fetchCalls.filter((c) => c.method === 'PUT').length, 0);
  els.saveBtn._fire('click', {});
  await settle(10);
  const putCalls = env.fetchCalls.filter((c) => c.method === 'PUT');
  assert.deepEqual(putCalls.map((c) => c.url), ['/api/editor/manifest']);
  assert.deepEqual(JSON.parse(putCalls[0].body).files, [{ effectId: 'fx-a', filename: 'viewer.js', content: 'imported code' }]);
  assert.equal(els.opsResult.textContent, '保存成功');
});

test('B6 空檔：viewer.js 不可[暫存]空、console.js 可[暫存]空＋exportSource 回空 staged', async () => {
  // viewer.js：清空 → [暫存] 被擋（不 staged、不 dirty）
  const env = await loadEnv({ manifest: M3, fileGet: { payload: 'x' } });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  els.code.value = '   ';
  els.saveFile._fire('click', {});
  await settle(4);
  assert.ok(els.opsResult.textContent.includes('viewer.js 不可為空'));
  assert.ok(els.opsResult.classList.contains('err'));
  assert.equal(ed.state.pendingCode['fx-a/viewer.js'], undefined);
  assert.equal(ed.state.dirty, false);

  // console.js：清空 → [暫存] 成功（staged 空內容）＋exportSource 回空 staged
  const env2 = await loadEnv({ manifest: M3, fileGet: { payload: 'y' } });
  const ed2 = env2.window.__rtxEditor;
  const els2 = env2.els;
  els2.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'console')._fire('click', {});
  await settle(4);
  els2.code.value = '';
  els2.saveFile._fire('click', {});
  await settle(4);
  assert.equal(els2.opsResult.textContent, 'code 已暫存（按 [保存至伺服器] 寫入伺服器）');
  assert.equal(ed2.state.dirty, true);
  const staged = ed2.state.pendingCode['fx-a/console.js'];
  assert.ok(staged);
  assert.equal(staged.content, '');
  assert.equal(staged.filename, 'console.js');
  assert.equal(await ed2.exportSource('fx-a', 'console.js'), '');
  assert.equal(env2.fetchCalls.filter((c) => c.method === 'PUT').length, 0);
});

test('語法高亮：highlightJs token 化（keyword/control/string/number/comment）＋HTML 跳脫＋showCode/input 填底層 pre', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  // tokenizer：各 token class 正確
  const html = ed.highlightJs('function f() { return "a" + 1; } // note');
  assert.ok(html.includes('<span class="tok-keyword">function</span>'), 'keyword');
  assert.ok(html.includes('<span class="tok-control">return</span>'), 'control');
  assert.ok(html.includes('<span class="tok-string">"a"</span>'), 'string');
  assert.ok(html.includes('<span class="tok-number">1</span>'), 'number');
  assert.ok(html.includes('<span class="tok-comment">// note</span>'), 'line comment');
  // HTML 跳脫：原始 < & > 不注入、token 仍可辨認
  const esc = ed.highlightJs('<b>if (a < b && c > 0) d</b>');
  assert.ok(esc.includes('&lt;b&gt;'), 'no raw <b>');
  assert.ok(esc.includes('&lt;') && esc.includes('&amp;&amp;') && esc.includes('&gt;'), 'escaped chars');
  assert.ok(esc.includes('<span class="tok-control">if</span>'), 'tokenizes after escape');
  assert.ok(!esc.includes('<b>'), 'no injected tag');
  // 整合：showCode 填底層 pre（tok-* span）、textarea 保留純文字
  ed.showCode('let n = 42; // hi');
  assert.ok(els.codeHlCode.innerHTML.includes('<span class="tok-keyword">let</span>'), 'pre keyword');
  assert.ok(els.codeHlCode.innerHTML.includes('<span class="tok-number">42</span>'), 'pre number');
  assert.ok(els.codeHlCode.innerHTML.includes('<span class="tok-comment">// hi</span>'), 'pre comment');
  assert.equal(els.code.value, 'let n = 42; // hi', 'textarea keeps plain text');
  // input 事件→重繪高亮
  els.code.value = 'var x = 7;';
  els.code._fire('input', {});
  assert.ok(els.codeHlCode.innerHTML.includes('<span class="tok-number">7</span>'), 'input updates highlight');
});

test('語法高亮：scroll 同步改用 transform（底層 code 與 gutter inner 平移、不經 scrollTop clamp）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const els = env.els;
  // scroll 事件→底層 code 以 translate(-x,-y)、gutter inner 以 translateY(-y) 同步
  els.code.scrollTop = 60;
  els.code.scrollLeft = 120;
  els.code._fire('scroll', {});
  assert.equal(els.codeHlCode.style.transform, 'translate(-120px, -60px)', 'code transform follows textarea scroll');
  assert.equal(els.codeGutterInner.style.transform, 'translateY(-60px)', 'gutter inner transform follows textarea scroll');
  // 再捲動→持續跟隨（不累積、不被 clamp 落後）
  els.code.scrollTop = 200;
  els.code.scrollLeft = 0;
  els.code._fire('scroll', {});
  assert.equal(els.codeHlCode.style.transform, 'translate(0px, -200px)', 'resync after scroll change');
  assert.equal(els.codeGutterInner.style.transform, 'translateY(-200px)', 'gutter resync');
  // 內容切換（showCode）後 transform 仍與 textarea 捲動一致
  els.code.scrollTop = 0;
  els.code.scrollLeft = 0;
  els.code._fire('scroll', {});
  assert.equal(els.codeHlCode.style.transform, 'translate(0px, 0px)', 'reset to origin');
  assert.equal(els.codeGutterInner.style.transform, 'translateY(0px)', 'gutter reset to origin');
});

test('3a zip 匯入：dry-run staged（無落盤 PUT）→ [保存] 寫 manifest（含 files）', async () => {
  const env = await loadEnv({
    manifest: M3,
    importSeq: [
      {
        status: 200,
        payload: {
          ok: true,
          dryRun: true,
          importedEffects: { 'fx-z': { label: 'Zeta', enabled: true, params: {} } },
          importedLayout: { currentEffects: ['fx-a', 'fx-z'], alternateEffects: ['fx-b'] },
          files: { 'fx-z/viewer.js': 'zeta code' },
          baseRev: 'e'.repeat(64)
        }
      }
    ],
    filePutSeq: [{ status: 200, payload: { ok: true, changed: true, rev: 'g'.repeat(64), warnings: [] } }]
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.fileImportEffects.files = [{ name: 'z.zip' }];
  els.fileImportEffects._fire('change', {});
  await settle(8);
  const importCall = env.fetchCalls.find((c) => c.method === 'POST' && c.url.startsWith('/api/editor/import'));
  assert.ok(importCall.url.includes('dryRun=true'));
  assert.equal(ed.state.manifest.effects['fx-z'].label, 'Zeta');
  assert.deepEqual(ed.state.manifest.currentEffects, ['fx-a', 'fx-z']);
  assert.equal(ed.state.pendingCode['fx-z/viewer.js'].content, 'zeta code');
  assert.equal(ed.state.dirty, true);
  assert.equal(ed.state.selected, 'fx-z');
  assert.equal(env.fetchCalls.filter((c) => c.method === 'PUT').length, 0);
  // 匯入後自動跑 3 檔格式檢查（staged 內容、不 fetch）→ 顯示於 warnings
  assert.ok(els.opsResult.textContent.includes('匯入已暫存：fx-z（按 [保存至伺服器] 寫入伺服器）'));
  assert.ok(els.opsResult.textContent.includes('檢查格式'));
  assert.ok(els.opsResult.textContent.includes('viewer.js'));
  els.saveBtn._fire('click', {});
  await settle(10);
  const putCalls = env.fetchCalls.filter((c) => c.method === 'PUT');
  assert.deepEqual(putCalls.map((c) => c.url), ['/api/editor/manifest']);
  assert.deepEqual(JSON.parse(putCalls[0].body).files, [{ effectId: 'fx-z', filename: 'viewer.js', content: 'zeta code' }]);
  assert.equal(ed.state.pendingCode['fx-z/viewer.js'], undefined);
  assert.equal(els.opsResult.textContent, '保存成功');
});

test('3a v1：code 控件 disabled、textarea readOnly', async () => {
  const env = await loadEnv({ manifest: M1P });
  const els = env.els;
  assert.equal(els.saveFile.disabled, true);
  assert.equal(els.importFile.disabled, true);
  assert.equal(els.exportFile.disabled, true);
  assert.equal(els.code.readOnly, true);
});

test('3a 匯出：vm 無 Blob/URL → 顯示提示', async () => {
  const env = await loadEnv({ manifest: M3, fileGet: { payload: 'exported' } });
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  els.exportFile._fire('click', {});
  await settle(4);
  const last = env.fetchCalls[env.fetchCalls.length - 1];
  assert.equal(last.method + ' ' + last.url, 'GET /api/editor/effect/fx-a/viewer.js');
  assert.equal(els.opsResult.textContent, '此環境不支援匯出');
  assert.ok(els.opsResult.classList.contains('err'));
});

test('3b previewStart：載入 plugin（bodyScripts 注入）、loadedId、createEffect 座標與參數、running、label/hint', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const { calls } = makeFakeEffects(env);
  ed.previewStart();
  await settle(8);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'fx-a');
  assert.equal(calls[0].px, 400);
  assert.equal(calls[0].py, 225);
  assert.equal(calls[0].params.count, 8);
  assert.equal(calls[0].params.note, 'hi');
  assert.equal(calls[0].params.mode, 'auto');
  assert.deepEqual([...calls[0].params.cols], [2, 3]);
  assert.ok(calls[0].fx);
  assert.equal(ed.preview.running, true);
  assert.equal(ed.preview.loadedId, 'fx-a');
  const scripts = bodyScripts(env);
  assert.equal(scripts.length, 1);
  assert.ok(scripts[0].src.startsWith('/effects/fx-a/viewer.js?'));
  assert.equal(els.previewLabel.textContent, 'Alpha（選定）· 800×450');
  assert.equal(els.previewHint.textContent, 'Alpha（選定）· x=50, y=50');
  ed.previewStop(true);
});

test('3b collectPreviewParams：editable:false 參數排除、default 取 .p-default', async () => {
  const MEDIT = {
    rev: 'e'.repeat(64),
    manifest: {
      version: 2,
      effects: {
        'fx-a': {
          label: 'Alpha',
          enabled: true,
          params: {
            count: { type: 'integer', label: 'Count', default: 8, editable: false },
            note: { type: 'string', label: 'Note', default: 'hi' }
          }
        }
      },
      currentEffects: ['fx-a']
    }
  };
  const env = await loadEnv({ manifest: MEDIT });
  const ed = env.window.__rtxEditor;
  const p1 = ed.collectPreviewParams();
  assert.equal(Object.keys(p1).length, 1);
  assert.equal(p1.note, 'hi');
  const card = env.els.pRows
    .querySelectorAll('.p-card')
    .find((c) => c.querySelector('.p-key').value === 'note');
  card.querySelector('.p-default').value = 'yo';
  const p2 = ed.collectPreviewParams();
  assert.equal(Object.keys(p2).length, 1);
  assert.equal(p2.note, 'yo');
  ed.previewStop(true);
});

test('3b 開始預覽：未選定 err；選定後 createEffect 400/225、params、running、label', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const { calls } = makeFakeEffects(env);
  ed.state.selected = null;
  els.previewStart._fire('click', {});
  await settle(4);
  assert.equal(els.opsResult.textContent, '請先選定特效');
  assert.ok(els.opsResult.classList.contains('err'));
  assert.equal(calls.length, 0);

  const itemA = els.zoneCur.querySelectorAll('.fx-item')[0];
  itemA._fire('click', { target: itemA.children[2] });
  assert.equal(ed.state.selected, 'fx-a');
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'fx-a');
  assert.equal(calls[0].px, 400);
  assert.equal(calls[0].py, 225);
  assert.equal(calls[0].params.count, 8);
  assert.equal(calls[0].params.note, 'hi');
  assert.equal(calls[0].params.mode, 'auto');
  assert.deepEqual([...calls[0].params.cols], [2, 3]);
  assert.equal(ed.preview.running, true);
  assert.equal(els.previewLabel.textContent, 'Alpha（選定）· 800×450');
  assert.equal(els.previewHint.textContent, 'Alpha（選定）· x=50, y=50');
  ed.previewStop(true);
});

test('3b tick：stepEffect 推進、clearRect/draw、done() 停止', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const { calls, steps } = makeFakeEffects(env);
  env.setNow(100);
  els.previewStart._fire('click', {});
  await settle(8);
  env.setNow(150);
  ed.previewTick();
  assert.equal(ed.preview.running, true);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].t, 50);
  assert.equal(calls[0].fx.elapsed, 50);
  assert.ok(els.previewCanvas._ctx._clears >= 1);

  calls[0].fx.done = () => true;
  env.setNow(200);
  ed.previewTick();
  assert.equal(ed.preview.running, false);
  assert.equal(ed.preview.fx, null);
  ed.previewStop(true);
});

test('7e-1 速率 1×：vtime 追蹤實時（假時鐘）、stepEffect 收 vtime', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const { steps } = makeFakeEffects(env);
  env.setNow(0);
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(ed.preview.running, true);
  assert.equal(ed.preview.vtime, 0);
  env.setNow(1000);
  ed.previewTick();
  assert.equal(ed.preview.vtime, 1000);
  assert.equal(steps[0].t, 1000);
  env.setNow(1250);
  ed.previewTick();
  assert.equal(ed.preview.vtime, 1250);
  assert.equal(ed.previewState().vtime, 1250);
  ed.previewStop(true);
});

test('7e-2 速率 4×：真實 ripple（1200ms）於實時 300ms 完成（<600ms）', async () => {
  const env = await loadEnv({});
  const ed = env.window.__rtxEditor;
  const els = env.els;
  Effects.reset();
  registerRealEffect(Effects, 'ripple');
  env.window.Effects = Effects;
  let lastStepT = -1;
  const coreStep = env.window.Effects.stepEffect.bind(env.window.Effects);
  env.window.Effects.stepEffect = (fx, t) => {
    lastStepT = t;
    coreStep(fx, t);
  };
  const rec = makeRecordingCtx();
  els.previewCanvas.getContext = () => rec.ctx;
  ed.state.selected = 'ripple';
  env.setNow(0);
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(ed.preview.running, true);
  assert.equal(ed.preview.vtime, 0);
  ed.previewSetRate(4);
  assert.equal(ed.preview.rate, 4);
  assert.equal(els.previewRate.value, '4');
  assert.equal(els.previewRateVal.textContent, '4×');
  env.setNow(300);
  ed.previewTick();
  assert.equal(lastStepT, 1200, '4× 實時 300ms → vtime 1200');
  assert.equal(ed.preview.running, false, '4× 應於實時 300ms 完成（<600ms）');
  assert.equal(ed.preview.vtime, 0, '完成後 vtime 重置 0');
  ed.previewStop(true);
});

test('7e-3 速率 0.25×：真實 ripple（1200ms）實時 1500ms 仍 running、約實時 4800ms 完成', async () => {
  const env = await loadEnv({});
  const ed = env.window.__rtxEditor;
  const els = env.els;
  Effects.reset();
  registerRealEffect(Effects, 'ripple');
  env.window.Effects = Effects;
  els.previewCanvas.getContext = () => makeRecordingCtx().ctx;
  ed.state.selected = 'ripple';
  env.setNow(0);
  els.previewStart._fire('click', {});
  await settle(8);
  ed.previewSetRate(0.25);
  assert.equal(ed.preview.rate, 0.25);
  for (let t = 100; t <= 1500; t += 100) {
    env.setNow(t);
    ed.previewTick();
  }
  assert.equal(ed.preview.running, true, '0.25× 實時 1500ms 應仍 running');
  assert.equal(ed.preview.vtime, 375);
  let stoppedAt = null;
  for (let t = 1600; t <= 4900; t += 100) {
    env.setNow(t);
    ed.previewTick();
    if (!ed.preview.running) {
      stoppedAt = t;
      break;
    }
  }
  assert.equal(stoppedAt, 4800, '0.25× 應於實時 4800ms 完成');
  ed.previewStop(true);
});

test('7e-4 暫停：vtime 凍結、loop 停、fx 保留靜幀', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const { steps } = makeFakeEffects(env);
  env.setNow(0);
  els.previewStart._fire('click', {});
  await settle(8);
  env.setNow(500);
  ed.previewTick();
  assert.equal(ed.preview.vtime, 500);
  ed.previewPauseToggle();
  assert.equal(ed.preview.paused, true);
  assert.equal(ed.preview.running, true);
  assert.ok(ed.preview.fx, '暫停應保留 fx（靜幀）');
  assert.equal(env.rafQueue.length, 0, '暫停應停止 rAF loop');
  assert.equal(els.previewPauseIco.getAttribute('data-ui-icon'), 'play', '暫停中切 play 圖示');
  assert.equal(els.previewPause.getAttribute('aria-label'), '繼續');
  env.setNow(1500);
  ed.previewTick();
  assert.equal(ed.preview.vtime, 500, '暫停期間 vtime 不推進');
  assert.equal(steps.length, 1, '暫停期間不 step');
  ed.previewStop(true);
});

test('7e-5 繼續：暫停時長不計入（lastTick 重錨定、無跳變）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  makeFakeEffects(env);
  env.setNow(0);
  els.previewStart._fire('click', {});
  await settle(8);
  env.setNow(500);
  ed.previewTick();
  assert.equal(ed.preview.vtime, 500);
  ed.previewPauseToggle();
  assert.equal(ed.preview.paused, true);
  env.setNow(1000);
  ed.previewPauseToggle();
  assert.equal(ed.preview.paused, false);
  assert.equal(els.previewPauseIco.getAttribute('data-ui-icon'), 'pause', '繼續後回 pause 圖示');
  env.setNow(1100);
  ed.previewTick();
  assert.equal(ed.preview.vtime, 600, '暫停的 500ms 不計入（500+100）');
  ed.previewStop(true);
});

test('7e-6 重播：vtime 歸零、running、rate 保持', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  makeFakeEffects(env);
  env.setNow(0);
  els.previewStart._fire('click', {});
  await settle(8);
  ed.previewSetRate(2);
  env.setNow(300);
  ed.previewTick();
  assert.equal(ed.preview.vtime, 600);
  const scriptsBefore = bodyScripts(env).length;
  els.previewReplay._fire('click', {});
  await settle(8);
  assert.equal(ed.preview.running, true, '重播應重新 running');
  assert.equal(ed.preview.vtime, 0);
  assert.equal(ed.preview.rate, 2, '重播保持目前速率');
  assert.equal(els.previewRate.value, '2');
  assert.equal(bodyScripts(env).length, scriptsBefore, '重播不重注入 .js');
  env.setNow(500);
  ed.previewTick();
  assert.equal(ed.preview.vtime, 400, '2× 實時 200ms → vtime 400');
  ed.previewStop(true);
});

test('7e-7 暫停中 [清屏]：running=false、paused=false、canvas 清、控制狀態（rate 啟用/pause 停用/replay 啟用）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  makeFakeEffects(env);
  env.setNow(0);
  els.previewStart._fire('click', {});
  await settle(8);
  env.setNow(500);
  ed.previewTick();
  ed.previewPauseToggle();
  assert.equal(ed.preview.paused, true);
  const clearsBefore = els.previewCanvas._ctx._clears;
  els.previewClear._fire('click', {});
  assert.equal(ed.preview.running, false);
  assert.equal(ed.preview.paused, false);
  assert.equal(ed.preview.fx, null);
  assert.equal(ed.preview.vtime, 0);
  assert.ok(els.previewCanvas._ctx._clears > clearsBefore, '清屏應清 canvas');
  assert.equal(els.previewRate.disabled, false, '清屏後速率滑桿仍啟用');
  assert.equal(els.previewPause.disabled, true, '清屏後 [暫停] disabled');
  assert.equal(els.previewReplay.disabled, false, '清屏後 [重播] 仍啟用');
});

test('7e-8 控制狀態：rate 常啟用、未 running 時 pause/replay disabled、running 啟用、暫停圖示切換（pause/play＋aria-label）、速率顯示同步、clamp', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(els.previewRate.disabled, false, '未 running：速率滑桿常啟用');
  assert.equal(els.previewPause.disabled, true, '未 running：[暫停] disabled');
  assert.equal(els.previewReplay.disabled, true, '首次預覽前：[重播] disabled');
  assert.equal(els.previewRateVal.textContent, '1×');
  assert.equal(els.previewPauseIco.getAttribute('data-ui-icon'), 'pause', '未 running：pause 圖示');
  assert.equal(els.previewPause.getAttribute('aria-label'), '暫停');
  makeFakeEffects(env);
  env.setNow(0);
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(els.previewRate.disabled, false, 'running：速率滑桿啟用');
  assert.equal(els.previewPause.disabled, false, 'running：[暫停] 啟用');
  assert.equal(els.previewReplay.disabled, false, 'running：[重播] 啟用');
  ed.previewSetRate(0.5);
  assert.equal(ed.preview.rate, 0.5);
  assert.equal(els.previewRate.value, '0.5');
  assert.equal(els.previewRateVal.textContent, '0.5×');
  ed.previewPauseToggle();
  assert.equal(els.previewPauseIco.getAttribute('data-ui-icon'), 'play', '暫停中切 play 圖示');
  assert.equal(els.previewPause.getAttribute('aria-label'), '繼續');
  ed.previewPauseToggle();
  assert.equal(els.previewPauseIco.getAttribute('data-ui-icon'), 'pause', '繼續後回 pause 圖示');
  assert.equal(els.previewPause.getAttribute('aria-label'), '暫停');
  ed.previewStop(true);
  assert.equal(els.previewRate.disabled, false, '停止後速率滑桿仍啟用');
  assert.equal(els.previewPause.disabled, true, '停止後 [暫停] disabled');
  assert.equal(els.previewReplay.disabled, false, '停止後 [重播] 仍啟用（loadedId 保留）');
  ed.previewSetRate(8);
  assert.equal(ed.preview.rate, 4, 'clamp 上限 4');
  ed.previewSetRate(0.1);
  assert.equal(ed.preview.rate, 0.25, 'clamp 下限 0.25');
  ed.previewSetRate('bad');
  assert.equal(ed.preview.rate, 1, '非數字→1');
  const st = ed.previewState();
  assert.equal(st.running, false);
  assert.equal(st.paused, false);
  assert.equal(st.rate, 1);
  assert.equal(st.vtime, 0);
});

test('7e-9 [重載] running（含暫停）：停預覽、清 canvas、paused 重置、rate 保持', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  makeFakeEffects(env);
  env.setNow(0);
  els.previewStart._fire('click', {});
  await settle(8);
  ed.previewSetRate(2);
  env.setNow(500);
  ed.previewTick();
  ed.previewPauseToggle();
  assert.equal(ed.preview.paused, true);
  const clearsBefore = els.previewCanvas._ctx._clears;
  els.reloadBtn._fire('click', {});
  await settle(8);
  assert.equal(ed.preview.running, false, '[重載] 應停止預覽');
  assert.equal(ed.preview.paused, false);
  assert.equal(ed.preview.fx, null);
  assert.equal(ed.preview.vtime, 0);
  assert.equal(ed.preview.rate, 2, '[重載] 不清 rate 值');
  assert.equal(els.previewRate.value, '2');
  assert.ok(els.previewCanvas._ctx._clears > clearsBefore, '[重載] 應清 canvas');
  assert.equal(els.previewRate.disabled, false, '[重載] 後速率滑桿仍啟用');
  assert.equal(els.previewPause.disabled, true, '[重載] 後 [暫停] disabled');
  assert.equal(els.previewReplay.disabled, false, '[重載] 後 [重播] 仍啟用（loadedId 保留）');
});

test('7f-1 速率滑桿開始預覽前即可調整（preview.rate 寫入、顯示同步、開始預覽沿用）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  makeFakeEffects(env);
  assert.equal(els.previewRate.disabled, false, '未 running：速率滑桿啟用');
  ed.previewSetRate(2);
  assert.equal(ed.preview.rate, 2);
  assert.equal(els.previewRate.value, '2');
  assert.equal(els.previewRateVal.textContent, '2×');
  env.setNow(0);
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(ed.preview.running, true);
  assert.equal(ed.preview.rate, 2, '開始預覽沿用已設速率');
  env.setNow(500);
  ed.previewTick();
  assert.equal(ed.preview.vtime, 1000, '2× 實時 500ms → vtime 1000');
  ed.previewStop(true);
});

test('7f-2 重播啟用規則：首次預覽前 disabled、預覽後啟用（含 auto-stop 後）、重播不重注入 .js', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const { calls } = makeFakeEffects(env);
  assert.equal(els.previewReplay.disabled, true, '首次預覽前：[重播] disabled');
  env.setNow(0);
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(ed.preview.running, true);
  assert.equal(els.previewReplay.disabled, false, '預覽後 [重播] 啟用');
  env.setNow(500);
  ed.previewTick();
  calls[0].fx.done = () => true;
  env.setNow(600);
  ed.previewTick();
  assert.equal(ed.preview.running, false, 'auto-stop');
  assert.equal(els.previewReplay.disabled, false, 'auto-stop 後 [重播] 仍啟用（loadedId 保留）');
  const scriptsBefore = bodyScripts(env).length;
  els.previewReplay._fire('click', {});
  await settle(8);
  assert.equal(ed.preview.running, true, '重播 running');
  assert.equal(ed.preview.vtime, 0);
  assert.equal(bodyScripts(env).length, scriptsBefore, '重播不重注入 .js');
  assert.equal(calls.length, 2, '重播重新 createEffect');
  ed.previewStop(true);
});

test('7h-1 影片撥放器式 transport：重播/暫停/清屏 圖示按鈕（replay/pause/end >|）、暫停中切 play 圖示＋aria-label', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(els.previewReplayIco.getAttribute('data-ui-icon'), 'replay', '[重播] replay 圖示');
  assert.equal(els.previewPauseIco.getAttribute('data-ui-icon'), 'pause', '[暫停] pause 圖示');
  assert.equal(els.previewClearIco.getAttribute('data-ui-icon'), 'end', '[清屏] end 圖示（>|）');
  assert.equal(els.previewReplay.getAttribute('aria-label'), '重播');
  assert.equal(els.previewPause.getAttribute('aria-label'), '暫停');
  assert.equal(els.previewClear.getAttribute('aria-label'), '清屏');
  assert.equal(els.previewClear.disabled, true, '[清屏] 首次預覽前 disabled（統一於 [重播][暫停]）');
  makeFakeEffects(env);
  env.setNow(0);
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(els.previewClear.disabled, false, '[清屏] 預覽後啟用（同 [重播][暫停]）');
  ed.previewPauseToggle();
  assert.equal(els.previewPauseIco.getAttribute('data-ui-icon'), 'play', '暫停中切 play 圖示');
  assert.equal(els.previewPause.getAttribute('aria-label'), '繼續');
  assert.equal(els.previewPause.getAttribute('title'), '繼續預覽');
  assert.equal(els.previewClear.disabled, false, '[清屏] 暫停中仍啟用');
  ed.previewStop(true);
  assert.equal(els.previewPauseIco.getAttribute('data-ui-icon'), 'pause', '停止後回 pause 圖示');
  assert.equal(els.previewPause.getAttribute('aria-label'), '暫停');
  assert.equal(els.previewClear.disabled, false, '[清屏] 停止後仍啟用（同 [重播]）');
});

test('7i-1 [清屏] 啟用邏輯統一於 [重播][暫停]＋訊息「已清除預覽畫面」', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(els.previewClear.disabled, true, '首次預覽前：[清屏] disabled');
  makeFakeEffects(env);
  env.setNow(0);
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(ed.preview.running, true);
  assert.equal(els.previewClear.disabled, false, 'running：[清屏] 啟用（同 [暫停]）');
  ed.previewPauseToggle();
  assert.equal(els.previewClear.disabled, false, 'paused：[清屏] 仍啟用');
  els.previewClear._fire('click', {});
  await settle(4);
  assert.equal(ed.preview.running, false);
  assert.equal(els.opsResult.textContent, '已清除預覽畫面');
  assert.ok(els.opsResult.classList.contains('ok'));
  assert.equal(els.previewClear.disabled, false, '停止後：[清屏] 仍啟用（同 [重播]）');
});

test('7j-1 color 參數 default 顏色選取器（渲染＋type 切換重建＋collectParams）', async () => {
  const env = await loadEnv({ manifest: MC });
  const ed = env.window.__rtxEditor;
  const els = env.els;

  const card = els.pRows.querySelectorAll('.p-card')[0];
  assert.equal(card.querySelector('.p-key').value, 'bg');
  const defInp = card.querySelector('.p-default');
  assert.equal(defInp.type, 'color');
  assert.equal(defInp.value, '#ff4d4d');

  const typeSel = card.querySelector('.p-type');
  typeSel.value = 'string';
  typeSel._fire('change', {});
  const defTxt = card.querySelector('.p-default');
  assert.equal(defTxt.type, 'text');
  assert.equal(defTxt.value, '');

  typeSel.value = 'color';
  typeSel._fire('change', {});
  const defCol = card.querySelector('.p-default');
  assert.equal(defCol.type, 'color');
  assert.equal(defCol.value, '#000000');

  defCol.value = '#123456';
  defCol._fire('input', {});
  assert.equal(els.dirty.dataset.state, 'unstaged', '7m：欄位編輯 → 未暫存變更');
  const p = ed.collectParams();
  assert.equal(p.bg.type, 'color');
  assert.equal(p.bg.label, 'BG');
  assert.equal(p.bg.default, '#123456');
  assert.equal(p.bg.editable, true);
});

test('7k-1 array 參數 default 子項列（渲染＋新增／刪除＋type 切換重建＋collectParams）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;

  const card = els.pRows.querySelectorAll('.p-card')[3];
  assert.equal(card.querySelector('.p-key').value, 'cols');
  const rows = card.querySelectorAll('.p-opt-row');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].querySelector('input').value, '2');
  assert.equal(rows[1].querySelector('input').value, '3');
  const addIt = card.querySelector('.p-add-opt');
  assert.equal(addIt.textContent, '+ item');

  addIt._fire('click', {});
  const rows2 = card.querySelectorAll('.p-opt-row');
  assert.equal(rows2.length, 3);
  rows2[2].querySelector('input').value = '9';
  assert.equal(els.dirty.dataset.state, 'unstaged', '7m：欄位編輯 → 未暫存變更');
  const p = ed.collectParams();
  assert.equal(p.cols.type, 'array');
  assert.equal(p.cols.items, 'integer');
  assert.equal(p.cols.default.length, 3);
  assert.equal(p.cols.default[0], 2);
  assert.equal(p.cols.default[1], 3);
  assert.equal(p.cols.default[2], 9);
  assert.equal(p.cols.minItems, 1);
  assert.equal(p.cols.maxItems, 8);

  rows2[1].querySelector('.p-opt-rm')._fire('click', {});
  const p2 = ed.collectParams();
  assert.equal(p2.cols.default.length, 2);
  assert.equal(p2.cols.default[0], 2);
  assert.equal(p2.cols.default[1], 9);

  const typeSel = card.querySelector('.p-type');
  typeSel.value = 'string';
  typeSel._fire('change', {});
  const defTxt = card.querySelector('.p-default');
  assert.equal(defTxt.type, 'text');
  assert.equal(defTxt.value, '');
  assert.equal(card.querySelectorAll('.p-opt-row').length, 0);

  typeSel.value = 'array';
  typeSel._fire('change', {});
  assert.ok(card.querySelector('.p-opts'));
  assert.equal(card.querySelectorAll('.p-opt-row').length, 0);
  assert.equal(card.querySelector('.p-add-opt').textContent, '+ item');
  assert.equal(card.querySelector('.p-items').value, '');
});

test('3b 預覽（單個特效）：真實特效渲染到 canvas（update/draw 循環、有繪製、done 完成）', async () => {
  const MREAL = {
    rev: 'v'.repeat(64),
    manifest: {
      version: 2,
      effects: {
        particle: { label: 'Particle', enabled: true, params: {} },
        ripple: { label: 'Ripple', enabled: true, params: {} },
        firework: { label: 'Firework', enabled: true, params: {} },
        text: { label: 'Text', enabled: true, params: {} }
      },
      currentEffects: ['particle', 'ripple', 'firework', 'text'],
      alternateEffects: []
    }
  };
  const env = await loadEnv({ manifest: MREAL });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  Effects.reset();
  const ids = ['particle', 'ripple', 'firework', 'text'];
  for (const id of ids) registerRealEffect(Effects, id);
  env.window.Effects = Effects;
  const rec = makeRecordingCtx();
  els.previewCanvas.getContext = () => rec.ctx;
  const PAINT = new Set([
    'fill',
    'stroke',
    'fillText',
    'strokeText',
    'fillRect',
    'strokeRect',
    'putImageData',
    'drawImage'
  ]);
  for (const id of ids) {
    rec.reset();
    env.setNow(0);
    ed.state.selected = id;
    els.previewStart._fire('click', {});
    await settle(8);
    assert.equal(ed.preview.running, true, id + '：預覽應啟動');
    assert.equal(ed.preview.loadedId, id, id + '：插件載入 id');
    for (let t = 100; t <= 2500; t += 100) {
      env.setNow(t);
      ed.previewTick();
      if (!ed.preview.running) break;
    }
    assert.equal(ed.preview.running, false, id + '：應 done 自動停止');
    const painted = rec.calls().filter((c) => PAINT.has(c));
    assert.ok(painted.length > 0, id + '：特效未繪製到 canvas（calls=' + rec.calls().slice(0, 20).join(',') + '）');
  }
  ed.previewStop(true);
});

test('5r runEffectTest：真實特效通過（繪製＋done）、語法錯／未註冊／不繪製 未通過', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const particleSrc = fs.readFileSync(path.join(here, '..', 'tests', 'fixtures', 'particle', 'viewer.js'), 'utf8');
  const good = ed.runEffectTest('particle', particleSrc, {});
  assert.equal(good.ok, true);
  assert.ok(good.lines.some((l) => l.indexOf('結果：通過') !== -1));
  assert.ok(good.lines.some((l) => l.indexOf('繪製：有') !== -1));
  assert.ok(good.lines.some((l) => l.indexOf('done') !== -1));

  const bad = ed.runEffectTest('particle', 'window.Effects.register("x", function ( { }', {});
  assert.equal(bad.ok, false);
  assert.ok(bad.lines.some((l) => l.indexOf('執行：錯誤') !== -1));

  const noreg = ed.runEffectTest('particle', '/* 未註冊 */', {});
  assert.equal(noreg.ok, false);
  assert.ok(noreg.lines.some((l) => l.indexOf('註冊') !== -1 && l.indexOf('應為 1') !== -1));

  const nodraw = ed.runEffectTest(
    'particle',
    'window.Effects.register("particle", function (px, py, p) { return { update: function () {}, draw: function () {}, done: function () { return true; } }; });',
    {}
  );
  assert.equal(nodraw.ok, false);
  assert.ok(nodraw.lines.some((l) => l.indexOf('繪製：無') !== -1));
  assert.ok(nodraw.lines.some((l) => l.indexOf('結果：未通過') !== -1));
});

test('S3 預覽前危險 API 掃描（非沙箱緩解）：引用 localStorage/fetch/cookie 等→非阻斷預警（仍執行）、乾淨碼無預警', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;

  // previewDangerScan 純函數：乾淨碼無命中、危險碼按定義順序命中（vm realm→用 join 比對避免跨 realm 陣列不等）
  assert.equal(ed.previewDangerScan('var x = 1;').join(','), '', '乾淨碼無命中');
  assert.equal(
    ed.previewDangerScan('var k = localStorage.getItem("x"); fetch("/a"); var c = document.cookie;').join('|'),
    'localStorage（server 金鑰）|document.cookie|fetch'
  );

  // [測試特效]：引用危險 API→預警列（仍執行、結果通過）；乾淨碼無預警列
  const dangerFx = 'window.Effects.register("particle", function (px, py, p) { var k = localStorage.getItem("k"); return { update: function () {}, done: function () { return false; }, draw: function (c) { c.fillRect(0, 0, 5, 5); } }; });';
  const r1 = ed.runEffectTest('particle', dangerFx, {});
  assert.ok(r1.lines.some((l) => l.indexOf('預警：') !== -1 && l.indexOf('localStorage') !== -1), '測試預警列含 localStorage');
  assert.ok(r1.lines.some((l) => l.indexOf('結果：通過') !== -1), '仍執行且通過');
  const cleanFx = 'window.Effects.register("particle", function (px, py, p) { return { update: function () {}, done: function () { return false; }, draw: function (c) { c.fillRect(0, 0, 5, 5); } }; });';
  const r2 = ed.runEffectTest('particle', cleanFx, {});
  assert.ok(!r2.lines.some((l) => l.indexOf('預警：') !== -1), '乾淨碼無預警列');

  // [開始預覽]：staged viewer 引用 localStorage→非阻斷預警（err 樣式、仍注入、loadedId 設定）
  els.opsResult.textContent = '';
  await ed.injectPlugin('fx-a', 'var k = localStorage.getItem("rtx.editor.srvKey");');
  assert.ok(els.opsResult.textContent.indexOf('預覽預警：') !== -1, '應顯示預覽預警');
  assert.ok(els.opsResult.textContent.indexOf('localStorage') !== -1, '預警指出 localStorage');
  assert.ok(els.opsResult.classList.contains('err'), '預警為 err 樣式');
  assert.equal(ed.preview.loadedId, 'fx-a', '仍注入（非阻斷）');

  // 乾淨 staged viewer→無預警
  els.opsResult.textContent = '';
  await ed.injectPlugin('fx-a', 'var x = 1;');
  assert.equal(els.opsResult.textContent, '', '乾淨 staged viewer 無預警');

  // console 路徑：staged console 引用 document.cookie→預警
  els.opsResult.textContent = '';
  ed.applyStagedConsole('fx-a', 'var c = document.cookie;');
  assert.ok(els.opsResult.textContent.indexOf('預覽預警：') !== -1, 'console 預覽預警');
  assert.ok(els.opsResult.textContent.indexOf('document.cookie') !== -1, '預警指出 document.cookie');
});

test('5r 測試特效按鈕：未選定 err；選定＋staged 真實 source→通過；語法錯→未通過', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const particleSrc = fs.readFileSync(path.join(here, '..', 'tests', 'fixtures', 'particle', 'viewer.js'), 'utf8');

  ed.state.selected = null;
  els.previewTest._fire('click', {});
  await settle(4);
  assert.equal(els.opsResult.textContent, '特效測試：請先選擇特效');
  assert.ok(els.opsResult.classList.contains('err'));

  ed.state.selected = 'particle';
  ed.state.pendingCode = {
    'particle/viewer.js': { content: particleSrc, effectId: 'particle', filename: 'viewer.js' }
  };
  els.previewTest._fire('click', {});
  await settle(6);
  assert.ok(els.opsResult.textContent.indexOf('結果：通過') !== -1);
  assert.ok(els.opsResult.classList.contains('ok'));

  ed.state.pendingCode = {
    'particle/viewer.js': {
      content: 'window.Effects.register("particle", function ( { }',
      effectId: 'particle',
      filename: 'viewer.js'
    }
  };
  els.previewTest._fire('click', {});
  await settle(6);
  assert.ok(els.opsResult.textContent.indexOf('執行：錯誤') !== -1);
  assert.ok(els.opsResult.classList.contains('err'));
});

test('5t runEffectTest：canvas gradient 特效（chrono-vortex/aurora/fire-dragon）通過（ctx stub 不拋錯、有繪製）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  for (const id of ['chrono-vortex', 'aurora', 'fire-dragon']) {
    const src = fs.readFileSync(path.join(here, '..', 'tests', 'fixtures', id, 'viewer.js'), 'utf8');
    const r = ed.runEffectTest(id, src, {});
    assert.equal(r.ok, true, id + ' 應通過：' + r.lines.join(' | '));
    assert.ok(r.lines.some((l) => l.indexOf('繪製：有') !== -1), id + ' 應有繪製');
    assert.ok(r.lines.every((l) => l.indexOf('運行：錯誤') === -1), id + ' 不應有運行錯誤');
  }
});

test('5t [新增特效]→[開始預覽]：viewer tab 顯示模板、injectPlugin 以 in-editor source 註冊、running', async () => {
  const env = await loadEnv({
    manifest: M3,
    fileGetSeq: [
      { status: 200, payload: 'fx-a-v1' }, // 切 viewer tab 載入 fx-a
      { status: 404, payload: null } // zz-new viewer（404 → 模板）
    ]
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const registered = [];
  env.window.Effects = {
    register: (id) => registered.push(id),
    createEffect: () => ({ elapsed: 0, update() {}, draw() {}, done() { return true; } }),
    stepEffect: () => {}
  };
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  assert.equal(els.code.value, 'fx-a-v1');
  // U10：無彈出視窗——預設 id＋流水號（effect-1／新特效 1）
  ed.newEffect();
  await settle(8);
  const newId = ed.state.selected;
  assert.equal(newId, 'effect-1', '預設 id＝effect-1（流水號）');
  assert.equal(ed.state.manifest.effects[newId].label, '新特效 1');
  assert.ok(els.code.value.includes(newId), 'viewer tab 應顯示新特效模板');
  els.previewStart._fire('click', {});
  await settle(8);
  assert.ok(registered.includes(newId), 'in-editor 模板應被執行（註冊新特效）');
  assert.equal(ed.preview.running, true, '新特效 [開始預覽] 應 running');
});

test('5u [存檔] console.js 後插件註冊（staged、尚未 [保存]→registry 更新）', async () => {
  const env = await loadEnv({
    manifest: M3,
    icons: { fx: { burst: '<svg burst>', sparkle: '<svg sparkle>', generic: '<svg g>' } }
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  // 切 console tab、寫入 staged console.js（iconID 'sparkle'）
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'console')._fire('click', {});
  await settle(6);
  els.code.value = "window.RTX_EFFECT_CONSOLE.register('fx-a', { iconID: 'sparkle', render: function () {} });";
  els.saveFile._fire('click', {});
  await settle(4);
  assert.ok(ed.state.pendingCode['fx-a/console.js'], 'console.js 應 staged（未 [保存]）');
  assert.equal(env.window.RTX_EFFECT_CONSOLE.registry['fx-a'] && env.window.RTX_EFFECT_CONSOLE.registry['fx-a'].iconID, 'sparkle');
});

test('5u exportSource：新增特效 [存檔]（staged）後匯出取 staged 內容（disk 404 不失敗）', async () => {
  const env = await loadEnv({
    manifest: M3,
    fileGet: { status: 404, payload: null }
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  // 無 staged/textarea（預設 manifest tab）→ disk 404 → null
  assert.equal(await ed.exportSource('fx-a', 'viewer.js'), null);
  // 模擬 [存檔]：staged viewer.js → 取 staged（disk 404 不失敗）
  ed.state.pendingCode = { 'fx-a/viewer.js': { effectId: 'fx-a', filename: 'viewer.js', content: 'STAGED-VIEWER' } };
  assert.equal(await ed.exportSource('fx-a', 'viewer.js'), 'STAGED-VIEWER');
  // staged console.js → 取 staged
  ed.state.pendingCode['fx-a/console.js'] = { effectId: 'fx-a', filename: 'console.js', content: 'STAGED-CONSOLE' };
  assert.equal(await ed.exportSource('fx-a', 'console.js'), 'STAGED-CONSOLE');
  // 清空 staged → 回退 textarea（切 viewer tab、設內容）
  ed.state.pendingCode = {};
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  els.code.value = 'TEXTAREA-VIEWER';
  assert.equal(await ed.exportSource('fx-a', 'viewer.js'), 'TEXTAREA-VIEWER');
});

test('3b 清屏：只清編輯器 canvas、不 POST /api/clear、running false', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  makeFakeEffects(env);
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(ed.preview.running, true);
  els.previewClear._fire('click', {});
  await settle(6);
  const clears = env.fetchCalls.filter((c) => c.method === 'POST' && c.url === '/api/clear');
  assert.equal(clears.length, 0, '[清屏] 不應 POST /api/clear（只清編輯器 canvas）');
  assert.equal(ed.preview.running, false);
  assert.equal(els.opsResult.textContent, '已清除預覽畫面');
  assert.ok(els.opsResult.classList.contains('ok'));
  ed.previewStop(true);
});

test('3b [保存] 自動重載：running 重預覽、stopped 重新注入 plugin、不同 id 不處理', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const { calls } = makeFakeEffects(env);
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(calls.length, 1);
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  els.saveFile._fire('click', {});
  els.saveBtn._fire('click', {});
  await settle(12);
  assert.equal(calls.length, 2);
  assert.equal(bodyScripts(env).length, 2);
  assert.equal(ed.preview.running, true);
  assert.equal(ed.preview.loadedId, 'fx-a');

  ed.previewStop(true);
  els.saveFile._fire('click', {});
  els.saveBtn._fire('click', {});
  await settle(12);
  assert.equal(calls.length, 2);
  assert.equal(bodyScripts(env).length, 3);
  assert.equal(ed.preview.loadedId, 'fx-a');

  const itemB = els.zoneAlt.querySelectorAll('.fx-item')[0];
  assert.equal(itemB.getAttribute('data-fx'), 'fx-b');
  itemB._fire('click', { target: itemB.children[2] });
  els.saveFile._fire('click', {});
  els.saveBtn._fire('click', {});
  await settle(12);
  assert.equal(calls.length, 2);
  assert.equal(bodyScripts(env).length, 3);
  ed.previewStop(true);
});

test('3b 選定切換：running 時切別項停止預覽、label 更新、再開始重預覽', async () => {
  const env = await loadEnv({ manifest: M2 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const { calls } = makeFakeEffects(env);
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'fx-a');
  assert.equal(ed.preview.running, true);

  const itemB = els.zoneCur.querySelectorAll('.fx-item')[1];
  assert.equal(itemB.getAttribute('data-fx'), 'fx-b');
  itemB._fire('click', { target: itemB.children[2] });
  assert.equal(ed.preview.running, false);
  assert.equal(ed.preview.fx, null);
  assert.equal(els.previewLabel.textContent, 'Beta（選定）· 800×450');
  assert.equal(els.previewHint.textContent, 'Beta（選定）· x=50, y=50');

  const itemA = els.zoneCur.querySelectorAll('.fx-item')[0];
  itemA._fire('click', { target: itemA.children[2] });
  assert.equal(els.previewLabel.textContent, 'Alpha（選定）· 800×450');
  assert.equal(els.previewHint.textContent, 'Alpha（選定）· x=50, y=50');

  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].type, 'fx-a');
  assert.equal(ed.preview.running, true);
  ed.previewStop(true);
});

test('U15 mini-console：[開始預覽] 讀暫存 console.js→特效 icon＋參數 render（僅展示）', async () => {
  const env = await loadEnv({
    manifest: M3,
    icons: { fx: { burst: '<svg burst>', generic: '<svg g>' } }
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'console')._fire('click', {});
  await settle(6);
  els.code.value =
    "window.RTX_EFFECT_CONSOLE.register('fx-a', { iconID: 'burst', render: function (c, api) {" +
    " var d = document.createElement('div'); d.className = 'rtx-field';" +
    " var i = document.createElement('input'); i.id = 'rtx-p-count'; i.type = 'number'; i.value = api.defaults.count;" +
    " d.appendChild(i); c.appendChild(d); } });";
  els.saveFile._fire('click', {});
  await settle(4);
  assert.ok(ed.state.pendingCode['fx-a/console.js'], 'console.js staged');
  await ed.prepareMiniConsole();
  assert.equal(els.miniFxIcon.innerHTML, '<svg burst>');
  assert.equal(els.miniFxName.textContent, 'Alpha');
  const inp = els.miniParamsBody.querySelector('#rtx-p-count');
  assert.ok(inp, '參數面板應有 render 出的 input');
  assert.equal(String(inp.value), '8');
});

test('U15 mini-console：無 console.js render→schema 參數渲染編輯框（僅展示）', async () => {
  const env = await loadEnv({
    manifest: M3,
    icons: { fx: { burst: '<svg burst>' } }
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  await ed.prepareMiniConsole(); // fx-a、無 staged console.js→無 plugin render→schema 編輯框
  assert.equal(els.miniFxIcon.innerHTML, '<svg burst>');
  const rows = els.miniParamsBody.querySelectorAll('.mini-field');
  assert.equal(rows.length, 3); // count/note/mode（cols array 略過）
  const inpCount = els.miniParamsBody.querySelector('#rtx-p-count');
  const inpNote = els.miniParamsBody.querySelector('#rtx-p-note');
  const selMode = els.miniParamsBody.querySelector('#rtx-p-mode');
  assert.ok(inpCount && inpNote && selMode, 'schema fallback 應渲染編輯框');
  assert.equal(inpCount.tagName, 'INPUT');
  assert.equal(inpCount.type, 'number');
  assert.equal(String(inpCount.value), '8');
  assert.equal(String(inpNote.value), 'hi');
  assert.equal(selMode.tagName, 'SELECT');
  assert.equal(String(selMode.value), 'auto');
  assert.equal(els.miniParamsBody.querySelectorAll('.mini-field-v').length, 0, '不應再有純文字 mini-field-v');
});

test('U15 mini-console：[開始預覽] 先同步 manifest fields→參數面板值與即時預覽一致（未存變更亦反映）', async () => {
  const env = await loadEnv({
    manifest: M3,
    icons: { fx: { burst: '<svg burst>' } }
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const { calls } = makeFakeEffects(env);
  // 修改 count 卡 default 8→20（不存檔）
  const card = els.pRows.querySelectorAll('.p-card')[0];
  assert.equal(card.querySelector('.p-key').value, 'count');
  const defInp = card.querySelector('.p-default');
  defInp.value = '20';
  defInp._fire('input', {});
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.count, 20, '預覽應使用新值');
  const inp = els.miniParamsBody.querySelector('#rtx-p-count');
  assert.ok(inp, 'mini console 應有 count 編輯框');
  assert.equal(String(inp.value), '20', 'mini console 值應與預覽一致（不顯示舊 manifest 值）');
  ed.previewStop(true);
});

test('U15 mini-console：切換特效→清空簡化 console', async () => {
  const env = await loadEnv({
    manifest: M3,
    icons: { fx: { burst: '<svg burst>', generic: '<svg g>' } }
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  await ed.prepareMiniConsole(); // fx-a
  assert.equal(els.miniFxName.textContent, 'Alpha');
  assert.ok(els.miniFxIcon.innerHTML, 'icon set');
  ed.selectItem('fx-b');
  assert.equal(els.miniFxName.textContent, '', '切換後清空 name');
  assert.equal(els.miniFxIcon.innerHTML, '', '切換後清空 icon');
  assert.ok(!els.miniConsole.classList.contains('open'), 'panel 收合');
});

test('U15 mini-console：FAB 展開/收合＋初始收合', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.ok(!els.miniConsole.classList.contains('open'), '初始收合');
  ed.miniToggle();
  assert.ok(els.miniConsole.classList.contains('open'));
  assert.equal(els.miniFab.getAttribute('aria-expanded'), 'true');
  ed.miniToggle();
  assert.ok(!els.miniConsole.classList.contains('open'));
});

test('U15 mini-console：[重載] 清除 icon 及 render（需重新 [開始預覽]）', async () => {
  const env = await loadEnv({
    manifest: M3,
    icons: { fx: { burst: '<svg burst>', generic: '<svg g>' } }
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  await ed.prepareMiniConsole(); // fx-a
  assert.equal(els.miniFxName.textContent, 'Alpha');
  assert.ok(els.miniFxIcon.innerHTML, 'icon set');
  els.reloadBtn._fire('click', { target: els.reloadBtn });
  await settle();
  assert.equal(els.miniFxName.textContent, '', '[重載] 清空 name');
  assert.equal(els.miniFxIcon.innerHTML, '', '[重載] 清空 icon');
  assert.ok(!els.miniConsole.classList.contains('open'), 'panel 收合');
});

test('2c drag：param card 從末位移到首位、重貼條紋、置 dirty', async () => {
  const env = await loadEnv({ manifest: M3 });
  const els = env.els;
  const cards = els.pRows.querySelectorAll('.p-card');
  cards.forEach((c, i) => {
    c.getBoundingClientRect = () => ({
      top: 100 + i * 60,
      left: 0,
      right: 200,
      bottom: 140 + i * 60,
      width: 200,
      height: 40
    });
  });
  const cols = cards[3];
  assert.equal(cols.querySelector('.p-key').value, 'cols');
  cols.querySelector('.grip')._fire('mousedown', { clientY: 200, preventDefault: () => {} });
  env.window._fire('mousemove', { clientY: 40 });
  assert.ok(cols.classList.contains('dragging'));
  env.window._fire('mouseup', {});
  assert.equal(cols.classList.contains('dragging'), false);
  const keys = els.pRows.querySelectorAll('.p-card').map((c) => c.querySelector('.p-key').value);
  assert.deepEqual(keys, ['cols', 'count', 'note', 'mode']);
  const striped = els.pRows.querySelectorAll('.p-card');
  assert.ok(striped[0].classList.contains('cA'));
  assert.ok(striped[1].classList.contains('cB'));
  assert.equal(els.dirty.dataset.state, 'unstaged', '7m：drag 重排 → 未暫存變更');
});

test('5b effects.json tab 顯示選定 effect 單項 entry（非整個 manifest）、唯讀', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'manifest')._fire('click', {});
  assert.equal(ed.activeTab(), 'manifest');
  assert.ok(els.code.value.includes('"label": "Alpha"'));
  assert.ok(els.code.value.includes('"category": "burst"'));
  assert.ok(els.code.value.includes('"count"'));
  assert.ok(!els.code.value.includes('"version"'));
  assert.ok(!els.code.value.includes('currentEffects'));
  assert.ok(!els.code.value.includes('Beta'));
  assert.equal(els.code.readOnly, true);
});

test('5b effects.json tab 未選定顯示「請先選擇特效」', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'manifest')._fire('click', {});
  assert.ok(els.code.value.includes('"label": "Alpha"'));
  ed.state.selected = null;
  ed.renderManifestView();
  assert.equal(els.code.value, '請先選擇特效');
  assert.equal(ed.selectedEffectEntry(), null);
});

test('5b effects.json tab 選定變更同步更新', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'manifest')._fire('click', {});
  assert.ok(els.code.value.includes('"label": "Alpha"'));
  const itemB = els.zoneAlt.querySelectorAll('.fx-item')[0];
  assert.equal(itemB.getAttribute('data-fx'), 'fx-b');
  itemB._fire('click', { target: itemB.children[2] });
  assert.equal(ed.state.selected, 'fx-b');
  assert.ok(els.code.value.includes('"label": "Beta"'));
  assert.ok(!els.code.value.includes('Alpha'));
  const json = ed.effectEntryJson('fx-b');
  assert.ok(json.includes('"label": "Beta"'));
  assert.equal(ed.effectEntryJson('nope'), null);
  assert.ok(ed.selectedEffectEntry().enabled === false);
});

test('5b previewStart 用選定座標（percent→canvas px）、hint 顯示座標', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const { calls } = makeFakeEffects(env);
  els.previewCanvas._fire('click', { clientX: 240, clientY: 90 });
  assert.equal(ed.preview.pos.x, 30);
  assert.equal(ed.preview.pos.y, 20);
  assert.ok(els.previewHint.textContent.includes('x=30, y=20'));
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'fx-a');
  assert.equal(calls[0].px, 240);
  assert.equal(calls[0].py, 90);
  ed.previewStop(true);
});

test('5b 預覽中改變選定座標：下次開始預覽生效', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const { calls } = makeFakeEffects(env);
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].px, 400);
  assert.equal(calls[0].py, 225);
  els.previewCanvas._fire('click', { clientX: 80, clientY: 45 });
  assert.equal(ed.preview.pos.x, 10);
  assert.equal(ed.preview.pos.y, 10);
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].px, 80);
  assert.equal(calls[1].py, 45);
  ed.previewStop(true);
});

test('U5 預覽生成點 marker：idle 點 canvas 畫十字標記（drawPreviewMarker 被呼叫）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  makeFakeEffects(env);
  const before = els.previewCanvas._ctx._marks;
  els.previewCanvas._fire('click', { clientX: 240, clientY: 90 });
  assert.equal(ed.preview.pos.x, 30);
  assert.equal(ed.preview.pos.y, 20);
  assert.ok(els.previewCanvas._ctx._marks > before, 'idle 點 canvas 應重畫 marker（drawPreviewMarker→ctx.save）');
  ed.previewStop(true);
});

test('U5 marker 反縮放：canvas 拉伸為非 16:9 時以 scale(1/sx,1/sy) 反縮放（避免標記變形）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  makeFakeEffects(env);
  els.previewCanvas.getBoundingClientRect = () => ({ top: 0, left: 0, right: 400, bottom: 300, width: 400, height: 300 });
  const scalesBefore = els.previewCanvas._ctx._scales.length;
  els.previewCanvas._fire('click', { clientX: 200, clientY: 150 });
  const s = els.previewCanvas._ctx._scales[scalesBefore];
  assert.ok(s, 'drawPreviewMarker 應呼叫 ctx.scale 反縮放');
  assert.ok(Math.abs(s[0] - 800 / 400) < 1e-6, 'scale x 應為 1/sx＝PREVIEW_LW/canvas 寬');
  assert.ok(Math.abs(s[1] - 450 / 300) < 1e-6, 'scale y 應為 1/sy＝PREVIEW_LH/canvas 高');
  assert.ok(els.previewCanvas._ctx._translate > 0, 'drawPreviewMarker 應先 translate 到標記中心');
  ed.previewStop(true);
});

test('U5 [重設 50/50]：pos 回 50/50、hint 更新、marker 重畫', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  makeFakeEffects(env);
  els.previewCanvas._fire('click', { clientX: 100, clientY: 50 });
  assert.equal(ed.preview.pos.x, 12.5);
  const before = els.previewCanvas._ctx._marks;
  els.previewReset._fire('click', {});
  assert.equal(ed.preview.pos.x, 50);
  assert.equal(ed.preview.pos.y, 50);
  assert.ok(els.previewHint.textContent.includes('x=50, y=50'));
  assert.ok(els.previewCanvas._ctx._marks > before, '重設後應重畫 marker');
  ed.previewStop(true);
});

test('U5 marker 播放期間不顯示（running tick 不畫 marker、停止後重現）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const { steps } = makeFakeEffects(env);
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(ed.preview.running, true);
  const before = els.previewCanvas._ctx._marks;
  env.setNow(120);
  ed.previewTick();
  assert.equal(els.previewCanvas._ctx._marks, before, '播放期間（running tick）不畫 marker');
  assert.equal(steps.length, 1);
  ed.previewStop(true);
  assert.ok(els.previewCanvas._ctx._marks > before, '停止後應重畫 marker');
});

test('U11 高 DPR：buffer 依 devicePixelRatio 放大＋setTransform、createEffect 座標仍 800×450 邏輯空間', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const { calls } = makeFakeEffects(env);
  env.window.devicePixelRatio = 2;
  els.previewCanvas._fire('click', { clientX: 240, clientY: 90 });
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(els.previewCanvas.width, 1600);
  assert.equal(els.previewCanvas.height, 900);
  assert.ok(els.previewCanvas._ctx._transforms >= 1, '應呼叫 setTransform');
  assert.equal(ed.preview.dpr, 2);
  assert.equal(calls[0].px, 240);
  assert.equal(calls[0].py, 90);
  ed.previewStop(true);
});

test('U11 標準 DPR（未設/≤1）：buffer 維持 800×450、createEffect 座標 400/225', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const { calls } = makeFakeEffects(env);
  els.previewStart._fire('click', {});
  await settle(8);
  assert.equal(els.previewCanvas.width, 800);
  assert.equal(els.previewCanvas.height, 450);
  assert.equal(ed.preview.dpr, 1);
  assert.equal(calls[0].px, 400);
  assert.equal(calls[0].py, 225);
  ed.previewStop(true);
});

test('5d 啟用/停用 switch：staged 本地變更＋dirty、無 PUT；[保存]才送出', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const itemB = els.zoneAlt.querySelectorAll('.fx-item')[0];
  assert.equal(itemB.getAttribute('data-fx'), 'fx-b');
  const swIn = itemSwitchInput(itemB);
  swIn.checked = true;
  swIn._fire('change', {});
  // staged：本地 state 變更＋dirty、無 PUT/GET
  assert.equal(ed.state.manifest.effects['fx-b'].enabled, true);
  assert.equal(els.dirty.dataset.state, 'dirty');
  assert.equal(env.fetchCalls.length, 1);
  // 列表重繪反映新狀態；selected（fx-a）的 meta 不受影響
  const itemB2 = els.zoneAlt.querySelectorAll('.fx-item')[0];
  assert.equal(itemSwitchInput(itemB2).checked, true);
  assert.equal(els.chkEnabled.checked, true);
  assert.equal(ed.state.selected, 'fx-a');
  // [保存]：PUT body 含 fx-b enabled
  els.saveBtn._fire('click', {});
  await settle(16);
  assert.deepEqual(
    env.fetchCalls.slice(1).map((c) => c.method + ' ' + c.url),
    ['PUT /api/editor/manifest', 'GET /api/editor/manifest']
  );
  const put = JSON.parse(env.fetchCalls[1].body);
  assert.equal(put.manifest.effects['fx-b'].enabled, true);
  assert.equal(put.deleteRemoved, false);
  assert.equal(els.opsResult.textContent, '保存成功');
  assert.equal(els.dirty.dataset.state, 'clean');
});

test('5d [✕ 移除] staged：本地移除＋pendingDeletes＋待刪列、無 DELETE/PUT；↺ 還原', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const confirms = [];
  env.window.confirm = (msg) => {
    confirms.push(msg);
    return true;
  };
  let itemB = els.zoneAlt.querySelectorAll('.fx-item')[0];
  assert.equal(itemB.getAttribute('data-fx'), 'fx-b');
  itemRmBtn(itemB)._fire('click', { target: itemB });
  // staged：本地移除＋pendingDeletes、無 DELETE/PUT
  assert.equal(ed.state.manifest.effects['fx-b'], undefined);
  assert.equal(ed.state.manifest.alternateEffects.length, 0);
  assert.equal(ed.state.pendingDeletes.length, 1);
  assert.equal(ed.state.pendingDeletes[0].id, 'fx-b');
  assert.equal(ed.state.pendingDeletes[0].deleteFiles, true);
  assert.equal(ed.state.pendingDeletes[0].zone, 'alt');
  assert.equal(ed.state.pendingDeletes[0].index, 0);
  assert.equal(ed.state.pendingDeletes[0].spec.label, 'Beta');
  assert.equal(env.fetchCalls.length, 1);
  assert.equal(els.dirty.dataset.state, 'dirty');
  // 已移除「移除特效」確認彈窗：[✕] 直接 staged、不彈 window.confirm
  assert.equal(confirms.length, 0);
  // 待刪列（pending-delete）顯示於專屬「待刪除/已刪除」區
  const pending = els.zonePending.children[els.zonePending.children.length - 1];
  assert.ok(pending.classList.contains('pending-delete'));
  assert.equal(pending.getAttribute('data-fx'), 'fx-b');
  assert.equal(pending.children[1].textContent, '［待刪·含檔案］');
  // ↺ 還原
  pending.children[2]._fire('click', {});
  assert.equal(ed.state.pendingDeletes.length, 0);
  assert.equal(ed.state.manifest.effects['fx-b'].label, 'Beta');
  assert.deepEqual(ed.state.manifest.alternateEffects, ['fx-b']);
  assert.equal(itemIds(els.zoneAlt).length, 1);
});

test('5d S1 待刪列顯示於專屬「待刪除/已刪除」區（非原區）、head 計數、↺ 還原清空', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  env.window.confirm = () => true;
  const itemB = els.zoneAlt.children.find((c) => c.classList.contains('fx-item'));
  assert.equal(itemB.getAttribute('data-fx'), 'fx-b');
  itemRmBtn(itemB)._fire('click', { target: itemB });
  // 待刪列在專屬區、不在原區（alt/cur）
  const pend = els.zonePending.children.filter((c) => c.classList.contains('pending-delete'));
  assert.equal(pend.length, 1);
  assert.equal(pend[0].getAttribute('data-fx'), 'fx-b');
  assert.equal(els.zoneAlt.children.filter((c) => c.classList.contains('pending-delete')).length, 0);
  assert.equal(els.zoneCur.children.filter((c) => c.classList.contains('pending-delete')).length, 0);
  assert.equal(els.zonePendingHead.textContent, '待刪除 / 已刪除（1）');
  // ↺ 還原 → 專屬區清空、fx-b 回到 alt
  const restoreBtn = pend[0].children.find((c) => c.classList.contains('rm'));
  restoreBtn._fire('click', {});
  assert.equal(ed.state.pendingDeletes.length, 0);
  assert.ok(ed.state.manifest.effects['fx-b']);
  assert.deepEqual(ed.state.manifest.alternateEffects, ['fx-b']);
  assert.equal(els.zonePending.children.filter((c) => c.classList.contains('pending-delete')).length, 0);
  assert.equal(els.zonePendingHead.textContent, '待刪除 / 已刪除（0）');
  assert.equal(itemIds(els.zoneAlt).length, 1);
});

test('5d U14 復原待刪除遇重複 id：顯示錯誤＋待刪項保留（不覆蓋新特效）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  env.window.confirm = () => true;
  // 移除 fx-b（staged）→ pendingDeletes[fx-b]、manifest.effects['fx-b'] 消失
  const itemB = els.zoneAlt.children.find((c) => c.classList.contains('fx-item'));
  itemRmBtn(itemB)._fire('click', { target: itemB });
  assert.equal(ed.state.pendingDeletes.length, 1);
  assert.equal(ed.state.manifest.effects['fx-b'], undefined);
  const pd = ed.state.pendingDeletes[0];
  assert.equal(pd.spec.label, 'Beta');
  // 新增特效並 re-key 為 fx-b → manifest.effects['fx-b'] 被新特效佔用
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'manifest')._fire('click', {});
  await settle(4);
  ed.newEffect(); // effect-1
  els.metaId.value = 'fx-b';
  await ed.saveFile();
  await settle(8);
  assert.ok(ed.state.manifest.effects['fx-b'], 'fx-b 已被新特效佔用');
  assert.notStrictEqual(ed.state.manifest.effects['fx-b'], pd.spec, '新特效 spec ≠ 待刪項 spec');
  assert.equal(ed.state.pendingDeletes.length, 1, '待刪項仍存在');
  // ↺ 復原 → id 衝突：顯示錯誤、待刪項保留、不覆蓋新特效
  const pend = els.zonePending.children.filter((c) => c.classList.contains('pending-delete'));
  const restoreBtn = pend[0].children.find((c) => c.classList.contains('rm'));
  restoreBtn._fire('click', {});
  assert.ok(els.opsResult.textContent.includes('復原失敗'), '應顯示復原失敗');
  assert.ok(els.opsResult.textContent.includes('已存在'), '應提示 effect_id 已存在');
  assert.ok(els.opsResult.classList.contains('err'), '應為 err 狀態');
  assert.equal(ed.state.pendingDeletes.length, 1, '待刪項保留');
  assert.notStrictEqual(ed.state.manifest.effects['fx-b'], pd.spec, '不覆蓋為待刪項的舊 spec');
});

test('5d 刪除特效：[保存] PUT deleteRemoved 為 id 陣列（含檔案；保留檔案已停用）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  env.window.confirm = () => true;
  let itemB = els.zoneAlt.querySelectorAll('.fx-item')[0];
  itemRmBtn(itemB)._fire('click', { target: itemB });
  // 保留檔案已停用：deleteFiles 恆為 true（一律刪目錄）
  assert.equal(ed.state.pendingDeletes[0].deleteFiles, true);
  els.saveBtn._fire('click', {});
  await settle(16);
  let put = JSON.parse(env.fetchCalls[1].body);
  assert.equal(put.manifest.effects['fx-b'], undefined);
  assert.deepEqual(put.deleteRemoved, ['fx-b']);
  assert.equal(put.baseRev, M3.rev);
});

test('5d 批次列：未選取特效時顯示「已選 0 項」、選取後顯示計數、取消後回「已選 0 項」', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(els.batchCount.textContent, '已選 0 項', '初始無選取→已選 0 項');
  ed.toggleBatch('fx-a', true);
  ed.toggleBatch('fx-b', true);
  assert.equal(els.batchCount.textContent, '已選 2 項', '選取 2 項→計數文字');
  ed.toggleBatch('fx-a', false);
  ed.toggleBatch('fx-b', false);
  assert.equal(els.batchCount.textContent, '已選 0 項', '取消全部→已選 0 項');
});

test('5d 批次操作 staged：停用/移區皆本地＋dirty、無 PUT；[保存]一次送出', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  ed.toggleBatch('fx-a', true);
  ed.toggleBatch('fx-b', true);
  ed.batchApply('enabled', false);
  assert.equal(ed.state.manifest.effects['fx-a'].enabled, false);
  assert.equal(ed.state.manifest.effects['fx-b'].enabled, false);
  assert.equal(els.chkEnabled.checked, false);
  assert.equal(env.fetchCalls.length, 1);
  assert.equal(els.dirty.dataset.state, 'dirty');
  ed.batchMove('alt');
  assert.deepEqual(ed.state.manifest.currentEffects, []);
  assert.deepEqual(ed.state.manifest.alternateEffects, ['fx-b', 'fx-a']);
  assert.equal(env.fetchCalls.length, 1);
  // [保存]：一次 PUT 帶全部 staged 變更
  els.saveBtn._fire('click', {});
  await settle(16);
  assert.deepEqual(
    env.fetchCalls.slice(1).map((c) => c.method),
    ['PUT', 'GET']
  );
  const put = JSON.parse(env.fetchCalls[1].body);
  assert.equal(put.manifest.effects['fx-a'].enabled, false);
  assert.equal(put.manifest.effects['fx-b'].enabled, false);
  assert.deepEqual(put.manifest.currentEffects, []);
  assert.deepEqual(put.manifest.alternateEffects, ['fx-b', 'fx-a']);
  assert.equal(put.deleteRemoved, false);
  assert.equal(els.opsResult.textContent, '保存成功');
});

test('5d 拖曳排序/跨區 staged：commitMove 本地變更＋dirty、無 PUT；無變化不 dirty', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(ed.state.dirty, false);
  ed.commitMove('fx-a', null, 'cur');
  assert.equal(ed.state.dirty, false);
  assert.deepEqual(ed.state.manifest.currentEffects, ['fx-a']);
  assert.equal(env.fetchCalls.length, 1);
  ed.commitMove('fx-b', 'fx-a', 'cur');
  assert.deepEqual(ed.state.manifest.currentEffects, ['fx-b', 'fx-a']);
  assert.deepEqual(ed.state.manifest.alternateEffects, []);
  assert.equal(ed.state.dirty, true);
  assert.equal(env.fetchCalls.length, 1);
  assert.deepEqual(itemIds(els.zoneCur), ['fx-b', 'fx-a']);
  assert.deepEqual(itemIds(els.zoneAlt), []);
});

test('P1 就地更新：拖曳 commitMove 只 move 既有節點、不重建（保留節點 identity）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.deepEqual(itemIds(els.zoneCur), ['fx-a']);
  assert.deepEqual(itemIds(els.zoneAlt), ['fx-b']);
  const nodeA = itemById(env, 'fx-a');
  const nodeB = itemById(env, 'fx-b');
  assert.ok(nodeA && nodeB);
  ed.commitMove('fx-b', 'fx-a', 'cur');
  assert.deepEqual(itemIds(els.zoneCur), ['fx-b', 'fx-a']);
  assert.deepEqual(itemIds(els.zoneAlt), []);
  assert.strictEqual(itemById(env, 'fx-b'), nodeB, 'fx-b 節點應被 move 至主區（非重建）');
  assert.strictEqual(itemById(env, 'fx-a'), nodeA, 'fx-a 節點應被復用（非重建）');
});

test('5d [＋新增特效] staged：本地加 entry＋dirty、無 PUT；[保存]送出新 entry', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  // U10：無彈出視窗——預設 id＋流水號（effect-1／新特效 1）
  ed.newEffect();
  const newId = ed.state.selected;
  assert.equal(newId, 'effect-1');
  assert.equal(els.dirty.dataset.state, 'dirty');
  assert.equal(env.fetchCalls.length, 1);
  const newSpec = ed.state.manifest.effects[newId];
  assert.equal(newSpec.label, '新特效 1');
  assert.equal(newSpec.enabled, true);
  assert.equal(Object.keys(newSpec.params).length, 0);
  assert.equal(els.metaId.value, 'effect-1', 'id 欄位顯示預設 id');
  assert.equal(els.metaId.disabled, false, '新增特效 id 欄位可編輯');
  assert.deepEqual(ed.state.manifest.currentEffects, ['fx-a', 'effect-1']);
  assert.deepEqual(ed.state.manifest.alternateEffects, ['fx-b']);
  assert.equal(ed.state.selected, 'effect-1');
  assert.equal(els.metaLabel.value, '新特效 1');
  assert.deepEqual(itemIds(els.zoneCur), ['fx-a', 'effect-1']);
  els.saveBtn._fire('click', {});
  await settle(16);
  assert.deepEqual(
    env.fetchCalls.slice(1).map((c) => c.method),
    ['PUT', 'GET']
  );
  const put = JSON.parse(env.fetchCalls[1].body);
  // buildManifest 不再填補 viewer/console（已移除 meta-files 欄位）；server 端預設＋建檔
  assert.deepEqual(put.manifest.effects['effect-1'], {
    label: '新特效 1',
    enabled: true,
    params: {}
  });
  assert.deepEqual(put.manifest.currentEffects, ['fx-a', 'effect-1']);
  assert.equal(put.deleteRemoved, false);
});

test('U10 effect_id：新增特效以 [存檔] re-key（改 id）＋列表/選定同步', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'manifest')._fire('click', {});
  await settle(4);
  ed.newEffect(); // 預設 effect-1／新特效 1
  assert.equal(ed.state.selected, 'effect-1');
  assert.equal(els.metaId.disabled, false, '新增特效 id 欄位可編輯');
  els.metaId.value = 'my-fx';
  await ed.saveFile(); // [存檔]（effects.json tab）→ re-key
  await settle(8);
  assert.equal(ed.state.selected, 'my-fx', 're-key 後 selected＝my-fx');
  assert.ok(ed.state.manifest.effects['my-fx'], 'manifest 有 my-fx');
  assert.equal(ed.state.manifest.effects['effect-1'], undefined, '舊 id effect-1 已移除');
  assert.deepEqual(ed.state.manifest.currentEffects, ['fx-a', 'my-fx']);
  assert.equal(els.metaId.value, 'my-fx');
  assert.equal(els.metaId.disabled, false, 'my-fx 仍新增未存檔→id 仍可編輯');
  assert.deepEqual(itemIds(els.zoneCur), ['fx-a', 'my-fx']);
  assert.ok(!els.opsResult.classList.contains('err'), 're-key 不應有錯誤');
});

test('U10 effect_id：[存檔] 時 id 不合理（格式/重複）被擋、已有特效 id 只讀', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'manifest')._fire('click', {});
  await settle(4);
  ed.selectItem('fx-a');
  await settle(2);
  assert.equal(els.metaId.disabled, true, '已有特效 id 欄位只讀');
  assert.equal(els.metaId.value, 'fx-a');
  ed.newEffect(); // effect-1（id 欄位轉可編輯）
  els.metaId.value = 'bad id!';
  await ed.saveFile();
  await settle(4);
  assert.ok(els.opsResult.classList.contains('err'), '非法 id 應 err');
  assert.ok(els.opsResult.textContent.includes('effect_id 不合理'), '提示 effect_id 不合理');
  assert.equal(ed.state.selected, 'effect-1', '非法 id 未 re-key');
  els.metaId.value = 'fx-a'; // 重複 id
  await ed.saveFile();
  await settle(4);
  assert.ok(els.opsResult.textContent.includes('已存在'), '重複 id 應提示已存在');
  assert.equal(ed.state.selected, 'effect-1');
});

test('Task1/3 effects.json 預覽：以 effect_id 為鍵＋[存檔] 依上方欄位更新', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  ed.selectItem('fx-a');
  await settle(2);
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'manifest')._fire('click', {});
  await settle(4);
  assert.ok(els.code.value.includes('"fx-a"'), 'Task1：預覽應含 effect_id 鍵 fx-a');
  els.metaLabel.value = '改過的標籤';
  await ed.saveFile(); // [存檔]（effects.json tab）→ 依上方欄位更新預覽
  await settle(4);
  assert.ok(els.code.value.includes('改過的標籤'), 'Task3-2：[存檔]後預覽反映 label');
  assert.ok(els.code.value.includes('"fx-a"'), '預覽仍以 id 為鍵');
  assert.ok(els.opsResult.textContent.includes('effects.json 欄位已套用'));
  assert.ok(!els.opsResult.classList.contains('err'));
});

test('5d [重載] 有 staged 變更：confirm 取消→不發請求；確認→重載並清 staged', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  ed.setDirty(true);
  let confirmed = false;
  env.window.confirm = () => confirmed;
  els.reloadBtn._fire('click', {});
  await settle(8);
  assert.equal(env.fetchCalls.length, 1);
  assert.equal(ed.state.dirty, true);
  confirmed = true;
  els.reloadBtn._fire('click', {});
  await settle(8);
  assert.deepEqual(
    env.fetchCalls.slice(1).map((c) => c.method + ' ' + c.url),
    ['POST /api/effects/reload', 'GET /api/editor/manifest']
  );
  assert.equal(ed.state.dirty, false);
  assert.equal(ed.state.pendingDeletes.length, 0);
});

test('5d [保存] 409：重抓 manifest 並清 pendingDeletes 與 dirty', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  env.window.confirm = () => true;
  const itemB = els.zoneAlt.querySelectorAll('.fx-item')[0];
  itemRmBtn(itemB)._fire('click', { target: itemB });
  assert.equal(ed.state.pendingDeletes.length, 1);
  env.putSeq = [{ status: 409, payload: { detail: 'baseRev mismatch' } }];
  els.saveBtn._fire('click', {});
  await settle(16);
  assert.equal(els.opsResult.textContent, '409 衝突：manifest 已被修改，已重抓最新');
  assert.ok(els.opsResult.classList.contains('err'));
  assert.equal(ed.state.pendingDeletes.length, 0);
  assert.equal(ed.state.dirty, false);
  assert.equal(ed.state.manifest.effects['fx-b'].label, 'Beta');
});

test('5j code tab 匯入/匯出按鈕標籤隨 tab（effects.json／console／viewer.js）、accept 隨副檔名、v1 disabled', async () => {
  const env = await loadEnv({ manifest: M3, fileGet: { payload: 'a' } });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  // 預設 effects.json tab
  assert.equal(els.importFile.textContent, '匯入 effects.json');
  assert.equal(els.exportFile.textContent, '匯出 effects.json');
  assert.equal(els.fileImportFile.accept, '.json');
  assert.equal(els.importFile.disabled, false);
  assert.equal(els.exportFile.disabled, false);
  // console tab
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'console')._fire('click', {});
  await settle(4);
  assert.equal(els.importFile.textContent, '匯入 console.js');
  assert.equal(els.exportFile.textContent, '匯出 console.js');
  assert.equal(els.importFile.disabled, false);
  assert.equal(els.exportFile.disabled, false);
  ed.importFile();
  assert.equal(els.fileImportFile.accept, '.js');
  // viewer tab
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  assert.equal(els.importFile.textContent, '匯入 viewer.js');
  assert.equal(els.exportFile.textContent, '匯出 viewer.js');
  ed.importFile();
  assert.equal(els.fileImportFile.accept, '.js');

  const env2 = await loadEnv({ manifest: M1P });
  const els2 = env2.els;
  assert.equal(els2.importFile.disabled, true);
  assert.equal(els2.exportFile.disabled, true);
});

test('5o effects.json tab 匯入（wrapper）：單一 entry 改寫為選定特效 id（staged、無新增、[保存]才送出）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(ed.activeTab(), 'manifest');
  assert.equal(ed.state.selected, 'fx-a');
  els.fileImportFile.files = [
    {
      name: 'fx-z.effects.json',
      text: async () =>
        JSON.stringify({ version: 2, effects: { 'fx-z': { label: 'Zeta', enabled: true, params: {} } } })
    }
  ];
  els.fileImportFile._fire('change', {});
  await settle(8);
  // 單一 entry（id=fx-z）改寫為選定 fx-a：覆蓋 fx-a、不新增 fx-z
  assert.equal(env.fetchCalls.length, 1);
  assert.equal(els.dirty.dataset.state, 'dirty');
  assert.equal(ed.state.manifest.effects['fx-a'].label, 'Zeta');
  assert.equal(ed.state.manifest.effects['fx-z'], undefined);
  assert.equal(ed.state.selected, 'fx-a');
  assert.equal(els.fileImportFile.value, '');
  // 匯入後自動跑 3 檔格式檢查（staged 內容、不 fetch）→ 顯示於 warnings
  assert.ok(els.opsResult.textContent.includes('匯入 fx-a（staged，按[保存至伺服器]寫入）'));
  assert.ok(els.opsResult.textContent.includes('檢查格式'));
  // 程式碼預覽（effects.json tab）與 meta 同步為選定 fx-a 的匯入結果
  assert.ok(els.code.value.includes('"label": "Zeta"'));
  assert.equal(els.metaLabel.value, 'Zeta');
  // [保存]：PUT body 含 fx-a=Zeta、無 fx-z
  els.saveBtn._fire('click', {});
  await settle(16);
  const calls = env.fetchCalls.slice(1);
  assert.deepEqual(calls.map((c) => c.method + ' ' + c.url), [
    'PUT /api/editor/manifest',
    'GET /api/editor/manifest'
  ]);
  const body = JSON.parse(calls[0].body);
  assert.equal(body.baseRev, M3.rev);
  assert.equal(body.deleteRemoved, false);
  assert.equal(body.manifest.version, 2);
  assert.equal(body.manifest.effects['fx-a'].label, 'Zeta');
  assert.equal(body.manifest.effects['fx-z'], undefined);
  assert.deepEqual(body.manifest.currentEffects, ['fx-a']);
  assert.deepEqual(body.manifest.alternateEffects, ['fx-b']);
  assert.equal(els.opsResult.textContent, '保存成功');
  assert.ok(els.opsResult.classList.contains('ok'));
});

test('5k effects.json tab 匯入：更新「已選定」effect → meta/params 與程式碼預覽同步新值（staged）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(ed.state.selected, 'fx-a');
  assert.equal(els.metaLabel.value, 'Alpha');
  els.fileImportFile.files = [
    {
      name: 'fx-a.effects.json',
      text: async () =>
        JSON.stringify({ version: 2, effects: { 'fx-a': { label: 'Alpha New', enabled: false, params: {} } } })
    }
  ];
  els.fileImportFile._fire('change', {});
  await settle(8);
  // 選定維持 fx-a，但 meta/params 與程式碼預覽同步為匯入新值
  assert.equal(ed.state.selected, 'fx-a');
  assert.equal(els.metaLabel.value, 'Alpha New');
  assert.equal(els.chkEnabled.checked, false);
  assert.ok(els.code.value.includes('"label": "Alpha New"'));
  assert.equal(env.fetchCalls.length, 1); // staged 無 PUT
  assert.equal(els.dirty.dataset.state, 'dirty');
});

test('5o effects.json tab 匯入：raw entry 改寫為選定特效 id（staged、無新增）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(ed.entryIdFromFilename('fx-q.effects.json'), 'fx-q');
  assert.equal(ed.entryIdFromFilename('fx-q.json'), 'fx-q');
  assert.equal(ed.entryIdFromFilename('bad name.json'), null);
  assert.equal(ed.state.selected, 'fx-a');
  els.fileImportFile.files = [
    { name: 'fx-q.effects.json', text: async () => JSON.stringify({ label: 'Qi', params: {} }) }
  ];
  els.fileImportFile._fire('change', {});
  await settle(8);
  assert.equal(env.fetchCalls.length, 1);
  // raw entry（檔名 id=fx-q）改寫為選定 fx-a：覆蓋 fx-a、不新增 fx-q
  assert.equal(ed.state.manifest.effects['fx-a'].label, 'Qi');
  assert.equal(ed.state.manifest.effects['fx-q'], undefined);
  els.saveBtn._fire('click', {});
  await settle(16);
  const put = env.fetchCalls.find((c) => c.method === 'PUT' && c.url === '/api/editor/manifest');
  assert.ok(put);
  const body = JSON.parse(put.body);
  assert.equal(body.manifest.effects['fx-a'].label, 'Qi');
  assert.equal(body.manifest.effects['fx-q'], undefined);
  assert.equal(body.manifest.effects['fx-b'].label, 'Beta');
});

test('5j effects.json tab 匯入：invalid JSON／無 id／v1 只讀皆不發 PUT', async () => {
  const env = await loadEnv({ manifest: M3 });
  const els = env.els;
  els.fileImportFile.files = [
    { name: 'fx-bad.effects.json', text: async () => 'not json' }
  ];
  els.fileImportFile._fire('change', {});
  await settle(8);
  assert.equal(els.opsResult.textContent, '匯入失敗：JSON 格式錯誤');
  assert.ok(els.opsResult.classList.contains('err'));

  els.fileImportFile.files = [
    { name: 'bad name.json', text: async () => '{"label":"X"}' }
  ];
  els.fileImportFile._fire('change', {});
  await settle(8);
  assert.equal(els.opsResult.textContent, '匯入失敗：缺少 effect id（檔名需為 <id>.effects.json）');

  assert.equal(env.fetchCalls.filter((c) => c.method === 'PUT').length, 0);

  const env2 = await loadEnv({ manifest: M1P });
  const els2 = env2.els;
  els2.fileImportFile.files = [
    { name: 'solo.effects.json', text: async () => JSON.stringify({ label: 'Solo 2', params: {} }) }
  ];
  els2.fileImportFile._fire('change', {});
  await settle(8);
  assert.equal(els2.opsResult.textContent, '匯入不可用（唯讀或保存中）');
  assert.equal(env2.fetchCalls.filter((c) => c.method === 'PUT').length, 0);
});

test('5j effects.json tab 匯出：單項 wrapper shape（version 2）；vm 無 Blob 顯示提示；未選定失敗', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const file = ed.selectedEffectFileJson();
  assert.equal(file.id, 'fx-a');
  const doc = JSON.parse(file.json);
  assert.equal(doc.version, 2);
  assert.deepEqual(doc.currentEffects, ['fx-a']);
  assert.deepEqual(doc.alternateEffects, []);
  assert.deepEqual(Object.keys(doc.effects), ['fx-a']);
  assert.equal(doc.effects['fx-a'].label, 'Alpha');
  els.exportFile._fire('click', {});
  await settle(4);
  assert.equal(els.opsResult.textContent, '此環境不支援匯出');
  assert.ok(els.opsResult.classList.contains('err'));
  assert.equal(env.fetchCalls.length, 1);

  const env2 = await loadEnv({ manifestFail: true });
  const els2 = env2.els;
  els2.exportFile._fire('click', {});
  await settle(4);
  assert.equal(els2.opsResult.textContent, '匯出失敗：未選取特效');
});

test('5f iconFor 優先序：iconSVG > iconID > manifest icon > id > generic > fallback', async () => {
  const env = await loadEnv({
    manifest: M2,
    icons: { fx: { burst: '<svg burst>', ring: '<svg ring>', generic: '<svg g>', 'fx-a': '<svg idkey>' } }
  });
  const ed = env.window.__rtxEditor;
  const reg = env.window.RTX_EFFECT_CONSOLE.registry;

  reg['fx-a'] = { iconSVG: '<svg p></svg>', iconID: 'burst' };
  assert.equal(ed.iconFor('fx-a', { icon: 'ring' }), '<svg p></svg>');
  reg['fx-a'] = { iconSVG: 42, iconID: 'burst' };
  assert.equal(ed.iconFor('fx-a', { icon: 'ring' }), '<svg burst>');
  reg['fx-a'] = { iconSVG: '<svg broken', iconID: 'burst' };
  assert.equal(ed.iconFor('fx-a', { icon: 'ring' }), '<svg burst>');
  reg['fx-a'] = { iconID: 'burst' };
  assert.equal(ed.iconFor('fx-a', { icon: 'ring' }), '<svg burst>');
  reg['fx-a'] = { iconID: 'nope' };
  assert.equal(ed.iconFor('fx-a', { icon: 'ring' }), '<svg ring>');
  delete reg['fx-a'];
  assert.equal(ed.iconFor('fx-a', { icon: 'ring' }), '<svg ring>');
  assert.equal(ed.iconFor('fx-a', {}), '<svg idkey>');
  assert.equal(ed.iconFor('fx-c', {}), '<svg g>');

  const env2 = await loadEnv({ manifest: M1P });
  const ed2 = env2.window.__rtxEditor;
  assert.equal(
    ed2.iconFor('solo', {}),
    "<svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='3'/></svg>"
  );
});

test('5f console.js 插件 script 注入：?v=rev cache bust、cache by id+rev 不重複載入、custom console 檔名', async () => {
  const env = await loadEnv({ manifest: M2 });
  const ed = env.window.__rtxEditor;
  const revB = 'b'.repeat(64);
  await ed.loadConsolePlugin('fx-a', ed.state.manifest.effects['fx-a'], revB);
  let scripts = headScripts(env);
  assert.equal(scripts.length, 1);
  assert.ok(scripts.some((s) => s.src === '/effects/fx-a/console.js?v=' + revB));
  // cache by id+rev：同 id+rev 重複載入不新增 script
  await ed.loadConsolePlugin('fx-a', ed.state.manifest.effects['fx-a'], revB);
  assert.equal(headScripts(env).length, 1);
  // 新 rev→新 script（cache bust）
  const revF = 'f'.repeat(64);
  await ed.loadConsolePlugin('fx-a', ed.state.manifest.effects['fx-a'], revF);
  scripts = headScripts(env);
  assert.equal(scripts.length, 2);
  assert.ok(scripts.some((s) => s.src === '/effects/fx-a/console.js?v=' + revF));

  // custom console 檔名
  const env2 = await loadEnv({
    manifest: {
      rev: 'a2'.repeat(32),
      manifest: {
        version: 2,
        effects: { 'fx-c': { label: 'Gamma', console: 'ctl.js', params: {} } },
        currentEffects: ['fx-c']
      }
    }
  });
  const ed2 = env2.window.__rtxEditor;
  await ed2.loadConsolePlugin('fx-c', ed2.state.manifest.effects['fx-c'], 'a2'.repeat(32));
  assert.equal(headScripts(env2).length, 1);
  assert.equal(headScripts(env2)[0].src, '/effects/fx-c/ctl.js?v=' + 'a2'.repeat(32));
});

test('5f 插件載入失敗：只 warn、不阻擋（mini-console 按需載入同路徑）', async () => {
  const env = await loadEnv({ manifest: M2, icons: { fx: { generic: '<svg g>' } } });
  const ed = env.window.__rtxEditor;
  const revB = 'b'.repeat(64);
  await ed.loadConsolePlugin('fx-a', ed.state.manifest.effects['fx-a'], revB);
  assert.equal(env.consoleWarn.length, 0);
  assert.equal(headScripts(env).length, 1);

  const curHeadAppend = env.doc.head.appendChild;
  env.doc.head.appendChild = (child) => {
    const r = curHeadAppend(child);
    if (child.tagName === 'SCRIPT' && String(child.src).indexOf('/effects/fx-a/') >= 0) {
      child.onload = null;
      Promise.resolve().then(() => {
        if (typeof child.onerror === 'function') child.onerror(new Error('simulated failure'));
      });
    }
    return r;
  };
  const revF = 'f'.repeat(64);
  await ed.loadConsolePlugin('fx-a', ed.state.manifest.effects['fx-a'], revF);
  assert.equal(env.consoleWarn.length, 1);
  assert.ok(env.consoleWarn[0].indexOf('/effects/fx-a/console.js?v=' + revF) >= 0);
  assert.equal(ed.state.manifest.effects['fx-a'].label, 'Alpha');
});

test('5f 保存後新特效：載入其 console.js 插件（mini-console 按需）', async () => {
  const env = await loadEnv({ manifest: M3, icons: { fx: { generic: '<svg g>' } } });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  ed.newEffect(); // U10：預設 id＋流水號（effect-1／新特效 1）
  env.manifest.payload.rev = 'e'.repeat(64);
  env.manifest.payload.manifest.effects['effect-1'] = {
    label: '新特效 1',
    enabled: true,
    params: {},
    viewer: 'viewer.js',
    console: 'console.js'
  };
  env.manifest.payload.manifest.currentEffects = ['fx-a', 'effect-1'];
  els.saveBtn._fire('click', {});
  await settle(16);
  assert.equal(ed.state.manifest.effects['effect-1'].label, '新特效 1');
  // mini-console 按需載入新特效的 console.js（id+rev cache）
  await ed.loadConsolePlugin('effect-1', ed.state.manifest.effects['effect-1'], 'e'.repeat(64));
  assert.ok(
    headScripts(env).some((s) => s.src === '/effects/effect-1/console.js?v=' + 'e'.repeat(64))
  );
});

// ===== 5n 格式檢查（輕量：語法＋註冊＋結構；單檔／3 檔＋匯入後自動檢查）=====
const VALID_VIEWER =
  "window.Effects.register('fx-a', function (px, py, params) {\n" +
  '  return { update: function () {}, draw: function () {}, done: function () { return false; } };\n' +
  '});';
const VALID_CONSOLE =
  "window.RTX_EFFECT_CONSOLE.register('fx-a', { render: function (root, fx, params) {} });";

test('5n checkEffectsEntry：valid entry 無錯無警', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const e = [];
  const w = [];
  ed.checkEffectsEntry('fx-a', { label: 'Alpha', enabled: true }, e, w);
  assert.deepEqual(e, []);
  assert.deepEqual(w, []);
});

test('5n checkEffectsEntry：空 label／非 boolean enabled／未知欄位／不支援 type 皆報', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const e = [];
  const w = [];
  ed.checkEffectsEntry(
    'fx-a',
    { label: '', enabled: 'yes', frobnicate: 1, params: { n: { type: 'nope', default: 1 } } },
    e,
    w
  );
  assert.ok(e.some((s) => s.includes('label')));
  assert.ok(e.some((s) => s.includes('enabled')));
  assert.ok(e.some((s) => s.includes('type')));
  assert.ok(w.some((s) => s.includes('未知欄位 frobnicate')));
});

test('5n checkViewerSource：valid 無錯；wrong id／語法錯誤／缺少 draw 皆報錯', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const entry = { params: {} };
  let e = [];
  let w = [];
  ed.checkViewerSource('fx-a', VALID_VIEWER, entry, e, w);
  assert.deepEqual(e, []);
  assert.deepEqual(w, []);
  e = [];
  w = [];
  ed.checkViewerSource('fx-a', VALID_VIEWER.replace("'fx-a'", "'fx-b'"), entry, e, w);
  assert.ok(e.some((s) => s.includes('註冊 id')));
  e = [];
  w = [];
  ed.checkViewerSource('fx-a', 'function ( {', entry, e, w);
  assert.ok(e.some((s) => s.includes('語法錯誤')));
  e = [];
  w = [];
  ed.checkViewerSource(
    'fx-a',
    "window.Effects.register('fx-a', function () { return { update: function(){}, done: function(){ return false; } }; });",
    entry,
    e,
    w
  );
  assert.ok(e.some((s) => s.includes('缺少 draw')));
});

test('5n checkConsoleSource：valid 無錯；missing render／wrong id 皆報錯', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const entry = { params: {} };
  let e = [];
  let w = [];
  ed.checkConsoleSource('fx-a', VALID_CONSOLE, entry, e, w);
  assert.deepEqual(e, []);
  assert.deepEqual(w, []);
  e = [];
  w = [];
  ed.checkConsoleSource('fx-a', "window.RTX_EFFECT_CONSOLE.register('fx-a', { icon: 1 });", entry, e, w);
  assert.ok(e.some((s) => s.includes('render')));
  e = [];
  w = [];
  ed.checkConsoleSource('fx-a', VALID_CONSOLE.replace("'fx-a'", "'fx-b'"), entry, e, w);
  assert.ok(e.some((s) => s.includes('註冊 id')));
});

test('5n computeCheck effects：選定 valid entry → effects.json：OK', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  ed.state.selected = 'fx-a';
  const lines = await ed.computeCheck('fx-a', ['effects'], false);
  assert.equal(lines.length, 1);
  assert.equal(lines[0], 'effects.json：OK');
});

test('5n computeCheck 3 檔：staged viewer/console 依內容判定（valid → 無錯行）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  ed.state.selected = 'fx-a';
  ed.state.pendingCode = {
    'fx-a/viewer.js': { content: VALID_VIEWER },
    'fx-a/console.js': { content: VALID_CONSOLE }
  };
  const lines = await ed.computeCheck('fx-a', ['effects', 'viewer', 'console'], false);
  assert.equal(lines.length, 3);
  assert.ok(lines[0].indexOf('effects.json：') === 0);
  assert.ok(lines[1].indexOf('viewer.js：') === 0);
  assert.ok(lines[2].indexOf('console.js：') === 0);
  assert.ok(!lines.some((l) => l.includes('錯')));
});

test('5n checkSingleFile：default(manifest) tab 檢查 effects entry → OK', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  ed.state.selected = 'fx-a';
  await ed.checkSingleFile();
  await settle(4);
  assert.ok(els.opsResult.textContent.includes('檢查格式'));
  assert.ok(els.opsResult.textContent.includes('effects.json：OK'));
});

test('5n checkSingleFile：viewer tab 語法錯誤 → warnings 顯示錯', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  ed.state.selected = 'fx-a';
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  els.code.value = 'function ( {';
  await ed.checkSingleFile();
  await settle(4);
  assert.ok(els.opsResult.textContent.includes('viewer.js'));
  assert.ok(els.opsResult.textContent.includes('錯'));
});

test('5n checkAllFiles：3 檔 staged valid → warnings 列 3 行無錯', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  ed.state.selected = 'fx-a';
  ed.state.pendingCode = {
    'fx-a/viewer.js': { content: VALID_VIEWER },
    'fx-a/console.js': { content: VALID_CONSOLE }
  };
  await ed.checkAllFiles();
  await settle(4);
  const t = els.opsResult.textContent;
  assert.ok(t.includes('檢查格式'));
  assert.ok(t.includes('effects.json：'));
  assert.ok(t.includes('viewer.js：'));
  assert.ok(t.includes('console.js：'));
  assert.ok(!t.includes('錯'));
});

test('5p 新增特效：viewer tab 直接套用模板（新特效無檔案 → 404 → ?template=true）', async () => {
  const env = await loadEnv({
    manifest: M3,
    fileGetSeq: [
      { status: 200, payload: 'var existing = 1;' }, // 選定 fx-a viewer（切 tab 時載入）
      { status: 404, payload: null } // 新增 zz-new viewer（尚無檔案 → 走模板）
    ]
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  assert.equal(els.code.value, 'var existing = 1;'); // 舊特效的 code
  // U10：無彈出視窗——預設 id＋流水號
  ed.newEffect();
  await settle(8);
  const newId = ed.state.selected;
  assert.equal(newId, 'effect-1');
  // 404 → 套用模板（harness 回傳含新特效 id 的模板），非錯誤
  assert.ok(els.code.value.includes(newId));
  assert.ok(els.opsResult.textContent.includes(newId + ' 套用 viewer.js 模板'));
  assert.ok(!els.opsResult.classList.contains('err'));
});

test('5p [存檔] staged：切換特效再切回不遺忘變更（顯示 staged、不 fetch server）', async () => {
  const env = await loadEnv({
    manifest: M3,
    fileGetSeq: [
      { status: 200, payload: 'A-v1' }, // fx-a viewer（切 tab 時載入）
      { status: 200, payload: 'B-v1' } // fx-b viewer（切到 fx-b）
    ]
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  assert.equal(els.code.value, 'A-v1');
  // 編輯並 [存檔]（staged，不寫 server）
  els.code.value = 'A-EDITED';
  ed.saveFile();
  await settle(2);
  assert.equal(ed.state.pendingCode['fx-a/viewer.js'].content, 'A-EDITED');
  // 切到 fx-b（載入 B）再切回 fx-a → 顯示 staged（不 fetch server）
  ed.selectItem('fx-b');
  await settle(4);
  assert.equal(els.code.value, 'B-v1');
  ed.selectItem('fx-a');
  await settle(4);
  assert.equal(els.code.value, 'A-EDITED'); // staged 不遺忘
  assert.ok(els.opsResult.textContent.includes('fx-a 顯示 [暫存] 的 staged 內容'));
  assert.ok(!els.opsResult.classList.contains('err'));
});

test('5o 匯入多 effect wrapper：被阻止（匯入 effects.json 只能含 1 個特效）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(ed.state.selected, 'fx-a');
  els.fileImportFile.files = [
    {
      name: 'bulk.json',
      text: async () =>
        JSON.stringify({
          version: 2,
          effects: { 'fx-m': { label: 'M', params: {} }, 'fx-n': { label: 'N', params: {} } }
        })
    }
  ];
  els.fileImportFile._fire('change', {});
  await settle(8);
  // 被阻止：fx-m/fx-n 未匯入、不設 dirty、warnings 顯示錯誤
  assert.equal(ed.state.manifest.effects['fx-m'], undefined);
  assert.equal(ed.state.manifest.effects['fx-n'], undefined);
  assert.equal(ed.state.manifest.effects['fx-a'].label, 'Alpha');
  assert.equal(ed.state.dirty, false);
  assert.equal(els.opsResult.textContent, '匯入失敗：匯入 effects.json 只能含 1 個特效（現為 2 個）');
});

test('B：程式碼編輯框未[暫存]變更——編輯即 dirty＋切換特效前 confirm（取消→不切換／確認→切換捨棄）', async () => {
  const env = await loadEnv({
    manifest: M3,
    fileGetSeq: [
      { status: 200, payload: 'A-v1' }, // fx-a viewer（切 tab 時載入）
      { status: 200, payload: 'B-v1' } // fx-b viewer（確認切換後載入）
    ]
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  assert.equal(ed.state.selected, 'fx-a');
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  assert.equal(els.code.value, 'A-v1');
  assert.equal(ed.state.dirty, false);
  // (a) 編輯→ input→ 四態即時「未暫存變更」（未 [暫存]）
  els.code.value = 'A-EDITED';
  els.code._fire('input', {});
  assert.equal(ed.state.dirty, true);
  assert.equal(els.dirty.dataset.state, 'unstaged');
  assert.equal(els.dirty.textContent, '未暫存變更');
  // (b) 切換特效（fx-a→fx-b）前 confirm：取消→不切換、編輯框未變
  const confirms = [];
  env.window.confirm = (msg) => { confirms.push(msg); return false; };
  const itemB = els.zoneAlt.querySelectorAll('.fx-item')[0];
  itemB._fire('click', { target: itemB });
  await settle(4);
  assert.equal(confirms.length, 1, '應彈一次 confirm');
  assert.ok(confirms[0].includes('未暫存的程式碼變更'));
  assert.equal(ed.state.selected, 'fx-a', '取消→未切換');
  assert.equal(els.code.value, 'A-EDITED', '編輯框未變');
  // (c) 確認→切換、編輯框捨棄（載入 fx-b code）
  env.window.confirm = () => true;
  itemB._fire('click', { target: itemB });
  await settle(4);
  assert.equal(ed.state.selected, 'fx-b', '確認→已切換');
  assert.equal(els.code.value, 'B-v1', '切換後載入 fx-b code');
});

test('7d 四態指標：編輯 code→未暫存變更→[暫存]→未保存變更→再編輯→未暫存變更→改回 staged→未保存變更→[保存至伺服器]→已同步', async () => {
  const env = await loadEnv({ manifest: M3, fileGet: { payload: 'A-v1' } });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  assert.equal(els.dirty.dataset.state, 'clean');
  assert.equal(els.dirty.textContent, '已同步');
  // 編輯→未暫存變更（state.dirty 同時為 true）
  els.code.value = 'A-EDITED';
  els.code._fire('input', {});
  assert.equal(ed.state.dirty, true);
  assert.equal(els.dirty.dataset.state, 'unstaged');
  assert.equal(els.dirty.textContent, '未暫存變更');
  // [暫存]→未保存變更（內容等於 staged→非 unstaged）
  els.saveFile._fire('click', {});
  await settle(4);
  assert.equal(ed.state.pendingCode['fx-a/viewer.js'].content, 'A-EDITED');
  assert.equal(els.dirty.dataset.state, 'dirty');
  assert.equal(els.dirty.textContent, '未保存變更');
  // 再編輯→回到未暫存變更
  els.code.value = 'A-EDITED2';
  els.code._fire('input', {});
  assert.equal(els.dirty.dataset.state, 'unstaged');
  // 改回 staged 內容→回到未保存變更
  els.code.value = 'A-EDITED';
  els.code._fire('input', {});
  assert.equal(els.dirty.dataset.state, 'dirty');
  // [保存至伺服器]（confirm 預設自動接受）→已同步
  els.saveBtn._fire('click', {});
  await settle(12);
  assert.equal(ed.state.dirty, false);
  assert.equal(els.dirty.dataset.state, 'clean');
  assert.equal(els.dirty.textContent, '已同步');
  assert.equal(els.code.value, 'A-v1', '保存成功後編輯框回到 server 內容');
});

test('7d [保存至伺服器] confirm：有未暫存變更→取消不 PUT；確認→PUT 且編輯框回到 server 基準', async () => {
  const env = await loadEnv({ manifest: M3, fileGet: { payload: 'A-v1' } });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  els.code.value = 'A-v1\n// unstaged';
  els.code._fire('input', {});
  assert.equal(els.dirty.dataset.state, 'unstaged');
  // 取消 confirm→不 PUT、編輯框未變
  const seen = [];
  env.window.confirm = (msg) => { seen.push(msg); return false; };
  els.saveBtn._fire('click', {});
  await settle(8);
  assert.equal(seen.length, 1, '應彈一次 confirm');
  assert.ok(seen[0].includes('未暫存變更'), '訊息提及未暫存變更');
  assert.ok(seen[0].includes('不會保存到伺服器'), '訊息提及不會保存到伺服器');
  assert.equal(env.fetchCalls.filter((c) => c.method === 'PUT').length, 0, '取消→不 PUT');
  assert.equal(els.code.value, 'A-v1\n// unstaged', '取消→編輯框未變');
  // 確認→PUT、保存成功後編輯框回到 server 內容
  env.window.confirm = () => true;
  els.saveBtn._fire('click', {});
  await settle(12);
  const putCalls = env.fetchCalls.filter((c) => c.method === 'PUT');
  assert.deepEqual(putCalls.map((c) => c.url), ['/api/editor/manifest']);
  assert.equal(els.code.value, 'A-v1', '保存成功後編輯框回到 server 內容');
  assert.equal(els.dirty.dataset.state, 'clean');
  assert.equal(els.opsResult.textContent, '保存成功');
});

test('7d [保存至伺服器] confirm：無未暫存變更→一般確認（無未暫存警告）', async () => {
  const env = await loadEnv({ manifest: M3, fileGet: { payload: 'a' } });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  els.code.value = 'a\n// edited';
  els.saveFile._fire('click', {});
  await settle(4);
  assert.equal(els.dirty.dataset.state, 'dirty', 'staged→未保存變更（非 unstaged）');
  const seen = [];
  env.window.confirm = (msg) => { seen.push(msg); return true; };
  els.saveBtn._fire('click', {});
  await settle(12);
  assert.equal(seen.length, 1, '應彈一次 confirm');
  assert.ok(!seen[0].includes('未暫存變更'), '無未暫存警告');
  assert.ok(!seen[0].includes('不會保存到伺服器'), '無「不會保存到伺服器」');
  const putCalls = env.fetchCalls.filter((c) => c.method === 'PUT');
  assert.deepEqual(putCalls.map((c) => c.url), ['/api/editor/manifest']);
  assert.deepEqual(JSON.parse(putCalls[0].body).files, [
    { effectId: 'fx-a', filename: 'viewer.js', content: 'a\n// edited' }
  ]);
});

// ===== 7m 兩段式變更指示器（manifest 欄位：未暫存變更 → 未保存變更）＋[新增特效] 清空 mini console =====

test('7m 兩段式指示器：改 manifest 欄位→未暫存變更；[暫存]→未保存變更；[保存至伺服器]→已同步', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const itemA = els.zoneCur.querySelectorAll('.fx-item')[0];
  itemA._fire('click', { target: itemA });
  await settle(4);
  assert.equal(ed.state.selected, 'fx-a');
  assert.equal(els.dirty.dataset.state, 'clean');
  assert.equal(els.dirty.textContent, '已同步');
  // 改 label→未暫存變更（flag=true、dirty=true）
  els.metaLabel.value = 'Alpha 2';
  els.metaLabel._fire('input', {});
  assert.equal(ed.state.unstagedFields, true);
  assert.equal(ed.state.dirty, true);
  assert.equal(els.dirty.dataset.state, 'unstaged');
  assert.equal(els.dirty.textContent, '未暫存變更');
  // [暫存] 前 spec 未變
  assert.equal(ed.state.manifest.effects['fx-a'].label, 'Alpha');
  // [暫存]→套用 spec→未保存變更
  els.saveFile._fire('click', {});
  await settle(4);
  assert.equal(ed.state.unstagedFields, false);
  assert.equal(ed.state.manifest.effects['fx-a'].label, 'Alpha 2');
  assert.equal(els.dirty.dataset.state, 'dirty');
  assert.equal(els.dirty.textContent, '未保存變更');
  // [保存至伺服器]（confirm 預設自動接受）→PUT 含編輯欄位、已同步
  els.saveBtn._fire('click', {});
  await settle(12);
  const putCalls = env.fetchCalls.filter((c) => c.method === 'PUT');
  assert.deepEqual(putCalls.map((c) => c.url), ['/api/editor/manifest']);
  assert.equal(JSON.parse(putCalls[0].body).manifest.effects['fx-a'].label, 'Alpha 2');
  assert.equal(ed.state.dirty, false);
  assert.equal(ed.state.unstagedFields, false);
  assert.equal(els.dirty.dataset.state, 'clean');
  assert.equal(els.dirty.textContent, '已同步');
});

test('7m 兩段式指示器：改欄位後切換特效→unstagedFields 清空（回到未保存變更）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const itemA = els.zoneCur.querySelectorAll('.fx-item')[0];
  itemA._fire('click', { target: itemA });
  await settle(4);
  els.metaLabel.value = 'Alpha 2';
  els.metaLabel._fire('input', {});
  assert.equal(ed.state.unstagedFields, true);
  assert.equal(els.dirty.dataset.state, 'unstaged');
  const itemB = els.zoneAlt.querySelectorAll('.fx-item')[0];
  itemB._fire('click', { target: itemB });
  await settle(4);
  assert.equal(ed.state.selected, 'fx-b');
  assert.equal(ed.state.unstagedFields, false);
  assert.equal(ed.state.dirty, true);
  assert.equal(els.dirty.dataset.state, 'dirty');
  assert.equal(els.dirty.textContent, '未保存變更');
  assert.equal(els.metaLabel.value, 'Beta');
});

test('7m [新增特效]：保留自動標籤＋清空簡化 console（直到下次 [開始預覽]）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  await ed.prepareMiniConsole(); // fx-a：填入 mini console
  assert.equal(els.miniFxName.textContent, 'Alpha');
  ed.miniToggle(); // FAB 展開
  assert.ok(els.miniConsole.classList.contains('open'));
  assert.equal(els.miniParamsBody.querySelectorAll('.mini-field').length, 3, 'mini console 有參數內容（count/note/mode；array 略過）');
  ed.newEffect();
  assert.equal(ed.state.selected, 'effect-1');
  assert.equal(ed.state.manifest.effects['effect-1'].label, '新特效 1');
  assert.equal(els.metaLabel.value, '新特效 1');
  // mini console 清空（面板收合、name/icon/參數內容皆空）
  assert.ok(!els.miniConsole.classList.contains('open'), 'panel 收合');
  assert.equal(els.miniFxName.textContent, '');
  assert.equal(els.miniFxIcon.innerHTML, '');
  // miniParamsBody 子元素清空由 E2E（真實 DOM）驗證；fake DOM 的 innerHTML 為字串屬性
  // 新特效是 staged 操作（非欄位編輯）→未保存變更（非未暫存變更）
  assert.equal(ed.state.unstagedFields, false);
  assert.equal(els.dirty.dataset.state, 'dirty');
  assert.equal(els.dirty.textContent, '未保存變更');
});

// ===== 7n：未 [暫存] 變更（程式碼／manifest 欄位）存在時，會捨棄它的動作先彈 confirm（切換特效／[新增特效]／匯入）=====

test('7n：manifest 欄位未暫存→切換特效 confirm（取消→不切換、變更保留／確認→切換、變更丟棄）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const itemA = els.zoneCur.querySelectorAll('.fx-item')[0];
  itemA._fire('click', { target: itemA });
  await settle(4);
  els.metaLabel.value = 'Alpha 2';
  els.metaLabel._fire('input', {});
  assert.equal(ed.state.unstagedFields, true);
  assert.equal(els.dirty.textContent, '未暫存變更');
  // (a) 取消→不切換、欄位變更保留
  const confirms = [];
  env.window.confirm = (msg) => { confirms.push(msg); return false; };
  const itemB = els.zoneAlt.querySelectorAll('.fx-item')[0];
  itemB._fire('click', { target: itemB });
  await settle(4);
  assert.equal(confirms.length, 1, '應彈一次 confirm');
  assert.ok(confirms[0].includes('manifest 欄位變更'), '訊息應提及 manifest 欄位');
  assert.equal(ed.state.selected, 'fx-a', '取消→未切換');
  assert.equal(els.metaLabel.value, 'Alpha 2', '欄位變更保留');
  assert.equal(ed.state.unstagedFields, true);
  assert.equal(els.dirty.textContent, '未暫存變更');
  // (b) 確認→切換、欄位變更丟棄
  env.window.confirm = () => true;
  itemB._fire('click', { target: itemB });
  await settle(4);
  assert.equal(ed.state.selected, 'fx-b', '確認→已切換');
  assert.equal(els.metaLabel.value, 'Beta');
  assert.equal(ed.state.unstagedFields, false);
  assert.equal(els.dirty.textContent, '未保存變更');
});

test('7n：manifest 欄位未暫存→[新增特效] confirm（取消→不建立／確認→建立、變更丟棄）', async () => {
  const env = await loadEnv({ manifest: M3 });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const itemA = els.zoneCur.querySelectorAll('.fx-item')[0];
  itemA._fire('click', { target: itemA });
  await settle(4);
  els.metaLabel.value = 'Alpha 2';
  els.metaLabel._fire('input', {});
  assert.equal(ed.state.unstagedFields, true);
  // (a) 取消→不建立、選取不變
  const confirms = [];
  env.window.confirm = (msg) => { confirms.push(msg); return false; };
  ed.newEffect();
  assert.equal(confirms.length, 1, '應彈一次 confirm');
  assert.ok(confirms[0].includes('建立新特效'), '訊息應提及建立新特效');
  assert.equal(ed.state.selected, 'fx-a', '取消→未切換');
  assert.equal(ed.state.manifest.effects['effect-1'], undefined, '未建立');
  assert.equal(els.metaLabel.value, 'Alpha 2');
  assert.equal(ed.state.unstagedFields, true);
  // (b) 確認→建立（自動標籤）、變更丟棄
  env.window.confirm = () => true;
  ed.newEffect();
  assert.equal(ed.state.selected, 'effect-1');
  assert.equal(ed.state.manifest.effects['effect-1'].label, '新特效 1');
  assert.equal(els.metaLabel.value, '新特效 1');
  assert.equal(ed.state.unstagedFields, false);
  assert.equal(els.dirty.textContent, '未保存變更');
});

test('7n：manifest 欄位未暫存→zip 匯入 confirm（取消→不匯入／確認→匯入＋選取切到匯入 effect）', async () => {
  const env = await loadEnv({
    manifest: M3,
    importSeq: [
      {
        status: 200,
        payload: {
          ok: true,
          dryRun: true,
          importedEffects: { 'fx-z': { label: 'Zeta', enabled: true, params: {} } },
          importedLayout: { currentEffects: ['fx-a', 'fx-z'], alternateEffects: ['fx-b'] },
          files: { 'fx-z/viewer.js': 'zeta code' },
          baseRev: 'e'.repeat(64)
        }
      }
    ]
  });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  const itemA = els.zoneCur.querySelectorAll('.fx-item')[0];
  itemA._fire('click', { target: itemA });
  await settle(4);
  els.metaLabel.value = 'Alpha 2';
  els.metaLabel._fire('input', {});
  assert.equal(ed.state.unstagedFields, true);
  // (a) 取消→無匯入請求
  env.window.confirm = (msg) => false;
  els.fileImportEffects.files = [{ name: 'z.zip' }];
  els.fileImportEffects._fire('change', {});
  await settle(8);
  assert.equal(env.fetchCalls.filter((c) => c.url.startsWith('/api/editor/import')).length, 0, '取消→無匯入請求');
  assert.equal(ed.state.manifest.effects['fx-z'], undefined);
  assert.equal(ed.state.selected, 'fx-a');
  assert.equal(els.metaLabel.value, 'Alpha 2');
  assert.equal(ed.state.unstagedFields, true);
  // (b) 確認→匯入、選取切到首個匯入 effect、欄位變更丟棄
  env.window.confirm = () => true;
  els.fileImportEffects.files = [{ name: 'z.zip' }];
  els.fileImportEffects._fire('change', {});
  await settle(8);
  assert.equal(ed.state.selected, 'fx-z');
  assert.equal(els.metaLabel.value, 'Zeta');
  assert.equal(ed.state.unstagedFields, false);
});

test('7n：程式碼＋manifest 欄位皆未暫存→確認訊息提及兩者（取消→不切換）', async () => {
  const env = await loadEnv({ manifest: M3, fileGetSeq: [{ status: 200, payload: 'A-v1' }] });
  const ed = env.window.__rtxEditor;
  const els = env.els;
  els.tabs.querySelectorAll('.tab').find((t) => t.getAttribute('data-tab') === 'viewer')._fire('click', {});
  await settle(4);
  els.code.value = 'A-EDITED';
  els.code._fire('input', {});
  els.metaLabel.value = 'Alpha 2';
  els.metaLabel._fire('input', {});
  assert.equal(els.dirty.textContent, '未暫存變更');
  const confirms = [];
  env.window.confirm = (msg) => { confirms.push(msg); return false; };
  const itemB = els.zoneAlt.querySelectorAll('.fx-item')[0];
  itemB._fire('click', { target: itemB });
  await settle(4);
  assert.equal(confirms.length, 1);
  assert.ok(confirms[0].includes('程式碼和 manifest 欄位變更'), '訊息應同時提及程式碼和 manifest 欄位');
  assert.equal(ed.state.selected, 'fx-a', '取消→未切換');
});
