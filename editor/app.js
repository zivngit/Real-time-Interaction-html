(function () {
  'use strict';

  var root = document.getElementById('rtx-editor');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';

  var SRV_KEY_LS = 'rtx.editor.srvKey';

  var consoleRegistry =
    window.RTX_EFFECT_CONSOLE && typeof window.RTX_EFFECT_CONSOLE === 'object'
      ? window.RTX_EFFECT_CONSOLE
      : { registry: {} };
  if (!window.RTX_EFFECT_CONSOLE) window.RTX_EFFECT_CONSOLE = consoleRegistry;
  consoleRegistry.registry = consoleRegistry.registry || {};
  if (typeof consoleRegistry.register !== 'function') {
    consoleRegistry.register = function (type, plugin) {
      if (!type || !plugin || typeof plugin !== 'object') return;
      consoleRegistry.registry[type] = plugin;
    };
  }

  var FALLBACK_ICON = "<svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='3'/></svg>";

  function isSvgString(v) {
    return typeof v === 'string' && /^\s*<svg[\s>]/.test(v) && /<\/svg>\s*$/i.test(v);
  }

  function resolvedPluginIcon(type) {
    var plugin = consoleRegistry.registry[type];
    if (!plugin || typeof plugin !== 'object') return null;
    if (isSvgString(plugin.iconSVG)) return plugin.iconSVG;
    var fx = window.RTX_EFFECT_ICONS || {};
    if (typeof plugin.iconID === 'string' && fx[plugin.iconID]) return fx[plugin.iconID];
    return null;
  }

  function iconFor(id, spec) {
    var m = spec || {};
    var fx = window.RTX_EFFECT_ICONS || {};
    return (
      resolvedPluginIcon(id) ||
      fx[m.icon] ||
      fx[id] ||
      fx.generic ||
      FALLBACK_ICON
    );
  }

  var EFFECT_ID_RE = /^[A-Za-z0-9_-]+$/;

  var state = {
    rev: null,
    baseRev: null,
    manifest: null,
    dirty: false,
    unstagedFields: false,
    selected: null,
    conn: false,
    streamOk: false,
    editable: false,
    saving: false,
    manifestLoadedOnce: false,
    batch: [],
    pendingDeletes: [],
    pendingCode: {},
    unsavedNew: {},
    codeLoaded: null
  };

  var els = {
    badge: document.getElementById('ed-badge'),
    chipVersion: document.getElementById('ed-chip-version'),
    chipRev: document.getElementById('ed-chip-rev'),
    chipCount: document.getElementById('ed-chip-count'),
    conn: document.getElementById('ed-conn'),
    keyInput: document.getElementById('ed-srv-key'),
    reloadBtn: document.getElementById('ed-reload-btn'),
    zoneCur: document.getElementById('ed-zone-cur'),
    zoneAlt: document.getElementById('ed-zone-alt'),
    zoneCurHead: document.getElementById('ed-zone-cur-head'),
    zoneAltHead: document.getElementById('ed-zone-alt-head'),
    zonePending: document.getElementById('ed-zone-pending'),
    zonePendingHead: document.getElementById('ed-zone-pending-head'),
    dirty: document.getElementById('ed-dirty'),
    metaTitle: document.getElementById('ed-meta-title'),
    tabsHint: document.getElementById('ed-tabs-hint'),
    saveBtn: document.getElementById('ed-save-btn'),
    metaId: document.getElementById('ed-meta-id'),
    metaLabel: document.getElementById('ed-meta-label'),
    metaIcon: document.getElementById('ed-meta-icon'),
    chkEnabled: document.getElementById('chk-enabled'),
    pRows: document.getElementById('ed-p-rows'),
    addParam: document.getElementById('ed-add-param'),
    code: document.getElementById('ed-code'),
    codeGutter: document.getElementById('ed-code-gutter'),
    codeGutterInner: document.getElementById('ed-code-gutter-inner'),
    codeHl: document.getElementById('ed-code-highlight'),
    codeHlCode: document.getElementById('ed-code-highlight-code'),
    tabs: document.getElementById('ed-tabs'),
    fxList: document.getElementById('ed-fx-list'),
    batchCount: document.getElementById('ed-batch-count'),
    batchEnable: document.getElementById('ed-batch-enable'),
    batchDisable: document.getElementById('ed-batch-disable'),
    batchToCur: document.getElementById('ed-batch-to-cur'),
    batchToAlt: document.getElementById('ed-batch-to-alt'),
    exportAll: document.getElementById('ed-export-all'),
    exportSel: document.getElementById('ed-export-sel'),
    addNew: document.getElementById('ed-add-new'),
    importEffects: document.getElementById('ed-import-effects'),
    fileImportEffects: document.getElementById('ed-file-import-effects'),
    fileImportFile: document.getElementById('ed-file-import-file'),
    saveFile: document.getElementById('ed-save-file'),
    importFile: document.getElementById('ed-import-file'),
    exportFile: document.getElementById('ed-export-file'),
    checkFile: document.getElementById('ed-check-file'),
    checkAll: document.getElementById('ed-check-all'),
    previewHint: document.getElementById('ed-preview-hint'),
    previewLabel: document.getElementById('ed-preview-label'),
    previewCanvas: document.getElementById('ed-preview-canvas'),
    previewStart: document.getElementById('ed-preview-start'),
    previewTest: document.getElementById('ed-preview-test'),
    opsResult: document.getElementById('ed-ops-result'),
    previewClear: document.getElementById('ed-preview-clear'),
    previewReset: document.getElementById('ed-preview-reset'),
    previewRate: document.getElementById('ed-preview-rate'),
    previewRateVal: document.getElementById('ed-preview-rate-val'),
    previewPause: document.getElementById('ed-preview-pause'),
    previewReplay: document.getElementById('ed-preview-replay'),
    miniFab: document.getElementById('ed-mini-fab'),
    miniConsole: document.getElementById('ed-mini-console'),
    miniFx: document.getElementById('ed-mini-fx'),
    miniFxIcon: document.getElementById('ed-mini-fx-icon'),
    miniFxName: document.getElementById('ed-mini-fx-name'),
    miniParams: document.getElementById('ed-mini-params'),
    miniParamsBody: document.getElementById('ed-mini-params-body')
  };

  var stream = null;
  var fxDragId = null;
  var PREVIEW_LW = 800;
  var PREVIEW_LH = 450;
  var preview = {
    running: false,
    fx: null,
    rate: 1,
    paused: false,
    vtime: 0,
    lastTick: 0,
    raf: 0,
    interval: 0,
    loadedId: null,
    pos: { x: 50, y: 50 },
    dpr: 1
  };
  var previewCtx = null;

  function injectIcons(scope) {
    scope = scope || document;
    var uis = window.RTX_UI_ICONS || {};
    var fx = window.RTX_EFFECT_ICONS || {};
    scope.querySelectorAll('[data-ui-icon]').forEach(function (el) {
      var key = el.getAttribute('data-ui-icon');
      if (uis[key] && el.dataset.uiDone !== key) {
        el.innerHTML = uis[key];
        el.dataset.uiDone = key;
      }
    });
    scope.querySelectorAll('[data-fx-icon]').forEach(function (el) {
      var key = el.getAttribute('data-fx-icon');
      if (fx[key] && el.dataset.fxDone !== key) {
        el.innerHTML = fx[key];
        el.dataset.fxDone = key;
      }
    });
  }

  function getCols() {
    var main = document.querySelector('.main');
    var css = getComputedStyle(main);
    var all = css.gridTemplateColumns.split(/\s+/).map(parseFloat);
    // .main 為 5 軌 [c1, 8px, c2, 8px, c3]，回 3 條內容欄 [c1, c2, c3]
    return [all[0], all[2], all[4]];
  }

  document.querySelectorAll('.rsz').forEach(function (bar) {
    bar.addEventListener('mousedown', function (ev) {
      ev.preventDefault();
      var idx = parseInt(bar.getAttribute('data-rsz') || '1', 10); // 1 或 2
      var start = getCols();
      var sx = ev.clientX;
      var colA = start[idx - 1];
      var colB = start[idx];
      var MIN = 220;
      bar.classList.add('on');
      document.body.setAttribute('userSelect', 'none');

      function onMove(e) {
        var dx = e.clientX - sx;
        // 兩欄總寬固定：拖動側隨 cursor、對側欄依剩餘寬度反推（一欄觸底時另一欄不再加大）
        var total = colA + colB;
        var na = colA + dx;
        if (na < MIN) na = MIN;
        if (na > total - MIN) na = total - MIN;
        var nb = total - na;
        var rootStyle = document.documentElement.style;
        if (idx === 1) {
          rootStyle.setProperty('--c1', na + 'px');
          rootStyle.setProperty('--c2', nb + 'px');
        } else {
          rootStyle.setProperty('--c2', na + 'px');
          rootStyle.setProperty('--c3', nb + 'px');
        }
      }
      function onUp() {
        bar.classList.remove('on');
        document.body.removeAttribute('userSelect');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  });

  function make(tag, id, className) {
    var el = document.createElement(tag);
    if (id) el.setAttribute('id', id);
    if (className) el.className = className;
    return el;
  }

  function getSrvKey() {
    return els.keyInput ? els.keyInput.value : '';
  }

  function saveSrvKey() {
    try {
      localStorage.setItem(SRV_KEY_LS, getSrvKey());
    } catch (e) {
      // ignore
    }
  }

  function headers() {
    var h = { 'Content-Type': 'application/json' };
    var key = getSrvKey();
    if (key) h['X-Access-Key'] = key;
    return h;
  }

  function sleep(ms) {
    return new Promise(function (res) {
      setTimeout(res, ms);
    });
  }

  function validManifest(data) {
    return (
      data &&
      typeof data.rev === 'string' &&
      data.manifest &&
      typeof data.manifest === 'object' &&
      data.manifest.effects &&
      typeof data.manifest.effects === 'object'
    );
  }

  function setConn(ok) {
    state.conn = ok;
    if (!els.conn) return;
    els.conn.classList.remove('ok', 'err');
    els.conn.classList.add(ok ? 'ok' : 'err');
    els.conn.title = ok ? '已連線' : '未連線';
  }

  function onConnFail() {
    setConn(false);
    if (els.badge) els.badge.textContent = '斷線';
  }

  // E3/S3：manifest 刷新後雙 registry 收斂到新一版——移除已不在 effects 的 id 條目
  // （執行中 preview 實體持有自己的 closure，不受 registry 移除影響；再預覽時 injectPlugin 會重新註冊）
  function pruneEffectRegistries() {
    var effects = state.manifest && state.manifest.effects;
    if (!effects) return;
    if (window.Effects && window.Effects.registry) {
      Object.keys(window.Effects.registry).forEach(function (key) {
        if (!effects[key]) delete window.Effects.registry[key];
      });
    }
    Object.keys(consoleRegistry.registry).forEach(function (key) {
      if (!effects[key]) delete consoleRegistry.registry[key];
    });
  }

  async function loadManifest() {
    // U9：載入／重載過渡態——badge 顯示「連線中…」，成功→已連線·vN（renderChips）、失敗→斷線（onConnFail）
    if (els.badge) els.badge.textContent = '連線中…';
    var r;
    try {
      r = await fetch('/api/editor/manifest', { headers: headers() });
    } catch (e) {
      onConnFail();
      return;
    }
    if (!r.ok) {
      onConnFail();
      return;
    }
    var data;
    try {
      data = await r.json();
    } catch (e) {
      data = null;
    }
    if (!validManifest(data)) {
      onConnFail();
      return;
    }
    state.rev = data.rev;
    state.baseRev = data.rev;
    state.manifest = data.manifest;
    pruneEffectRegistries();
    state.batch = state.batch.filter(function (id) {
      return state.manifest && state.manifest.effects && state.manifest.effects[id];
    });
    state.pendingDeletes = [];
    state.unsavedNew = {};
    state.dirty = false;
    state.unstagedFields = false;
    setDirtyUI();
    setConn(true);
    setEditable(data.manifest.version === 2);
    var keepSelId =
      state.selected && state.manifest && state.manifest.effects[state.selected]
        ? state.selected
        : null;
    renderAll();
    if (keepSelId && state.selected === keepSelId) {
      renderMeta(keepSelId);
      renderParams(keepSelId);
    }
    if (!state.manifestLoadedOnce) {
      state.manifestLoadedOnce = true;
      setWarnings('操作結果：尚未執行');
    }
    if (activeTab() === 'manifest') renderManifestView();
  }

  function renderAll() {
    renderChips();
    renderList();
    syncBatchUI();
  }

  function renderChips() {
    var m = state.manifest;
    if (!m) return;
    var ids = Object.keys(m.effects);
    var enabled = 0;
    ids.forEach(function (id) {
      if (m.effects[id] && m.effects[id].enabled !== false) enabled++;
    });
    if (els.chipVersion) els.chipVersion.textContent = 'version ' + m.version;
    if (els.chipRev) els.chipRev.textContent = 'rev ' + String(state.rev).slice(0, 10) + '（base）';
    if (els.chipCount) els.chipCount.textContent = enabled + ' / ' + ids.length + ' 特效啟用';
    if (els.badge) els.badge.textContent = '已連線 · v' + m.version + (m.version === 2 ? '' : ' 唯讀');
  }

  function zones() {
    var m = state.manifest;
    var ids = Object.keys(m.effects);
    var cur = [];
    var alt = [];
    var seen = {};
    function push(arr, id) {
      if (m.effects[id] && !seen[id]) {
        seen[id] = 1;
        arr.push(id);
      }
    }
    if (m.version === 2) {
      (m.currentEffects || []).forEach(function (id) {
        push(cur, id);
      });
      (m.alternateEffects || []).forEach(function (id) {
        push(alt, id);
      });
      ids.forEach(function (id) {
        push(alt, id);
      });
    } else {
      ids.forEach(function (id) {
        if (m.effects[id] && m.effects[id].enabled !== false) cur.push(id);
        else alt.push(id);
      });
    }
    return { cur: cur, alt: alt };
  }

  function buildItem(id, spec) {
    spec = spec && typeof spec === 'object' ? spec : {};
    var enabled = spec.enabled !== false;
    var item = make('div', '', 'fx-item');
    item.setAttribute('data-fx', id);

    var chk = make('input', '', 'fx-chk');
    chk.type = 'checkbox';
    chk.title = '多選';
    chk.checked = state.batch.indexOf(id) >= 0;

    var grip = make('span', '', 'grip');
    grip.textContent = '⋮⋮';
    grip.title = '拖曳排序';

    var name = make('span', '', 'name');
    name.textContent = spec.label || id;

    var parts = [chk, grip, name];
    if (!enabled) {
      var off = make('span', '', 'off-tag');
      off.textContent = '[未啟用]';
      parts.push(off);
      item.classList.add('disabled');
    }

    var sw = make('label', '', 'switch sm');
    sw.title = '啟用/停用';
    var swIn = make('input', '', '');
    swIn.type = 'checkbox';
    swIn.checked = enabled;
    var slider = make('span', '', 'slider');
    sw.appendChild(swIn);
    sw.appendChild(slider);

    var rm = make('button', '', 'rm');
    rm.title = '移除';
    rm.textContent = '✕';

    parts.push(sw, rm);
    parts.forEach(function (p) {
      item.appendChild(p);
    });

    item.addEventListener('click', function (e) {
      var t = e.target;
      if (t === chk || t === rm || t === sw || t === swIn || t === slider) return;
      // B/7n：切換特效前，若有未 [暫存] 變更（程式碼／manifest 欄位）→確認（避免靜默捨棄）
      var unMsg = unstagedDiscardMsg('切換特效');
      if (id !== state.selected && unMsg && !window.confirm(unMsg)) return;
      selectItem(id);
    });

    grip.draggable = state.editable;
    chk.addEventListener('change', function () {
      toggleBatch(id, chk.checked);
    });
    swIn.addEventListener('change', function () {
      setEnabled(id, swIn.checked);
    });
    rm.addEventListener('click', function () {
      removeEffect(id);
    });
    grip.addEventListener('dragstart', function (e) {
      if (!state.editable) return;
      fxDragId = id;
      item.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        try {
          e.dataTransfer.setData('text/plain', id);
          e.dataTransfer.setDragImage(item, 8, 12);
        } catch (err) {
          // ignore
        }
      }
    });
    grip.addEventListener('dragend', function () {
      fxDragId = null;
      item.classList.remove('dragging');
      clearDragOver();
    });
    return item;
  }

  function buildPendingItem(pd) {
    var item = make('div', '', 'fx-item pending-delete');
    item.setAttribute('data-fx', pd.id);
    var name = make('span', '', 'name');
    name.textContent = (pd.spec && pd.spec.label) || pd.id;
    var tag = make('span', '', 'off-tag');
    tag.textContent = pd.deleteFiles ? '［待刪·含檔案］' : '［待刪］';
    var restore = make('button', '', 'rm restore');
    restore.title = '還原（取消刪除）';
    restore.textContent = '↺';
    restore.addEventListener('click', function () {
      undoPendingDelete(pd);
    });
    item.appendChild(name);
    item.appendChild(tag);
    item.appendChild(restore);
    return item;
  }

  function refreshItem(el, id, spec) {
    spec = spec && typeof spec === 'object' ? spec : {};
    var enabled = spec.enabled !== false;
    if (el.classList) el.classList.toggle('disabled', !enabled);
    var name = el.querySelector('.name');
    if (name) name.textContent = spec.label || id;
    var sw = el.querySelector('.switch');
    var off = el.querySelector('.off-tag');
    if (!enabled && !off) {
      off = make('span', '', 'off-tag');
      off.textContent = '[未啟用]';
      if (sw && sw.parentNode) sw.parentNode.insertBefore(off, sw);
      else el.appendChild(off);
    } else if (enabled && off && off.parentNode) {
      off.parentNode.removeChild(off);
    }
    var swIn = sw ? sw.querySelector('input') : null;
    if (swIn) swIn.checked = !!enabled;
  }

  function selectItem(id) {
    var same = state.selected === id;
    state.selected = id;
    if (preview.running && preview.loadedId !== id) previewStop(true);
    root.querySelectorAll('.fx-item').forEach(function (el) {
      el.classList.toggle('selected', el.getAttribute('data-fx') === id);
    });
    if (els.metaTitle) els.metaTitle.textContent = 'Meta · ' + id;
    if (!same) {
      renderMeta(id);
      renderParams(id);
      clearMiniConsole(); // U15: effect switch → clear the simplified console (until next [start preview])
    }
    setDirtyUI(); // 7m: after effect switch, recalculate the 4-state indicator (clear the unstaged-fields flag when fields sync)
    setEditable(state.editable);
    renderPreviewLabel();
    var tab = activeTab();
    if (tab === 'manifest') {
      renderManifestView();
    } else if (!same) {
      // 切換特效時程式碼預覽（viewer.js/console.js）跟隨重新載入
      loadCodeFile();
    }
  }

  function renderPendingZone() {
    if (!els.zonePending) return;
    for (var i = els.zonePending.children.length - 1; i >= 0; i--) {
      var ch = els.zonePending.children[i];
      if (ch.classList && ch.classList.contains('fx-item')) els.zonePending.removeChild(ch);
    }
    (state.pendingDeletes || []).forEach(function (pd) {
      els.zonePending.appendChild(buildPendingItem(pd));
    });
  }

  function renderList() {
    var m = state.manifest;
    if (!m) return;
    var z = zones();
    var scroller = els.fxList;
    var savedTop = scroller && typeof scroller.scrollTop === 'number' ? scroller.scrollTop : 0;
    // S1：待刪除項移至專屬區，先從主/次區清除殘留
    [els.zoneCur, els.zoneAlt].forEach(function (zoneEl) {
      if (!zoneEl) return;
      for (var i = zoneEl.children.length - 1; i >= 0; i--) {
        var ch = zoneEl.children[i];
        if (ch.classList && ch.classList.contains('pending-delete')) zoneEl.removeChild(ch);
      }
    });
    // 收集既有真實項（排除 pending-delete），依 data-fx 復用 → 就地更新、避免整列重建（P1）
    var existing = {};
    [els.zoneCur, els.zoneAlt].forEach(function (zoneEl) {
      if (!zoneEl) return;
      for (var i = 0; i < zoneEl.children.length; i++) {
        var ch = zoneEl.children[i];
        if (ch.classList && ch.classList.contains('fx-item') && !ch.classList.contains('pending-delete')) {
          existing[ch.getAttribute('data-fx')] = ch;
        }
      }
    });
    function nodeFor(id) {
      var spec = m.effects[id] || {};
      var el = existing[id];
      if (el) refreshItem(el, id, spec);
      else el = buildItem(id, spec);
      return el;
    }
    function layoutZone(zoneEl, headEl, ids) {
      if (!zoneEl) return;
      var nodes = [];
      ids.forEach(function (id) {
        nodes.push(nodeFor(id));
      });
      var targetSet = {};
      nodes.forEach(function (n) {
        targetSet[n.getAttribute('data-fx')] = 1;
      });
      // 移除已不在本區的真實項
      for (var ci = zoneEl.children.length - 1; ci >= 0; ci--) {
        var ch = zoneEl.children[ci];
        if (
          ch.classList &&
          ch.classList.contains('fx-item') &&
          !ch.classList.contains('pending-delete') &&
          !targetSet[ch.getAttribute('data-fx')]
        ) {
          zoneEl.removeChild(ch);
        }
      }
      // 依序排列真實項：僅移動錯位節點（不重建）、保留既有節點與監聽
      var prev = headEl || zoneEl.children[0];
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (!prev) {
          zoneEl.appendChild(node);
        } else if (prev.nextSibling !== node && prev.parentNode) {
          prev.parentNode.insertBefore(node, prev.nextSibling);
        }
        prev = node;
      }
    }
    layoutZone(els.zoneCur, els.zoneCurHead, z.cur);
    layoutZone(els.zoneAlt, els.zoneAltHead, z.alt);
    renderPendingZone();
    // C5：v1 無 currentEffects/alternateEffects，依 enabled 派生→區頭顯示「已啟用/未啟用」；v2 才顯示 layout 名稱
    var v2zone = m.version === 2;
    if (els.zoneCurHead) els.zoneCurHead.textContent = (v2zone ? '主區 · currentEffects（' : '主區 · 已啟用（') + z.cur.length + '）';
    if (els.zoneAltHead) els.zoneAltHead.textContent = (v2zone ? '次區 · alternateEffects（' : '次區 · 未啟用（') + z.alt.length + '）';
    if (els.zonePendingHead) els.zonePendingHead.textContent = '待刪除 / 已刪除（' + (state.pendingDeletes || []).length + '）';
    var sel = state.selected && m.effects[state.selected] ? state.selected : z.cur[0] || z.alt[0];
    if (sel) selectItem(sel);
    else {
      state.selected = null;
      renderPreviewLabel();
    }
    if (scroller && typeof scroller.scrollTop === 'number') scroller.scrollTop = savedTop;
  }

  function setDirtyUI() {
    if (!els.dirty) return;
    // 7d：四態——已同步（clean）／未保存變更（dirty）／未暫存變更（unstaged）／保存中（saving）
    // 優先序 saving > unstaged > dirty > clean：編輯框有未 [暫存] 變更時顯示「未暫存變更」（即便 state.dirty 已為 true）
    // 7m: two-stage indicator—manifest field edits not yet applied via [stage] (unstagedFields) likewise show "unstaged changes"
    var st = state.saving ? 'saving' : (hasUnstagedCode() || state.unstagedFields ? 'unstaged' : (state.dirty ? 'dirty' : 'clean'));
    els.dirty.setAttribute('data-state', st);
    els.dirty.textContent =
      st === 'saving' ? '保存中…'
      : st === 'unstaged' ? '未暫存變更'
      : st === 'dirty' ? '未保存變更'
      : '已同步';
  }

  function setDirty(v) {
    state.dirty = !!v;
    setDirtyUI();
  }

  // 7m: manifest field edit (label/icon/enabled/params card) → fields not yet applied to state.manifest (cleared after [stage])
  function setFieldsUnstaged() {
    state.unstagedFields = true;
    setDirty(true);
  }

  async function postJson(path, body) {
    for (var attempt = 0; attempt < 3; attempt++) {
      var r;
      try {
        r = await fetch(path, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(body || {})
        });
      } catch (e) {
        console.error('[editor] 請求失敗', path);
        return null;
      }
      if (r.status === 429) {
        var ra = 1;
        try {
          var v = r.headers && r.headers.get ? r.headers.get('Retry-After') : null;
          var n = parseFloat(v);
          if (n >= 0) ra = n;
        } catch (e2) {
          // 預設 1 秒
        }
        await sleep(ra * 1000);
        continue;
      }
      if (r.status === 401) {
        setConn(false);
        console.error('[editor] 401 金鑰錯誤');
        return null;
      }
      if (!r.ok) {
        console.error('[editor] 請求失敗', path, r.status);
        return null;
      }
      try {
        return await r.json();
      } catch (e3) {
        return null;
      }
    }
    return null;
  }

  async function reloadManifest() {
    if (state.dirty && !window.confirm('有未保存變更，重載將遺失。放棄變更並重載？')) {
      return;
    }
    await postJson('/api/effects/reload', {});
    await loadManifest();
    previewStop(true); // 7e：[重載] 停止預覽（含暫停中）、清 canvas（舊插件碼不再生效，需重新 [開始預覽]）
    clearMiniConsole(); // U15：[重載] 清除簡化 console 的 icon 及 render（需重新 [開始預覽]）
    // [重載] 後刷新程式碼編輯框（顯示 server 最新版本／或 staged）
    var tab = activeTab();
    if (tab === 'viewer' || tab === 'console') loadCodeFile();
  }

  function openStream() {
    if (typeof EventSource === 'undefined') return;
    if (stream) {
      try {
        stream.close();
      } catch (e) {
        // ignore
      }
      stream = null;
    }
    var key = getSrvKey();
    stream = new EventSource(key ? '/api/stream?key=' + encodeURIComponent(key) : '/api/stream');
    stream.addEventListener('manifest', function (e) {
      state.streamOk = true; // U13：SSE 有送達＝串流正常（獨立於 manifest 連線）
      var d = null;
      try {
        d = JSON.parse(e.data);
      } catch (err) {
        // ignore
      }
      if (d && d.rev && d.rev !== state.baseRev && !state.dirty) loadManifest();
    });
    stream.addEventListener('error', function () {
      // U13：SSE 斷流不影響 manifest 連線（icon/badge 跟隨 manifest、非 SSE）；EventSource 自動重連，僅獨立標記 streamOk
      state.streamOk = false;
    });
  }

  var PARAM_TYPES = ['integer', 'number', 'string', 'color', 'boolean', 'select', 'array'];
  var ARRAY_ITEM_TYPES = ['integer', 'number', 'string', 'color'];

  function setOpsResult(text, kind) {
    if (!els.opsResult) return;
    els.opsResult.textContent = text || '操作結果：尚未執行';
    els.opsResult.classList.remove('err', 'ok');
    if (kind) els.opsResult.classList.add(kind);
  }

  function setWarnings(text, kind) {
    setOpsResult(text, kind);
  }

  function setTestResult(text, kind) {
    setOpsResult(text, kind);
  }

  function defaultToText(spec, type) {
    var d = spec ? spec.default : undefined;
    if (type === 'array') return JSON.stringify(d == null ? [] : d);
    if (type === 'boolean') return d === true ? 'true' : 'false';
    if (d == null) return '';
    return String(d);
  }

  function parseDefault(text, type) {
    var t = (text || '').trim();
    if (type === 'integer') {
      var n = parseInt(t, 10);
      return isNaN(n) ? 0 : n;
    }
    if (type === 'number') {
      var f = parseFloat(t);
      return isNaN(f) ? 0 : f;
    }
    if (type === 'boolean') return t === 'true';
    if (type === 'array') {
      try {
        var a = JSON.parse(t);
        return Array.isArray(a) ? a : [];
      } catch (e) {
        return [];
      }
    }
    return t;
  }

  function readNum(input, asInt) {
    if (!input) return null;
    var v = asInt ? parseInt(input.value, 10) : parseFloat(input.value);
    return isNaN(v) ? null : v;
  }

  // 7j：default 輸入——color 用原生顏色選取器（input type=color）、array 用子項列（＋[+ item]，7k）、其餘為文字
  function buildDefaultInput(spec, type) {
    if (type === 'array') {
      var box = make('span', '', 'p-opts');
      var vals = spec && Array.isArray(spec.default) ? spec.default : [];
      vals.forEach(function (v) {
        box.appendChild(buildOptRow(v, 'remove item'));
      });
      var addIt = make('button', '', 'btn small p-add-opt');
      addIt.textContent = '+ item';
      addIt.addEventListener('click', function () {
        if (!state.editable) return;
        box.appendChild(buildOptRow('', 'remove item'));
        setFieldsUnstaged();
      });
      box.appendChild(addIt);
      return box;
    }
    var inp = make('input', '', 'mono p-default');
    if (type === 'color') {
      inp.type = 'color';
      var d = spec ? spec.default : undefined;
      inp.value = typeof d === 'string' && /^#[0-9a-fA-F]{6}$/.test(d) ? d : '#000000';
    } else {
      inp.type = 'text';
      inp.value = defaultToText(spec, type);
    }
    inp.addEventListener('input', function () { setFieldsUnstaged(); });
    inp.addEventListener('change', function () { setFieldsUnstaged(); });
    return inp;
  }

  function buildOptRow(val, rmTitle) {
    var row = make('span', '', 'p-opt-row');
    var inp = make('input', '', 'mono');
    inp.type = 'text';
    inp.value = val == null ? '' : String(val);
    inp.addEventListener('input', function () { setFieldsUnstaged(); });
    var rm = make('button', '', 'rm sm p-opt-rm');
    rm.textContent = '✕';
    rm.title = rmTitle || 'remove option';
    rm.addEventListener('click', function () {
      if (row.parentNode) row.parentNode.removeChild(row);
      setFieldsUnstaged();
    });
    row.appendChild(inp);
    row.appendChild(rm);
    return row;
  }

  function fillR3(card, spec, type) {
    var r3 = card.querySelector('.p-r3');
    while (r3.children.length > 1) r3.removeChild(r3.lastChild);

    function specItem(labelText) {
      var item = make('span', '', 'spec-item');
      var lab = make('span', '', 'p-k');
      lab.textContent = labelText;
      item.appendChild(lab);
      r3.appendChild(item);
      return item;
    }
    function numInput(cls, value) {
      var inp = make('input', '', 'mono ' + cls);
      inp.type = 'text';
      if (value != null) inp.value = String(value);
      inp.addEventListener('input', function () { setFieldsUnstaged(); });
      inp.addEventListener('change', function () { setFieldsUnstaged(); });
      return inp;
    }

    if (type === 'integer' || type === 'number') {
      var im = specItem('min');
      im.appendChild(numInput('p-min', spec.min));
      var ix = specItem('max');
      ix.appendChild(numInput('p-max', spec.max));
      var is = specItem('step');
      is.appendChild(numInput('p-step', spec.step));
    } else if (type === 'string') {
      var il = specItem('maxLength');
      il.appendChild(numInput('p-maxlen', spec.maxLength));
    } else if (type === 'color' || type === 'boolean') {
      var dim = make('span', '', 'dim');
      dim.textContent = '—';
      r3.appendChild(dim);
    } else if (type === 'select') {
      var iopts = specItem('options');
      var box = make('span', '', 'p-opts');
      var opts = Array.isArray(spec.options) ? spec.options : [];
      opts.forEach(function (v) {
        box.appendChild(buildOptRow(v));
      });
      iopts.appendChild(box);
      var addOpt = make('button', '', 'btn small p-add-opt');
      addOpt.textContent = '+ option';
      addOpt.addEventListener('click', function () {
        if (!state.editable) return;
        box.appendChild(buildOptRow(''));
        setFieldsUnstaged();
      });
      iopts.appendChild(addOpt);
    } else if (type === 'array') {
      var iitems = specItem('items');
      var itSel = make('select', '', 'p-items');
      var op0 = make('option', '', '');
      op0.value = '';
      op0.textContent = '(none)';
      itSel.appendChild(op0);
      ARRAY_ITEM_TYPES.forEach(function (t) {
        var op = make('option', '', '');
        op.value = t;
        op.textContent = t;
        itSel.appendChild(op);
      });
      var itv = typeof spec.items === 'string' ? spec.items : spec.items && spec.items.type;
      itSel.value = ARRAY_ITEM_TYPES.indexOf(itv) >= 0 ? itv : '';
      itSel.addEventListener('change', function () { setFieldsUnstaged(); });
      iitems.appendChild(itSel);
      var imi = specItem('minItems');
      imi.appendChild(numInput('p-minitems', spec.minItems));
      var ima = specItem('maxItems');
      ima.appendChild(numInput('p-maxitems', spec.maxItems));
    }
  }

  function startCardDrag(card) {
    var grip = card.querySelector('.grip');
    if (!grip || !els.pRows) return;
    grip.addEventListener('mousedown', function (ev) {
      if (!state.editable) return;
      ev.preventDefault();
      var rows = els.pRows;
      var startY = ev.clientY;
      var moved = false;

      function onMove(e) {
        moved = true;
        card.classList.add('dragging');
        var cards = Array.prototype.slice.call(rows.querySelectorAll('.p-card'));
        var fromIdx = cards.indexOf(card);
        var dy = e.clientY - startY;
        for (var i = 0; i < cards.length; i++) {
          if (i === fromIdx) continue;
          var rect = cards[i].getBoundingClientRect();
          var mid = rect.top + rect.height / 2;
          if (dy < 0 && i < fromIdx && e.clientY < mid) {
            rows.insertBefore(card, cards[i]);
            break;
          }
          if (dy > 0 && i > fromIdx && e.clientY > mid) {
            rows.insertBefore(card, cards[i].nextSibling);
            break;
          }
        }
      }
      function onUp() {
        card.classList.remove('dragging');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        if (moved) {
          rows.querySelectorAll('.p-card').forEach(function (c, i) {
            c.classList.remove('cA', 'cB');
            c.classList.add(i % 2 === 0 ? 'cA' : 'cB');
          });
          setFieldsUnstaged();
        }
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  function buildParamCard(key, spec) {
    spec = spec && typeof spec === 'object' ? spec : {};
    var type = PARAM_TYPES.indexOf(spec.type) >= 0 ? spec.type : 'string';

    var card = make('div', '', 'p-card');

    var r1 = make('div', '', 'p-r1');
    var grip = make('span', '', 'grip');
    grip.textContent = '⋮⋮';
    var kf = make('span', '', 'p-field');
    var kfLab = make('span', '', 'p-k');
    kfLab.textContent = 'key';
    var keyInp = make('input', '', 'mono p-key');
    keyInp.type = 'text';
    keyInp.value = key || '';
    kf.appendChild(kfLab);
    kf.appendChild(keyInp);
    var ef = make('span', '', 'p-field p-edit-wrap');
    var efLab = make('span', '', 'p-k');
    efLab.textContent = 'editable';
    var sw = make('label', '', 'switch sm');
    var editInp = make('input', '', 'p-editable');
    editInp.type = 'checkbox';
    editInp.checked = spec.editable !== false;
    var slider = make('span', '', 'slider');
    sw.appendChild(editInp);
    sw.appendChild(slider);
    ef.appendChild(efLab);
    ef.appendChild(sw);
    var rm = make('button', '', 'rm p-rm');
    rm.textContent = '✕';
    rm.title = 'remove parameter';
    r1.appendChild(grip);
    r1.appendChild(kf);
    r1.appendChild(ef);
    r1.appendChild(rm);

    var r2 = make('div', '', 'p-r2');
    var lf = make('span', '', 'p-field');
    var lfLab = make('span', '', 'p-k');
    lfLab.textContent = 'label';
    var labelInp = make('input', '', 'p-label');
    labelInp.type = 'text';
    labelInp.value = spec.label || '';
    lf.appendChild(lfLab);
    lf.appendChild(labelInp);
    var tf = make('span', '', 'p-field');
    var tfLab = make('span', '', 'p-k');
    tfLab.textContent = 'type';
    var typeSel = make('select', '', 'p-type');
    PARAM_TYPES.forEach(function (t) {
      var op = make('option', '', '');
      op.value = t;
      op.textContent = t;
      typeSel.appendChild(op);
    });
    typeSel.value = type;
    tf.appendChild(tfLab);
    tf.appendChild(typeSel);
    var df = make('span', '', 'p-field');
    var dfLab = make('span', '', 'p-k');
    dfLab.textContent = 'default';
    var defInp = buildDefaultInput(spec, type);
    df.appendChild(dfLab);
    df.appendChild(defInp);
    r2.appendChild(lf);
    r2.appendChild(tf);
    r2.appendChild(df);

    var r3 = make('div', '', 'p-r3');
    var r3Lab = make('span', '', 'p-spec-label');
    r3Lab.textContent = 'type-specific fields';
    r3.appendChild(r3Lab);
    card.appendChild(r1);
    card.appendChild(r2);
    card.appendChild(r3);
    fillR3(card, spec, type);

    [keyInp, labelInp].forEach(function (inp) {
      inp.addEventListener('input', function () { setFieldsUnstaged(); });
      inp.addEventListener('change', function () { setFieldsUnstaged(); });
    });
    editInp.addEventListener('change', function () { setFieldsUnstaged(); });
    rm.addEventListener('click', function () {
      if (!state.editable) return;
      if (card.parentNode) card.parentNode.removeChild(card);
      setFieldsUnstaged();
    });
    typeSel.addEventListener('change', function () {
      if (!state.editable) return;
      var t = typeSel.value;
      var oldDef = defInp;
      defInp = buildDefaultInput({}, t);
      oldDef.parentNode.replaceChild(defInp, oldDef);
      fillR3(card, {}, t);
      setFieldsUnstaged();
    });
    startCardDrag(card);
    return card;
  }

  function renderParams(id) {
    state.unstagedFields = false; // 7m: DOM redrawn from manifest → fields synced with spec
    if (!els.pRows) return;
    while (els.pRows.children.length > 0) els.pRows.removeChild(els.pRows.lastChild);
    var m = state.manifest;
    var spec = m && m.effects && m.effects[id] && typeof m.effects[id] === 'object' ? m.effects[id] : {};
    var params = spec.params && typeof spec.params === 'object' ? spec.params : {};
    var keys = Object.keys(params);
    if (!keys.length) {
      var empty = make('div', '', 'dim');
      empty.textContent = '(no parameters)';
      els.pRows.appendChild(empty);
    }
    keys.forEach(function (k, i) {
      var card = buildParamCard(k, params[k]);
      card.classList.add(i % 2 === 0 ? 'cA' : 'cB');
      els.pRows.appendChild(card);
    });
  }

  function renderMeta(id) {
    state.unstagedFields = false; // 7m: DOM redrawn from manifest → fields synced with spec
    var m = state.manifest;
    var spec = m && m.effects && m.effects[id] && typeof m.effects[id] === 'object' ? m.effects[id] : {};
    if (els.metaId) els.metaId.value = id;
    if (els.metaLabel) els.metaLabel.value = spec.label || '';
    if (els.metaIcon) els.metaIcon.value = spec.icon || '';
    if (els.chkEnabled) els.chkEnabled.checked = spec.enabled !== false;
    syncMetaIdEditable();
  }

  // U10：effect_id 欄位——僅「新增（尚未存檔）」的特效可改名；已有特效只讀
  // （改名會使 server 以模板重建 viewer.js/console.js→舊碼遺失、舊目錄 orphan，存檔 API 不移目錄）
  function syncMetaIdEditable() {
    if (!els.metaId) return;
    var isNew = !!(state.unsavedNew && state.unsavedNew[state.selected]);
    els.metaId.disabled = !state.editable || !isNew;
    els.metaId.title = isNew
      ? 'effect_id（僅新增特效可改；[暫存] 時檢查合理性）'
      : 'effect_id（已有特效不可改名；改名會重建檔案並遺失舊內容）';
  }

  // id 合理性檢查：回傳 null＝通過，字串＝錯誤訊息（與 server EFFECT_ID_RE 一致）
  function validateId(newId, currentId) {
    if (!newId) return '不可為空';
    if (!EFFECT_ID_RE.test(newId)) return '格式錯誤（限字母／數字／_／-）';
    if (newId !== currentId && state.manifest && state.manifest.effects && state.manifest.effects[newId]) {
      return 'id 已存在：' + newId;
    }
    return null;
  }

  // [存檔] 時套用 effect_id：驗證＋（僅新增特效）re-key。回傳 { ok, err, changed }
  function applyIdRekey() {
    var id = state.selected;
    var newId = els.metaId ? els.metaId.value.trim() : id;
    if (!id || !state.manifest || !state.manifest.effects) return { ok: true, changed: false };
    if (newId === id) return { ok: true, changed: false };
    var verr = validateId(newId, id);
    if (verr) return { ok: false, err: verr };
    if (!state.unsavedNew || !state.unsavedNew[id]) {
      return { ok: false, err: '已有特效不可改名（請以「新增特效」建立）' };
    }
    var m = state.manifest;
    m.effects[newId] = m.effects[id];
    delete m.effects[id];
    ['currentEffects', 'alternateEffects'].forEach(function (k) {
      if (Array.isArray(m[k])) {
        var i = m[k].indexOf(id);
        if (i >= 0) m[k][i] = newId;
      }
    });
    delete state.unsavedNew[id];
    state.unsavedNew[newId] = true;
    state.selected = newId;
    if (els.metaId) els.metaId.value = newId;
    syncMetaIdEditable();
    return { ok: true, changed: true };
  }

  // 把上方欄位（label/icon/enabled/params）套用到 state.manifest（供程式碼預覽即時反映）
  function applyManifestFields() {
    var id = state.selected;
    var m = state.manifest;
    if (!id || !m || !m.effects || !m.effects[id]) return;
    var spec = m.effects[id];
    var label = els.metaLabel ? els.metaLabel.value.trim() : '';
    if (label) spec.label = label;
    else delete spec.label;
    var icon = els.metaIcon ? els.metaIcon.value.trim() : '';
    if (icon) spec.icon = icon;
    else delete spec.icon;
    if (els.chkEnabled) spec.enabled = els.chkEnabled.checked;
    spec.params = collectParams();
    state.unstagedFields = false; // 7m: fields applied to manifest → synced
    setDirtyUI();
  }

  // 新增特效的預設 id／label 流水號：effect-<N>／新特效 <N>（N＝既有 effect-<n> 最大值＋1）
  function nextEffectSerial() {
    var m = state.manifest;
    var ids = m && m.effects ? Object.keys(m.effects) : [];
    var maxN = 0;
    ids.forEach(function (x) {
      var mm = String(x).match(/^effect-(\d+)$/);
      if (mm) {
        var n = parseInt(mm[1], 10);
        if (n > maxN) maxN = n;
      }
    });
    return maxN + 1;
  }

  // 7k：array 參數 default 從 default 欄位的子項列讀取（依 items 型別轉值、空值跳過）
  function readArrayDefault(card) {
    var r3 = card.querySelector('.p-r3');
    var itSel = r3 ? r3.querySelector('.p-items') : null;
    var iv = itSel ? itSel.value : '';
    var arr = [];
    var defBox = card.querySelector('.p-opts');
    if (defBox) {
      defBox.querySelectorAll('.p-opt-row').forEach(function (row) {
        var inp = row.querySelector('input');
        var v = inp ? inp.value.trim() : '';
        if (!v) return;
        if (iv === 'integer') {
          var n = parseInt(v, 10);
          if (!isNaN(n)) arr.push(n);
        } else if (iv === 'number') {
          var f = parseFloat(v);
          if (!isNaN(f)) arr.push(f);
        } else if (iv === 'boolean') {
          arr.push(v === 'true');
        } else {
          arr.push(v);
        }
      });
    }
    return arr;
  }

  function readCardSpec(card) {
    var keyInp = card.querySelector('.p-key');
    var key = keyInp ? keyInp.value.trim() : '';
    if (!key) return null;
    var typeSel = card.querySelector('.p-type');
    var type = typeSel ? typeSel.value : 'string';
    var spec = { type: type };
    var labelInp = card.querySelector('.p-label');
    if (labelInp && labelInp.value.trim()) spec.label = labelInp.value.trim();
    var defInp = card.querySelector('.p-default');
    spec.default = type === 'array' ? readArrayDefault(card) : parseDefault(defInp ? defInp.value : '', type);
    var editInp = card.querySelector('.p-editable');
    spec.editable = editInp ? !!editInp.checked : true;
    var r3 = card.querySelector('.p-r3');
    function num(cls, asInt) {
      return readNum(r3 ? r3.querySelector(cls) : null, asInt);
    }
    if (type === 'integer' || type === 'number') {
      var mn = num('.p-min', type === 'integer');
      var mx = num('.p-max', type === 'integer');
      var st = num('.p-step', false);
      if (mn != null) spec.min = mn;
      if (mx != null) spec.max = mx;
      if (st != null) spec.step = st;
    } else if (type === 'string') {
      var ml = num('.p-maxlen', true);
      if (ml != null) spec.maxLength = ml;
    } else if (type === 'select') {
      var opts = [];
      if (r3) {
        r3.querySelectorAll('.p-opt-row').forEach(function (row) {
          var inp = row.querySelector('input');
          if (inp && inp.value.trim()) opts.push(inp.value.trim());
        });
      }
      spec.options = opts;
    } else if (type === 'array') {
      var itSel = r3 ? r3.querySelector('.p-items') : null;
      var itv = itSel ? itSel.value : '';
      if (itv) spec.items = itv;
      var mi = num('.p-minitems', true);
      var ma = num('.p-maxitems', true);
      if (mi != null) spec.minItems = mi;
      if (ma != null) spec.maxItems = ma;
    }
    return { key: key, spec: spec };
  }

  function collectParams() {
    var out = {};
    if (!els.pRows) return out;
    els.pRows.querySelectorAll('.p-card').forEach(function (card) {
      var r = readCardSpec(card);
      if (r) out[r.key] = r.spec;
    });
    return out;
  }

  function buildManifest() {
    var m = state.manifest;
    if (!m || !m.effects) return null;
    var out = JSON.parse(JSON.stringify(m));
    out.version = 2;
    var id = state.selected;
    if (id && out.effects[id]) {
      var spec = out.effects[id];
      var label = els.metaLabel ? els.metaLabel.value.trim() : '';
      if (label) spec.label = label;
      else delete spec.label;
      var icon = els.metaIcon ? els.metaIcon.value.trim() : '';
      if (icon) spec.icon = icon;
      else delete spec.icon;
      if (els.chkEnabled) spec.enabled = els.chkEnabled.checked;
      spec.params = collectParams();
      // id re-key（僅新增特效、且欄位改動時；[存檔] 未先套用的兜底）
      var newId = els.metaId ? els.metaId.value.trim() : id;
      if (newId && newId !== id && state.unsavedNew && state.unsavedNew[id]) {
        out.effects[newId] = spec;
        delete out.effects[id];
        ['currentEffects', 'alternateEffects'].forEach(function (k) {
          if (Array.isArray(out[k])) {
            var i = out[k].indexOf(id);
            if (i >= 0) out[k][i] = newId;
          }
        });
      }
    }
    return out;
  }

  function setEditable(v) {
    state.editable = !!v;
    function dis(el) {
      if (el) el.disabled = !state.editable;
    }
    dis(els.saveBtn);
    dis(els.addParam);
    dis(els.metaLabel);
    dis(els.metaIcon);
    dis(els.chkEnabled);
    syncMetaIdEditable();
    dis(els.batchEnable);
    dis(els.batchDisable);
    dis(els.batchToCur);
    dis(els.batchToAlt);
    dis(els.addNew);
    dis(els.importEffects);
    dis(els.saveFile);
    dis(els.importFile);
    dis(els.exportFile);
    if (els.pRows) {
      els.pRows.querySelectorAll('input').forEach(function (el) { el.disabled = !state.editable; });
      els.pRows.querySelectorAll('select').forEach(function (el) { el.disabled = !state.editable; });
      els.pRows.querySelectorAll('button').forEach(function (el) { el.disabled = !state.editable; });
    }
    if (els.tabsHint) els.tabsHint.textContent = state.editable ? 'manifest editable (v2)' : 'manifest read-only (v1)';
    syncCodeEditable();
  }

  async function putJson(path, body) {
    for (var attempt = 0; attempt < 3; attempt++) {
      var r;
      try {
        r = await fetch(path, {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify(body)
        });
      } catch (e) {
        return { status: 0, data: null };
      }
      var data = null;
      try {
        data = await r.json();
      } catch (e2) {
        data = null;
      }
      if (r.status === 429) {
        var ra = 1;
        try {
          var v = r.headers && r.headers.get ? r.headers.get('Retry-After') : null;
          var n = parseFloat(v);
          if (n >= 0) ra = n;
        } catch (e3) {
          ra = 1;
        }
        await sleep(ra * 1000);
        continue;
      }
      return { status: r.status, data: data };
    }
    return { status: 429, data: null };
  }

  function keyHeadersOnly() {
    var h = {};
    var key = getSrvKey();
    if (key) h['X-Access-Key'] = key;
    return h;
  }

  async function putManifest(mutator, okMsg) {
    if (!state.editable || state.saving || !state.manifest) return;
    state.saving = true;
    if (els.saveBtn) els.saveBtn.disabled = true;
    setWarnings('保存中…');
    var manifest = JSON.parse(JSON.stringify(state.manifest));
    mutator(manifest);
    var r = await putJson('/api/editor/manifest', {
      manifest: manifest,
      baseRev: state.baseRev,
      deleteRemoved: false
    });
    state.saving = false;
    if (els.saveBtn) els.saveBtn.disabled = !state.editable;
    await handleMutateResponse(r, okMsg);
  }

  async function handleMutateResponse(r, okMsg) {
    if (r.status === 409) {
      await loadManifest();
      setWarnings('409 衝突：manifest 已被修改，已重抓最新', 'err');
      return false;
    }
    if (r.status === 429) {
      setWarnings('429 限流：請稍後再試', 'err');
      return false;
    }
    if (r.status === 401) {
      setConn(false);
      setWarnings('401 金鑰錯誤', 'err');
      return false;
    }
    if (r.status === 0) {
      setWarnings('請求失敗（網路錯誤）', 'err');
      return false;
    }
    if (r.status >= 200 && r.status < 300) {
      await loadManifest();
      var ws = r.data && r.data.warnings;
      if (ws && ws.length) setWarnings('預警：' + ws.join('; '), 'err');
      else setWarnings(okMsg || '保存成功', 'ok');
      return true;
    }
    var detail = r.data && r.data.detail;
    setWarnings('請求失敗 ' + r.status + (detail ? '：' + detail : ''), 'err');
    return false;
  }

  async function delJson(path) {
    for (var attempt = 0; attempt < 3; attempt++) {
      var r;
      try {
        r = await fetch(path, {
          method: 'DELETE',
          headers: headers()
        });
      } catch (e) {
        return { status: 0, data: null };
      }
      var data = null;
      try {
        data = await r.json();
      } catch (e2) {
        data = null;
      }
      if (r.status === 429) {
        var ra = 1;
        try {
          var v = r.headers && r.headers.get ? r.headers.get('Retry-After') : null;
          var n = parseFloat(v);
          if (n >= 0) ra = n;
        } catch (e3) {
          ra = 1;
        }
        await sleep(ra * 1000);
        continue;
      }
      return { status: r.status, data: data };
    }
    return { status: 429, data: null };
  }

  function toggleBatch(id, on) {
    var i = state.batch.indexOf(id);
    if (on && i < 0) state.batch.push(id);
    if (!on && i >= 0) state.batch.splice(i, 1);
    syncBatchUI();
  }

  function syncBatchUI() {
    if (els.batchCount) {
      els.batchCount.textContent = '已選 ' + state.batch.length + ' 項';
    }
    if (els.fxList) {
      els.fxList.querySelectorAll('.fx-item').forEach(function (el) {
        var chk = el.querySelector('.fx-chk');
        if (chk) chk.checked = state.batch.indexOf(el.getAttribute('data-fx')) >= 0;
      });
    }
    var has = state.batch.length > 0;
    if (els.batchEnable) els.batchEnable.disabled = !state.editable || !has;
    if (els.batchDisable) els.batchDisable.disabled = !state.editable || !has;
    if (els.batchToCur) els.batchToCur.disabled = !state.editable || !has;
    if (els.batchToAlt) els.batchToAlt.disabled = !state.editable || !has;
  }

  function setEnabled(id, enabled) {
    if (!state.editable || state.saving) return;
    if (!state.manifest || !state.manifest.effects[id]) return;
    state.manifest.effects[id].enabled = !!enabled;
    if (id === state.selected && els.chkEnabled) els.chkEnabled.checked = !!enabled;
    setDirty(true);
    renderAll();
  }

  function batchApply(field, value) {
    if (!state.editable || state.saving || !state.batch.length) return;
    if (field !== 'enabled') return;
    var m = state.manifest;
    state.batch.forEach(function (id) {
      if (m.effects[id]) m.effects[id].enabled = !!value;
    });
    if (state.selected && state.batch.indexOf(state.selected) >= 0 && els.chkEnabled) {
      els.chkEnabled.checked = !!value;
    }
    setDirty(true);
    renderAll();
  }

  function batchMove(zone) {
    if (!state.editable || state.saving || !state.batch.length) return;
    var m = state.manifest;
    var targetKey = zone === 'alt' ? 'alternateEffects' : 'currentEffects';
    var sourceKey = zone === 'alt' ? 'currentEffects' : 'alternateEffects';
    m[targetKey] = m[targetKey] || [];
    m[sourceKey] = m[sourceKey] || [];
    state.batch.forEach(function (id) {
      var si = m[sourceKey].indexOf(id);
      if (si >= 0) m[sourceKey].splice(si, 1);
      if (m[targetKey].indexOf(id) < 0) m[targetKey].push(id);
    });
    setDirty(true);
    renderAll();
  }

  function removeEffect(id) {
    if (!state.editable || state.saving) return;
    if (!state.manifest || !state.manifest.effects[id]) return;
    var m = state.manifest;
    var spec = m.effects[id];
    var z = zones();
    var zone = z.cur.indexOf(id) >= 0 ? 'cur' : 'alt';
    var arr = zone === 'cur' ? m.currentEffects || [] : m.alternateEffects || [];
    var index = arr.indexOf(id);
    if (index < 0) index = 0;
    delete m.effects[id];
    if (m.currentEffects) {
      var ci = m.currentEffects.indexOf(id);
      if (ci >= 0) m.currentEffects.splice(ci, 1);
    }
    if (m.alternateEffects) {
      var ai = m.alternateEffects.indexOf(id);
      if (ai >= 0) m.alternateEffects.splice(ai, 1);
    }
    state.pendingDeletes.push({
      id: id,
      deleteFiles: true,
      spec: spec,
      zone: zone,
      index: index
    });
    var bi = state.batch.indexOf(id);
    if (bi >= 0) state.batch.splice(bi, 1);
    if (state.unsavedNew) delete state.unsavedNew[id];
    if (state.selected === id) {
      state.selected = null;
      if (preview.running) previewStop(true);
    }
    setDirty(true);
    renderAll();
  }

  function undoPendingDelete(pd) {
    if (!state.editable || state.saving) return;
    if (!state.manifest || !pd) return;
    if (state.manifest.effects[pd.id]) {
      setWarnings('復原失敗：effect_id「' + pd.id + '」已存在，待刪除項保留', 'err');
      return;
    }
    state.manifest.effects[pd.id] = pd.spec;
    var key = pd.zone === 'alt' ? 'alternateEffects' : 'currentEffects';
    if (!Array.isArray(state.manifest[key])) state.manifest[key] = [];
    var at = Math.max(0, Math.min(pd.index || 0, state.manifest[key].length));
    state.manifest[key].splice(at, 0, pd.id);
    state.pendingDeletes = state.pendingDeletes.filter(function (x) {
      return x !== pd;
    });
    setDirty(true);
    renderAll();
  }

  function commitMove(effectId, beforeId, toZone) {
    if (!state.editable || state.saving || !state.manifest) return;
    var m = state.manifest;
    var cur = m.currentEffects || [];
    var alt = m.alternateEffects || [];
    var oldCur = JSON.stringify(cur);
    var oldAlt = JSON.stringify(alt);
    var ci = cur.indexOf(effectId);
    var ai = alt.indexOf(effectId);
    if (ci >= 0) cur.splice(ci, 1);
    if (ai >= 0) alt.splice(ai, 1);
    var target = toZone === 'alt' ? alt : cur;
    if (beforeId) {
      var bi = target.indexOf(beforeId);
      if (bi >= 0) target.splice(bi, 0, effectId);
      else target.push(effectId);
    } else {
      target.push(effectId);
    }
    m.currentEffects = cur;
    m.alternateEffects = alt;
    if (oldCur === JSON.stringify(cur) && oldAlt === JSON.stringify(alt)) return;
    setDirty(true);
    renderAll();
  }

  function newEffect() {
    if (!state.editable || state.saving) return;
    // 7n：有未 [暫存] 變更（程式碼／manifest 欄位）→確認（避免靜默捨棄）
    var unMsg = unstagedDiscardMsg('建立新特效');
    if (unMsg && !window.confirm(unMsg)) return;
    var m = state.manifest;
    m.effects = m.effects || {};
    // U10：無彈出視窗——預設 id＋流水號（effect-<N>／新特效 <N>），改以 effect_id 欄位就地修改
    var n = nextEffectSerial();
    var id = 'effect-' + n;
    while (m.effects[id]) { n += 1; id = 'effect-' + n; }
    var label = '新特效 ' + n;
    m.effects[id] = { label: label, enabled: true, params: {} };
    m.currentEffects = m.currentEffects || [];
    m.alternateEffects = m.alternateEffects || [];
    if (m.currentEffects.indexOf(id) < 0) m.currentEffects.push(id);
    var ai = m.alternateEffects.indexOf(id);
    if (ai >= 0) m.alternateEffects.splice(ai, 1);
    state.pendingDeletes = state.pendingDeletes.filter(function (pd) {
      return pd.id !== id;
    });
    state.unsavedNew = state.unsavedNew || {};
    state.unsavedNew[id] = true;
    state.selected = id;
    setDirty(true);
    renderAll();
    renderMeta(id);
    renderParams(id);
    clearMiniConsole(); // 7m：新特效 → 清空簡化 console（直到下次 [開始預覽]）
    setDirtyUI(); // 7n：meta/params 重繪後重算四態指示（欄位旗標已清→未保存變更）
    // 新特效尚無 viewer.js／console.js → viewer/console tab 同步清空程式碼預覽（404 → 清空、非錯誤）
    if (activeTab() !== 'manifest') loadCodeFile();
  }

  async function exportZip(ids, asFull) {
    if (state.saving) return;
    ids = Array.isArray(ids) ? ids.slice() : [];
    if (!ids.length) {
      setWarnings('匯出失敗：未選取特效', 'err');
      return;
    }
    state.saving = true;
    if (els.saveBtn) els.saveBtn.disabled = true;
    setWarnings('匯出中…');
    var manifest = buildManifest();
    if (!manifest) {
      setWarnings('匯出失敗：manifest 未載入', 'err');
      return;
    }
    var files = [];
    Object.keys(state.pendingCode || {}).forEach(function (key) {
      var f = state.pendingCode[key];
      if (f && f.effectId && f.filename) {
        files.push({ effectId: f.effectId, filename: f.filename, content: f.content });
      }
    });
    var headers = { 'Content-Type': 'application/json' };
    var kh = keyHeadersOnly();
    Object.keys(kh).forEach(function (k) { headers[k] = kh[k]; });
    var r;
    try {
      r = await fetch('/api/editor/export', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          manifest: manifest,
          files: files,
          ids: asFull ? null : ids.join(',')
        })
      });
    } catch (e) {
      state.saving = false;
      if (els.saveBtn) els.saveBtn.disabled = !state.editable;
      setWarnings('匯出失敗（網路錯誤）', 'err');
      return;
    }
    if (!r.ok) {
      state.saving = false;
      if (els.saveBtn) els.saveBtn.disabled = !state.editable;
      var detail = null;
      try {
        var d = await r.json();
        detail = d && d.detail;
      } catch (e2) {
        detail = null;
      }
      setWarnings('匯出失敗 ' + r.status + (detail ? '：' + detail : ''), 'err');
      return;
    }
    var blob = await r.blob();
    state.saving = false;
    if (els.saveBtn) els.saveBtn.disabled = !state.editable;
    var a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = ids.length === 1 ? ids[0] + '.zip' : 'effects.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      window.URL.revokeObjectURL(a.href);
    }, 1000);
    setWarnings('匯出成功', 'ok');
  }

  async function importZip(inputEl) {
    var file = inputEl && inputEl.files && inputEl.files[0];
    if (!file) return;
    inputEl.value = '';
    if (!state.editable || state.saving) {
      setWarnings('匯入不可用（唯讀或保存中）', 'err');
      return;
    }
    // 7n：匯入後選取切到首個匯入 effect→有未 [暫存] 變更（程式碼／manifest 欄位）→確認（避免靜默捨棄）
    var unMsg = unstagedDiscardMsg('匯入');
    if (unMsg && !window.confirm(unMsg)) return;
    var fd = new FormData();
    fd.append('file', file);
    state.saving = true;
    if (els.saveBtn) els.saveBtn.disabled = true;
    setWarnings('匯入中…');
    var r = null;
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        r = await fetch('/api/editor/import?dryRun=true', {
          method: 'POST',
          headers: keyHeadersOnly(),
          body: fd
        });
      } catch (e) {
        r = { status: 0, data: null };
        break;
      }
      var data = null;
      try {
        data = await r.json();
      } catch (e2) {
        data = null;
      }
      if (r.status === 429) {
        var ra = 1;
        try {
          var v = r.headers && r.headers.get ? r.headers.get('Retry-After') : null;
          var n = parseFloat(v);
          if (n >= 0) ra = n;
        } catch (e3) {
          ra = 1;
        }
        await sleep(ra * 1000);
        continue;
      }
      r = { status: r.status, data: data };
      break;
    }
    state.saving = false;
    if (els.saveBtn) els.saveBtn.disabled = !state.editable;
    if (!r) {
      setWarnings('匯入失敗（網路錯誤）', 'err');
      return;
    }
    if (r.status === 0) {
      setWarnings('匯入失敗（網路錯誤）', 'err');
      return;
    }
    if (r.status === 401) {
      setConn(false);
      setWarnings('401 金鑰錯誤', 'err');
      return;
    }
    if (r.status >= 200 && r.status < 300) {
      stageImport(r.data);
      var created = Object.keys((r.data && r.data.importedEffects) || {});
      var firstImported = created.length ? created[0] : null;
      var importLines = firstImported ? await computeCheck(firstImported, ['effects', 'viewer', 'console'], false) : [];
      displayCheck(
        importLines,
        '匯入已暫存' + (created.length ? '：' + created.join(', ') : '') + '（按 [保存至伺服器] 寫入伺服器）'
      );
      return;
    }
    var detail = r.data && r.data.detail;
    setWarnings('匯入失敗 ' + r.status + (detail ? '：' + detail : ''), 'err');
  }

  function stageImport(data) {
    var m = state.manifest;
    if (!m) return;
    m.effects = m.effects || {};
    var imported = (data && data.importedEffects) || {};
    var firstId = null;
    Object.keys(imported).forEach(function (id) {
      m.effects[id] = imported[id];
      if (!firstId) firstId = id;
    });
    var importedLayout = data && data.importedLayout;
    if (importedLayout && importedLayout.currentEffects && importedLayout.alternateEffects) {
      var cur = m.currentEffects || [];
      var alt = m.alternateEffects || [];
      var curSet = {};
      cur.forEach(function (i) { curSet[i] = true; });
      var altSet = {};
      alt.forEach(function (i) { altSet[i] = true; });
      var impCur = {};
      importedLayout.currentEffects.forEach(function (i) { impCur[i] = true; });
      var impAlt = {};
      importedLayout.alternateEffects.forEach(function (i) { impAlt[i] = true; });
      Object.keys(imported).forEach(function (id) {
        if (impCur[id]) {
          if (altSet[id]) {
            var ai = alt.indexOf(id);
            if (ai >= 0) alt.splice(ai, 1);
            delete altSet[id];
          }
          if (!curSet[id]) {
            cur.push(id);
            curSet[id] = true;
          }
        } else if (impAlt[id]) {
          if (curSet[id]) {
            var ci = cur.indexOf(id);
            if (ci >= 0) cur.splice(ci, 1);
            delete curSet[id];
          }
          if (!altSet[id]) {
            alt.push(id);
            altSet[id] = true;
          }
        }
      });
      m.currentEffects = cur;
      m.alternateEffects = alt;
    }
    state.pendingCode = state.pendingCode || {};
    var files = (data && data.files) || {};
    Object.keys(files).forEach(function (key) {
      var parts = key.split('/');
      var effectId = parts[0];
      var filename = parts.slice(1).join('/');
      state.pendingCode[key] = {
        effectId: effectId,
        filename: filename,
        content: files[key]
      };
    });
    setDirty(true);
    state.unstagedFields = false; // 7m: import is a staged operation (not a field edit)
    renderAll();
    if (firstId && state.manifest) selectItem(firstId);
  }

  function clearDragOver() {
    if (!els.fxList) return;
    els.fxList.querySelectorAll('.fx-item').forEach(function (el) {
      el.classList.remove('drop-before', 'drop-after', 'dragging');
    });
    els.fxList.querySelectorAll('.zone-group').forEach(function (el) {
      el.classList.remove('drop-target');
    });
  }

  function initListDrag() {
    if (!els.fxList) return;
    [els.zoneCur, els.zoneAlt].forEach(function (zone) {
      if (!zone) return;
      zone.addEventListener('dragover', function (e) {
        if (!fxDragId) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        clearDragOver();
        var items = Array.prototype.slice.call(zone.querySelectorAll('.fx-item'));
        var beforeEl = null;
        var afterEl = null;
        for (var i = 0; i < items.length; i++) {
          var el = items[i];
          if (el.classList.contains('pending-delete')) continue;
          if (el.getAttribute('data-fx') === fxDragId) continue;
          var rect = el.getBoundingClientRect();
          var midY = rect.top + rect.height / 2;
          if (e.clientY < midY) {
            beforeEl = el;
            break;
          }
          afterEl = el;
        }
        if (beforeEl) {
          beforeEl.classList.add('drop-before');
        } else if (afterEl) {
          afterEl.classList.add('drop-after');
        } else {
          zone.classList.add('drop-target');
        }
      });
      zone.addEventListener('drop', function (e) {
        if (!fxDragId) return;
        e.preventDefault();
        var zoneName = zone === els.zoneAlt ? 'alt' : 'cur';
        var marker = zone.querySelector('.fx-item.drop-before, .fx-item.drop-after');
        var beforeId = null;
        if (marker) {
          if (marker.classList.contains('drop-before')) {
            beforeId = marker.getAttribute('data-fx');
          } else {
            var next = marker.nextElementSibling;
            while (next && next.classList && !next.classList.contains('fx-item')) {
              next = next.nextElementSibling;
            }
            if (next) beforeId = next.getAttribute('data-fx');
          }
        }
        var id = fxDragId;
        clearDragOver();
        commitMove(id, beforeId, zoneName);
      });
    });
  }

  function closeAllDropdowns() {
    root.querySelectorAll('.dd.open').forEach(function (dd) {
      dd.classList.remove('open');
    });
  }

  function initDropdowns() {
    var dds = root.querySelectorAll('.dd');
    dds.forEach(function (dd) {
      var btn = dd.querySelector('button');
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var wasOpen = dd.classList.contains('open');
        closeAllDropdowns();
        if (!wasOpen) dd.classList.add('open');
      });
    });
    if (typeof document.addEventListener === 'function') {
      document.addEventListener('click', function () {
        closeAllDropdowns();
      });
      document.addEventListener('keydown', function (e) {
        if (e && e.key === 'Escape') closeAllDropdowns();
      });
    }
  }

  async function save() {
    if (!state.editable || state.saving) return;
    // U10-4：存檔前檢查 effect_id 合理性（格式／重複／已有特效不可改名）
    var curId = state.selected;
    var newId = els.metaId ? els.metaId.value.trim() : curId;
    if (curId && state.manifest && state.manifest.effects && state.manifest.effects[curId]) {
      var verr = (newId === curId) ? (newId ? null : '不可為空') : validateId(newId, curId);
      if (verr) {
        setWarnings('effect_id 不合理：' + verr, 'err');
        return;
      }
      if (newId !== curId && (!state.unsavedNew || !state.unsavedNew[curId])) {
        setWarnings('effect_id 不合理：已有特效不可改名（請以「新增特效」建立）', 'err');
        return;
      }
    }
    // 7d：保存確認（一律 confirm）；有未暫存變更時明確告知其不會保存到伺服器
    var confirmed = hasUnstagedCode()
      ? window.confirm('有未暫存的程式碼變更：未暫存變更不會保存到伺服器（請先按 [暫存]）。仍要保存至伺服器？')
      : window.confirm('要將目前變更保存至伺服器？');
    if (!confirmed) return;
    var manifest = buildManifest();
    if (!manifest) {
      setWarnings('保存失敗：manifest 未載入', 'err');
      return;
    }
    state.saving = true;
    if (els.saveBtn) els.saveBtn.disabled = true;
    setDirtyUI();
    setWarnings('保存中…');
    var deleteIds = [];
    (state.pendingDeletes || []).forEach(function (pd) {
      if (pd && pd.deleteFiles) deleteIds.push(pd.id);
    });
    var stagedFiles = [];
    Object.keys(state.pendingCode || {}).forEach(function (kpc) {
      var pcv = state.pendingCode[kpc];
      stagedFiles.push({ effectId: pcv.effectId, filename: pcv.filename, content: pcv.content });
    });
    var r = await putJson('/api/editor/manifest', {
      manifest: manifest,
      baseRev: state.baseRev,
      deleteRemoved: deleteIds.length ? deleteIds : false,
      files: stagedFiles
    });
    state.saving = false;
    setDirtyUI();
    if (r.status === 409) {
      await loadManifest();
      setWarnings('409 衝突：manifest 已被修改，已重抓最新', 'err');
    } else if (r.status === 429) {
      setWarnings('429 限流：請稍後再試', 'err');
    } else if (r.status === 401) {
      setConn(false);
      setWarnings('401 金鑰錯誤', 'err');
    } else if (r.status === 0) {
      setWarnings('保存失敗（網路錯誤）', 'err');
    } else if (r.status >= 200 && r.status < 300) {
      state.pendingCode = {};
      // 存檔後強制重新載入 console 插件並刷新列表 icon（rev 隨檔案內容而變，清 cache 確保重抓）
      for (var k in pluginCache) delete pluginCache[k];
      await loadManifest();
      onCodeSaved(state.selected);
      // 7d：保存成功後若目前在 viewer/console tab，重抓檔案更新基準（指標回到「已同步」）
      if (activeTab() === 'viewer' || activeTab() === 'console') await loadCodeFile();
      var ws = (r.data && r.data.warnings) || [];
      if (ws.length) setWarnings('預警：' + ws.join('; '));
      else setWarnings('保存成功', 'ok');
    } else {
      var detail = r.data && r.data.detail;
      setWarnings('保存失敗 ' + r.status + (detail ? '：' + detail : ''), 'err');
    }
    if (els.saveBtn) els.saveBtn.disabled = !state.editable;
  }

  function activeTab() {
    if (!els.tabs) return 'manifest';
    var tabs = els.tabs.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].classList.contains('active')) {
        return tabs[i].getAttribute('data-tab') || 'manifest';
      }
    }
    return 'manifest';
  }

  function importExportLabel(isImport) {
    var tab = activeTab();
    if (tab === 'console') return isImport ? '匯入 console.js' : '匯出 console.js';
    if (tab === 'viewer') return isImport ? '匯入 viewer.js' : '匯出 viewer.js';
    return isImport ? '匯入 effects.json' : '匯出 effects.json';
  }

  function syncCodeEditable() {
    if (!els.code) return;
    var tab = activeTab();
    els.code.readOnly = !state.editable || tab === 'manifest';
    if (els.codeHl) els.codeHl.classList.toggle('is-readonly', !state.editable || tab === 'manifest');
    if (els.importFile) {
      els.importFile.textContent = importExportLabel(true);
      els.importFile.disabled = !state.editable;
    }
    if (els.exportFile) {
      els.exportFile.textContent = importExportLabel(false);
      els.exportFile.disabled = !state.editable || (tab === 'manifest' && !state.selected);
    }
    if (els.checkFile) els.checkFile.disabled = !state.selected;
    if (els.checkAll) els.checkAll.disabled = !state.selected;
  }

  function renderLineNumbers(text) {
    if (!els.codeGutter) return;
    var n = String(text == null ? '' : text).split('\n').length;
    var lines = [];
    for (var i = 1; i <= n; i++) lines.push(String(i));
    (els.codeGutterInner || els.codeGutter).textContent = lines.join('\n');
  }

  // 語法高亮：把 JS/JSON 文字 token 化為帶 class 的 HTML（底層 <pre> 顯示；textarea 文字透明）
  var CODE_TOKEN_RE = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(if|else|for|while|do|switch|case|break|continue|return|try|catch|finally|throw|typeof|in|of|instanceof|delete|void)\b|\b(const|let|var|function|class|import|export|from|new|await|async|this|super|static|true|false|null|undefined)\b|\b(console|document|window|Math|JSON|Object|Array|Promise)\b|(\b0[xX][0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b)/g;
  function highlightJs(text) {
    var esc = String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    if (esc.charAt(esc.length - 1) === '\n') esc += ' ';
    return esc.replace(CODE_TOKEN_RE, function (m, comment, str, control, keyword, fn, num) {
      if (comment) return '<span class="tok-comment">' + m + '</span>';
      if (str) return '<span class="tok-string">' + m + '</span>';
      if (control) return '<span class="tok-control">' + m + '</span>';
      if (keyword) return '<span class="tok-keyword">' + m + '</span>';
      if (fn) return '<span class="tok-function">' + m + '</span>';
      if (num) return '<span class="tok-number">' + m + '</span>';
      return m;
    });
  }

  function renderHighlight() {
    if (!els.codeHlCode) return;
    els.codeHlCode.innerHTML = highlightJs(els.code ? els.code.value : '');
  }

  // 底層高亮／行號改用 transform 平移同步（不經 scrollTop，避免 scrollbar 佔位造成 maxScroll clamp 錯位）
  function syncCodeScroll() {
    if (!els.code) return;
    var x = els.code.scrollLeft || 0;
    var y = els.code.scrollTop || 0;
    if (els.codeHlCode) els.codeHlCode.style.transform = 'translate(' + (0 - x) + 'px, ' + (0 - y) + 'px)';
    if (els.codeGutterInner) els.codeGutterInner.style.transform = 'translateY(' + (0 - y) + 'px)';
  }

  function showCode(text) {
    if (!els.code) return;
    els.code.value = text == null ? '' : String(text);
    syncCodeEditable();
    renderLineNumbers(els.code.value);
    renderHighlight();
    syncCodeScroll();
    var ct = activeTab();
    state.codeLoaded = {
      id: state.selected,
      filename: ct === 'viewer' ? 'viewer.js' : (ct === 'console' ? 'console.js' : null),
      content: els.code.value
    };
    setDirtyUI(); // 7d：基準更新（載入／保存成功後）→ 指標反映有無未暫存變更
  }

  // 目前程式碼編輯框（viewer/console tab）是否有「未 [暫存]」的變更（內容異於載入基準）
  function hasUnstagedCode() {
    if (!els.code || !state.codeLoaded) return false;
    var b = state.codeLoaded;
    if (!b.filename) return false;
    if (state.selected !== b.id) return false;
    var tab = activeTab();
    if (b.filename === 'viewer.js' && tab !== 'viewer') return false;
    if (b.filename === 'console.js' && tab !== 'console') return false;
    var val = els.code.value;
    var staged = (state.pendingCode || {})[b.id + '/' + b.filename];
    if (staged && typeof staged.content === 'string' && staged.content === val) return false;
    return val !== b.content;
  }

  // 7n：有「未 [暫存]」變更（程式碼／manifest 欄位）時，會捨棄它們的動作→確認訊息（無則回 null）
  function unstagedDiscardMsg(action) {
    var c = hasUnstagedCode();
    var f = !!state.unstagedFields;
    if (!c && !f) return null;
    var what;
    if (c && f) what = '程式碼和 manifest 欄位變更';
    else if (c) what = '程式碼變更';
    else what = ' manifest 欄位變更';
    return '有未暫存的' + what + '，' + action + '將捨棄。確定繼續？';
  }

  // E5：code preview rev-keyed cache（id/filename → {content,rev}）——同 rev（檔案內容未變）免重複 GET
  var codeCache = {};

  function codeFilePath() {
    var name = activeTab();
    if (name !== 'viewer' && name !== 'console') return null;
    if (!state.manifest || !state.selected) return null;
    if (!state.manifest.effects[state.selected]) return null;
    return '/api/editor/effect/' + state.selected + '/' + (name === 'viewer' ? 'viewer.js' : 'console.js');
  }

  async function loadCodeFile() {
    var path = codeFilePath();
    if (!path) {
      showCode('');
      setWarnings('請先選擇特效', 'err');
      return;
    }
    var id = state.selected;
    var filename = activeTab() === 'viewer' ? 'viewer.js' : 'console.js';
    // 已 [存檔] staged 的檔案 → 直接顯示 staged 內容（不 fetch、切換特效不遺忘變更）
    var staged = (state.pendingCode || {})[id + '/' + filename];
    if (staged && typeof staged.content === 'string') {
      showCode(staged.content);
      setWarnings('（' + id + ' 顯示 [暫存] 的 staged 內容，按 [保存至伺服器] 寫入伺服器）');
      return;
    }
    // E5：rev-keyed cache——同 id 同 rev（檔案內容未變）→ 由 cache 顯示，免重複 GET
    var spec = state.manifest.effects[id];
    var crev = (spec && (filename === 'viewer.js' ? spec.viewerRev : spec.consoleRev)) || state.rev || '';
    var cached = codeCache[id + '/' + filename];
    if (cached && cached.rev === crev) {
      showCode(cached.content);
      return;
    }
    var r;
    try {
      r = await fetch(path, { headers: keyHeadersOnly() });
    } catch (e) {
      showCode('');
      setWarnings('載入失敗（網路錯誤）', 'err');
      return;
    }
    if (!r.ok) {
      if (r.status === 404) {
        // 特效尚無此檔案（新增特效）→ 直接套用 server 模板（不落盤、不改 server 檔案）
        var tr;
        try {
          tr = await fetch(path + '?template=true', { headers: keyHeadersOnly() });
        } catch (e) {
          showCode('');
          setWarnings('載入失敗（網路錯誤）', 'err');
          return;
        }
        if (!tr.ok) {
          var td = null;
          try {
            var t2 = await tr.json();
            td = t2 && t2.detail;
          } catch (e3) {
            td = null;
          }
          showCode('');
          setWarnings('載入失敗 ' + tr.status + (td ? '：' + td : ''), 'err');
          return;
        }
        var ttext = await tr.text();
        codeCache[id + '/' + filename] = { content: ttext, rev: crev };
        showCode(ttext);
        setWarnings('（' + id + ' 套用 ' + filename + ' 模板，[暫存]／[保存至伺服器]後寫入伺服器）');
        return;
      }
      var detail = null;
      try {
        var d = await r.json();
        detail = d && d.detail;
      } catch (e2) {
        detail = null;
      }
      showCode('');
      setWarnings('載入失敗 ' + r.status + (detail ? '：' + detail : ''), 'err');
      return;
    }
    var ftext = await r.text();
    codeCache[id + '/' + filename] = { content: ftext, rev: crev };
    showCode(ftext);
  }

  async function saveFile() {
    if (!state.editable) return;
    var tab = activeTab();
    // 先套用 effect_id（manifest 層、任何 tab 皆適用）＋合理性檢查（U10-4）
    var idRes = applyIdRekey();
    if (!idRes.ok) {
      setWarnings('effect_id 不合理：' + idRes.err, 'err');
      return;
    }
    // manifest（effects.json）tab：把上方欄位套用到 state.manifest＋刷新程式碼預覽（Task3-2）
    if (tab === 'manifest') {
      applyManifestFields();
      setDirty(true);
      renderAll();
      renderMeta(state.selected);
      renderParams(state.selected);
      renderManifestView();
      setWarnings('effects.json 欄位已套用（按 [保存至伺服器] 寫入伺服器）', 'ok');
      return;
    }
    // viewer/console tab：id 若剛改過→重繪列表＋以新 id 重新載入程式碼（內容須與新 register id 一致）
    if (idRes.changed) {
      renderAll();
      await loadCodeFile();
    }
    var path = codeFilePath();
    if (!path) {
      setWarnings('沒有可暫存的檔案', 'err');
      return;
    }
    var id = state.selected;
    var filename = tab === 'viewer' ? 'viewer.js' : 'console.js';
    // viewer.js 為 enabled 特效必備 → 不可存空（console.js 可清空＝無 console 插件）
    if (filename === 'viewer.js' && !String(els.code.value).trim()) {
      setWarnings('viewer.js 不可為空（如需停用請取消啟用或 [✕ 移除] 特效）', 'err');
      return;
    }
    state.pendingCode = state.pendingCode || {};
    state.pendingCode[id + '/' + filename] = {
      effectId: id,
      filename: filename,
      content: els.code.value
    };
    setDirty(true);
    if (filename === 'console.js') {
      applyStagedConsole(id, state.pendingCode[id + '/' + filename].content);
    }
    setWarnings('code 已暫存（按 [保存至伺服器] 寫入伺服器）', 'ok');
  }

  function importFile() {
    if (!state.editable || state.saving) return;
    if (els.fileImportFile) {
      els.fileImportFile.accept = activeTab() === 'manifest' ? '.json' : '.js';
      els.fileImportFile.click();
    }
  }

  async function doImportFile(inputEl) {
    if (activeTab() === 'manifest') {
      doImportEntry(inputEl);
      return;
    }
    var file = inputEl && inputEl.files && inputEl.files[0];
    if (!file) return;
    inputEl.value = '';
    if (!state.editable || state.saving) {
      setWarnings('匯入不可用（唯讀或保存中）', 'err');
      return;
    }
    var text;
    try {
      text = await file.text();
    } catch (e) {
      setWarnings('匯入失敗：無法讀取檔案', 'err');
      return;
    }
    showCode(text);
    await saveFile();
    // 匯入 .js 後對該檔跑格式檢查（staged/編輯框內容、不 fetch）——與 doImportEntry 匯入 .json 行為一致（U12）
    var impId = state.selected;
    if (impId && state.manifest) {
      var impKind = activeTab() === 'viewer' ? 'viewer' : 'console';
      var impLines = await computeCheck(impId, [impKind], false);
      displayCheck(impLines, '匯入 ' + impId + '/' + (impKind === 'viewer' ? 'viewer.js' : 'console.js') + '（staged，按[保存至伺服器]寫入）');
    }
  }

  function selectedEffectFileJson() {
    var id = state.selected;
    if (!id || !state.manifest || !state.manifest.effects) return null;
    var spec = state.manifest.effects[id];
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null;
    // 匯出為完整 v2 迷你 manifest：補上 currentEffects/alternateEffects（依 enabled 派生），
    // 避免缺 layout 鍵而被視為格式錯誤（v2 manifest 必備此二鍵）
    var enabled = spec.enabled !== false;
    var payload = {
      version: 2,
      currentEffects: enabled ? [id] : [],
      alternateEffects: enabled ? [] : [id],
      effects: {}
    };
    payload.effects[id] = spec;
    return { id: id, json: JSON.stringify(payload, null, 2) + '\n' };
  }

  function entryIdFromFilename(name) {
    var n = String(name || '');
    var m = n.match(/^(.+?)\.effects\.json$/i);
    var stem = m ? m[1] : n.replace(/\.json$/i, '');
    if (!/^[A-Za-z0-9_-]+$/.test(stem)) return null;
    return stem;
  }

  async function doImportEntry(inputEl) {
    var file = inputEl && inputEl.files && inputEl.files[0];
    if (!file) return;
    inputEl.value = '';
    if (!state.editable || state.saving) {
      setWarnings('匯入不可用（唯讀或保存中）', 'err');
      return;
    }
    // 7n：匯入後選取切到匯入 effect→有未 [暫存] 變更（程式碼／manifest 欄位）→確認（避免靜默捨棄）
    var unMsg = unstagedDiscardMsg('匯入');
    if (unMsg && !window.confirm(unMsg)) return;
    var text;
    try {
      text = await file.text();
    } catch (e) {
      setWarnings('匯入失敗：無法讀取檔案', 'err');
      return;
    }
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      setWarnings('匯入失敗：JSON 格式錯誤', 'err');
      return;
    }
    var entries = null;
    if (
      data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      data.effects &&
      typeof data.effects === 'object' &&
      !Array.isArray(data.effects)
    ) {
      entries = data.effects;
    } else if (data && typeof data === 'object' && !Array.isArray(data)) {
      var fid = entryIdFromFilename(file.name);
      if (!fid) {
        setWarnings('匯入失敗：缺少 effect id（檔名需為 <id>.effects.json）', 'err');
        return;
      }
      entries = {};
      entries[fid] = data;
    } else {
      setWarnings('匯入失敗：effects JSON 格式錯誤', 'err');
      return;
    }
    var ids = Object.keys(entries);
    if (!ids.length) {
      setWarnings('匯入失敗：無特效項目', 'err');
      return;
    }
    if (ids.length > 1) {
      setWarnings('匯入失敗：匯入 effects.json 只能含 1 個特效（現為 ' + ids.length + ' 個）', 'err');
      return;
    }
    for (var i = 0; i < ids.length; i++) {
      if (!/^[A-Za-z0-9_-]+$/.test(ids[i])) {
        setWarnings('匯入失敗：effect id 不合理：' + ids[i], 'err');
        return;
      }
      var entry = entries[ids[i]];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        setWarnings('匯入失敗：特效項目不合法：' + ids[i], 'err');
        return;
      }
    }
    // effects.json（單項）tab 匯入：單一 entry（raw 或只含 1 個 effect 的 wrapper）一律改寫成「選定特效」id，
    // 避免以檔名/wrapper key 意外新增特效；要新增特效請用 [＋新增特效]／[匯入 effects.zip]。
    if (state.selected && ids.length === 1 && state.selected !== ids[0]) {
      var rekeyId = state.selected;
      entries[rekeyId] = entries[ids[0]];
      delete entries[ids[0]];
      ids = [rekeyId];
    }
    var m = state.manifest;
    m.effects = m.effects || {};
    ids.forEach(function (id) {
      m.effects[id] = JSON.parse(JSON.stringify(entries[id]));
    });
    state.pendingDeletes = state.pendingDeletes.filter(function (pd) {
      return ids.indexOf(pd.id) < 0;
    });
    setDirty(true);
    renderAll();
    // 選取第一個匯入 effect → [manifest 編輯]（meta/params）與程式碼預覽同步為匯入結果
    // （僅編輯器前端 staged 變更，按[保存]才寫入 server 檔案）
    var targetId = ids[0];
    var wasSelected = state.selected === targetId;
    selectItem(targetId);
    if (wasSelected) {
      // 原本即選定時 selectItem 會略過 meta/params 重繪 → 補上（匯入可能已變更數值）
      renderMeta(targetId);
      renderParams(targetId);
    }
    // 匯入後對該特效的 3 個檔案（effects.json entry＋viewer.js＋console.js）跑格式檢查（只用 staged 內容、不 fetch）
    var importLines = await computeCheck(targetId, ['effects', 'viewer', 'console'], false);
    displayCheck(importLines, '匯入 ' + ids.join(', ') + '（staged，按[保存至伺服器]寫入）');
  }

  // ---- 格式檢查（輕量：語法＋註冊＋結構；參考 tests/test_effect_catalog.mjs）----
  var CHECK_PARAM_TYPES = { integer: 1, number: 1, string: 1, color: 1, boolean: 1, select: 1, array: 1 };
  var CHECK_COLOR_RE = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;
  var CHECK_EFFECT_FIELDS = { label: 1, category: 1, icon: 1, viewer: 1, console: 1, params: 1, enabled: 1 };
  var CHECK_PARAM_FIELDS = { type: 1, label: 1, default: 1, min: 1, max: 1, step: 1, editable: 1, maxLength: 1, options: 1, items: 1, minItems: 1, maxItems: 1 };

  function checkIsPlainObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  }

  function checkParam(id, key, spec, errors, warnings) {
    if (!/^[A-Za-z0-9_-]+$/.test(key)) { errors.push(id + '：param key ' + key + ' 無效'); return; }
    if (!checkIsPlainObject(spec)) { errors.push(id + '：param ' + key + ' 必須是 object'); return; }
    Object.keys(spec).forEach(function (f) {
      if (!CHECK_PARAM_FIELDS[f]) warnings.push(id + '：param ' + key + ' 未知欄位 ' + f);
    });
    if (!CHECK_PARAM_TYPES[spec.type]) { errors.push(id + '：param ' + key + ' 不支援的 type：' + spec.type); return; }
    if (!('default' in spec)) { errors.push(id + '：param ' + key + ' 缺少 default'); return; }
    if ('editable' in spec && typeof spec.editable !== 'boolean') errors.push(id + '：param ' + key + ' 的 editable 必須是 boolean');
    if (spec.type === 'integer' || spec.type === 'number') {
      if (typeof spec.default !== 'number' || !isFinite(spec.default)) errors.push(id + '：param ' + key + ' 的 default 必須是有限數字');
      else {
        if (spec.type === 'integer' && !Number.isInteger(spec.default)) errors.push(id + '：param ' + key + ' 的 default 必須是整數');
        if ('min' in spec && (typeof spec.min !== 'number' || spec.default < spec.min)) errors.push(id + '：param ' + key + ' 的 default 低於 min');
        if ('max' in spec && (typeof spec.max !== 'number' || spec.default > spec.max)) errors.push(id + '：param ' + key + ' 的 default 高於 max');
      }
    }
    if (spec.type === 'string' && typeof spec.default !== 'string') errors.push(id + '：param ' + key + ' 的 default 必須是 string');
    if (spec.type === 'color' && (typeof spec.default !== 'string' || !CHECK_COLOR_RE.test(spec.default))) errors.push(id + '：param ' + key + ' 的 default 必須是 #rrggbb');
    if (spec.type === 'boolean' && typeof spec.default !== 'boolean') errors.push(id + '：param ' + key + ' 的 default 必須是 boolean');
    if (spec.type === 'select') {
      if (!Array.isArray(spec.options) || !spec.options.length) errors.push(id + '：param ' + key + ' select 需要 options');
      else {
        var vals = [];
        spec.options.forEach(function (o) { vals.push(checkIsPlainObject(o) && 'value' in o ? o.value : o); });
        if (vals.indexOf(spec.default) < 0) errors.push(id + '：param ' + key + ' 的 default 不在 options');
      }
    }
    if (spec.type === 'array' && !Array.isArray(spec.default)) errors.push(id + '：param ' + key + ' 的 default 必須是陣列');
  }

  function checkEffectsEntry(id, entry, errors, warnings) {
    if (!checkIsPlainObject(entry)) { errors.push(id + '：effects.json entry 必須是 object'); return; }
    Object.keys(entry).forEach(function (f) {
      if (!CHECK_EFFECT_FIELDS[f]) warnings.push(id + '：未知欄位 ' + f);
    });
    if ('label' in entry && (typeof entry.label !== 'string' || entry.label.length === 0)) errors.push(id + '：label 必須是非空 string');
    if ('category' in entry && typeof entry.category !== 'string') errors.push(id + '：category 必須是 string');
    if ('icon' in entry && typeof entry.icon !== 'string') errors.push(id + '：icon 必須是 string');
    if ('enabled' in entry && typeof entry.enabled !== 'boolean') errors.push(id + '：enabled 必須是 boolean');
    if ('viewer' in entry && entry.viewer !== 'viewer.js') errors.push(id + '：viewer 必須是 viewer.js');
    if ('console' in entry && entry.console !== 'console.js') errors.push(id + '：console 必須是 console.js');
    var params = 'params' in entry ? entry.params : {};
    if (!checkIsPlainObject(params)) errors.push(id + '：params 必須是 object');
    else Object.keys(params).forEach(function (k) { checkParam(id, k, params[k], errors, warnings); });
  }

  function checkMakeDom() {
    function makeEl() {
      var target = { tagName: 'DIV', children: [], style: {}, value: '', textContent: '', checked: false, type: '', id: '', className: '' };
      target.appendChild = function (c) { target.children.push(c); return c; };
      target.classList = { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } };
      if (typeof Proxy === 'undefined') return target;
      return new Proxy(target, {
        get: function (obj, prop) {
          if (prop in obj) return obj[prop];
          if (prop === 'then' || prop === 'toJSON' || prop === 'utilInspect') return undefined;
          return function () { return makeEl(); };
        },
        set: function (obj, prop, value) { obj[prop] = value; return true; }
      });
    }
    var docTarget = {
      createElement: makeEl,
      createElementNS: makeEl,
      getElementById: makeEl,
      querySelector: makeEl,
      querySelectorAll: function () { return []; },
      body: makeEl(),
      documentElement: makeEl(),
      head: makeEl()
    };
    if (typeof Proxy === 'undefined') return docTarget;
    return new Proxy(docTarget, {
      get: function (obj, prop) {
        if (prop in obj) return obj[prop];
        if (prop === 'then' || prop === 'toJSON') return undefined;
        return function () { return makeEl(); };
      },
      set: function (obj, prop, value) { obj[prop] = value; return true; }
    });
  }

  function checkRunSource(source, registryName) {
    var registrations = [];
    var sandboxWindow = {};
    if (registryName === 'Effects') {
      sandboxWindow.Effects = { register: function (id, factory) { registrations.push({ id: id, factory: factory }); } };
    } else {
      sandboxWindow.RTX_EFFECT_CONSOLE = { register: function (id, plugin) { registrations.push({ id: id, plugin: plugin }); } };
    }
    var doc = checkMakeDom();
    try {
      var fn = new Function('window', 'document', 'console', source);
      fn(sandboxWindow, doc, console);
    } catch (e) {
      return { error: e && e.message ? e.message : String(e), registrations: registrations };
    }
    return { registrations: registrations };
  }

  function checkSourceWarns(file, source, warnings) {
    if (/\bimport\b/.test(source)) warnings.push(file + '：使用 import');
    if (/\bexport\b/.test(source)) warnings.push(file + '：使用 export');
    if (/\brequire\s*\(/.test(source)) warnings.push(file + '：使用 require');
    if (/\bfetch\s*\(/.test(source)) warnings.push(file + '：使用 fetch');
    if (/XMLHttpRequest/.test(source)) warnings.push(file + '：使用 XMLHttpRequest');
    if (/\bWebSocket\b/.test(source)) warnings.push(file + '：使用 WebSocket');
  }

  // S3：預覽前危險 API 掃描——插件碼以 new Function 於當前 realm 執行（非隔離），可觸及頁面金鑰
  // （localStorage['rtx.editor.srvKey']）/cookie/網路。對引用這些 API 者於結果區非阻斷提示（仍執行）；
  // 本地可信工具，請勿預覽／測試不信任代碼。
  var PREVIEW_DANGEROUS_APIS = [
    [/\blocalStorage\b/, 'localStorage（server 金鑰）'],
    [/\bsessionStorage\b/, 'sessionStorage'],
    [/\bdocument\.cookie\b/, 'document.cookie'],
    [/\bfetch\s*\(/, 'fetch'],
    [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
    [/\bWebSocket\b/, 'WebSocket'],
    [/\bsendBeacon\s*\(/, 'sendBeacon'],
    [/\beval\s*\(/, 'eval'],
    [/\bnew\s+Function\b/, 'new Function'],
    [/\blocation\b/, 'location']
  ];
  function previewDangerScan(source) {
    var s = String(source == null ? '' : source);
    var hits = [];
    PREVIEW_DANGEROUS_APIS.forEach(function (p) {
      if (p[0].test(s)) hits.push(p[1]);
    });
    return hits;
  }
  function previewDangerWarn(fileLabel, source) {
    var hits = previewDangerScan(source);
    if (hits.length) {
      setWarnings('預覽預警：' + fileLabel + ' 引用 ' + hits.join('、') + '（可存取頁面金鑰/cookie/網路）。本地可信工具，請僅預覽可信代碼', 'err');
    }
  }

  function checkDefaultsFromEntry(entry) {
    var out = {};
    var params = checkIsPlainObject(entry && entry.params) ? entry.params : {};
    Object.keys(params).forEach(function (k) {
      if (checkIsPlainObject(params[k]) && 'default' in params[k]) out[k] = params[k].default;
    });
    return out;
  }

  function checkViewerSource(id, source, entry, errors, warnings) {
    source = String(source == null ? '' : source);
    checkSourceWarns(id + '/viewer.js', source, warnings);
    var res = checkRunSource(source, 'Effects');
    if (res.error) { errors.push(id + '：viewer.js 執行/語法錯誤：' + res.error); return; }
    if (res.registrations.length !== 1) {
      errors.push(id + '：viewer.js 必須恰好呼叫一次 window.Effects.register（找到 ' + res.registrations.length + '）');
      return;
    }
    var reg = res.registrations[0];
    if (reg.id !== id) errors.push(id + '：viewer.js 註冊 id 為 ' + reg.id + '，應為 ' + id);
    if (typeof reg.factory !== 'function') { errors.push(id + '：viewer.js register factory 必須是 function'); return; }
    var fx;
    try { fx = reg.factory(0, 0, checkDefaultsFromEntry(entry)); }
    catch (e) { errors.push(id + '：viewer.js factory 執行錯誤：' + (e && e.message)); return; }
    if (!checkIsPlainObject(fx)) { errors.push(id + '：viewer.js factory 必須回傳 object'); return; }
    ['update', 'draw', 'done'].forEach(function (fn) {
      if (typeof fx[fn] !== 'function') errors.push(id + '：viewer.js factory 回傳缺少 ' + fn);
    });
  }

  function checkConsoleSource(id, source, entry, errors, warnings) {
    source = String(source == null ? '' : source);
    checkSourceWarns(id + '/console.js', source, warnings);
    var res = checkRunSource(source, 'RTX_EFFECT_CONSOLE');
    if (res.error) { errors.push(id + '：console.js 執行/語法錯誤：' + res.error); return; }
    if (res.registrations.length !== 1) {
      errors.push(id + '：console.js 必須恰好呼叫一次 window.RTX_EFFECT_CONSOLE.register（找到 ' + res.registrations.length + '）');
      return;
    }
    var reg = res.registrations[0];
    if (reg.id !== id) errors.push(id + '：console.js 註冊 id 為 ' + reg.id + '，應為 ' + id);
    if (!checkIsPlainObject(reg.plugin)) { errors.push(id + '：console.js register plugin 必須是 object'); return; }
    if (typeof reg.plugin.render !== 'function') errors.push(id + '：console.js plugin 缺少 render function');
    if (
      typeof reg.plugin.iconID === 'string' &&
      typeof window.RTX_EFFECT_ICONS !== 'undefined' &&
      window.RTX_EFFECT_ICONS &&
      !Object.prototype.hasOwnProperty.call(window.RTX_EFFECT_ICONS, reg.plugin.iconID)
    ) {
      warnings.push(id + '：console.js iconID 不是有效的 RTX_EFFECT_ICONS key');
    }
  }

  function checkCurrentFileKind() {
    var tab = activeTab();
    if (tab === 'viewer') return 'viewer';
    if (tab === 'console') return 'console';
    return 'effects';
  }

  function checkEntry(id) {
    return state.manifest && state.manifest.effects && state.manifest.effects[id] ? state.manifest.effects[id] : null;
  }

  async function checkContent(id, filename, allowFetch) {
    var tab = activeTab();
    if ((tab === 'viewer' && filename === 'viewer.js') || (tab === 'console' && filename === 'console.js')) {
      return els.code ? els.code.value : null;
    }
    var pc = state.pendingCode;
    if (pc && pc[id + '/' + filename]) return pc[id + '/' + filename].content;
    if (!allowFetch) return null;
    var path = '/api/editor/effect/' + encodeURIComponent(id) + '/' + filename;
    var r;
    try { r = await fetch(path, { headers: keyHeadersOnly() }); }
    catch (e) { return null; }
    if (!r.ok) return null;
    return await r.text();
  }

  function checkFmt(label, errors, warnings) {
    if (errors.length) return label + '：' + errors.length + ' 錯 — ' + errors.join('；');
    if (warnings.length) return label + '：' + warnings.length + ' 警 — ' + warnings.join('；');
    return label + '：OK';
  }

  async function computeCheck(id, files, allowFetch) {
    var lines = [];
    var entry = checkEntry(id);
    var i;
    for (i = 0; i < files.length; i++) {
      var which = files[i];
      if (which === 'effects') {
        if (!entry) { lines.push('effects.json：無 entry'); continue; }
        var eErr = []; var eWarn = [];
        checkEffectsEntry(id, entry, eErr, eWarn);
        lines.push(checkFmt('effects.json', eErr, eWarn));
      } else if (which === 'viewer') {
        var vs = await checkContent(id, 'viewer.js', allowFetch);
        if (vs == null) { lines.push('viewer.js：（無內容，略過）'); continue; }
        var vErr = []; var vWarn = [];
        checkViewerSource(id, vs, entry, vErr, vWarn);
        lines.push(checkFmt('viewer.js', vErr, vWarn));
      } else if (which === 'console') {
        var cs = await checkContent(id, 'console.js', allowFetch);
        if (cs == null) { lines.push('console.js：（無內容，略過）'); continue; }
        var cErr = []; var cWarn = [];
        checkConsoleSource(id, cs, entry, cErr, cWarn);
        lines.push(checkFmt('console.js', cErr, cWarn));
      }
    }
    return lines;
  }

  function displayCheck(lines, prefix) {
    var hasErr = lines.some(function (l) { return l.indexOf('錯') !== -1 || l.indexOf('無 entry') !== -1; });
    var hasWarn = lines.some(function (l) { return l.indexOf('警') !== -1 || l.indexOf('無內容') !== -1; });
    var kind = hasErr ? 'err' : (hasWarn ? null : 'ok');
    var text = (prefix ? prefix + '\n' : '') + '檢查格式\n' + lines.join('\n');
    setWarnings(text, kind);
  }

  async function checkSingleFile() {
    var id = state.selected;
    if (!id || !state.manifest) { setWarnings('檢查格式：請先選擇特效', 'err'); return; }
    var lines = await computeCheck(id, [checkCurrentFileKind()], true);
    displayCheck(lines);
  }

  async function checkAllFiles() {
    var id = state.selected;
    if (!id || !state.manifest) { setWarnings('檢查格式：請先選擇特效', 'err'); return; }
    var lines = await computeCheck(id, ['effects', 'viewer', 'console'], true);
    displayCheck(lines);
  }

  var TEST_PAINT = { fill: 1, stroke: 1, fillText: 1, strokeText: 1, fillRect: 1, strokeRect: 1, putImageData: 1, drawImage: 1 };

  function makeTestCtx() {
    var calls = [];
    function chainable() {
      return new Proxy(function () {}, {
        get: function (t, prop) {
          if (typeof prop !== 'string') return undefined;
          if (prop === 'width' || prop === 'height') return 0;
          if (prop === 'then' || prop === 'toJSON') return undefined;
          return function () { return chainable(); };
        },
        set: function () { return true; }
      });
    }
    var canvasObj = { width: 800, height: 450 };
    var gradStub = { addColorStop: function () {}, width: 0, height: 0, data: [] };
    if (typeof Proxy === 'undefined') {
      var plain = {};
      ['clearRect', 'fillRect', 'strokeRect', 'fill', 'stroke', 'beginPath', 'closePath', 'arc', 'ellipse', 'rect', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'save', 'restore', 'scale', 'rotate', 'translate', 'setTransform', 'transform', 'clip', 'setLineDash', 'fillText', 'strokeText', 'drawImage', 'putImageData', 'getImageData', 'createRadialGradient', 'createLinearGradient', 'createConicGradient', 'createPattern', 'measureText'].forEach(function (m) {
        plain[m] = function () { if (TEST_PAINT[m]) calls.push(m); return gradStub; };
      });
      plain.canvas = canvasObj;
      return { ctx: plain, calls: calls };
    }
    var ctx = new Proxy({}, {
      get: function (t, prop) {
        if (typeof prop !== 'string') return undefined;
        if (prop in t) return t[prop];
        if (prop === 'canvas') return canvasObj;
        if (prop === 'measureText') return function () { return { width: 0 }; };
        if (prop === 'getImageData') return function () { return gradStub; };
        return function () { calls.push(prop); return chainable(); };
      },
      set: function (t, prop, value) { t[prop] = value; return true; }
    });
    return { ctx: ctx, calls: calls };
  }

  function runEffectTest(id, source, params) {
    var lines = ['特效測試：' + id];
    var dHits = previewDangerScan(source);
    if (dHits.length) lines.push('預警：' + id + '/viewer.js 引用 ' + dHits.join('、') + '（可存取頁面金鑰/cookie/網路，請僅測試可信代碼）');
    var res = checkRunSource(String(source == null ? '' : source), 'Effects');
    if (res.error) {
      lines.push('執行：錯誤 — ' + res.error);
      lines.push('結果：未通過');
      return { ok: false, lines: lines };
    }
    lines.push('執行：OK');
    if (res.registrations.length !== 1) {
      lines.push('註冊：window.Effects.register 呼叫 ' + res.registrations.length + ' 次（應為 1）');
      lines.push('結果：未通過');
      return { ok: false, lines: lines };
    }
    var reg = res.registrations[0];
    lines.push('註冊：1 次' + (reg.id === id ? '（id 相符）' : '（id 為 ' + reg.id + '，選定 ' + id + '）'));
    if (typeof reg.factory !== 'function') {
      lines.push('register factory 不是 function');
      lines.push('結果：未通過');
      return { ok: false, lines: lines };
    }
    var fx;
    try { fx = reg.factory(400, 225, params); }
    catch (e) {
      lines.push('生成特效：錯誤 — ' + (e && e.message ? e.message : String(e)));
      lines.push('結果：未通過');
      return { ok: false, lines: lines };
    }
    if (!checkIsPlainObject(fx)) {
      lines.push('生成特效：factory 回傳非 object');
      lines.push('結果：未通過');
      return { ok: false, lines: lines };
    }
    var missing = [];
    ['update', 'draw', 'done'].forEach(function (fn) {
      if (typeof fx[fn] !== 'function') missing.push(fn);
    });
    if (missing.length) {
      lines.push('生成特效：OK');
      lines.push('方法：缺少 ' + missing.join('、'));
      lines.push('結果：未通過');
      return { ok: false, lines: lines };
    }
    lines.push('生成特效：OK');
    var rec = makeTestCtx();
    if (fx.elapsed == null) fx.elapsed = 0;
    var frames = 0;
    var t = 0;
    var MAX = 5000;
    var STEP = 50;
    var done = false;
    var err = null;
    try {
      while (t <= MAX && frames < 200) {
        fx.update(STEP);
        fx.elapsed += STEP;
        t += STEP;
        if (fx.done()) { done = true; break; }
        rec.ctx.clearRect(0, 0, 800, 450);
        fx.draw(rec.ctx);
        frames++;
      }
    } catch (e) {
      err = e && e.message ? e.message : String(e);
    }
    if (err) {
      lines.push('運行：錯誤（frame ' + frames + '）— ' + err);
      lines.push('結果：未通過');
      return { ok: false, lines: lines };
    }
    var paint = 0;
    rec.calls.forEach(function (c) { if (TEST_PAINT[c]) paint++; });
    lines.push('frames：' + frames + '（' + STEP + 'ms/step、上限 ' + MAX + 'ms）');
    lines.push('繪製：' + (paint > 0 ? '有（paint 呼叫 ' + paint + ' 次）' : '無'));
    lines.push('完成：' + (done ? 'done（' + t + 'ms）' : '未 done（循環特效）'));
    var ok = paint > 0;
    lines.push('結果：' + (ok ? '通過' : '未通過'));
    return { ok: ok, lines: lines };
  }

  async function testEffect() {
    var id = state.selected;
    if (!id || !state.manifest) { setTestResult('特效測試：請先選擇特效', 'err'); return; }
    var source = await checkContent(id, 'viewer.js', true);
    if (source == null || source === '') {
      setTestResult('特效測試：' + id + '（無 viewer.js 內容，略過）', null);
      return;
    }
    var params = collectPreviewParams();
    var result = runEffectTest(id, source, params);
    setTestResult(result.lines.join('\n'), result.ok ? 'ok' : 'err');
  }

  async function exportSource(id, filename) {
    var pc = state.pendingCode || {};
    var staged = pc[id + '/' + filename];
    if (staged && typeof staged.content === 'string') return staged.content;
    var tab = activeTab();
    if ((tab === 'viewer' && filename === 'viewer.js') || (tab === 'console' && filename === 'console.js')) {
      if (els.code && els.code.value) return els.code.value;
    }
    var path = '/api/editor/effect/' + encodeURIComponent(id) + '/' + filename;
    var r;
    try {
      r = await fetch(path, { headers: keyHeadersOnly() });
    } catch (e) {
      return null;
    }
    if (!r.ok) return null;
    return await r.text();
  }

  async function exportFile() {
    if (activeTab() === 'manifest') {
      var sel = selectedEffectFileJson();
      if (!sel) {
        setWarnings('匯出失敗：未選取特效', 'err');
        return;
      }
      if (typeof window.Blob === 'undefined' || typeof window.URL === 'undefined') {
        setWarnings('此環境不支援匯出', 'err');
        return;
      }
      var a = document.createElement('a');
      a.href = window.URL.createObjectURL(new window.Blob([sel.json], { type: 'application/json' }));
      a.download = sel.id + '.effects.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        window.URL.revokeObjectURL(a.href);
      }, 1000);
      setWarnings('匯出成功', 'ok');
      return;
    }
    var path = codeFilePath();
    if (!path) {
      setWarnings('匯出失敗：無可匯出的檔案', 'err');
      return;
    }
    var text = await exportSource(state.selected, activeTab() === 'viewer' ? 'viewer.js' : 'console.js');
    if (text == null) {
      setWarnings('匯出失敗：無內容', 'err');
      return;
    }
    if (typeof window.Blob === 'undefined' || typeof window.URL === 'undefined') {
      setWarnings('此環境不支援匯出', 'err');
      return;
    }
    var a = document.createElement('a');
    a.href = window.URL.createObjectURL(new window.Blob([text], { type: 'text/javascript' }));
    a.download = path.split('/').pop();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      window.URL.revokeObjectURL(a.href);
    }, 1000);
    setWarnings('匯出成功', 'ok');
  }

  function nowMs() {
    if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }

  var inflightPreviewScripts = {};

  function prunePreviewScripts() {
    var nodes = document.body.querySelectorAll('script[data-rtx-effect]');
    for (var i = 0; i < nodes.length; i++) {
      var pid = nodes[i].getAttribute('data-rtx-effect');
      if (nodes[i] !== inflightPreviewScripts[pid]) nodes[i].remove();
    }
  }

  function loadScript(src, effectId, rev) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      if (effectId) {
        s.setAttribute('data-rtx-effect', effectId);
        s.setAttribute('data-rtx-rev', rev || '');
        prunePreviewScripts();
        inflightPreviewScripts[effectId] = s;
      }
      var suffix;
      if (effectId && rev) {
        suffix = '?v=' + encodeURIComponent(rev);
      } else {
        suffix = (src.indexOf('?') >= 0 ? '&' : '?') + 't=' + nowMs();
      }
      s.src = src + suffix;
      s.onload = function () {
        if (effectId && inflightPreviewScripts[effectId] === s) delete inflightPreviewScripts[effectId];
        resolve();
      };
      s.onerror = function () {
        if (effectId && inflightPreviewScripts[effectId] === s) delete inflightPreviewScripts[effectId];
        reject(new Error('script load failed: ' + src));
      };
      document.body.appendChild(s);
    });
  }

  var pluginCache = {};

  var inflightConsolePlugins = {};

  function pruneConsolePlugins() {
    var nodes = (document.head || document.body).querySelectorAll('script[data-rtx-effect]');
    for (var i = 0; i < nodes.length; i++) {
      var pid = nodes[i].getAttribute('data-rtx-effect');
      if (nodes[i] !== inflightConsolePlugins[pid]) nodes[i].remove();
    }
  }

  function loadConsolePlugin(id, spec, rev) {
    var effRev = (spec && spec.consoleRev) || rev || '';
    var key = id + '\u0000' + effRev;
    if (pluginCache[key]) return pluginCache[key];
    var file = (spec && spec.console) || 'console.js';
    var url = '/effects/' + id + '/' + file;
    var suffix = effRev ? '?v=' + encodeURIComponent(effRev) : '';
    var p = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = url + suffix;
      s.setAttribute('data-rtx-effect', id);
      s.setAttribute('data-rtx-rev', effRev);
      pruneConsolePlugins();
      inflightConsolePlugins[id] = s;
      s.onload = function () {
        if (inflightConsolePlugins[id] === s) delete inflightConsolePlugins[id];
        resolve(true);
      };
      s.onerror = function () {
        if (inflightConsolePlugins[id] === s) delete inflightConsolePlugins[id];
        console.warn('[editor] console 插件載入失敗，icon 回退既有優先序', url + suffix);
        resolve(false);
      };
      (document.head || document.body).appendChild(s);
    });
    pluginCache[key] = p;
    return p;
  }

  function applyStagedConsole(id, content) {
    if (!content || typeof content !== 'string') return false;
    previewDangerWarn(id + '/console.js', content);
    try {
      var fn = new Function('window', 'document', content);
      fn(window, document);
    } catch (e) {
      return false;
    }
    return true;
  }

  function effectViewerFile(spec) {
    return (spec && spec.viewer) || 'viewer.js';
  }

  function collectPreviewParams() {
    var out = {};
    if (!els.pRows) return out;
    els.pRows.querySelectorAll('.p-card').forEach(function (card) {
      var r = readCardSpec(card);
      if (!r) return;
      if (r.spec.editable === false) return;
      out[r.key] = r.spec.default;
    });
    return out;
  }

  async function ensureEffectsCore() {
    if (typeof window.Effects === 'undefined') {
      await loadScript('/viewer/effects.js');
    }
  }

  function previewViewerSource(id) {
    var pc = state.pendingCode || {};
    if (pc[id + '/viewer.js'] && typeof pc[id + '/viewer.js'].content === 'string') {
      return pc[id + '/viewer.js'].content;
    }
    // E5：僅當 codeLoaded 即此 id 的 viewer.js 時才信任 textarea（避免切換特效 fetch 未完成時把舊內容當本特效 source）
    if (activeTab() === 'viewer' && els.code && els.code.value) {
      var b = state.codeLoaded;
      if (b && b.id === id && b.filename === 'viewer.js') return els.code.value;
    }
    return null;
  }

  async function injectPlugin(id, content) {
    if (content != null && content !== '') {
      previewDangerWarn(id + '/viewer.js', content);
      try {
        var fn = new Function('window', 'document', content);
        fn(window, document);
      } catch (e) {
        return false;
      }
      preview.loadedId = id;
      return true;
    }
    var spec = state.manifest && state.manifest.effects ? state.manifest.effects[id] : null;
    if (!spec) return false;
    // E2：fetch 文字＋new Function（不注入 body <script data-rtx-effect>），rev-keyed codeCache 命中則免 request
    var filename = effectViewerFile(spec);
    var effRev = spec.viewerRev || state.rev || '';
    var ck = id + '/' + filename;
    var text = null;
    var cached = codeCache[ck];
    if (cached && cached.rev === effRev) {
      text = cached.content;
    } else {
      try {
        var resp = await fetch('/effects/' + id + '/' + filename + '?v=' + encodeURIComponent(effRev));
        if (!resp.ok) return false;
        text = await resp.text();
        codeCache[ck] = { content: text, rev: effRev };
      } catch (e) {
        return false;
      }
    }
    previewDangerWarn(ck, text);
    try {
      var fn = new Function('window', 'document', text);
      fn(window, document);
    } catch (e) {
      return false;
    }
    preview.loadedId = id;
    return true;
  }

  function setupPreviewCanvas() {
    if (!els.previewCanvas) return 1;
    if (!previewCtx) previewCtx = els.previewCanvas.getContext('2d');
    var dpr = (typeof window.devicePixelRatio === 'number' && window.devicePixelRatio > 1) ? window.devicePixelRatio : 1;
    els.previewCanvas.width = Math.round(PREVIEW_LW * dpr);
    els.previewCanvas.height = Math.round(PREVIEW_LH * dpr);
    if (previewCtx) previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    preview.dpr = dpr;
    return dpr;
  }

  function drawPreviewMarker() {
    if (!previewCtx || !els.previewCanvas) return;
    var rect = null;
    try {
      rect = els.previewCanvas.getBoundingClientRect();
    } catch (err) {
      rect = null;
    }
    var sx = (rect && rect.width) ? rect.width / PREVIEW_LW : 1;
    var sy = (rect && rect.height) ? rect.height / PREVIEW_LH : 1;
    if (!(sx > 0) || !(sy > 0)) return;
    var cx = Math.round((preview.pos.x / 100) * PREVIEW_LW);
    var cy = Math.round((preview.pos.y / 100) * PREVIEW_LH);
    var s = 12;
    var gap = 4;
    // 反縮放 scale(1/sx,1/sy)：canvas 被 CSS 拉伸為非 16:9 時，標記仍以恆定 CSS px 繪製（圓點不變橢圓、十字臂等長、線寬一致）
    previewCtx.save();
    previewCtx.translate(cx, cy);
    previewCtx.scale(1 / sx, 1 / sy);
    previewCtx.strokeStyle = 'rgba(255,255,255,0.9)';
    previewCtx.lineWidth = 2;
    previewCtx.shadowColor = 'rgba(0,0,0,0.55)';
    previewCtx.shadowBlur = 2;
    previewCtx.beginPath();
    previewCtx.moveTo(-s, 0);
    previewCtx.lineTo(-gap, 0);
    previewCtx.moveTo(gap, 0);
    previewCtx.lineTo(s, 0);
    previewCtx.moveTo(0, -s);
    previewCtx.lineTo(0, -gap);
    previewCtx.moveTo(0, gap);
    previewCtx.lineTo(0, s);
    previewCtx.stroke();
    previewCtx.fillStyle = 'rgba(255,255,255,0.95)';
    previewCtx.beginPath();
    previewCtx.arc(0, 0, 2.5, 0, Math.PI * 2);
    previewCtx.fill();
    previewCtx.restore();
  }

  // ===== U15 簡化 console（mini-console）：FAB 展開/收合＋可拖曳（限 preview 區）、icon＋參數僅展示 =====
  var MINI_FAB_SIZE = 40;
  var MINI_GAP = 8;
  var MINI_MARGIN = 6;
  var MINI_DRAG_SLOP = 8;
  var miniPos = { x: 12, y: 12 };
  var miniOpen = false;
  var miniDrag = null;
  var miniSuppressClick = false;

  // U15：FAB 可移動範圍限縮至 canvas（#ed-preview-canvas）大小
  function miniBounds() {
    var host = els.miniConsole ? els.miniConsole.parentNode : null;
    if (!host) return { x: 0, y: 0, w: 0, h: 0 };
    var hw = host.clientWidth || 0;
    var hh = host.clientHeight || 0;
    var canvas = els.previewCanvas || (host.querySelector ? host.querySelector('.preview-box') : null);
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function' || typeof host.getBoundingClientRect !== 'function') {
      return { x: 0, y: 0, w: hw, h: hh };
    }
    var hRect = host.getBoundingClientRect();
    var cRect = canvas.getBoundingClientRect();
    return {
      x: cRect.left - hRect.left,
      y: cRect.top - hRect.top,
      w: cRect.width || 0,
      h: cRect.height || 0
    };
  }

  function miniClamp(v, min, max) {
    if (max < min) max = min;
    return Math.max(min, Math.min(v, max));
  }

  function miniClampPos(x, y, w, h, b) {
    b = b || { x: 0, y: 0, w: 0, h: 0 };
    return {
      x: miniClamp(x, b.x + MINI_MARGIN, Math.max(b.x + MINI_MARGIN, b.x + b.w - w - MINI_MARGIN)),
      y: miniClamp(y, b.y + MINI_MARGIN, Math.max(b.y + MINI_MARGIN, b.y + b.h - h - MINI_MARGIN))
    };
  }

  function miniOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    var x = Math.max(0, Math.min(x1 + w1, x2 + w2) - Math.max(x1, x2));
    var y = Math.max(0, Math.min(y1 + h1, y2 + h2) - Math.max(y1, y2));
    return x * y;
  }

  function miniApplyFabPos() {
    if (!els.miniFab || !els.miniConsole) return;
    var b = miniBounds();
    if (!b.w || !b.h) return;
    var f = miniClampPos(miniPos.x, miniPos.y, MINI_FAB_SIZE, MINI_FAB_SIZE, b);
    miniPos.x = f.x;
    miniPos.y = f.y;
    els.miniFab.style.left = f.x + 'px';
    els.miniFab.style.top = f.y + 'px';
    if (!miniOpen) return;
    // 面板與 FAB 同限於 canvas 內：max-height 限 canvas 高、4 候選（下/上/右/左）clamp 至 canvas、取與 FAB 重疊最少者
    els.miniConsole.style.maxHeight = Math.max(60, b.h - MINI_MARGIN * 2) + 'px';
    var pw = els.miniConsole.offsetWidth || 220;
    var ph = els.miniConsole.offsetHeight || 120;
    var cands = [
      { x: f.x, y: f.y + MINI_FAB_SIZE + MINI_GAP },
      { x: f.x, y: f.y - MINI_GAP - ph },
      { x: f.x + MINI_FAB_SIZE + MINI_GAP, y: f.y },
      { x: f.x - pw - MINI_GAP, y: f.y }
    ];
    var best = null;
    var bestArea = Infinity;
    cands.forEach(function (c) {
      var pos = miniClampPos(c.x, c.y, pw, ph, b);
      var area = miniOverlap(pos.x, pos.y, pw, ph, f.x, f.y, MINI_FAB_SIZE, MINI_FAB_SIZE);
      if (area < bestArea) {
        bestArea = area;
        best = pos;
      }
    });
    if (best) {
      els.miniConsole.style.left = best.x + 'px';
      els.miniConsole.style.top = best.y + 'px';
    }
  }

  function miniToggle() {
    if (!els.miniFab || !els.miniConsole) return;
    miniOpen = !miniOpen;
    els.miniFab.classList.toggle('active', miniOpen);
    els.miniFab.setAttribute('aria-expanded', miniOpen ? 'true' : 'false');
    els.miniConsole.classList.toggle('open', miniOpen);
    els.miniConsole.setAttribute('aria-hidden', miniOpen ? 'false' : 'true');
    miniApplyFabPos();
  }

  function miniToggleParams() {
    if (!els.miniParams || !els.miniParamsBody) return;
    var open = els.miniParamsBody.classList.toggle('open');
    els.miniParams.classList.toggle('active', open);
    els.miniParams.setAttribute('aria-expanded', open ? 'true' : 'false');
    miniApplyFabPos();
  }

  function clearMiniConsole() {
    miniOpen = false;
    if (els.miniFab) {
      els.miniFab.classList.remove('active');
      els.miniFab.setAttribute('aria-expanded', 'false');
    }
    if (els.miniConsole) {
      els.miniConsole.classList.remove('open');
      els.miniConsole.setAttribute('aria-hidden', 'true');
    }
    if (els.miniParamsBody) {
      els.miniParamsBody.innerHTML = '';
      els.miniParamsBody.classList.remove('open');
    }
    if (els.miniParams) {
      els.miniParams.classList.remove('active');
      els.miniParams.setAttribute('aria-expanded', 'false');
    }
    if (els.miniFxIcon) els.miniFxIcon.innerHTML = '';
    if (els.miniFxName) els.miniFxName.textContent = '';
  }

  function miniFields(spec) {
    var params = spec && spec.params && typeof spec.params === 'object' ? spec.params : {};
    var out = [];
    Object.keys(params).forEach(function (k) {
      var d = params[k];
      if (!d || typeof d !== 'object') return;
      if (d.editable === false) return;
      if (d.type === 'array') return;
      out.push({
        key: k,
        label: d.label || k,
        type: d.type || 'string',
        def: d.default,
        min: d.min,
        max: d.max,
        step: d.step,
        maxLength: d.maxLength,
        options: d.options
      });
    });
    return out;
  }

  function miniConsoleApi(id, spec) {
    spec = spec || {};
    var params = spec.params && typeof spec.params === 'object' ? spec.params : {};
    var fields = miniFields(spec);
    var defaults = {};
    fields.forEach(function (d) { defaults[d.key] = d.def; });
    function q(key) {
      if (!els.miniParamsBody) return null;
      return els.miniParamsBody.querySelector('[id="rtx-p-' + key + '"]');
    }
    return {
      type: id,
      params: params,
      defaults: defaults,
      fields: fields,
      getValue: function (key) {
        var i = q(key);
        if (!i) return undefined;
        return i.type === 'checkbox' ? i.checked : i.value;
      },
      setValue: function (key, value) {
        var i = q(key);
        if (!i) return;
        if (i.type === 'checkbox') i.checked = Boolean(value);
        else i.value = value;
      }
    };
  }

  function renderMiniSchemaBody(spec) {
    if (!els.miniParamsBody) return;
    var fields = miniFields(spec);
    if (!fields.length) {
      var empty = document.createElement('div');
      empty.className = 'mini-empty';
      empty.textContent = '（無參數）';
      els.miniParamsBody.appendChild(empty);
      return;
    }
    fields.forEach(function (d) {
      var row = document.createElement('div');
      row.className = 'mini-field';
      var lab = document.createElement('label');
      lab.className = 'mini-field-k';
      lab.textContent = d.label;
      var input;
      if (d.type === 'select') {
        input = document.createElement('select');
        input.id = 'rtx-p-' + d.key;
        (d.options || []).forEach(function (o) {
          var opt = document.createElement('option');
          var v = o && typeof o === 'object' ? o.value : o;
          var t = o && typeof o === 'object' ? (o.label != null ? o.label : String(o.value)) : String(o);
          opt.value = v;
          opt.textContent = t;
          input.appendChild(opt);
        });
        input.value = d.def != null ? d.def : '';
      } else {
        input = document.createElement('input');
        input.id = 'rtx-p-' + d.key;
        if (d.type === 'boolean') {
          input.type = 'checkbox';
          input.checked = d.def === true;
        } else {
          input.type = d.type === 'color' ? 'color' : d.type === 'integer' || d.type === 'number' ? 'number' : 'text';
          input.value = d.def == null ? '' : String(d.def);
        }
        if (d.min != null) input.min = d.min;
        if (d.max != null) input.max = d.max;
        if (d.step != null) input.step = d.step;
        if (d.maxLength != null) input.maxLength = d.maxLength;
      }
      row.appendChild(lab);
      row.appendChild(input);
      els.miniParamsBody.appendChild(row);
    });
  }

  function renderMiniConsole(id, spec) {
    spec = spec || {};
    if (els.miniFxIcon) els.miniFxIcon.innerHTML = iconFor(id, spec);
    if (els.miniFxName) els.miniFxName.textContent = spec.label || id;
    if (els.miniFx) els.miniFx.title = spec.label || id;
    if (!els.miniParamsBody) return;
    els.miniParamsBody.innerHTML = '';
    var plugin = consoleRegistry.registry[id];
    var rendered = false;
    if (plugin && typeof plugin.render === 'function') {
      try {
        plugin.render(els.miniParamsBody, miniConsoleApi(id, spec));
        rendered = true;
      } catch (e) {
        console.warn('[editor] mini-console render 失敗，改用 schema 展示', e);
      }
    }
    if (!rendered) renderMiniSchemaBody(spec);
  }

  async function prepareMiniConsole() {
    var id = state.selected;
    if (!id) return;
    var spec = (state.manifest && state.manifest.effects && state.manifest.effects[id]) || {};
    var staged = state.pendingCode && state.pendingCode[id + '/console.js'];
    if (staged && typeof staged.content === 'string') {
      applyStagedConsole(id, staged.content);
    } else {
      await loadConsolePlugin(id, spec, state.rev || '');
    }
    renderMiniConsole(id, spec);
  }

  function miniInit() {
    if (els.miniFab) {
      els.miniFab.addEventListener('click', function () {
        if (miniSuppressClick) return;
        miniToggle();
      });
      els.miniFab.addEventListener('pointerdown', function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        miniDrag = { startX: e.clientX, startY: e.clientY, originX: miniPos.x, originY: miniPos.y, active: false };
        if (els.miniFab.setPointerCapture) els.miniFab.setPointerCapture(e.pointerId);
      });
    }
    if (els.miniParams) {
      els.miniParams.addEventListener('click', miniToggleParams);
    }
    window.addEventListener('pointermove', function (e) {
      if (!miniDrag) return;
      if (!miniDrag.active) {
        if (Math.abs(e.clientX - miniDrag.startX) <= MINI_DRAG_SLOP &&
            Math.abs(e.clientY - miniDrag.startY) <= MINI_DRAG_SLOP) return;
        miniDrag.active = true;
        if (els.miniFab) els.miniFab.classList.add('dragging');
      }
      miniPos.x = miniDrag.originX + (e.clientX - miniDrag.startX);
      miniPos.y = miniDrag.originY + (e.clientY - miniDrag.startY);
      miniApplyFabPos();
      e.preventDefault();
    });
    window.addEventListener('pointerup', function () {
      if (!miniDrag) return;
      var wasDrag = miniDrag.active;
      miniDrag = null;
      if (els.miniFab) els.miniFab.classList.remove('dragging');
      if (wasDrag) {
        miniSuppressClick = true;
        setTimeout(function () { miniSuppressClick = false; }, 0);
      }
    });
    window.addEventListener('resize', miniApplyFabPos);
    // canvas 大小變化（.rsz 拖曳／視窗／佈局）→ 重 clamp FAB/面板至新 canvas 邊界＋idle 重畫 marker（7g：播放期間不畫 marker、停止後重現）
    if (els.previewCanvas && typeof window.ResizeObserver === 'function') {
      var miniRsz = new window.ResizeObserver(function () {
        miniApplyFabPos();
        if (!preview.running) refreshPreviewIdle();
      });
      miniRsz.observe(els.previewCanvas);
    }
    var b0 = miniBounds();
    if (b0.w && b0.h) {
      miniPos = { x: b0.x + b0.w - MINI_FAB_SIZE - MINI_MARGIN, y: b0.y + MINI_MARGIN };
    } else {
      miniPos = { x: 8, y: 8 };
    }
    clearMiniConsole();
    miniApplyFabPos();
  }

  function refreshPreviewIdle() {
    if (!previewCtx || !els.previewCanvas || preview.running) return;
    previewCtx.clearRect(0, 0, PREVIEW_LW, PREVIEW_LH);
    drawPreviewMarker();
  }

  function resetPreviewPos() {
    preview.pos = { x: 50, y: 50 };
    renderPreviewLabel();
    refreshPreviewIdle();
  }

  function schedulePreviewTick() {
    if (!preview.running) return;
    if (typeof window.requestAnimationFrame === 'function') {
      preview.raf = window.requestAnimationFrame(previewTick);
    } else if (!preview.interval) {
      preview.interval = setInterval(previewTick, 33);
    }
  }

  function stopPreviewLoop() {
    if (preview.raf) {
      try {
        window.cancelAnimationFrame(preview.raf);
      } catch (e) {
        // ignore
      }
      preview.raf = 0;
    }
    if (preview.interval) {
      clearInterval(preview.interval);
      preview.interval = 0;
    }
  }

  function previewTick() {
    if (!preview.running || preview.paused || !preview.fx || !previewCtx) return;
    var now = nowMs();
    preview.vtime += (now - preview.lastTick) * preview.rate;
    preview.lastTick = now;
    var fx = preview.fx;
    if (window.Effects && typeof window.Effects.stepEffect === 'function') {
      window.Effects.stepEffect(fx, preview.vtime);
    }
    if (typeof fx.done === 'function' && fx.done()) {
      previewStop(true);
      return;
    }
    previewCtx.clearRect(0, 0, PREVIEW_LW, PREVIEW_LH);
    if (typeof fx.draw === 'function') fx.draw(previewCtx);
    schedulePreviewTick();
  }

  function previewStop(clearCanvas) {
    stopPreviewLoop();
    preview.running = false;
    preview.fx = null;
    preview.paused = false;
    preview.vtime = 0;
    preview.lastTick = 0;
    if (clearCanvas && previewCtx && els.previewCanvas) {
      previewCtx.clearRect(0, 0, PREVIEW_LW, PREVIEW_LH);
      drawPreviewMarker();
    }
    renderPreviewControls();
  }

  function renderPreviewControls() {
    var on = preview.running;
    if (els.previewRate) els.previewRate.disabled = false;
    if (els.previewPause) {
      els.previewPause.disabled = !on;
      // 7h：影片撥放器式——暫停中切 play 圖示（＋aria-label/title 同步）
      var paused = preview.paused;
      els.previewPause.setAttribute('title', paused ? '繼續預覽' : '暫停預覽（暫停時長不計入特效時間）');
      els.previewPause.setAttribute('aria-label', paused ? '繼續' : '暫停');
      var pIco = els.previewPause.querySelector('.ui-ico');
      if (pIco) {
        pIco.setAttribute('data-ui-icon', paused ? 'play' : 'pause');
        injectIcons(els.previewPause);
      }
    }
    if (els.previewReplay) {
      els.previewReplay.disabled = !(preview.loadedId && preview.loadedId === state.selected);
    }
    // 7i：[清屏] 啟用邏輯統一於 [重播][暫停]（running ⊆ loaded 且為選定特效）
    if (els.previewClear) {
      els.previewClear.disabled = !(preview.loadedId && preview.loadedId === state.selected);
    }
    if (els.previewRateVal) els.previewRateVal.textContent = preview.rate + '×';
  }

  function previewPauseToggle() {
    if (!preview.running) return;
    if (preview.paused) {
      preview.lastTick = nowMs();
      preview.paused = false;
      schedulePreviewTick();
    } else {
      stopPreviewLoop();
      preview.paused = true;
    }
    renderPreviewControls();
  }

  function previewReplay() {
    if (!preview.loadedId || preview.loadedId !== state.selected) return;
    previewStart(true);
  }

  function previewSetRate(r) {
    var v = Number(r);
    if (!isFinite(v)) v = 1;
    if (v < 0.25) v = 0.25;
    if (v > 4) v = 4;
    preview.rate = v;
    if (els.previewRate && Number(els.previewRate.value) !== v) els.previewRate.value = String(v);
    renderPreviewControls();
  }

  function previewState() {
    return {
      running: preview.running,
      paused: preview.paused,
      rate: preview.rate,
      vtime: preview.vtime
    };
  }

  async function previewStart(reusePlugin) {
    var id = state.selected;
    if (!id || !state.manifest || !state.manifest.effects[id]) {
      setTestResult('請先選定特效', 'err');
      return;
    }
    applyManifestFields(); // 先同步上方欄位（label/icon/enabled/params）→state.manifest，簡化 console 讀值即與即時預覽一致
    prepareMiniConsole(); // U15：讀暫存/已存 console.js→更新簡化 console（icon＋參數僅展示）
    if (!els.previewCanvas) return;
    var freshCtx = els.previewCanvas.getContext('2d');
    if (freshCtx) previewCtx = freshCtx;
    if (!previewCtx) {
      setTestResult('preview canvas not supported', 'err');
      return;
    }
    setupPreviewCanvas();
    if (preview.running) previewStop(false);
    try {
      await ensureEffectsCore();
    } catch (e) {
      previewStop(true);
      setTestResult('預覽載入失敗：Effects registry 未就緒', 'err');
      return;
    }
    if (!(reusePlugin && preview.loadedId === id)) {
      await injectPlugin(id, previewViewerSource(id));
    }
    if (typeof window.Effects === 'undefined' || typeof window.Effects.createEffect !== 'function') {
      previewStop(true);
      setTestResult('預覽載入失敗：Effects registry 未就緒', 'err');
      return;
    }
    var fx = null;
    var px = Math.round((preview.pos.x / 100) * PREVIEW_LW);
    var py = Math.round((preview.pos.y / 100) * PREVIEW_LH);
    try {
      fx = window.Effects.createEffect(id, px, py, collectPreviewParams());
    } catch (e) {
      setTestResult('createEffect 失敗：' + (e && e.message ? e.message : e), 'err');
      return;
    }
    if (!fx) {
      setTestResult('createEffect 失敗：無回傳特效', 'err');
      return;
    }
    preview.fx = fx;
    preview.vtime = 0;
    preview.lastTick = nowMs();
    preview.paused = false;
    if (fx.elapsed !== undefined) fx.elapsed = 0;
    preview.running = true;
    previewCtx.clearRect(0, 0, PREVIEW_LW, PREVIEW_LH);
    renderPreviewControls();
    schedulePreviewTick();
  }

  function previewClear() {
    previewStop(true);
    setTestResult('已清除預覽畫面', 'ok');
  }

  function onPreviewClick(e) {
    if (!els.previewCanvas || !e) return;
    var rect = null;
    try {
      rect = els.previewCanvas.getBoundingClientRect();
    } catch (err) {
      return;
    }
    if (!rect || !rect.width || !rect.height) return;
    var x = Math.round(((e.clientX - rect.left) / rect.width) * 10000) / 100;
    var y = Math.round(((e.clientY - rect.top) / rect.height) * 10000) / 100;
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    preview.pos = { x: x, y: y };
    renderPreviewLabel();
    refreshPreviewIdle();
  }

  async function onCodeSaved(id) {
    if (!id || !preview.loadedId) return;
    if (preview.running) {
      previewStart();
    } else if (id === preview.loadedId) {
      await injectPlugin(id);
    }
  }

  function renderPreviewLabel() {
    var id = state.selected;
    var spec = id && state.manifest && state.manifest.effects ? state.manifest.effects[id] : null;
    var lab = spec && spec.label ? spec.label : id || '——';
    if (els.previewLabel) els.previewLabel.textContent = lab + '（選定）· 800×450';
    if (els.previewHint) els.previewHint.textContent = lab + '（選定）· x=' + preview.pos.x + ', y=' + preview.pos.y;
  }

  function selectTab(name) {
    if (!els.tabs) return;
    els.tabs.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === name);
    });
    if (name === 'manifest') {
      renderManifestView();
    } else {
      loadCodeFile();
    }
  }

  function selectedEffectEntry() {
    var id = state.selected;
    if (!id || !state.manifest || !state.manifest.effects) return null;
    var spec = state.manifest.effects[id];
    return spec && typeof spec === 'object' ? spec : null;
  }

  function effectEntryJson(id) {
    var m = state.manifest;
    var spec = m && m.effects && m.effects[id] && typeof m.effects[id] === 'object' ? m.effects[id] : null;
    return spec ? JSON.stringify(spec, null, 2) : null;
  }

  function renderManifestView() {
    var text;
    if (!state.manifest) {
      text = '(manifest not loaded)';
    } else {
      var id = state.selected;
      var spec = id && state.manifest.effects[id] && typeof state.manifest.effects[id] === 'object'
        ? state.manifest.effects[id]
        : null;
      if (spec) {
        // Task1：以 effect_id 為鍵顯示該特效的 effects.json entry
        var entry = {};
        entry[id] = spec;
        text = JSON.stringify(entry, null, 2);
      } else {
        text = '請先選擇特效';
      }
    }
    showCode(text);
    if (els.tabs) {
      els.tabs.querySelectorAll('.tab').forEach(function (t) {
        t.classList.toggle('active', t.getAttribute('data-tab') === 'manifest');
      });
    }
  }

  async function init() {
    if (els.keyInput) {
      try {
        els.keyInput.value = localStorage.getItem(SRV_KEY_LS) || '';
      } catch (e) {
        // ignore
      }
    }
    setDirty(false);
    injectIcons(root);
    await loadManifest();
    if (state.conn) openStream();
  }

  if (els.keyInput) {
    els.keyInput.addEventListener('change', function () {
      saveSrvKey();
      openStream();
    });
  }
  if (els.reloadBtn) {
    els.reloadBtn.addEventListener('click', function () {
      reloadManifest();
    });
  }
  [els.metaId, els.metaLabel, els.metaIcon].forEach(function (el) {
    if (el) {
      el.addEventListener('input', function () { setFieldsUnstaged(); });
      el.addEventListener('change', function () { setFieldsUnstaged(); });
    }
  });
  if (els.chkEnabled) {
    els.chkEnabled.addEventListener('change', function () { setFieldsUnstaged(); });
  }
  if (els.addParam) {
    els.addParam.addEventListener('click', function () {
      if (!state.editable) return;
      var card = buildParamCard('', {});
      var n = els.pRows.querySelectorAll('.p-card').length;
      card.classList.add(n % 2 === 0 ? 'cA' : 'cB');
      els.pRows.appendChild(card);
      setFieldsUnstaged();
    });
  }
  if (els.saveBtn) {
    els.saveBtn.addEventListener('click', function () {
      save();
    });
  }
  if (els.tabs) {
    els.tabs.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        selectTab(t.getAttribute('data-tab'));
      });
    });
  }
  if (els.exportAll) {
    els.exportAll.addEventListener('click', function () {
      exportZip(Object.keys(state.manifest && state.manifest.effects || {}), true);
    });
  }
  if (els.exportSel) {
    els.exportSel.addEventListener('click', function () {
      exportZip(state.batch.slice(), false);
    });
  }
  if (els.addNew) {
    els.addNew.addEventListener('click', function () {
      newEffect();
    });
  }
  if (els.importEffects) {
    els.importEffects.addEventListener('click', function () {
      if (els.fileImportEffects) els.fileImportEffects.click();
    });
  }
  if (els.fileImportEffects) {
    els.fileImportEffects.addEventListener('change', function () {
      importZip(els.fileImportEffects);
    });
  }
  if (els.saveFile) {
    els.saveFile.addEventListener('click', function () {
      saveFile();
    });
  }
  if (els.importFile) {
    els.importFile.addEventListener('click', function () {
      importFile();
    });
  }
  if (els.exportFile) {
    els.exportFile.addEventListener('click', function () {
      exportFile();
    });
  }
  if (els.checkFile) {
    els.checkFile.addEventListener('click', function () {
      checkSingleFile();
    });
  }
  if (els.checkAll) {
    els.checkAll.addEventListener('click', function () {
      checkAllFiles();
    });
  }
  if (els.previewStart) {
    els.previewStart.addEventListener('click', function () {
      previewStart();
    });
  }
  if (els.previewTest) {
    els.previewTest.addEventListener('click', function () {
      testEffect();
    });
  }
  if (els.previewClear) {
    els.previewClear.addEventListener('click', function () {
      previewClear();
    });
  }
  if (els.previewReset) {
    els.previewReset.addEventListener('click', function () {
      resetPreviewPos();
    });
  }
  if (els.previewRate) {
    els.previewRate.addEventListener('input', function () {
      previewSetRate(els.previewRate.value);
    });
  }
  if (els.previewPause) {
    els.previewPause.addEventListener('click', function () {
      previewPauseToggle();
    });
  }
  if (els.previewReplay) {
    els.previewReplay.addEventListener('click', function () {
      previewReplay();
    });
  }
  miniInit(); // U15：簡化 console（FAB 拖曳/展開、初始右上角、空狀態）
  if (els.previewCanvas) {
    els.previewCanvas.addEventListener('click', function (e) {
      onPreviewClick(e);
    });
  }
  if (els.fileImportFile) {
    els.fileImportFile.addEventListener('change', function () {
      doImportFile(els.fileImportFile);
    });
  }
  if (els.code) {
    els.code.addEventListener('input', function () {
      renderLineNumbers(els.code.value);
      renderHighlight();
      if (hasUnstagedCode()) setDirty(true);
      setDirtyUI(); // 7d：內容回到 staged/server 基準時指標需回到「未保存變更」或「已同步」
    });
    els.code.addEventListener('scroll', function () {
      syncCodeScroll();
    });
    els.code.addEventListener('keydown', function (e) {
      if (e && e.key === 'Tab') {
        e.preventDefault();
        var ta = els.code;
        if (typeof ta.selectionStart !== 'number' || typeof ta.selectionEnd !== 'number') return;
        var start = ta.selectionStart;
        var end = ta.selectionEnd;
        var indent = '    ';
        ta.value = ta.value.substring(0, start) + indent + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = start + indent.length;
        renderLineNumbers(ta.value);
        renderHighlight();
        syncCodeScroll();
        if (hasUnstagedCode()) setDirty(true);
        setDirtyUI(); // 7d：同 input handler（Tab 縮排後刷新四態指標）
      }
    });
  }
  if (els.batchEnable) {
    els.batchEnable.addEventListener('click', function () {
      batchApply('enabled', true);
    });
  }
  if (els.batchDisable) {
    els.batchDisable.addEventListener('click', function () {
      batchApply('enabled', false);
    });
  }
  if (els.batchToCur) {
    els.batchToCur.addEventListener('click', function () {
      batchMove('cur');
    });
  }
  if (els.batchToAlt) {
    els.batchToAlt.addEventListener('click', function () {
      batchMove('alt');
    });
  }
  initListDrag();
  initDropdowns();

  window.addEventListener('beforeunload', function (e) {
    if (!state.dirty) return;
    e.preventDefault();
    e.returnValue = '有未存變更，離開將遺失';
    return e.returnValue;
  });

  setupPreviewCanvas();
  refreshPreviewIdle();
  renderPreviewControls();
  window.__rtxEditorReady = init();
  window.__rtxEditor = {
    version: '7m',
    state: state,
    setDirty: setDirty,
    setDirtyUI: setDirtyUI,
    selectItem: selectItem,
    loadManifest: loadManifest,
    reload: reloadManifest,
    openStream: openStream,
    injectIcons: injectIcons,
    iconFor: iconFor,
    resolvedPluginIcon: resolvedPluginIcon,
    loadConsolePlugin: loadConsolePlugin,
    applyStagedConsole: applyStagedConsole,
    injectPlugin: injectPlugin,
    previewViewerSource: previewViewerSource,
    previewDangerScan: previewDangerScan,
    pluginCache: pluginCache,
    codeCache: codeCache,
    prepareMiniConsole: prepareMiniConsole,
    renderMiniConsole: renderMiniConsole,
    clearMiniConsole: clearMiniConsole,
    miniInit: miniInit,
    miniApplyFabPos: miniApplyFabPos,
    miniToggle: miniToggle,
    miniToggleParams: miniToggleParams,
    setEditable: setEditable,
    setOpsResult: setOpsResult,
    setWarnings: setWarnings,
    setTestResult: setTestResult,
    save: save,
    buildManifest: buildManifest,
    collectParams: collectParams,
    renderMeta: renderMeta,
    renderParams: renderParams,
    renderManifestView: renderManifestView,
    selectedEffectEntry: selectedEffectEntry,
    effectEntryJson: effectEntryJson,
    selectedEffectFileJson: selectedEffectFileJson,
    doImportEntry: doImportEntry,
    entryIdFromFilename: entryIdFromFilename,
    selectTab: selectTab,
    activeTab: activeTab,
    codeFilePath: codeFilePath,
    renderLineNumbers: renderLineNumbers,
    highlightJs: highlightJs,
    renderHighlight: renderHighlight,
    showCode: showCode,
    loadCodeFile: loadCodeFile,
    saveFile: saveFile,
    stageImport: stageImport,
    importFile: importFile,
    doImportFile: doImportFile,
    exportSource: exportSource,
    exportFile: exportFile,
    importExportLabel: importExportLabel,
    checkSingleFile: checkSingleFile,
    checkAllFiles: checkAllFiles,
    checkEffectsEntry: checkEffectsEntry,
    checkViewerSource: checkViewerSource,
    checkConsoleSource: checkConsoleSource,
    computeCheck: computeCheck,
    displayCheck: displayCheck,
    preview: preview,
    previewStart: previewStart,
    testEffect: testEffect,
    runEffectTest: runEffectTest,
    previewStop: previewStop,
    previewPauseToggle: previewPauseToggle,
    previewReplay: previewReplay,
    previewSetRate: previewSetRate,
    previewState: previewState,
    renderPreviewControls: renderPreviewControls,
    previewClear: previewClear,
    setupPreviewCanvas: setupPreviewCanvas,
    drawPreviewMarker: drawPreviewMarker,
    refreshPreviewIdle: refreshPreviewIdle,
    resetPreviewPos: resetPreviewPos,
    previewTick: previewTick,
    collectPreviewParams: collectPreviewParams,
    onPreviewClick: onPreviewClick,
    onCodeSaved: onCodeSaved,
    renderPreviewLabel: renderPreviewLabel,
    syncCodeEditable: syncCodeEditable,
    putJson: putJson,
    delJson: delJson,
    putManifest: putManifest,
    handleMutateResponse: handleMutateResponse,
    toggleBatch: toggleBatch,
    syncBatchUI: syncBatchUI,
    setEnabled: setEnabled,
    batchApply: batchApply,
    batchMove: batchMove,
    removeEffect: removeEffect,
    undoPendingDelete: undoPendingDelete,
    commitMove: commitMove,
    newEffect: newEffect,
    applyIdRekey: applyIdRekey,
    validateId: validateId,
    nextEffectSerial: nextEffectSerial,
    applyManifestFields: applyManifestFields,
    syncMetaIdEditable: syncMetaIdEditable,
    exportZip: exportZip,
    importZip: importZip,
    clearDragOver: clearDragOver,
    initListDrag: initListDrag,
    initDropdowns: initDropdowns,
    closeAllDropdowns: closeAllDropdowns
  };
})();
