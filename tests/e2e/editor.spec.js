import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TEST_EFFECTS_DIR } from './e2e-paths.js';
import {
  trackPageErrors,
  TEST_EFFECTS,
  snapshotFixture,
  restoreFixture,
  writeFixture,
  readFixture,
  waitRateLimit,
  canvasHasPixelsNear,
  readZipEntries
} from './helpers.js';

test.use({ baseURL: 'http://localhost:8123' });

async function openEditorPage(page) {
  const manifestResp = page.waitForResponse((r) => r.url().includes('/api/editor/manifest') && r.ok());
  await page.goto('/editor');
  const resp = await manifestResp;
  await expect(page.locator('#rtx-editor')).toBeVisible();
  return resp;
}

test.describe('2a editor 頁面骨架', () => {
  test('骨架 DOM、頂列、三欄布局與資產 200', async ({ page }) => {
    const errs = trackPageErrors(page);
    const responses = {};
    for (const p of ['/editor', '/editor/app.js', '/editor/style.css']) {
      const r = await page.request.get(p);
      responses[p] = r.status();
    }
    await page.goto('/editor');
    await expect(page.locator('#rtx-editor')).toBeVisible();
    // 三欄
    for (const id of ['#ed-list-panel', '#ed-manifest-panel', '#ed-code-panel', '#ed-preview-panel']) {
      await expect(page.locator(id)).toBeVisible();
    }
    await expect(page.locator('.rsz')).toHaveCount(2);
    // 頂列（2b：chips 已填入 fixture 實際值）
    await expect(page.locator('.topbar .brand')).toBeVisible();
    await expect(page.locator('#ed-badge')).toContainText('v1');
    await expect(page.locator('#ed-chip-version')).toHaveText('version 1');
    await expect(page.locator('#ed-chip-rev')).toContainText('（base）');
    await expect(page.locator('#ed-chip-count')).toHaveText('4 / 4 特效啟用');
    await expect(page.locator('#ed-srv-key')).toBeVisible();
    await expect(page.locator('#ed-reload-btn')).toBeVisible();
    await expect(page.locator('#ed-save-btn')).toBeVisible();
    // 各區塊占位
    await expect(page.locator('#ed-fx-list')).toBeVisible();
    await expect(page.locator('#ed-zone-cur')).toBeVisible();
    await expect(page.locator('#ed-zone-alt')).toBeVisible();
    await expect(page.locator('#ed-meta-label')).toBeVisible();
    await expect(page.locator('#chk-enabled')).toBeChecked();
    await expect(page.locator('#ed-p-rows')).toBeVisible();
    await expect(page.locator('#ed-tabs .tab.active')).toHaveText('effects.json');
    await expect(page.locator('#ed-code')).toBeVisible();
    await expect(page.locator('#ed-preview-box')).toBeVisible();
    await expect(page.locator('#ed-preview-canvas')).toBeVisible();
    expect(responses, responses).toEqual({
      '/editor': 200,
      '/editor/app.js': 200,
      '/editor/style.css': 200,
    });
    expect(errs, errs).toEqual([]);
  });

  test('.rsz 可拖曳調整欄寬', async ({ page }) => {
    const errs = trackPageErrors(page);
    await page.goto('/editor');
    await expect(page.locator('#rtx-editor')).toBeVisible();
    const panel = page.locator('#ed-list-panel');
    const mid = page.locator('.left-col');
    const before = await panel.boundingBox();
    const midBefore = await mid.boundingBox();
    const bar = page.locator('.rsz[data-rsz="1"]');
    const box = await bar.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    const after = await panel.boundingBox();
    const midAfter = await mid.boundingBox();
    const c1d = after.width - before.width;
    const c2d = midBefore.width - midAfter.width;
    expect(c1d, `before=${before.width} after=${after.width}`).toBeGreaterThan(10);
    // B7：對側欄（c2）應等量收縮（左增右減），而非被釘在 220px 下限
    expect(Math.abs(c1d - c2d), `c1 增 ${c1d} / c2 減 ${c2d}`).toBeLessThan(12);
    expect(errs, errs).toEqual([]);
  });

  test('B7 拖曳 .rsz[2]：中欄增、預覽欄等量減（非釘 220px）', async ({ page }) => {
    const errs = trackPageErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/editor');
    await expect(page.locator('#rtx-editor')).toBeVisible();
    const mid = page.locator('.left-col');
    const pv = page.locator('#ed-preview-panel');
    const midBefore = await mid.boundingBox();
    const pvBefore = await pv.boundingBox();
    const bar = page.locator('.rsz[data-rsz="2"]');
    const box = await bar.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    const midAfter = await mid.boundingBox();
    const pvAfter = await pv.boundingBox();
    const c2d = midAfter.width - midBefore.width;
    const c3d = pvBefore.width - pvAfter.width;
    expect(c2d, `中欄 before=${midBefore.width} after=${midAfter.width}`).toBeGreaterThan(10);
    // B7：對側欄（c3 預覽）應等量收縮，而非被釘在 220px（且失去 1fr）
    expect(Math.abs(c2d - c3d), `c2 增 ${c2d} / c3 減 ${c3d}`).toBeLessThan(12);
    expect(errs, errs).toEqual([]);
  });

  test('B10 拖曳 .rsz 至對側欄觸底：另一欄不意外加大（兩欄總寬守恆）', async ({ page }) => {
    const errs = trackPageErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/editor');
    await expect(page.locator('#rtx-editor')).toBeVisible();
    const panel = page.locator('#ed-list-panel');
    const mid = page.locator('.left-col');
    const pBefore = await panel.boundingBox();
    const mBefore = await mid.boundingBox();
    const bar = page.locator('.rsz[data-rsz="1"]');
    const box = await bar.boundingBox();
    const sx = box.x + box.width / 2;
    const sy = box.y + box.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    // 大幅右拖（dx≈420）使對側欄 c2 撞到 220px 下限並繼續推移
    await page.mouse.move(sx + 420, sy, { steps: 10 });
    await page.mouse.up();
    const pAfter = await panel.boundingBox();
    const mAfter = await mid.boundingBox();
    const sumBefore = pBefore.width + mBefore.width;
    const sumAfter = pAfter.width + mAfter.width;
    expect(mAfter.width, `c2 應觸底=${mAfter.width}`).toBeLessThanOrEqual(230);
    // B10：對側欄觸底後繼續拖，另一欄不得加大 → 兩欄總寬守恆
    expect(Math.abs(sumAfter - sumBefore), `兩欄總寬 前=${sumBefore} 後=${sumAfter}`).toBeLessThan(12);
    expect(errs, errs).toEqual([]);
  });

  test('U2 響應式：窄視窗主區橫向捲動、預覽欄維持最小寬', async ({ page }) => {
    const errs = trackPageErrors(page);
    await page.setViewportSize({ width: 820, height: 720 });
    await page.goto('/editor');
    await expect(page.locator('#rtx-editor')).toBeVisible();
    const main = page.locator('.main');
    const narrow = await main.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(narrow.sw, `窄視窗 scrollWidth=${narrow.sw} clientWidth=${narrow.cw}`).toBeGreaterThan(narrow.cw);
    const pw = await page.locator('#ed-preview-panel').evaluate((el) => el.getBoundingClientRect().width);
    expect(pw, `預覽欄寬 ${pw}`).toBeGreaterThanOrEqual(300);
    await page.setViewportSize({ width: 1280, height: 720 });
    const wide = await main.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(wide.sw, `寬視窗 scrollWidth=${wide.sw} clientWidth=${wide.cw}`).toBeLessThanOrEqual(wide.cw + 1);
    expect(errs, errs).toEqual([]);
  });

  test('B8 高度不足時 zone 盒不壓縮、特效項不溢出盒子', async ({ page }) => {
    const errs = trackPageErrors(page);
    await page.setViewportSize({ width: 1280, height: 340 });
    await page.goto('/editor');
    await expect(page.locator('#rtx-editor')).toBeVisible();
    const fx = await page.locator('#ed-fx-list').evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
    // 此高度下內容超出列表視口＝會觸發 B8 的條件（改由捲動而非壓縮）
    expect(fx.sh, `fx-list scrollHeight=${fx.sh} clientHeight=${fx.ch}`).toBeGreaterThan(fx.ch);
    const res = await page.locator('.zone-group').evaluateAll((zgs) =>
      zgs.map((zg) => {
        const items = zg.querySelectorAll('.fx-item');
        const last = items[items.length - 1];
        const box = zg.getBoundingClientRect();
        return {
          scrollHeight: zg.scrollHeight,
          clientHeight: zg.clientHeight,
          leak: last ? last.getBoundingClientRect().bottom - box.bottom : 0,
          count: items.length,
        };
      })
    );
    // S1：主/次/待刪除共 3 個 zone-group
    expect(res.length).toBe(3);
    for (const z of res) {
      expect(z.scrollHeight, `zone scrollHeight=${z.scrollHeight} clientHeight=${z.clientHeight}`).toBeLessThanOrEqual(z.clientHeight + 1);
      expect(z.leak, `特效項溢出 zone 盒 ${z.leak}px（count=${z.count}）`).toBeLessThanOrEqual(2);
    }
    expect(errs, errs).toEqual([]);
  });

  test('B2 拖曳放置指示線可解析成 accent 顏色（drop-before/after/target）', async ({ page }) => {
    const errs = trackPageErrors(page);
    await page.goto('/editor');
    await expect(page.locator('#rtx-editor')).toBeVisible();
    const res = await page.evaluate(() => {
      const probe = document.createElement('i');
      probe.style.color = 'var(--accent)';
      document.body.appendChild(probe);
      const accent = getComputedStyle(probe).color;
      probe.remove();
      const item = document.querySelector('#ed-zone-cur .fx-item');
      const zone = document.getElementById('ed-zone-cur');
      if (!item || !zone) return null;
      const out = { accent };
      item.classList.add('drop-before');
      const a = getComputedStyle(item);
      out.beforeTop = a.borderTopWidth + '|' + a.borderTopStyle + '|' + a.borderTopColor;
      item.classList.remove('drop-before');
      item.classList.add('drop-after');
      const b = getComputedStyle(item);
      out.afterBottom = b.borderBottomWidth + '|' + b.borderBottomStyle + '|' + b.borderBottomColor;
      item.classList.remove('drop-after');
      zone.classList.add('drop-target');
      const c = getComputedStyle(zone);
      out.targetOutline = c.outlineWidth + '|' + c.outlineStyle + '|' + c.outlineColor;
      zone.classList.remove('drop-target');
      return out;
    });
    expect(res, '缺少 zone/fx-item').toBeTruthy();
    expect(res.beforeTop, res.beforeTop).toContain('2px');
    expect(res.beforeTop, res.beforeTop).toContain(res.accent);
    expect(res.afterBottom, res.afterBottom).toContain('2px');
    expect(res.afterBottom, res.afterBottom).toContain(res.accent);
    expect(res.targetOutline, res.targetOutline).toContain('2px');
    expect(res.targetOutline, res.targetOutline).toContain(res.accent);
    expect(errs, errs).toEqual([]);
  });
});

test.describe('2b manifest 載入與特效列表', () => {
  test('fixture manifest（v1）：主區 4 特效、次區空、chips 正確', async ({ page }) => {
    const errs = trackPageErrors(page);
    const resp = await openEditorPage(page);
    const data = await resp.json();
    expect(data.rev).toMatch(/^[0-9a-f]{64}$/);
    expect(data.manifest.version).toBe(1);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 1');
    await expect(page.locator('#ed-chip-rev')).toHaveText(`rev ${data.rev.slice(0, 10)}（base）`);
    await expect(page.locator('#ed-chip-count')).toHaveText('4 / 4 特效啟用');
    await expect(page.locator('#ed-badge')).toContainText('v1');
    // 主區 4 項（manifest 順序）
    const cur = page.locator('#ed-zone-cur .fx-item');
    await expect(cur).toHaveCount(4);
    const curIds = await cur.evaluateAll((els) => els.map((el) => el.getAttribute('data-fx')));
    expect(curIds).toEqual(['particle', 'ripple', 'firework', 'text']);
    await expect(page.locator('#ed-zone-cur-head')).toHaveText('主區 · 已啟用（4）');
    // 次區空
    await expect(page.locator('#ed-zone-alt .fx-item')).toHaveCount(0);
    await expect(page.locator('#ed-zone-alt-head')).toHaveText('次區 · 未啟用（0）');
    // 每項：checkbox / 啟用開關（開）/ 移除鈕、無 [未啟用]
    for (const id of TEST_EFFECTS) {
      const item = page.locator(`#ed-zone-cur .fx-item[data-fx="${id}"]`);
      await expect(item.locator('.fx-chk')).toHaveCount(1);
      await expect(item.locator('.switch.sm input[type="checkbox"]')).toBeChecked();
      await expect(item.locator('.rm')).toHaveCount(1);
      await expect(item.locator('.off-tag')).toHaveCount(0);
    }
    // 首項預設選中
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="particle"]')).toHaveClass(/selected/);
    await expect(page.locator('#ed-meta-title')).toHaveText('Meta · particle');
    expect(errs, errs).toEqual([]);
  });

  test('v2 manifest mock：主/次區分組、disabled 項 [未啟用] 且開關關', async ({ page }) => {
    const errs = trackPageErrors(page);
    const payload = {
      rev: 'abcdef1234',
      manifest: {
        version: 2,
        effects: {
          'fx-a': { label: 'Alpha', enabled: true, params: {} },
          'fx-b': { label: 'Beta', enabled: false, params: {} },
          'fx-c': { label: 'Gamma', params: {} },
          'fx-d': { label: 'Delta', params: {} }
        },
        currentEffects: ['fx-a', 'fx-b'],
        alternateEffects: ['fx-c']
      }
    };
    await page.route(/\/api\/editor\/manifest/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) })
    );
    await openEditorPage(page);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 2');
    await expect(page.locator('#ed-chip-rev')).toHaveText('rev abcdef1234（base）');
    await expect(page.locator('#ed-chip-count')).toHaveText('3 / 4 特效啟用');
    await expect(page.locator('#ed-badge')).toContainText('v2');
    const curIds = await page
      .locator('#ed-zone-cur .fx-item')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-fx')));
    expect(curIds).toEqual(['fx-a', 'fx-b']);
    const altIds = await page
      .locator('#ed-zone-alt .fx-item')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-fx')));
    expect(altIds).toEqual(['fx-c', 'fx-d']);
    const bItem = page.locator('#ed-zone-cur .fx-item[data-fx="fx-b"]');
    await expect(bItem).toHaveClass(/disabled/);
    await expect(bItem.locator('.off-tag')).toHaveText('[未啟用]');
    await expect(bItem.locator('.switch.sm input[type="checkbox"]')).not.toBeChecked();
    await expect(
      page.locator('#ed-zone-cur .fx-item[data-fx="fx-a"] .switch.sm input[type="checkbox"]')
    ).toBeChecked();
    expect(errs, errs).toEqual([]);
  });

  test('[重載]：POST /api/effects/reload 後再抓 manifest 重繪', async ({ page }) => {
    const errs = trackPageErrors(page);
    await openEditorPage(page);
    await expect(page.locator('#ed-chip-count')).toHaveText('4 / 4 特效啟用');
    const reloadResp = page.waitForResponse(
      (r) => r.url().includes('/api/effects/reload') && r.request().method() === 'POST'
    );
    const manifestAgain = page.waitForResponse((r) => r.url().includes('/api/editor/manifest') && r.ok());
    await page.locator('#ed-reload-btn').click();
    const rr = await reloadResp;
    expect(rr.status()).toBe(200);
    const rd = await rr.json();
    expect(rd.ok).toBe(true);
    const m2 = await manifestAgain;
    expect(m2.status()).toBe(200);
    await expect(page.locator('#ed-chip-count')).toHaveText('4 / 4 特效啟用');
    await expect(page.locator('#ed-zone-cur .fx-item')).toHaveCount(4);
    expect(errs, errs).toEqual([]);
  });

  test('U13 SSE 斷流不轉紅：icon 跟隨 manifest 連線（非 SSE）', async ({ page }) => {
    const errs = trackPageErrors(page);
    await openEditorPage(page);
    // manifest 連線成功→badge 已連線、icon ok
    await expect(page.locator('#ed-badge')).toContainText('v1');
    await expect
      .poll(async () => page.evaluate(() => document.querySelector('#ed-conn').classList.contains('ok')))
      .toBe(true);
    // 中斷 SSE→重新整理讓 SSE 在已 abort 的 route 下連線（觸發 error）
    await page.route(/\/api\/stream(\?.*)?$/, (route) => route.abort());
    await page.reload();
    await expect(page.locator('#ed-badge')).toContainText('v1');
    // 等 SSE 連線嘗試（已 abort）觸發 error 後，icon 仍 ok、不轉 err
    await page.waitForTimeout(1000);
    await expect
      .poll(async () => page.evaluate(() => document.querySelector('#ed-conn').classList.contains('ok')))
      .toBe(true);
    await expect
      .poll(async () => page.evaluate(() => !document.querySelector('#ed-conn').classList.contains('err')))
      .toBe(true);
    expect(errs, errs).toEqual([]);
  });
});

function v2Fixture(manifest) {
  const m = { version: 2, effects: {}, currentEffects: [], alternateEffects: [] };
  for (const [id, spec] of Object.entries(manifest.effects)) {
    m.effects[id] = { ...spec, enabled: true };
    m.currentEffects.push(id);
  }
  return m;
}

const createdFxDirs = [];

function trackEffectDir(id) {
  if (!createdFxDirs.includes(id)) createdFxDirs.push(id);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  }
  const localBuf = Buffer.concat(localParts);
  const centralBuf = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(localBuf.length, 16);
  end.writeUInt16LE(0, 18);
  return Buffer.concat([localBuf, centralBuf, end]);
}

function isZip(bytes) {
  return bytes.length > 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

test.describe('2c meta/params 編輯與保存流程', () => {
  let fixtureBytes = null;

  test.beforeAll(async () => {
    fixtureBytes = snapshotFixture();
  });

  test.afterEach(async ({ page }) => {
    restoreFixture(fixtureBytes);
    await waitRateLimit();
    await page.request.post('/api/effects/reload');
  });

  test('v1 fixture：meta/params 控件唯讀、5 參數卡渲染、manifest tab 單項', async ({ page }) => {
    const errs = trackPageErrors(page);
    const resp = await openEditorPage(page);
    const data = await resp.json();
    expect(data.manifest.version).toBe(1);
    await expect(page.locator('#ed-save-btn')).toBeDisabled();
    await expect(page.locator('#ed-add-param')).toBeDisabled();
    for (const sel of ['#ed-meta-label', '#ed-meta-icon', '#chk-enabled']) {
      await expect(page.locator(sel)).toBeDisabled();
    }
    // meta 值跟隨 fixture 的 particle
    await expect(page.locator('#ed-meta-label')).toHaveValue('粒子爆散');
    await expect(page.locator('#ed-meta-icon')).toHaveValue('particle');
    await expect(page.locator('#chk-enabled')).toBeChecked();
    await expect(page.locator('#ed-tabs-hint')).toHaveText('manifest read-only (v1)');
    // 5 張參數卡（particle 順序）
    const cards = page.locator('#ed-p-rows .p-card');
    await expect(cards).toHaveCount(5);
    const keys = await cards.evaluateAll((els) => els.map((el) => el.querySelector('.p-key').value));
    expect(keys).toEqual(['color', 'count', 'spread', 'speed', 'duration']);
    const types = await cards.evaluateAll((els) => els.map((el) => el.querySelector('.p-type').value));
    expect(types).toEqual(['color', 'integer', 'number', 'number', 'integer']);
    // 卡內 input/select 全 disabled
    const ctrls = page.locator('#ed-p-rows .p-card input, #ed-p-rows .p-card select');
    const total = await ctrls.count();
    const disabled = await ctrls.evaluateAll((els) => els.filter((el) => el.disabled).length);
    expect(disabled, `disabled=${disabled} total=${total}`).toBe(total);
    // manifest tab：選定 effect（particle）單項 JSON（textarea 用 inputValue 讀值）
    await page.locator('#ed-tabs .tab[data-tab="manifest"]').click();
    const codeText = await page.locator('#ed-code').inputValue();
    expect(codeText).toContain('"label": "粒子爆散"');
    expect(codeText).toContain('"particle"');
    expect(codeText).not.toContain('"version": 1');
    expect(codeText).not.toContain('漣漪圈');
    expect(errs, errs).toEqual([]);
  });

  test('v2 fixture：改 meta＋param → PUT 200 → 檔案同步、dirty 清、save succeeded', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    const rr = await page.request.post('/api/effects/reload');
    expect(rr.status()).toBe(200);

    await openEditorPage(page);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 2');
    await expect(page.locator('#ed-tabs-hint')).toHaveText('manifest editable (v2)');
    await expect(page.locator('#ed-save-btn')).toBeEnabled();
    await expect(page.locator('#ed-meta-label')).toBeEnabled();

    await page.locator('#ed-meta-label').fill('粒子爆發 v2');
    const cardCount = page.locator('#ed-p-rows .p-card');
    const idx = await cardCount.evaluateAll(
      (els) => els.findIndex((el) => el.querySelector('.p-key').value === 'count')
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    await cardCount.nth(idx).locator('.p-default').fill('12');
    await expect(page.locator('#ed-dirty')).toHaveText('未暫存變更'); // 7m：欄位編輯未 [暫存] → 未暫存變更

    page.on('dialog', (d) => d.accept()); // 7d：[保存至伺服器] confirm 自動接受
    await waitRateLimit();
    const putResp = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'PUT' && r.ok()
    );
    await page.locator('#ed-save-btn').click();
    const pr = await putResp;
    expect(pr.status()).toBe(200);
    const pd = await pr.json();
    expect(pd.ok).toBe(true);
    expect(pd.created).toEqual([]);

    await expect(page.locator('#ed-ops-result')).toContainText('保存成功');
    await expect(page.locator('#ed-dirty')).toHaveText('已同步');
    await expect(page.locator('#ed-meta-label')).toHaveValue('粒子爆發 v2');

    const disk = readFixture();
    expect(disk.version).toBe(2);
    expect(disk.effects.particle.label).toBe('粒子爆發 v2');
    expect(disk.effects.particle.params.count.default).toBe(12);
    expect(disk.currentEffects).toEqual(['particle', 'ripple', 'firework', 'text']);
    expect(errs, errs).toEqual([]);
  });

  test('7j color 參數 default 顏色選取器：v1 唯讀渲染、v2 切 type 重建', async ({ page }) => {
    const errs = trackPageErrors(page);
    // v1：color 卡 default 為 input[type=color]（唯讀）
    await openEditorPage(page);
    let cards = page.locator('#ed-p-rows .p-card');
    let idx = await cards.evaluateAll((els) =>
      els.findIndex((el) => el.querySelector('.p-key').value === 'color')
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    const v1Def = cards.nth(idx).locator('.p-default');
    await expect(v1Def).toHaveAttribute('type', 'color');
    await expect(v1Def).toBeDisabled();
    await expect(v1Def).toHaveValue('#ff0044');

    // v2：default 可編輯；切 type color→string→color（default 重建）
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);
    cards = page.locator('#ed-p-rows .p-card');
    idx = await cards.evaluateAll((els) =>
      els.findIndex((el) => el.querySelector('.p-key').value === 'color')
    );
    const typeSel = cards.nth(idx).locator('.p-type');
    await expect(cards.nth(idx).locator('.p-default')).toHaveAttribute('type', 'color');
    await expect(cards.nth(idx).locator('.p-default')).toBeEnabled();

    await typeSel.selectOption('string');
    await expect(cards.nth(idx).locator('.p-default')).toHaveAttribute('type', 'text');
    await expect(cards.nth(idx).locator('.p-default')).toHaveValue('');

    await typeSel.selectOption('color');
    await expect(cards.nth(idx).locator('.p-default')).toHaveAttribute('type', 'color');
    await expect(cards.nth(idx).locator('.p-default')).toHaveValue('#000000');
    expect(errs, errs).toEqual([]);
  });

  test('7k array 參數 default 子項列：v1 唯讀渲染、v2 新增／刪除／切 type 重建', async ({ page }) => {
    const errs = trackPageErrors(page);
    // v1：firework colors 卡 default 為 4 行子項（唯讀）＋[+ item]
    await openEditorPage(page);
    await page.locator('#ed-zone-cur .fx-item[data-fx="firework"]').click();
    let cards = page.locator('#ed-p-rows .p-card');
    let idx = await cards.evaluateAll((els) =>
      els.findIndex((el) => el.querySelector('.p-key').value === 'colors')
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    const v1Card = cards.nth(idx);
    const v1Rows = v1Card.locator('.p-r2 .p-opt-row');
    await expect(v1Rows).toHaveCount(4);
    const v1Vals = await v1Rows.evaluateAll((els) =>
      els.map((el) => el.querySelector('input').value)
    );
    expect(v1Vals).toEqual(['#ff5252', '#ffd740', '#40c4ff', '#69f0ae']);
    await expect(v1Card.locator('.p-add-opt')).toHaveText('+ item');
    await expect(v1Card.locator('.p-add-opt')).toBeDisabled();
    await expect(v1Rows.nth(0).locator('input')).toBeDisabled();

    // v2：可編輯；新增／刪除子項；切 type array→string→array（default 重建）
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);
    await page.locator('#ed-zone-cur .fx-item[data-fx="firework"]').click();
    cards = page.locator('#ed-p-rows .p-card');
    idx = await cards.evaluateAll((els) =>
      els.findIndex((el) => el.querySelector('.p-key').value === 'colors')
    );
    const card2 = cards.nth(idx);
    const rows2 = card2.locator('.p-r2 .p-opt-row');
    await expect(rows2).toHaveCount(4);
    await expect(card2.locator('.p-add-opt')).toBeEnabled();
    await card2.locator('.p-add-opt').click();
    await expect(rows2).toHaveCount(5);
    await rows2.nth(4).locator('input').fill('#123456');
    await rows2.nth(0).locator('.p-opt-rm').click();
    await expect(rows2).toHaveCount(4);
    const vals2 = await rows2.evaluateAll((els) =>
      els.map((el) => el.querySelector('input').value)
    );
    expect(vals2).toEqual(['#ffd740', '#40c4ff', '#69f0ae', '#123456']);
    await expect(page.locator('#ed-dirty')).toHaveText('未暫存變更'); // 7m：欄位編輯未 [暫存] → 未暫存變更

    const typeSel = card2.locator('.p-type');
    await typeSel.selectOption('string');
    await expect(card2.locator('.p-default')).toHaveAttribute('type', 'text');
    await expect(card2.locator('.p-default')).toHaveValue('');
    await expect(card2.locator('.p-r2 .p-opt-row')).toHaveCount(0);

    await typeSel.selectOption('array');
    await expect(card2.locator('.p-r2 .p-opt-row')).toHaveCount(0);
    await expect(card2.locator('.p-add-opt')).toHaveText('+ item');
    expect(errs, errs).toEqual([]);
  });

  test('409：外部改 fixture＋reload（SSE 斷線）→ 保存 409 → 重抓最新並顯示 409', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    const rr1 = await page.request.post('/api/effects/reload');
    expect(rr1.status()).toBe(200);

    // 斷 SSE 以免 editor 自動同步 rev
    await page.route(/\/api\/stream(\?.*)?$/, (route) => route.abort());
    await openEditorPage(page);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 2');
    await expect(page.locator('#ed-save-btn')).toBeEnabled();

    await page.locator('#ed-meta-label').fill('我的標籤');

    // 外部改動＋reload（server rev 前進）
    await waitRateLimit();
    const ext = readFixture();
    ext.effects.particle.label = '外部改動';
    writeFixture(ext);
    const rr2 = await page.request.post('/api/effects/reload');
    expect(rr2.status()).toBe(200);

    page.on('dialog', (d) => d.accept()); // 7d：[保存至伺服器] confirm 自動接受
    await waitRateLimit();
    const putResp = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'PUT'
    );
    await page.locator('#ed-save-btn').click();
    const pr = await putResp;
    expect(pr.status()).toBe(409);
    expect((await pr.json()).detail).toBe('baseRev mismatch');

    await expect(page.locator('#ed-ops-result')).toContainText('409 衝突');
    await expect(page.locator('#ed-meta-label')).toHaveValue('外部改動');
    expect(errs, errs).toEqual([]);
  });
});

test.describe('2d 拖曳排序、批次操作、新增特效與 zip 匯入匯出（5d staged：按[保存]才寫入）', () => {
  let fixtureBytes = null;

  test.beforeAll(async () => {
    fixtureBytes = snapshotFixture();
  });

  test.afterEach(async ({ page }) => {
    restoreFixture(fixtureBytes);
    for (const id of createdFxDirs.splice(0).reverse()) {
      rmSync(path.join(TEST_EFFECTS_DIR, id), { recursive: true, force: true });
    }
    await waitRateLimit();
    await page.request.post('/api/effects/reload');
  });

  function countMutations(page) {
    const n = { put: 0, del: 0 };
    page.on('request', (req) => {
      const url = req.url();
      if (req.method() === 'PUT' && url.includes('/api/editor/manifest')) n.put++;
      if (req.method() === 'DELETE' && url.includes('/api/editor/effect/')) n.del++;
    });
    return n;
  }

  async function zoneIds(page, sel) {
    return page.locator(`${sel} .fx-item`).evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-fx'))
    );
  }

  test('拖曳同區排序與跨區移動：staged 不立即寫入→[保存]才寫', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    const mut = countMutations(page);
    await openEditorPage(page);

    // 同區排序：ripple → particle 前（staged，無 PUT、磁碟不變）
    await page
      .locator('#ed-zone-cur .fx-item[data-fx="ripple"] .grip')
      .dragTo(page.locator('#ed-zone-cur .fx-item[data-fx="particle"]'), {
        targetPosition: { x: 4, y: 2 }
      });
    await page.waitForTimeout(300);
    expect(mut.put, '未保存前不發 PUT').toBe(0);
    await expect(page.locator('#ed-dirty')).toHaveText('未保存變更');
    expect(readFixture().currentEffects).toEqual(['particle', 'ripple', 'firework', 'text']);
    expect(await zoneIds(page, '#ed-zone-cur')).toEqual(['ripple', 'particle', 'firework', 'text']);

    // [保存]寫入
    page.on('dialog', (d) => d.accept()); // 7d：[保存至伺服器] confirm 自動接受
    await waitRateLimit();
    const putResp1 = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'PUT' && r.ok()
    );
    await page.locator('#ed-save-btn').click();
    const r1 = await putResp1;
    expect(r1.status()).toBe(200);
    expect(mut.put).toBe(1);
    let disk = readFixture();
    expect(disk.currentEffects).toEqual(['ripple', 'particle', 'firework', 'text']);
    expect(disk.alternateEffects).toEqual([]);
    await expect(page.locator('#ed-dirty')).toHaveText('已同步');

    // 跨區移動：particle → 次區（staged，無 PUT、磁碟不變）
    await page
      .locator('#ed-zone-cur .fx-item[data-fx="particle"] .grip')
      .dragTo(page.locator('#ed-zone-alt'), {
        targetPosition: { x: 4, y: 4 }
      });
    await page.waitForTimeout(300);
    expect(mut.put, '未保存前不發 PUT').toBe(1);
    await expect(page.locator('#ed-dirty')).toHaveText('未保存變更');
    expect(readFixture().currentEffects).toEqual(['ripple', 'particle', 'firework', 'text']);
    expect(await zoneIds(page, '#ed-zone-alt')).toEqual(['particle']);

    // [保存]寫入
    await waitRateLimit();
    const putResp2 = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'PUT' && r.ok()
    );
    await page.locator('#ed-save-btn').click();
    const r2 = await putResp2;
    expect(r2.status()).toBe(200);
    disk = readFixture();
    expect(disk.currentEffects).toEqual(['ripple', 'firework', 'text']);
    expect(disk.alternateEffects).toEqual(['particle']);
    expect(errs, errs).toEqual([]);
  });

  test('拖曳指示線隨 cursor 位置落到正確項目（非固定第 1 項）', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);

    const res = await page.evaluate(() => {
      const zone = document.getElementById('ed-zone-cur');
      const items = [...zone.querySelectorAll('.fx-item')];
      const sourceGrip = items[1].querySelector('.grip'); // 拖第 2 項 grip，cursor 滑到最後一項下半
      const target = items[items.length - 1];
      const tr = target.getBoundingClientRect();
      const dt = new DataTransfer();
      sourceGrip.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true }));
      zone.dispatchEvent(new DragEvent('dragover', {
        clientX: tr.x + tr.width / 2,
        clientY: tr.bottom - 2,
        dataTransfer: dt,
        bubbles: true,
        cancelable: true
      }));
      const marker = zone.querySelector('.fx-item.drop-before, .fx-item.drop-after');
      const out = {
        markerFx: marker ? marker.getAttribute('data-fx') : null,
        markerCls: marker ? marker.className : null,
        firstFx: items[0].getAttribute('data-fx'),
        lastFx: target.getAttribute('data-fx')
      };
      sourceGrip.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
      return out;
    });
    // 修正前：指示線恆卡在第 1 項（drop-after item[0]）；修正後：應落最後一項之後
    expect(res.markerFx, JSON.stringify(res)).toBe(res.lastFx);
    expect(res.markerCls).toContain('drop-after');
    expect(res.markerFx).not.toBe(res.firstFx);
    expect(errs, errs).toEqual([]);
  });

  test('批次停用、移入次區：staged→[保存]才寫', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    const mut = countMutations(page);
    await openEditorPage(page);

    await expect(page.locator('#ed-batch-bar')).toBeVisible();
    await expect(page.locator('#ed-batch-count')).toHaveText('已選 0 項');
    await page.locator('#ed-zone-cur .fx-item[data-fx="particle"] .fx-chk').check();
    await page.locator('#ed-zone-cur .fx-item[data-fx="ripple"] .fx-chk').check();
    await expect(page.locator('#ed-batch-count')).toHaveText('已選 2 項');
    await expect(page.locator('#ed-batch-enable')).toBeEnabled();

    // 批次停用（staged：無 PUT、磁碟不變、本地 switch 關閉）
    await page.locator('#ed-batch-disable').click();
    await page.waitForTimeout(300);
    expect(mut.put, '未保存前不發 PUT').toBe(0);
    await expect(page.locator('#ed-dirty')).toHaveText('未保存變更');
    let disk = readFixture();
    expect(disk.effects.particle.enabled).toBe(true);
    expect(disk.effects.ripple.enabled).toBe(true);
    await expect(
      page.locator('#ed-zone-cur .fx-item[data-fx="particle"] .switch.sm input[type="checkbox"]')
    ).not.toBeChecked();
    await expect(
      page.locator('#ed-zone-cur .fx-item[data-fx="ripple"] .switch.sm input[type="checkbox"]')
    ).not.toBeChecked();

    // [保存]寫入
    page.on('dialog', (d) => d.accept()); // 7d：[保存至伺服器] confirm 自動接受
    await waitRateLimit();
    const putResp1 = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'PUT' && r.ok()
    );
    await page.locator('#ed-save-btn').click();
    const r1 = await putResp1;
    expect(r1.status()).toBe(200);
    expect(mut.put).toBe(1);
    disk = readFixture();
    expect(disk.effects.particle.enabled).toBe(false);
    expect(disk.effects.ripple.enabled).toBe(false);
    expect(disk.effects.firework.enabled).toBe(true);

    // 移入次區（staged：無 PUT、磁碟不變、本地已入次區）
    await page.locator('#ed-batch-to-alt').click();
    await page.waitForTimeout(300);
    expect(mut.put, '未保存前不發 PUT').toBe(1);
    await expect(page.locator('#ed-zone-alt .fx-item[data-fx="particle"]')).toBeVisible();
    await expect(page.locator('#ed-zone-alt .fx-item[data-fx="ripple"]')).toBeVisible();
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="particle"]')).toHaveCount(0);
    disk = readFixture();
    expect(disk.currentEffects).toEqual(['particle', 'ripple', 'firework', 'text']);

    // [保存]寫入
    await waitRateLimit();
    const putResp2 = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'PUT' && r.ok()
    );
    await page.locator('#ed-save-btn').click();
    const r2 = await putResp2;
    expect(r2.status()).toBe(200);
    disk = readFixture();
    expect(disk.alternateEffects).toEqual(['particle', 'ripple']);
    expect(disk.currentEffects).toEqual(['firework', 'text']);
    expect(errs, errs).toEqual([]);
  });

  test('P1 就地更新：staged 變更復用未受影響列表節點（非重建，保留節點 identity）', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);
    // 標記未受影響的 firework 列表節點
    await page.evaluate(() => {
      const n = document.querySelector('.fx-item[data-fx="firework"]');
      if (n) n.setAttribute('data-p1-tag', 'reused');
    });
    // 對 particle 做 staged 變更（setEnabled → renderAll/renderList）
    await page.evaluate(() => window.__rtxEditor.setEnabled('particle', false));
    await page.waitForTimeout(120);
    // firework 未受影響 → 其節點應被復用（data-p1-tag 保留），非重建
    const tag = await page.evaluate(() => {
      const n = document.querySelector('.fx-item[data-fx="firework"]');
      return n ? n.getAttribute('data-p1-tag') : null;
    });
    expect(tag).toBe('reused');
    // particle 停用 → 顯示 [未啟用]（.disabled）
    await expect(page.locator('.fx-item[data-fx="particle"]')).toHaveClass(/disabled/);
    expect(errs, errs).toEqual([]);
  });

  test('新增特效（[保存]時 server 建模板）→ 移除（pendingDeletes）→ [保存]刪 effects/ 目錄', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    const mut = countMutations(page);
    await openEditorPage(page);

    let sawPrompt = false;
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') sawPrompt = true;
      await dialog.accept();
    });

    // [＋新增特效] staged：無 PUT、無彈出視窗（U10）、預設 id＋流水號
    await page.locator('#ed-add-btn').click();
    await page.locator('#ed-add-new').click();
    await page.waitForTimeout(300);
    expect(sawPrompt, 'U10：新增特效不應彈出 prompt').toBe(false);
    expect(mut.put, '未保存前不發 PUT').toBe(0);
    await expect(page.locator('#ed-dirty')).toHaveText('未保存變更');
    // 預設 id（effect-1）→ 以 effect_id 欄位改成 zz-test＋[存檔] staged（re-key）
    await page.locator('#ed-meta-id').fill('zz-test');
    await page.locator('#ed-save-file').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="zz-test"]')).toBeVisible();
    expect(existsSync(path.join(TEST_EFFECTS_DIR, 'zz-test'))).toBe(false);

    // [保存]→ PUT（created 含 zz-test）、server 建模板檔
    await waitRateLimit();
    const putResp = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'PUT' && r.ok()
    );
    await page.locator('#ed-save-btn').click();
    const pr = await putResp;
    expect(pr.status()).toBe(200);
    const pd = await pr.json();
    expect(pd.created, pd.created).toContain('zz-test');
    trackEffectDir('zz-test');
    expect(existsSync(path.join(TEST_EFFECTS_DIR, 'zz-test', 'viewer.js'))).toBe(true);
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="zz-test"]')).toBeVisible();

    // [✕ 移除] staged：待刪列、無 DELETE/PUT、目錄仍存在
    await page.locator('#ed-zone-cur .fx-item[data-fx="zz-test"] .rm').click();
    await page.waitForTimeout(300);
    expect(mut.put, '未保存前不發 PUT').toBe(1);
    expect(mut.del, '未保存前不發 DELETE').toBe(0);
    await expect(page.locator('#ed-dirty')).toHaveText('未保存變更');
    await expect(page.locator('.fx-item[data-fx="zz-test"]:not(.pending-delete)')).toHaveCount(0);
    // S1：待刪列顯示於專屬「待刪除/已刪除」區（非主/次區）
    await expect(page.locator('#ed-zone-pending .fx-item[data-fx="zz-test"].pending-delete')).toHaveCount(1);
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="zz-test"], #ed-zone-alt .fx-item[data-fx="zz-test"]')).toHaveCount(0);
    expect(existsSync(path.join(TEST_EFFECTS_DIR, 'zz-test'))).toBe(true);
    expect(readFixture().effects['zz-test']).toBeDefined();

    // [保存]→ PUT deleteRemoved ['zz-test']→ 目錄確實刪除
    await waitRateLimit();
    const putResp2 = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'PUT' && r.ok()
    );
    await page.locator('#ed-save-btn').click();
    const dr = await putResp2;
    expect(dr.status()).toBe(200);
    expect(mut.del, '全程不發 DELETE').toBe(0);
    expect(existsSync(path.join(TEST_EFFECTS_DIR, 'zz-test'))).toBe(false);
    expect(readFixture().effects['zz-test']).toBeUndefined();
    expect(errs, errs).toEqual([]);
  });

  test('匯出 effects.zip 與所選 effect.zip', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);

    await page.locator('#ed-export-btn').click();
    const [downloadAll] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#ed-export-all').click()
    ]);
    expect(await downloadAll.suggestedFilename()).toBe('effects.zip');
    const allPath = await downloadAll.path();
    expect(isZip(readFileSync(allPath))).toBe(true);
    const allEntries = readZipEntries(readFileSync(allPath));
    const allManifest = JSON.parse(allEntries.get('effects.json').toString('utf8'));
    expect(Object.keys(allManifest.effects)).toEqual(['particle', 'ripple', 'firework', 'text']);
    expect(allManifest.currentEffects).toEqual(['particle', 'ripple', 'firework', 'text']);
    expect(allManifest.alternateEffects).toEqual([]);

    await page.locator('#ed-zone-cur .fx-item[data-fx="particle"] .fx-chk').check();
    await page.locator('#ed-zone-cur .fx-item[data-fx="ripple"] .fx-chk').check();
    await page.locator('#ed-export-btn').click();
    const [downloadSel] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#ed-export-sel').click()
    ]);
    expect(await downloadSel.suggestedFilename()).toBe('effects.zip');
    const selPath = await downloadSel.path();
    expect(isZip(readFileSync(selPath))).toBe(true);
    const selEntries = readZipEntries(readFileSync(selPath));
    const selManifest = JSON.parse(selEntries.get('effects.json').toString('utf8'));
    expect(selManifest.version).toBe(2);
    expect(Object.keys(selManifest.effects).sort()).toEqual(['particle', 'ripple']);
    expect(selManifest.currentEffects).toEqual(['particle', 'ripple']);
    expect(selManifest.alternateEffects).toEqual([]);
    expect(selEntries.has('particle/viewer.js')).toBe(true);
    expect(selEntries.has('ripple/viewer.js')).toBe(true);
    expect(selEntries.has('text/viewer.js')).toBe(false);
    expect(errs, errs).toEqual([]);
  });

  test('匯入 effects.zip（effects.json only）staged → [保存] 建立新特效', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);

    const importedManifest = {
      version: 2,
      effects: {
        'imported-fx': {
          label: 'Imported',
          enabled: true,
          params: {}
        }
      },
      currentEffects: ['imported-fx'],
      alternateEffects: []
    };
    const zipBytes = buildZip([
      {
        name: 'effects.json',
        data: Buffer.from(JSON.stringify(importedManifest, null, 2), 'utf8')
      }
    ]);

    const importResp = page.waitForResponse(
      (r) => r.url().includes('/api/editor/import') && r.request().method() === 'POST' && r.ok()
    );
    await page
      .locator('#ed-file-import-effects')
      .setInputFiles({ name: 'effect.zip', mimeType: 'application/zip', buffer: zipBytes });
    const ir = await importResp;
    expect(ir.status()).toBe(200);
    const id = await ir.json();
    expect(id.dryRun).toBe(true);
    expect(Object.keys(id.importedEffects), id.importedEffects).toEqual(['imported-fx']);
    expect(id.files, 'staged files 含 template viewer.js').toHaveProperty(['imported-fx/viewer.js']);
    // staged：目錄尚未建立
    expect(existsSync(path.join(TEST_EFFECTS_DIR, 'imported-fx'))).toBe(false);
    // 列表項 staged 可見
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="imported-fx"]')).toBeVisible();
    // [保存] 寫入
    trackEffectDir('imported-fx');
    page.on('dialog', (d) => d.accept()); // 7d：[保存至伺服器] confirm 自動接受
    await waitRateLimit();
    await page.locator('#ed-save-btn').click();
    await waitRateLimit();
    expect(existsSync(path.join(TEST_EFFECTS_DIR, 'imported-fx', 'viewer.js'))).toBe(true);
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="imported-fx"]')).toBeVisible();
    expect(errs, errs).toEqual([]);
  });
});

const VIEWER_JS_PATH = path.join(TEST_EFFECTS_DIR, 'particle', 'viewer.js');
const CONSOLE_JS_PATH = path.join(TEST_EFFECTS_DIR, 'particle', 'console.js');

test.describe('3a 程式碼編輯（viewer.js / console.js）', () => {
  let viewerBytes = null;

  let fixtureBytes = null;

  test.beforeAll(async () => {
    fixtureBytes = snapshotFixture();
    viewerBytes = readFileSync(VIEWER_JS_PATH);
  });

  test.afterEach(async ({ page }) => {
    restoreFixture(fixtureBytes);
    writeFileSync(VIEWER_JS_PATH, viewerBytes);
    await waitRateLimit();
    await page.request.post('/api/effects/reload');
  });

  test('v2：viewer.js 載入→編輯→[存檔] staged → [保存] 寫入 → 檔案同步', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 2');
    await expect(page.locator('#ed-tabs-hint')).toHaveText('manifest editable (v2)');
    await expect(page.locator('#ed-save-file')).toBeEnabled();
    await expect(page.locator('#ed-tabs .tab.active')).toHaveText('effects.json');

    await waitRateLimit();
    await page.locator('#ed-tabs .tab[data-tab="viewer"]').click();
    const served = readFileSync(VIEWER_JS_PATH, 'utf8').replace(/\r\n/g, '\n');
    await expect(page.locator('#ed-code')).toHaveValue(served);
    await expect(page.locator('#ed-code-gutter')).not.toBeEmpty();

    const newContent = served + '\n// edited by 3a\n';
    await page.locator('#ed-code').fill(newContent);

    // [存檔] staged（無 PUT、dirty）
    await waitRateLimit();
    await page.locator('#ed-save-file').click();
    await expect(page.locator('#ed-ops-result')).toContainText('code 已暫存');
    await expect(page.locator('#ed-dirty')).toHaveText('未保存變更');
    expect(readFileSync(VIEWER_JS_PATH, 'utf8').replace(/\r\n/g, '\n')).toBe(served);

    // [保存] 寫 manifest（含 staged files，單一原子請求）
    page.on('dialog', (d) => d.accept()); // 7d：[保存至伺服器] confirm 自動接受
    await waitRateLimit();
    const savePut = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'PUT' && r.ok()
    );
    await page.locator('#ed-save-btn').click();
    const fp = await savePut;
    expect(fp.status()).toBe(200);
    const pd = await fp.json();
    expect(pd.ok).toBe(true);
    await expect(page.locator('#ed-ops-result')).toContainText('保存成功');
    await expect(page.locator('#ed-dirty')).toHaveText('已同步');
    await expect(page.locator('#ed-chip-rev')).toHaveText(`rev ${pd.rev.slice(0, 10)}（base）`);
    expect(readFileSync(VIEWER_JS_PATH, 'utf8').replace(/\r\n/g, '\n')).toBe(newContent);
    expect(errs, errs).toEqual([]);
  });

  test('7d：[保存至伺服器] confirm——有未暫存變更→取消不 PUT；確認→PUT 且編輯框回到 server 基準', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 2');
    await page.locator('#ed-tabs .tab[data-tab="viewer"]').click();
    const served = readFileSync(VIEWER_JS_PATH, 'utf8').replace(/\r\n/g, '\n');
    await expect(page.locator('#ed-code')).toHaveValue(served);
    const code = page.locator('#ed-code');

    // 編輯→未暫存變更
    await code.fill(served + '\n// edited');
    await expect(page.locator('#ed-dirty')).toHaveText('未暫存變更');

    const seen = [];
    let acceptNext = false;
    page.on('dialog', async (d) => {
      if (d.type() === 'confirm') { seen.push(d.message()); if (acceptNext) await d.accept(); else await d.dismiss(); }
      else await d.accept();
    });

    // (a) 取消→不 PUT、編輯框與指標不變
    await waitRateLimit();
    await page.locator('#ed-save-btn').click();
    await page.waitForTimeout(400);
    expect(seen).toEqual(['有未暫存的程式碼變更：未暫存變更不會保存到伺服器（請先按 [暫存]）。仍要保存至伺服器？']);
    await expect(code).toHaveValue(served + '\n// edited');
    await expect(page.locator('#ed-dirty')).toHaveText('未暫存變更');

    // (b) 確認→PUT 200、保存成功、編輯框回到 server 基準（已同步）
    acceptNext = true;
    await waitRateLimit();
    const savePut = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'PUT' && r.ok()
    );
    await page.locator('#ed-save-btn').click();
    const fp = await savePut;
    expect(fp.status()).toBe(200);
    await expect(page.locator('#ed-ops-result')).toContainText('保存成功');
    await expect(code).toHaveValue(served);
    await expect(page.locator('#ed-dirty')).toHaveText('已同步');
    expect(errs, errs).toEqual([]);
  });

  test('v2：console.js 載入＋匯出下載內容一致', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 2');

    await waitRateLimit();
    await page.locator('#ed-tabs .tab[data-tab="console"]').click();
    const consoleJs = readFileSync(CONSOLE_JS_PATH, 'utf8').replace(/\r\n/g, '\n');
    await expect(page.locator('#ed-code')).toHaveValue(consoleJs);

    await waitRateLimit();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#ed-export-file').click()
    ]);
    expect(await download.suggestedFilename()).toBe('console.js');
    const dl = readFileSync(await download.path());
    expect(dl.toString('utf8').replace(/\r\n/g, '\n')).toBe(consoleJs);
    await expect(page.locator('#ed-ops-result')).toContainText('匯出成功');
    expect(errs, errs).toEqual([]);
  });

  test('3a 語法高亮：底層 <pre> 依 JS token 上色、textarea 文字透明＋隨輸入重繪', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 2');

    await waitRateLimit();
    await page.locator('#ed-tabs .tab[data-tab="viewer"]').click();
    const served = readFileSync(VIEWER_JS_PATH, 'utf8').replace(/\r\n/g, '\n');
    await expect(page.locator('#ed-code')).toHaveValue(served);
    // 載入後底層高亮已渲染（tok-* span）
    let hl = await page.locator('#ed-code-highlight-code').innerHTML();
    expect(hl).toContain('class="tok-');

    // scroll 同步：底層 code／gutter inner 以 transform 跟隨 textarea 捲動（不經 scrollTop clamp 錯位）
    await page.evaluate(() => {
      const ta = document.getElementById('ed-code');
      ta.scrollTop = ta.scrollHeight;
      ta.scrollLeft = ta.scrollWidth;
    });
    await page.waitForTimeout(100);
    const sync = await page.evaluate(() => {
      const ta = document.getElementById('ed-code');
      return {
        y: ta.scrollTop,
        x: ta.scrollLeft,
        codeT: document.getElementById('ed-code-highlight-code').style.transform,
        gutT: document.getElementById('ed-code-gutter-inner').style.transform
      };
    });
    expect(sync.y).toBeGreaterThan(0);
    expect(sync.codeT).toBe(`translate(${0 - sync.x}px, ${0 - sync.y}px)`);
    expect(sync.gutT).toBe(`translateY(${0 - sync.y}px)`);

    // 輸入新內容→重繪高亮、textarea 仍為純文字
    const typed = 'function f(a) { return a + 1; } // hi\n';
    await page.locator('#ed-code').fill(typed);
    await expect(page.locator('#ed-code')).toHaveValue(typed);
    hl = await page.locator('#ed-code-highlight-code').innerHTML();
    expect(hl).toContain('class="tok-keyword">function');
    expect(hl).toContain('class="tok-number">1');
    expect(hl).toContain('class="tok-comment">// hi');

    // 表層 textarea 文字透明（靠底層顯示顏色）、游標可見
    const ta = await page.evaluate(() => {
      const s = getComputedStyle(document.getElementById('ed-code'));
      return { color: s.color, caret: s.caretColor };
    });
    expect(ta.color).toMatch(/rgba\(0, 0, 0, 0\)/);
    expect(ta.caret).not.toMatch(/rgba\(0, 0, 0, 0\)/);
    expect(errs, errs).toEqual([]);
  });

  test('5p 新增特效：viewer tab 直接套用模板（無檔案 → server 模板、不落盤）', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);
    await expect(page.locator('#ed-tabs .tab.active')).toHaveText('effects.json');
    await waitRateLimit();
    await page.locator('#ed-tabs .tab[data-tab="viewer"]').click();
    await expect(page.locator('#ed-code')).not.toBeEmpty(); // particle viewer
    let sawPrompt = false;
    page.on('dialog', async (d) => {
      if (d.type() === 'prompt') sawPrompt = true;
      await d.accept();
    });
    await page.locator('#ed-add-btn').click();
    await page.locator('#ed-add-new').click();
    await page.waitForTimeout(300); // 讓新特效（預設 id）的 viewer 模板載入完成
    expect(sawPrompt, 'U10：新增特效不應彈出 prompt').toBe(false);
    // 預設 id（effect-1）→ 以 effect_id 欄位改成 zz-tpl＋[存檔]（viewer tab：re-key＋重載模板）
    await page.locator('#ed-meta-id').fill('zz-tpl');
    await page.locator('#ed-save-file').click();
    await page.waitForTimeout(400);
    // 選取維持新特效，viewer 預覽顯示 server 模板（含新特效 id zz-tpl）
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="zz-tpl"].selected')).toBeVisible();
    await expect(page.locator('#ed-code')).toHaveValue(/window\.Effects\.register\("zz-tpl"/);
    // 模板不落盤
    expect(existsSync(path.join(TEST_EFFECTS_DIR, 'zz-tpl'))).toBe(false);
    expect(errs, errs).toEqual([]);
  });

  test('5p [存檔] staged：切換特效再切回不遺忘變更（顯示 staged、server 檔未變）', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);
    await expect(page.locator('#ed-tabs .tab.active')).toHaveText('effects.json');
    await waitRateLimit();
    await page.locator('#ed-tabs .tab[data-tab="viewer"]').click();
    const served = readFileSync(VIEWER_JS_PATH, 'utf8').replace(/\r\n/g, '\n');
    await expect(page.locator('#ed-code')).toHaveValue(served);
    // 編輯並 [存檔]（staged、不寫 server）
    await page.locator('#ed-code').fill(served + '\n// staged edit\n');
    await page.locator('#ed-save-file').click();
    await expect(page.locator('#ed-ops-result')).toContainText('code 已暫存');
    expect(readFileSync(VIEWER_JS_PATH, 'utf8').replace(/\r\n/g, '\n')).toBe(served);
    // 切到 ripple 再切回 particle → 顯示 staged（不遺忘變更）
    await page.locator('#ed-zone-cur .fx-item[data-fx="ripple"] .name').click();
    await waitRateLimit();
    await page.locator('#ed-zone-cur .fx-item[data-fx="particle"] .name').click();
    await expect(page.locator('#ed-code')).toHaveValue(/\/\/ staged edit/);
    await expect(page.locator('#ed-ops-result')).toContainText('particle 顯示 [暫存] 的 staged 內容');
    // server 檔仍未變（staged 未寫入）
    expect(readFileSync(VIEWER_JS_PATH, 'utf8').replace(/\r\n/g, '\n')).toBe(served);
    expect(errs, errs).toEqual([]);
  });

  test('v1：code 控件 disabled、textarea readOnly', async ({ page }) => {
    const errs = trackPageErrors(page);
    await openEditorPage(page);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 1');
    await expect(page.locator('#ed-tabs-hint')).toHaveText('manifest read-only (v1)');
    await expect(page.locator('#ed-save-file')).toBeDisabled();
    await expect(page.locator('#ed-import-file')).toBeDisabled();
    await expect(page.locator('#ed-export-file')).toBeDisabled();
    await expect(page.locator('#ed-code')).toHaveAttribute('readonly', '');
    expect(errs, errs).toEqual([]);
  });

  test('B：程式碼未[暫存]變更——編輯即 dirty、切換特效 confirm（取消→不切換）、[重載] confirm＋刷新編輯框', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 2');
    await page.locator('#ed-tabs .tab[data-tab="viewer"]').click();
    const served = readFileSync(VIEWER_JS_PATH, 'utf8').replace(/\r\n/g, '\n');
    await expect(page.locator('#ed-code')).toHaveValue(served);
    const code = page.locator('#ed-code');

    // (a) 編輯→ 四態指示器立即「未暫存變更」（未 [暫存]）
    await code.fill(served + '\n// edited');
    await expect(page.locator('#ed-dirty')).toHaveText('未暫存變更');

    // dialog 控制：confirm 依 acceptNext accept／dismiss
    const seen = [];
    let acceptNext = false;
    page.on('dialog', async (d) => {
      if (d.type() === 'confirm') { seen.push(d.message()); if (acceptNext) await d.accept(); else await d.dismiss(); }
      else await d.accept();
    });

    // (b) 切換特效→ confirm（取消→不切換、編輯框未變）
    const beforeTitle = (await page.locator('#ed-meta-title').textContent()).trim();
    await page.locator('#ed-zone-cur .fx-item').nth(1).click();
    await page.waitForTimeout(400);
    expect(seen).toEqual(['有未暫存的程式碼變更，切換特效將捨棄。確定繼續？']);
    expect((await page.locator('#ed-meta-title').textContent()).trim()).toBe(beforeTitle);

    // (c) [重載]→ confirm（dirty，因已編輯）→ 接受→ 刷新編輯框為 server 內容
    acceptNext = true;
    await waitRateLimit();
    const reloadResp = page.waitForResponse(
      (r) => r.url().includes('/api/effects/reload') && r.request().method() === 'POST'
    );
    await page.locator('#ed-reload-btn').click();
    const rr = await reloadResp;
    expect(rr.status()).toBe(200);
    await page.waitForTimeout(500);
    expect(seen.length).toBe(2);
    expect(seen[1]).toContain('未保存變更');
    await expect(code).toHaveValue(served);
    expect(errs, errs).toEqual([]);
  });
});

async function installCreateRecorder(page) {
  await page.evaluate(async () => {
    if (typeof window.Effects === 'undefined') {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = '/viewer/effects.js';
        s.onload = resolve;
        s.onerror = () => reject(new Error('effects.js load failed'));
        document.body.appendChild(s);
      });
    }
    window.__previewCreateCalls = [];
    const orig = window.Effects.createEffect.bind(window.Effects);
    window.Effects.createEffect = function (type, px, py, params) {
      const fx = orig(type, px, py, params);
      window.__previewCreateCalls.push({ type, px, py, params: params || null });
      return fx;
    };
  });
}

test.describe('3b 即時預覽＋清屏', () => {
  test('v1：開始預覽 → createEffect 400/225、label、canvas 有像素、清屏停止', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    await openEditorPage(page);
    await installCreateRecorder(page);

    const pluginResp = page.waitForResponse((r) => r.url().includes('/effects/particle/viewer.js'));
    await page.locator('#ed-preview-start').click();
    await pluginResp;
    await expect
      .poll(async () => page.evaluate(() => window.__previewCreateCalls.length))
      .toBeGreaterThan(0);
    const call = await page.evaluate(() => window.__previewCreateCalls[0]);
    expect(call.type).toBe('particle');
    expect(call.px).toBe(400);
    expect(call.py).toBe(225);
    expect(call.params, call.params).toEqual(expect.any(Object));
    await expect(page.locator('#ed-preview-label')).toContainText('粒子爆散');
    await expect(page.locator('#ed-preview-canvas')).toBeVisible();
    await expect
      .poll(async () => canvasHasPixelsNear(page, 0.5, 0.5))
      .toBe(true);
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(true);

    await page.locator('#ed-preview-clear').click();
    await expect(page.locator('#ed-ops-result')).toContainText('已清除預覽畫面');
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(false);
    expect(errs, errs).toEqual([]);
  });

  test('v1：清屏 → 只清編輯器 canvas、不 POST /api/clear、running 停止', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    await openEditorPage(page);
    await installCreateRecorder(page);

    let clearCalls = 0;
    page.on('request', (r) => {
      if (r.url().endsWith('/api/clear') && r.method() === 'POST') clearCalls += 1;
    });

    await page.locator('#ed-preview-start').click();
    await expect
      .poll(async () => page.evaluate(() => window.__previewCreateCalls.length))
      .toBeGreaterThan(0);
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(true);

    await page.locator('#ed-preview-clear').click();
    await expect(page.locator('#ed-ops-result')).toContainText('已清除預覽畫面');
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(false);
    await new Promise((res) => setTimeout(res, 150));
    expect(clearCalls, 'clearCalls').toBe(0, '[清屏] 不應 POST /api/clear');
    expect(errs, errs).toEqual([]);
  });

  test('7e：速率滑桿／暫停／重播互動＋控制狀態同步', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    await openEditorPage(page);

    // 未 running：rate 滑桿常啟用、pause/replay disabled（首次預覽前）
    await expect(page.locator('#ed-preview-rate')).toBeEnabled();
    await expect(page.locator('#ed-preview-pause')).toBeDisabled();
    await expect(page.locator('#ed-preview-replay')).toBeDisabled();
    await expect(page.locator('#ed-preview-rate-val')).toHaveText('1×');
    await expect(page.locator('#ed-preview-pause')).toHaveAttribute('aria-label', '暫停');

    // viewer.js 請求計數（重播不應再請求）
    let pluginReqs = 0;
    page.on('request', (r) => {
      if (r.url().includes('/effects/ripple/viewer.js')) pluginReqs += 1;
    });

    // 選 ripple（固定 1200ms）→ 開始預覽 → 啟用
    await page.locator('.fx-item[data-fx="ripple"]').click();
    const pluginResp = page.waitForResponse((r) => r.url().includes('/effects/ripple/viewer.js'));
    await page.locator('#ed-preview-start').click();
    await pluginResp;
    expect(pluginReqs, `pluginReqs=${pluginReqs}`).toBe(1);
    await expect(page.locator('#ed-preview-rate')).toBeEnabled();
    await expect(page.locator('#ed-preview-pause')).toBeEnabled();
    await expect(page.locator('#ed-preview-replay')).toBeEnabled();
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(true);

    // 暫停 → 繼續（paused=true、仍 running；7h：aria-label 切「繼續」）
    await page.locator('#ed-preview-pause').click();
    await expect(page.locator('#ed-preview-pause')).toHaveAttribute('aria-label', '繼續');
    await expect(await page.evaluate(() => window.__rtxEditor.preview.paused)).toBe(true);
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(true);

    // 暫停中 vtime 凍結（隔 300ms 兩讀相同）
    const vA = await page.evaluate(() => window.__rtxEditor.preview.vtime);
    await new Promise((res) => setTimeout(res, 300));
    const vB = await page.evaluate(() => window.__rtxEditor.preview.vtime);
    expect(vB, `vA=${vA} vB=${vB}`).toBe(vA);

    // 速率 → 4×：顯示同步（暫停中改速率）
    await page.locator('#ed-preview-rate').evaluate((el) => {
      el.value = '4';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.locator('#ed-preview-rate-val')).toHaveText('4×');
    await expect(await page.evaluate(() => window.__rtxEditor.preview.rate)).toBe(4);

    // 繼續 → 暫停（paused=false），隨即再暫停凍結
    await page.locator('#ed-preview-pause').click();
    await expect(page.locator('#ed-preview-pause')).toHaveAttribute('aria-label', '暫停');
    await expect(await page.evaluate(() => window.__rtxEditor.preview.paused)).toBe(false);
    await page.locator('#ed-preview-pause').click();
    await expect(page.locator('#ed-preview-pause')).toHaveAttribute('aria-label', '繼續');

    // 重播：running、vtime 重置 ~0、rate 保持 4×、不重請求 .js
    await page.locator('#ed-preview-replay').click();
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(true);
    const vC = await page.evaluate(() => window.__rtxEditor.preview.vtime);
    expect(vC, `vC=${vC}`).toBeGreaterThanOrEqual(0);
    expect(vC, `vC=${vC}`).toBeLessThan(400);
    expect(pluginReqs, `pluginReqs=${pluginReqs}`).toBe(1, '重播不應再請求 viewer.js');
    await expect(await page.evaluate(() => window.__rtxEditor.preview.rate)).toBe(4);

    // [清屏] 停止 → rate 常啟用、pause disabled、replay 仍啟用
    await page.locator('#ed-preview-clear').click();
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(false);
    await expect(page.locator('#ed-preview-rate')).toBeEnabled();
    await expect(page.locator('#ed-preview-pause')).toBeDisabled();
    await expect(page.locator('#ed-preview-replay')).toBeEnabled();

    expect(errs, errs).toEqual([]);
  });

  test('7h：transport 影片撥放器式圖示按鈕（重播/暫停/清屏 SVG＋aria-label、暫停中切 play）', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    await openEditorPage(page);

    // 三圖示按鈕皆渲染 SVG（RTX_UI_ICONS replay/pause/end）＋aria-label
    await expect(page.locator('#ed-preview-replay .ui-ico svg')).toHaveCount(1);
    await expect(page.locator('#ed-preview-pause .ui-ico svg')).toHaveCount(1);
    await expect(page.locator('#ed-preview-clear .ui-ico svg')).toHaveCount(1);
    await expect(page.locator('#ed-preview-replay')).toHaveAttribute('aria-label', '重播');
    await expect(page.locator('#ed-preview-pause')).toHaveAttribute('aria-label', '暫停');
    await expect(page.locator('#ed-preview-clear')).toHaveAttribute('aria-label', '清屏');

    // 選 ripple（固定 1200ms）→ 開始預覽 → 暫停：aria-label 暫停→繼續
    await page.locator('.fx-item[data-fx="ripple"]').click();
    const pluginResp = page.waitForResponse((r) => r.url().includes('/effects/ripple/viewer.js'));
    await page.locator('#ed-preview-start').click();
    await pluginResp;
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(true);
    await page.locator('#ed-preview-pause').click();
    await expect(page.locator('#ed-preview-pause')).toHaveAttribute('aria-label', '繼續');
    await expect(await page.evaluate(() => window.__rtxEditor.preview.paused)).toBe(true);

    expect(errs, errs).toEqual([]);
  });

  test('7i：[清屏] >| 圖示＋啟用邏輯統一於 [重播][暫停]＋訊息更新', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    await openEditorPage(page);

    // >|（end）圖示＋精簡 title（不再強調編輯器/viewer）＋首次預覽前 disabled
    await expect(page.locator('#ed-preview-clear .ui-ico svg')).toHaveCount(1);
    await expect(page.locator('#ed-preview-clear')).toHaveAttribute('title', '結束預覽並清除畫面');
    await expect(page.locator('#ed-preview-clear')).toBeDisabled();

    // 選 ripple → 開始預覽 → 啟用（同 [重播][暫停]）
    await page.locator('.fx-item[data-fx="ripple"]').click();
    const pluginResp = page.waitForResponse((r) => r.url().includes('/effects/ripple/viewer.js'));
    await page.locator('#ed-preview-start').click();
    await pluginResp;
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(true);
    await expect(page.locator('#ed-preview-clear')).toBeEnabled();

    // [清屏]：清除畫面＋結果訊息（不再強調編輯器 canvas）＋停止後仍啟用（同 [重播]）
    await page.locator('#ed-preview-clear').click();
    await expect(page.locator('#ed-ops-result')).toContainText('已清除預覽畫面');
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(false);
    await expect(page.locator('#ed-preview-clear')).toBeEnabled();

    expect(errs, errs).toEqual([]);
  });
});

test.describe('U15 簡化 console（mini-console）', () => {
  test('v1：FAB 初始收合；[開始預覽]→icon＋參數 render（僅展示）；[參數] 折疊；切換特效→清空', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    await openEditorPage(page);

    // FAB 存在、初始收合
    await expect(page.locator('#ed-mini-fab')).toBeVisible();
    await expect(page.locator('#ed-mini-console')).toBeHidden();

    // FAB 初始位置在 canvas（preview-box）範圍內（可移動範圍限縮至 canvas 大小）
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const fab = document.querySelector('#ed-mini-fab').getBoundingClientRect();
          const box = document.querySelector('#ed-preview-box').getBoundingClientRect();
          return (
            fab.left >= box.left &&
            fab.right <= box.right &&
            fab.top >= box.top &&
            fab.bottom <= box.bottom
          );
        })
      )
      .toBe(true);

    // [開始預覽]→讀 particle console.js→特效鈕 icon＋name
    const consoleResp = page.waitForResponse((r) => r.url().includes('/effects/particle/console.js'));
    await page.locator('#ed-preview-start').click();
    await consoleResp;
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const el = document.querySelector('#ed-mini-fx-icon');
          return el ? el.innerHTML.indexOf('<svg') >= 0 : false;
        })
      )
      .toBe(true);

    // 展開面板（FAB）
    await page.locator('#ed-mini-fab').click();
    await expect(page.locator('#ed-mini-console')).toBeVisible();
    await expect(page.locator('#ed-mini-fx-name')).toContainText('粒子爆散');

    // [參數] 展開→console.js render 出的輸入框（僅展示）
    await page.locator('#ed-mini-params').click();
    await expect(page.locator('#ed-mini-params-body')).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const b = document.querySelector('#ed-mini-params-body');
          return b ? b.querySelectorAll('.rtx-field input, .rtx-field select').length : 0;
        })
      )
      .toBe(5); // particle：color/count/spread/speed/duration

    // 切換特效→清空簡化 console
    await page.locator('.fx-item[data-fx="ripple"]').click();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const el = document.querySelector('#ed-mini-fx-name');
          return el ? el.textContent.trim() === '' : true;
        })
      )
      .toBe(true);

    expect(errs, errs).toEqual([]);
  });

  test('v2：canvas 縮小（.rsz 拖曳）→ FAB/面板重 clamp 至新 canvas 邊界內（不超出）', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    await openEditorPage(page);

    // [開始預覽]→canvas 渲染
    const consoleResp = page.waitForResponse((r) => r.url().includes('/effects/particle/console.js'));
    await page.locator('#ed-preview-start').click();
    await consoleResp;

    // 展開簡化 console＋參數（面板展開、較高）
    await page.locator('#ed-mini-fab').click();
    await expect(page.locator('#ed-mini-console')).toBeVisible();
    await page.locator('#ed-mini-params').click();
    await expect(page.locator('#ed-mini-params-body')).toBeVisible();

    // 拖曳 .rsz[2] 右移→縮小預覽欄（canvas 變小）
    const pvBefore = await page.locator('#ed-preview-panel').boundingBox();
    const bar = page.locator('.rsz[data-rsz="2"]');
    const box = await bar.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    const pvAfter = await page.locator('#ed-preview-panel').boundingBox();
    expect(pvAfter.width, `預覽欄 前=${pvBefore.width} 後=${pvAfter.width}`).toBeLessThan(pvBefore.width - 30);

    // FAB 與面板皆應重 clamp 至「縮小後」的 canvas（preview-box）範圍內（不超出邊界）
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const fab = document.querySelector('#ed-mini-fab').getBoundingClientRect();
          const con = document.querySelector('#ed-mini-console').getBoundingClientRect();
          const box = document.querySelector('#ed-preview-box').getBoundingClientRect();
          const inBox = (r) =>
            r.left >= box.left - 1 &&
            r.right <= box.right + 1 &&
            r.top >= box.top - 1 &&
            r.bottom <= box.bottom + 1;
          return inBox(fab) && inBox(con);
        })
      )
      .toBe(true);

    expect(errs, errs).toEqual([]);
  });

  test('v3：無 console.js 特效（firework）→簡化 console 亦渲染編輯框；未存參數變更亦反映', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    await openEditorPage(page);

    // 選 firework（manifest 無 console.js）
    await page.locator('.fx-item[data-fx="firework"]').click();

    // [開始預覽]→無 plugin render→schema fallback
    await page.locator('#ed-preview-start').click();
    await expect(page.locator('#ed-mini-fx-name')).toContainText('煙火');

    // 展開面板＋參數→schema fallback 渲染編輯框（count/duration；colors array editable:false 略過）
    await page.locator('#ed-mini-fab').click();
    await expect(page.locator('#ed-mini-console')).toBeVisible();
    await page.locator('#ed-mini-params').click();
    await expect(page.locator('#ed-mini-params-body')).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const b = document.querySelector('#ed-mini-params-body');
          return b ? b.querySelectorAll('.mini-field input, .mini-field select').length : 0;
        })
      )
      .toBe(2);
    await expect(page.locator('#ed-mini-params-body #rtx-p-count')).toHaveValue('90');
    await expect(page.locator('#ed-mini-params-body #rtx-p-duration')).toHaveValue('1800');

    // 未存變更：count 卡 default 90→120（不存檔）→再預覽→mini console 值同步
    // （.p-key value 是 JS property 非 attribute→無法用 CSS [value=] 篩選，改 evaluate 定位）
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.p-card'));
      const card = cards.find((c) => c.querySelector('.p-key').value === 'count');
      if (!card) throw new Error('count card not found');
      const inp = card.querySelector('.p-default');
      inp.value = '120';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#ed-preview-start').click();
    await expect
      .poll(async () => page.locator('#ed-mini-params-body #rtx-p-count').inputValue())
      .toBe('120');

    expect(errs, errs).toEqual([]);
  });
});

test.describe('S1 插件 script 節點計數穩定（memory governance）', () => {
  let fixtureBytes = null;
  let viewerBytes = null;

  test.beforeAll(async () => {
    fixtureBytes = snapshotFixture();
    viewerBytes = readFileSync(VIEWER_JS_PATH, 'utf8');
  });

  test.afterEach(async ({ page }) => {
    restoreFixture(fixtureBytes);
    writeFileSync(VIEWER_JS_PATH, viewerBytes);
    await waitRateLimit();
    await page.request.post('/api/effects/reload');
  });

  test('重覆預覽／存檔／rev 變化：E2 不注入 body script、head 不累積、同 rev 免重複 request', async ({
    page,
  }) => {
    const errs = trackPageErrors(page);
    await page.addInitScript(() => {
      window.__rtxWinErrors = [];
      window.addEventListener('error', (e) => {
        const headNode = document.head.querySelector('script[data-rtx-effect]');
        window.__rtxWinErrors.push({
          message: e.message,
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          stack: e.error && e.error.stack,
          headSrc: headNode && headNode.src,
          headCount: document.head.querySelectorAll('script[data-rtx-effect]').length,
          t: Date.now(),
        });
      });
    });
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);
    await installCreateRecorder(page);

    // E2：preview plugin 走 fetch 文字＋new Function（不注入 body <script data-rtx-effect>）
    const effectGets = [];
    page.on('response', (r) => {
      const u = r.url();
      if (u.includes('/effects/particle/viewer.js') && !u.includes('/api/')) effectGets.push(u);
    });
    const bodyMarked = () =>
      page.evaluate(() => document.body.querySelectorAll('script[data-rtx-effect]').length);
    const headMarked = () =>
      page.evaluate(() => document.head.querySelectorAll('script[data-rtx-effect]').length);
    const coreCount = () =>
      page.evaluate(() =>
        Array.from(document.body.querySelectorAll('script')).filter(
          (s) => !s.hasAttribute('data-rtx-effect') && /\/viewer\/effects\.js(\?|$)/.test(s.src)
        ).length
      );
    // E2 fetch URL 用 effRev = spec.viewerRev || state.rev；server manifest entry 無 per-effect rev
    // → 實際以 state.rev（catalog fingerprint，含檔案 hash）為 ?v=
    const manifestRev = () => page.evaluate(() => window.__rtxEditor.state.rev);

    // 每 phase 前打時間戳：若出現 429，對照該 phase 的 request 判斷是否觸發 rate limit
    const phaseMarks = [];
    const markPhase = (label) => phaseMarks.push({ label, t: Date.now() });
    const phaseAt = (t) => {
      let cur = 'setup';
      for (const m of phaseMarks) if (t >= m.t) cur = m.label;
      return cur;
    };

    // 首次預覽：fetch ?v=manifest rev、body 無標記節點、head 1（console）、core 1 未標記
    markPhase('A 首次預覽');
    const r1 = page.waitForResponse((r) => r.url().includes('/effects/particle/viewer.js'));
    await page.locator('#ed-preview-start').click();
    await r1;
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(true);
    await expect.poll(bodyMarked).toBe(0);
    await expect.poll(headMarked).toBe(1);
    expect(await coreCount()).toBe(1);
    const revA = await manifestRev();
    expect(revA).toMatch(/^[0-9a-f]{64}$/);
    expect(effectGets).toHaveLength(1);
    expect(effectGets[0].endsWith('/effects/particle/viewer.js?v=' + revA)).toBe(true);
    // plugin 在真實 browser 執行成功：registry 已註冊＋codeCache rev 已記
    expect(await page.evaluate(() => typeof window.Effects.registry.particle)).toBe('function');
    expect(await page.evaluate(() => window.__rtxEditor.codeCache['particle/viewer.js'].rev)).toBe(revA);

    // 停止＋再預覽：同 rev→codeCache 命中、無新 request、body 仍無節點
    markPhase('B 再預覽');
    await page.locator('#ed-preview-clear').click();
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(false);
    await page.locator('#ed-preview-start').click();
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(true);
    expect(effectGets).toHaveLength(1, '同 rev 不應重複 request');
    expect(await bodyMarked()).toBe(0);
    expect(await headMarked()).toBe(1);

    // 暫停（保留 running=true、凍結特效，避免 1200ms 結束自動停導致 onCodeSaved 走「不重預覽」分支）
    markPhase('C 暫停＋存檔');
    await page.locator('#ed-preview-pause').click();
    await expect(await page.evaluate(() => window.__rtxEditor.preview.paused)).toBe(true);
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(true);

    // 暫存 viewer 代碼→[保存] PUT→onCodeSaved 重預覽：rev 變→重 fetch
    await page.locator('#ed-tabs .tab[data-tab="viewer"]').click();
    const code = page.locator('#ed-code');
    // loadCodeFile 為 async：E2 下 phase A 的 fetch 已寫 codeCache（revA、raw CRLF bytes）
    // → 切 tab 走 cache 命中（無 API GET）、showCode 寫入 raw 內容；
    // 但 HTML textarea 的 value setter 依規範將 CRLF 正規化為 LF，故 inputValue 比對 LF 版
    await expect.poll(async () => code.inputValue()).toBe(viewerBytes.replace(/\r\n/g, '\n'));
    await code.fill(viewerBytes.replace(/\r\n/g, '\n') + '\n// s1-e2e staged\n');
    await page.locator('#ed-save-file').click();
    // 切回 manifest tab：onCodeSaved 走 null content→E2 fetch 路徑（rev 更新→重抓）
    await page.locator('#ed-tabs .tab[data-tab="manifest"]').click();
    page.on('dialog', (d) => d.accept());
    await waitRateLimit();
    const put = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'PUT' && r.ok()
    );
    await page.locator('#ed-save-btn').click();
    await put;
    await expect(page.locator('#ed-dirty')).toHaveText('已同步');
    await expect
      .poll(async () => page.evaluate(() => window.__rtxEditor.preview.running))
      .toBe(true);
    // loadManifest（PUT 成功後）先更新 state.rev，再 onCodeSaved 重預覽
    // 注意：await expect.poll(...).not.toBe(null) 是斷言、會 resolve undefined（非被 poll 的值）
    // → 先 poll 等待 rev 變化，再獨立讀取實際值
    await expect
      .poll(async () => {
        const r = await manifestRev();
        return r && r !== revA ? r : null;
      })
      .not.toBe(null);
    const revC = await manifestRev();
    expect(revC).toMatch(/^[0-9a-f]{64}$/);
    // rev 變化→重 fetch（新 ?v=）、codeCache 更新
    await expect.poll(async () => effectGets.length).toBe(2);
    expect(effectGets[1].endsWith('/effects/particle/viewer.js?v=' + revC)).toBe(true);
    expect(await bodyMarked()).toBe(0);
    expect(await headMarked()).toBe(1);
    expect(await coreCount()).toBe(1);
    expect(await page.evaluate(() => window.__rtxEditor.codeCache['particle/viewer.js'].rev)).toBe(revC);

    // 外部改 viewer.js＋[重載]→catalog rev 再變：再預覽拿最新 rev（重 fetch）
    markPhase('D 外部改檔＋重載');
    await waitRateLimit();
    const extBytes = viewerBytes + '\n// s1-e2e ext\n';
    writeFileSync(VIEWER_JS_PATH, extBytes);
    const reloadResp = page.waitForResponse(
      (r) => r.url().includes('/api/effects/reload') && r.request().method() === 'POST' && r.ok()
    );
    await page.locator('#ed-reload-btn').click();
    const rr = await reloadResp;
    expect(rr.status()).toBe(200);
    // reload 後 loadManifest 更新 state.rev（fingerprint 含檔案 hash→必變）
    // 同上：poll 僅作等待斷言，實際值另行讀取
    await expect
      .poll(async () => {
        const r = await manifestRev();
        return r && r !== revC ? r : null;
      })
      .not.toBe(null);
    const revD = await manifestRev();
    expect(revD).toMatch(/^[0-9a-f]{64}$/);
    await page.locator('#ed-preview-clear').click();
    await page.locator('#ed-preview-start').click();
    await expect.poll(async () => effectGets.length).toBe(3);
    expect(effectGets[2].endsWith('/effects/particle/viewer.js?v=' + revD)).toBe(true);
    await expect(await page.evaluate(() => window.__rtxEditor.preview.running)).toBe(true);
    expect(await bodyMarked()).toBe(0);
    expect(await headMarked()).toBe(1);
    expect(await coreCount()).toBe(1);
    const winErrors = await page.evaluate(() => window.__rtxWinErrors);
    expect(
      errs,
      [
        ...errs.map((e) => (e && (e.stack || e.message)) || String(e)),
        '--- window error events ---',
        ...winErrors.map((w) => JSON.stringify({ ...w, phase: phaseAt(w.t) })),
      ].join('\n')
    ).toEqual([]);
  });
});

test.describe('5r 測試特效（單個特效測試）', () => {
  test('v1：[測試特效] → 真實插件實際運行、結果顯示於預覽面板結果區', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    await openEditorPage(page);
    // particle 為預設選定
    await expect(page.locator('#ed-preview-test')).toBeVisible();
    const resp = page.waitForResponse(
      (r) => r.url().includes('/api/editor/effect/particle/viewer.js') && r.ok()
    );
    await page.locator('#ed-preview-test').click();
    await resp;
    await expect(page.locator('#ed-ops-result')).toContainText('特效測試：particle');
    await expect(page.locator('#ed-ops-result')).toContainText('結果：通過');
    expect(errs, errs).toEqual([]);
  });

  test('v1：未選定特效 → [測試特效] 於預覽面板結果區顯示請先選擇特效', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    await openEditorPage(page);
    await page.evaluate(() => {
      window.__rtxEditor.state.selected = null;
    });
    await page.locator('#ed-preview-test').click();
    await expect(page.locator('#ed-ops-result')).toContainText('特效測試：請先選擇特效');
    expect(errs, errs).toEqual([]);
  });
});

test.describe('5a 頂列下拉間隙與 [＋新增參數] 布局', () => {
  let fixtureBytes = null;

  test.beforeAll(async () => {
    fixtureBytes = snapshotFixture();
  });

  test.afterEach(async ({ page }) => {
    restoreFixture(fixtureBytes);
    await waitRateLimit();
    await page.request.post('/api/effects/reload');
  });

  test('兩 dropdown 點按開啟、選單緊貼按鈕無空隙、點外部關閉', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);

    await page.locator('#ed-export-btn').click();
    await expect(page.locator('.dd:has(#ed-export-btn) .dd-menu')).toBeVisible();
    await expect(page.locator('#ed-export-all')).toBeVisible();
    await expect(page.locator('#ed-export-sel')).toBeVisible();
    await expect(page.locator('.dd:has(#ed-export-btn) .dd-menu .dd-item')).toHaveCount(2);
    const expBtn = await page.locator('#ed-export-btn').boundingBox();
    const expMenu = await page.locator('.dd:has(#ed-export-btn) .dd-menu').boundingBox();
    expect(expMenu.y, `menu.y=${expMenu.y} btnBottom=${expBtn.y + expBtn.height}`).toBeCloseTo(
      expBtn.y + expBtn.height,
      1
    );
    expect(Math.abs(expMenu.x + expMenu.width - (expBtn.x + expBtn.width))).toBeLessThanOrEqual(1);

    await page.locator('#ed-add-btn').click();
    await expect(page.locator('#ed-add-new')).toBeVisible();
    await expect(page.locator('#ed-import-effects')).toBeVisible();
    await expect(page.locator('.dd:has(#ed-add-btn) .dd-menu .dd-item')).toHaveCount(2);
    await expect(page.locator('#ed-export-all')).toBeHidden();

    await page.locator('#ed-chip-version').click();
    await expect(page.locator('#ed-add-new')).toBeHidden();
    await expect(page.locator('#ed-export-all')).toBeHidden();
    expect(errs, errs).toEqual([]);
  });

  test('[＋新增參數] 與 [Params schema] 標題同行（標題左、按鈕右）不重疊', async ({ page }) => {
    const errs = trackPageErrors(page);
    await openEditorPage(page);

    const row = await page.locator('#ed-params-head').boundingBox();
    const label = await page.locator('#ed-params-title').boundingBox();
    const btn = await page.locator('#ed-add-param').boundingBox();
    expect(row).toBeTruthy();
    expect(label).toBeTruthy();
    expect(btn).toBeTruthy();
    expect(Math.abs(btn.y + btn.height / 2 - (row.y + row.height / 2))).toBeLessThanOrEqual(1);
    expect(btn.y).toBeGreaterThanOrEqual(row.y);
    expect(btn.y + btn.height).toBeLessThanOrEqual(row.y + row.height + 1);
    expect(label.x + label.width, `labelRight=${label.x + label.width} btnX=${btn.x}`).toBeLessThanOrEqual(btn.x + 1);
    expect(btn.x + btn.width).toBeLessThanOrEqual(row.x + row.width + 1);
    expect(errs, errs).toEqual([]);
  });
});

test.describe('5b effects.json tab 單個 effect 檢視＋預覽選定座標', () => {
  test('effects.json tab 顯示選定特效單項 entry（非整個 manifest）、選定變更同步', async ({ page }) => {
    const errs = trackPageErrors(page);
    await openEditorPage(page);

    await page.locator('#ed-tabs .tab[data-tab="manifest"]').click();
    let codeText = await page.locator('#ed-code').inputValue();
    // Task1：預覽以 effect_id 為鍵（particle）
    expect(codeText).toContain('"particle"');
    expect(codeText).toContain('"label": "粒子爆散"');
    expect(codeText).toContain('"count"');
    expect(codeText).not.toContain('"version": 1');
    expect(codeText).not.toContain('漣漪圈');
    await expect(page.locator('#ed-code')).toHaveAttribute('readonly', '');
    // v1 fixture：code 區匯入/匯出 disabled（標籤仍隨 tab）
    await expect(page.locator('#ed-import-file')).toHaveText('匯入 effects.json');
    await expect(page.locator('#ed-export-file')).toHaveText('匯出 effects.json');
    await expect(page.locator('#ed-import-file')).toBeDisabled();
    await expect(page.locator('#ed-export-file')).toBeDisabled();

    // 選定變更→同步更新（切到 ripple）
    await page.locator('#ed-zone-cur .fx-item[data-fx="ripple"] .name').click();
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="ripple"]')).toHaveClass(/selected/);
    codeText = await page.locator('#ed-code').inputValue();
    expect(codeText).toContain('"ripple"'); // Task1：id 鍵隨選定更新
    expect(codeText).toContain('"label": "漣漪圈"');
    expect(codeText).not.toContain('粒子爆散');
    expect(errs, errs).toEqual([]);
  });

  test('canvas 點擊設座標→hint 顯示→開始預覽 createEffect 座標符合', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    await openEditorPage(page);
    await installCreateRecorder(page);

    const box = await page.locator('#ed-preview-canvas').boundingBox();
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.4);
    // hint 顯示選定座標（mouse 取整致 25/40 前後 ±0.5% 內）
    const posText = await page.locator('#ed-preview-hint').textContent();
    const pm = posText.match(/x=([\d.]+), y=([\d.]+)/);
    expect(pm, `hint=${posText}`).toBeTruthy();
    const pos = { x: parseFloat(pm[1]), y: parseFloat(pm[2]) };
    expect(pos.x).toBeGreaterThan(24);
    expect(pos.x).toBeLessThan(26);
    expect(pos.y).toBeGreaterThan(39);
    expect(pos.y).toBeLessThan(41);

    const pluginResp = page.waitForResponse((r) => r.url().includes('/effects/particle/viewer.js'));
    await page.locator('#ed-preview-start').click();
    await pluginResp;
    await expect
      .poll(async () => page.evaluate(() => window.__previewCreateCalls.length))
      .toBeGreaterThan(0);
    const call = await page.evaluate(() => window.__previewCreateCalls[0]);
    // createEffect 座標＝選定 percent→canvas px 換算
    expect(call.px, `call=${JSON.stringify(call)}`).toBe(Math.round((pos.x / 100) * 800));
    expect(call.py, `call=${JSON.stringify(call)}`).toBe(Math.round((pos.y / 100) * 450));
    expect(errs, errs).toEqual([]);
  });
});

test.describe('U10 effect_id 欄位＋程式碼預覽下方按鈕分組', () => {
  let fixtureBytes = null;
  test.beforeAll(async () => {
    fixtureBytes = snapshotFixture();
  });
  test.afterEach(async ({ page }) => {
    restoreFixture(fixtureBytes);
    await waitRateLimit();
    await page.request.post('/api/effects/reload');
  });

  test('effect_id 欄位：新增特效預設 id（流水號）可編輯、已有特效只讀、[存檔] re-key', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);

    // 已有特效：id 欄位只讀
    await page.locator('#ed-zone-cur .fx-item[data-fx="particle"] .name').click();
    await expect(page.locator('#ed-meta-id')).toHaveValue('particle');
    await expect(page.locator('#ed-meta-id')).toBeDisabled();

    // 新增特效：預設 id（流水號）＋可編輯、無彈出視窗
    let sawPrompt = false;
    page.on('dialog', async (d) => { if (d.type() === 'prompt') sawPrompt = true; await d.accept(); });
    await page.locator('#ed-add-btn').click();
    await page.locator('#ed-add-new').click();
    expect(sawPrompt, 'U10：不應彈出 prompt').toBe(false);
    const defId = await page.locator('#ed-meta-id').inputValue();
    expect(defId, `defId=${defId}`).toMatch(/^effect-\d+$/);
    await expect(page.locator('#ed-meta-id')).toBeEnabled();
    // [存檔] re-key 成 custom-id（effects.json tab）
    await page.locator('#ed-tabs .tab[data-tab="manifest"]').click();
    await page.locator('#ed-meta-id').fill('custom-id');
    await page.locator('#ed-save-file').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="custom-id"].selected')).toBeVisible();
    await expect(page.locator('#ed-meta-id')).toHaveValue('custom-id');
    // Task3-2：[存檔]後 effects.json 預覽依上方欄位（新 id）更新（#ed-code 為 textarea→用 toHaveValue）
    await expect(page.locator('#ed-code')).toHaveValue(/"custom-id"/);
    expect(errs, errs).toEqual([]);
  });

  test('下方 5 按鈕分組：[匯入/匯出]＋[檢查此檔/檢查 3 檔] 各成組、[暫存] 為主要＋U7 按鈕改名/三態', async ({ page }) => {
    const errs = trackPageErrors(page);
    await openEditorPage(page);
    const groups = page.locator('#ed-code-panel .actions .act-group');
    await expect(groups).toHaveCount(2);
    await expect(groups.nth(0)).toContainText('匯入 effects.json');
    await expect(groups.nth(0)).toContainText('匯出 effects.json');
    await expect(groups.nth(1)).toContainText('檢查此檔');
    await expect(groups.nth(1)).toContainText('檢查 3 檔');
    await expect(page.locator('#ed-save-file')).toHaveClass(/primary/);
    await expect(page.locator('#ed-save-file')).toHaveText('暫存');
    await expect(page.locator('#ed-save-btn')).toHaveText('保存至伺服器');
    await expect(page.locator('#ed-dirty')).toHaveText('已同步');
    expect(errs, errs).toEqual([]);
  });
});

test.describe('5c console 匯入匯出與子集 zip', () => {
  let fixtureBytes = null;
  let viewerBytes = null;
  let consoleBytes = null;

  test.beforeAll(async () => {
    fixtureBytes = snapshotFixture();
    viewerBytes = readFileSync(VIEWER_JS_PATH);
    consoleBytes = readFileSync(CONSOLE_JS_PATH);
  });

  test.afterEach(async ({ page }) => {
    restoreFixture(fixtureBytes);
    writeFileSync(VIEWER_JS_PATH, viewerBytes);
    writeFileSync(CONSOLE_JS_PATH, consoleBytes);
    for (const id of createdFxDirs.splice(0).reverse()) {
      rmSync(path.join(TEST_EFFECTS_DIR, id), { recursive: true, force: true });
    }
    await waitRateLimit();
    await page.request.post('/api/effects/reload');
  });

  test('console tab：[匯入 console.js]／[匯出 console.js] 標籤＋console.js 匯出下載＋匯入存檔', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 2');

    await expect(page.locator('#ed-import-file')).toHaveText('匯入 effects.json');
    await expect(page.locator('#ed-export-file')).toHaveText('匯出 effects.json');

    await page.locator('#ed-tabs .tab[data-tab="console"]').click();
    await expect(page.locator('#ed-import-file')).toHaveText('匯入 console.js');
    await expect(page.locator('#ed-export-file')).toHaveText('匯出 console.js');

    const served = readFileSync(CONSOLE_JS_PATH, 'utf8').replace(/\r\n/g, '\n');
    await expect(page.locator('#ed-code')).toHaveValue(served);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#ed-export-file').click()
    ]);
    expect(await download.suggestedFilename()).toBe('console.js');
    expect(readFileSync(await download.path()).toString('utf8').replace(/\r\n/g, '\n')).toBe(served);
    await expect(page.locator('#ed-ops-result')).toContainText('匯出成功');

    await waitRateLimit();
    const newContent = served + '\n// e2e 5c console import\n';
    // [匯入 console] staged（無 PUT、dirty）
    await page.locator('#ed-file-import-file').setInputFiles({
      name: 'console.js',
      mimeType: 'text/javascript',
      buffer: Buffer.from(newContent, 'utf8')
    });
    // U12：匯入 .js 後自動跑該檔格式檢查（staged、不 fetch）
    await expect(page.locator('#ed-ops-result')).toContainText('檢查格式');
    await expect(page.locator('#ed-ops-result')).toContainText('console.js');
    await expect(page.locator('#ed-dirty')).toHaveText('未保存變更');
    expect(readFileSync(CONSOLE_JS_PATH, 'utf8').replace(/\r\n/g, '\n')).toBe(served);
    // [保存] 寫 manifest（含 staged files，單一原子請求）
    page.on('dialog', (d) => d.accept()); // 7d：[保存至伺服器] confirm 自動接受
    await waitRateLimit();
    const savePut = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'PUT' && r.ok()
    );
    await page.locator('#ed-save-btn').click();
    const fp = await savePut;
    expect(fp.status()).toBe(200);
    await expect(page.locator('#ed-ops-result')).toContainText('保存成功');
    expect(readFileSync(CONSOLE_JS_PATH, 'utf8').replace(/\r\n/g, '\n')).toBe(newContent);
    expect(errs, errs).toEqual([]);
  });

  test('子集 zip round-trip：匯出片段→移除特效→匯入還原（layout 保留、created 正確）', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');

    await page.route(/\/api\/stream(\?.*)?$/, (route) => route.abort());
    await openEditorPage(page);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 2');

    const exp = await page.request.post('/api/editor/export', {
      data: { manifest: readFixture(), files: [], ids: 'particle' }
    });
    expect(exp.status()).toBe(200);
    const zipBuf = await exp.body();
    const entries = readZipEntries(zipBuf);
    const subset = JSON.parse(entries.get('effects.json').toString('utf8'));
    expect(subset.version).toBe(2);
    expect(Object.keys(subset.effects)).toEqual(['particle']);
    expect(subset.currentEffects).toEqual(['particle']);
    expect(subset.alternateEffects).toEqual([]);
    expect(entries.has('particle/viewer.js')).toBe(true);
    expect(entries.has('ripple/viewer.js')).toBe(false);

    const ext = readFixture();
    delete ext.effects.particle;
    ext.currentEffects = ext.currentEffects.filter((i) => i !== 'particle');
    ext.alternateEffects = (ext.alternateEffects || []).filter((i) => i !== 'particle');
    writeFixture(ext);

    await waitRateLimit();
    const reloadResp = page.waitForResponse(
      (r) => r.url().includes('/api/effects/reload') && r.request().method() === 'POST' && r.ok()
    );
    const manifestResp = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'GET' && r.ok()
    );
    await page.locator('#ed-reload-btn').click();
    expect((await reloadResp).status()).toBe(200);
    expect((await manifestResp).status()).toBe(200);

    await waitRateLimit();
    const importResp = page.waitForResponse(
      (r) => r.url().includes('/api/editor/import') && r.request().method() === 'POST' && r.ok()
    );
    await page.locator('#ed-file-import-effects').setInputFiles({
      name: 'particle.zip',
      mimeType: 'application/zip',
      buffer: zipBuf
    });
    const ir = await importResp;
    expect(ir.status()).toBe(200);
    const id = await ir.json();
    expect(id.dryRun).toBe(true);
    expect(Object.keys(id.importedEffects)).toEqual(['particle']);
    // staged：manifest 未落盤（particle 仍不在 disk manifest）
    expect(readFixture().effects.particle).toBeUndefined();
    // 列表項 staged 可見（匯入 layout 合併：particle 放回其原 zone＝主區）
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="particle"]')).toBeVisible();
    // [保存] 寫入
    page.on('dialog', (d) => d.accept()); // 7d：[保存至伺服器] confirm 自動接受
    await waitRateLimit();
    await page.locator('#ed-save-btn').click();
    await waitRateLimit();
    const disk = readFixture();
    expect(disk.effects.particle.label).toBe('粒子爆散');
    expect(disk.currentEffects).toEqual(['ripple', 'firework', 'text', 'particle']);
    expect(disk.alternateEffects).toEqual([]);
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="particle"]')).toBeVisible();
    expect(errs, errs).toEqual([]);
  });

  test('匯出所選 effects.zip（單選）：effects.json 只含該 effect、[匯入 effects.zip] 匯入還原', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');

    await page.route(/\/api\/stream(\?.*)?$/, (route) => route.abort());
    await openEditorPage(page);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 2');

    // 單選 text → [匯出 ▾] → [匯出所選 effects.zip]
    await page.locator('#ed-zone-cur .fx-item[data-fx="text"] .fx-chk').check();
    const dlPromise = page.waitForEvent('download');
    await page.locator('#ed-export-btn').click();
    const [download] = await Promise.all([dlPromise, page.locator('#ed-export-sel').click()]);
    expect(await download.suggestedFilename()).toBe('text.zip');
    const zipBuf = readFileSync(await download.path());
    expect(isZip(zipBuf)).toBe(true);
    const entries = readZipEntries(zipBuf);
    const doc = JSON.parse(entries.get('effects.json').toString('utf8'));
    expect(doc.version).toBe(2);
    expect(Object.keys(doc.effects), 'effects.json 只含選定的單個 effect').toEqual(['text']);
    expect(doc.effects.text.label).toBe('浮現文字');
    expect(doc.currentEffects).toEqual(['text']);
    expect(doc.alternateEffects).toEqual([]);
    expect(entries.has('text/viewer.js')).toBe(true);
    for (const id of ['particle', 'ripple', 'firework']) {
      expect(entries.has(`${id}/viewer.js`), `${id} 不應在 zip 內`).toBe(false);
    }
    await expect(page.locator('#ed-ops-result')).toContainText('匯出成功');

    // 移除 text → 重載 → [匯入 effects.zip] 匯入剛匯出的 zip
    const ext = readFixture();
    delete ext.effects.text;
    ext.currentEffects = ext.currentEffects.filter((i) => i !== 'text');
    ext.alternateEffects = (ext.alternateEffects || []).filter((i) => i !== 'text');
    writeFixture(ext);

    await waitRateLimit();
    const reloadResp = page.waitForResponse(
      (r) => r.url().includes('/api/effects/reload') && r.request().method() === 'POST' && r.ok()
    );
    const manifestResp = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'GET' && r.ok()
    );
    await page.locator('#ed-reload-btn').click();
    expect((await reloadResp).status()).toBe(200);
    expect((await manifestResp).status()).toBe(200);

    await waitRateLimit();
    const importResp = page.waitForResponse(
      (r) => r.url().includes('/api/editor/import') && r.request().method() === 'POST' && r.ok()
    );
    await page.locator('#ed-file-import-effects').setInputFiles({
      name: 'text.zip',
      mimeType: 'application/zip',
      buffer: zipBuf
    });
    const ir = await importResp;
    expect(ir.status()).toBe(200);
    const id = await ir.json();
    expect(id.dryRun).toBe(true);
    expect(Object.keys(id.importedEffects)).toEqual(['text']);
    // staged：manifest 未落盤
    expect(readFixture().effects.text).toBeUndefined();
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="text"]')).toBeVisible();
    // [保存] 寫入
    page.on('dialog', (d) => d.accept()); // 7d：[保存至伺服器] confirm 自動接受
    await waitRateLimit();
    await page.locator('#ed-save-btn').click();
    await waitRateLimit();
    const disk = readFixture();
    expect(disk.effects.text.label).toBe('浮現文字');
    expect(disk.effects.particle.label).toBe('粒子爆散');
    expect(disk.currentEffects).toEqual(['particle', 'ripple', 'firework', 'text']);
    expect(disk.alternateEffects).toEqual([]);
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="text"]')).toBeVisible();
    expect(errs, errs).toEqual([]);
  });

  test('批次全選 [匯出所選 effects.zip]：zip 內 effects.json 含選取 ids 與分區鍵', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await page.route(/\/api\/stream(\?.*)?$/, (route) => route.abort());
    await openEditorPage(page);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 2');

    for (const id of TEST_EFFECTS) {
      await page.locator(`#ed-zone-cur .fx-item[data-fx="${id}"] .fx-chk`).check();
    }
    const dlPromise = page.waitForEvent('download');
    await page.locator('#ed-export-btn').click();
    const [download] = await Promise.all([dlPromise, page.locator('#ed-export-sel').click()]);
    expect(await download.suggestedFilename()).toBe('effects.zip');
    const zipBuf = readFileSync(await download.path());
    expect(isZip(zipBuf)).toBe(true);
    const entries = readZipEntries(zipBuf);
    const doc = JSON.parse(entries.get('effects.json').toString('utf8'));
    expect(doc.version).toBe(2);
    expect(Object.keys(doc.effects).sort(), 'effects.json 只含選取 ids').toEqual([...TEST_EFFECTS].sort());
    expect(doc.currentEffects).toEqual([...TEST_EFFECTS]);
    expect(doc.alternateEffects).toEqual([]);
    expect(doc.layout).toBeUndefined();
    for (const id of TEST_EFFECTS) {
      expect(entries.has(`${id}/viewer.js`), `${id}/viewer.js 應在 zip 內`).toBe(true);
    }
    await expect(page.locator('#ed-ops-result')).toContainText('匯出成功');
    expect(errs, errs).toEqual([]);
  });
});

test.describe('5j effects.json tab 預設與匯入匯出', () => {
  let fixtureBytes = null;

  test.beforeAll(async () => {
    fixtureBytes = snapshotFixture();
  });

  test.afterEach(async ({ page }) => {
    restoreFixture(fixtureBytes);
    for (const id of createdFxDirs.splice(0).reverse()) {
      rmSync(path.join(TEST_EFFECTS_DIR, id), { recursive: true, force: true });
    }
    await waitRateLimit();
    await page.request.post('/api/effects/reload');
  });

  test('預設 tab 為 effects.json：選定單項 entry、[匯出 effects.json] 只下載該 effect', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await page.route(/\/api\/stream(\?.*)?$/, (route) => route.abort());
    await openEditorPage(page);
    await expect(page.locator('#ed-tabs .tab.active')).toHaveText('effects.json');
    const codeText = await page.locator('#ed-code').inputValue();
    expect(codeText).toContain('"label": "粒子爆散"');
    expect(codeText).not.toContain('"version"');
    await expect(page.locator('#ed-import-file')).toHaveText('匯入 effects.json');
    await expect(page.locator('#ed-export-file')).toHaveText('匯出 effects.json');
    await expect(page.locator('#ed-import-file')).toBeEnabled();
    await expect(page.locator('#ed-export-file')).toBeEnabled();
    await expect(page.locator('#ed-file-import-file')).toHaveAttribute('accept', '.json');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#ed-export-file').click()
    ]);
    expect(await download.suggestedFilename()).toBe('particle.effects.json');
    const doc = JSON.parse(readFileSync(await download.path(), 'utf8'));
    expect(doc.version).toBe(2);
    expect(Object.keys(doc.effects), 'effects.json 只含選定的單個 effect').toEqual(['particle']);
    expect(doc.effects.particle.label).toBe('粒子爆散');
    await expect(page.locator('#ed-ops-result')).toContainText('匯出成功');
    expect(errs, errs).toEqual([]);
  });

  test('[匯入 effects.json]：本機 .json 單一 entry 改寫為選定特效（particle）→[保存]寫入磁碟', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await page.route(/\/api\/stream(\?.*)?$/, (route) => route.abort());
    await openEditorPage(page);
    await expect(page.locator('#ed-tabs .tab.active')).toHaveText('effects.json');
    // 選定特效為 particle（主區首項）
    await expect(page.locator('#ed-meta-title')).toHaveText('Meta · particle');

    await page.locator('#ed-file-import-file').setInputFiles({
      name: 'json-fx.effects.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({ version: 2, effects: { 'json-fx': { label: 'JSON 特效', enabled: true, params: {} } } }),
        'utf8'
      )
    });
    // 單一 entry（id=json-fx）改寫為選定 particle：覆蓋 particle、不新增 json-fx
    await expect(page.locator('#ed-ops-result')).toContainText('匯入 particle（staged，按[保存至伺服器]寫入）');
    await expect(page.locator('#ed-ops-result')).toContainText('檢查格式');
    expect(readFixture().effects['json-fx'], 'staged 未新增 json-fx').toBeUndefined();
    await expect(page.locator('#ed-dirty')).toHaveText('未保存變更');

    // 選取維持 particle → [manifest 編輯] 與程式碼預覽同步為匯入結果（僅前端 staged）
    await expect(page.locator('#ed-meta-title')).toHaveText('Meta · particle');
    await expect(page.locator('#ed-meta-label')).toHaveValue('JSON 特效');
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="particle"].selected')).toBeVisible();
    const codeText = await page.locator('#ed-code').inputValue();
    expect(codeText).toContain('"label": "JSON 特效"');

    page.on('dialog', (d) => d.accept()); // 7d：[保存至伺服器] confirm 自動接受
    await waitRateLimit();
    const putResp = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'PUT' && r.ok()
    );
    await page.locator('#ed-save-btn').click();
    const pr = await putResp;
    expect(pr.status()).toBe(200);
    const disk = readFixture();
    expect(disk.effects.particle.label).toBe('JSON 特效');
    expect(disk.effects['json-fx'], '未新增 json-fx').toBeUndefined();
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="particle"]')).toBeVisible();
    expect(errs, errs).toEqual([]);
  });

  test('5n [檢查此檔]（單檔）＋[檢查 3 檔]：按鈕存在、單檔檢查 effects、3 檔皆列示', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await page.route(/\/api\/stream(\?.*)?$/, (route) => route.abort());
    await openEditorPage(page);
    await expect(page.locator('#ed-tabs .tab.active')).toHaveText('effects.json');
    // 兩個按鈕皆存在且（有選定特效時）enabled
    await expect(page.locator('#ed-check-file')).toHaveText('檢查此檔');
    await expect(page.locator('#ed-check-all')).toHaveText('檢查 3 檔');
    await expect(page.locator('#ed-check-file')).toBeEnabled();
    await expect(page.locator('#ed-check-all')).toBeEnabled();
    // [檢查此檔]（effects.json tab）→ 單檔（effects entry），不 fetch；結果標題仍為「檢查格式」
    await page.locator('#ed-check-file').click();
    await expect(page.locator('#ed-ops-result')).toContainText('檢查格式');
    await expect(page.locator('#ed-ops-result')).toContainText('effects.json');
    // [檢查 3 檔] → effects.json＋viewer.js＋console.js 三行（viewer/console 走 fetch，async → 用重試斷言等完成）
    await waitRateLimit();
    await page.locator('#ed-check-all').click();
    await expect(page.locator('#ed-ops-result')).toContainText('effects.json：OK');
    await expect(page.locator('#ed-ops-result')).toContainText('viewer.js：OK');
    await expect(page.locator('#ed-ops-result')).toContainText('console.js：OK');
    expect(errs, errs).toEqual([]);
  });
});

test.describe('7m 兩段式變更指示器＋[新增特效]', () => {
  let fixtureBytes = null;

  test.beforeAll(async () => {
    fixtureBytes = snapshotFixture();
  });

  test.afterEach(async ({ page }) => {
    restoreFixture(fixtureBytes);
    await waitRateLimit();
    await page.request.post('/api/effects/reload');
  });

  test('7m：改 manifest 欄位→未暫存變更；[暫存]→未保存變更；[保存至伺服器]→已同步', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 2');
    await expect(page.locator('#ed-dirty')).toHaveText('已同步');

    // 選定 particle、改 label→未暫存變更（manifest 欄位、未 [暫存] 前）
    await page.locator('#ed-zone-cur .fx-item[data-fx="particle"] .name').click();
    await page.locator('#ed-meta-label').fill('粒子爆散 7m');
    await expect(page.locator('#ed-dirty')).toHaveText('未暫存變更');

    // [暫存]（effects.json tab）→套用欄位→未保存變更
    await waitRateLimit();
    await page.locator('#ed-save-file').click();
    await expect(page.locator('#ed-ops-result')).toContainText('effects.json 欄位已套用');
    await expect(page.locator('#ed-dirty')).toHaveText('未保存變更');

    // [保存至伺服器]（confirm 自動接受）→PUT 含編輯欄位→已同步、fixture 落盤
    page.on('dialog', (d) => d.accept());
    await waitRateLimit();
    const putResp = page.waitForResponse(
      (r) => r.url().includes('/api/editor/manifest') && r.request().method() === 'PUT' && r.ok()
    );
    await page.locator('#ed-save-btn').click();
    const pr = await putResp;
    expect(pr.status()).toBe(200);
    expect(readFixture().effects.particle.label).toBe('粒子爆散 7m');
    await expect(page.locator('#ed-dirty')).toHaveText('已同步');
    expect(errs, errs).toEqual([]);
  });

  test('7m：[新增特效] 保留自動標籤「新特效 N」＋清空簡化 console（直到下次 [開始預覽]）', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);

    // [開始預覽]→簡化 console 有內容（particle）
    const consoleResp = page.waitForResponse((r) => r.url().includes('/effects/particle/console.js'));
    await page.locator('#ed-preview-start').click();
    await consoleResp;
    await expect(page.locator('#ed-mini-fx-name')).toContainText('粒子爆散');
    await page.locator('#ed-mini-fab').click();
    await expect(page.locator('#ed-mini-console')).toBeVisible();
    await page.locator('#ed-mini-params').click();
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const b = document.querySelector('#ed-mini-params-body');
          return b ? b.querySelectorAll('.rtx-field input, .rtx-field select, .mini-field input, .mini-field select').length : 0;
        })
      )
      .toBe(5); // particle：color/count/spread/speed/duration

    // [新增特效]→自動標籤保留、簡化 console 清空（面板收合、name/icon/參數內容皆空）
    await page.locator('#ed-add-btn').click();
    await page.locator('#ed-add-new').click();
    const defId = await page.locator('#ed-meta-id').inputValue();
    expect(defId).toMatch(/^effect-\d+$/);
    await expect(page.locator('#ed-meta-label')).toHaveValue(`新特效 ${defId.replace('effect-', '')}`);
    await expect(page.locator('#ed-mini-console')).toBeHidden();
    await expect(page.locator('#ed-mini-fx-name')).toHaveText('');
    await expect
      .poll(async () => page.evaluate(() => document.querySelector('#ed-mini-fx-icon').innerHTML === ''))
      .toBe(true);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const b = document.querySelector('#ed-mini-params-body');
          return b ? b.querySelectorAll('.rtx-field input, .rtx-field select, .mini-field input, .mini-field select').length : 0;
        })
      )
      .toBe(0);
    // 新特效是 staged 操作（非欄位編輯）→未保存變更（非未暫存變更）
    await expect(page.locator('#ed-dirty')).toHaveText('未保存變更');
    expect(errs, errs).toEqual([]);
  });
});

test.describe('7n：未 [暫存] 變更（程式碼／manifest 欄位）存在時，會捨棄它的動作先彈 confirm', () => {
  let fixtureBytes = null;

  test.beforeAll(async () => {
    fixtureBytes = snapshotFixture();
  });

  test.afterEach(async ({ page }) => {
    restoreFixture(fixtureBytes);
    await waitRateLimit();
    await page.request.post('/api/effects/reload');
  });

  test('7n：欄位未暫存→切換特效 confirm（取消→不切換／確認→切換、變更丟棄）', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);
    await expect(page.locator('#ed-chip-version')).toHaveText('version 2');

    // 選定 particle、改 label→未暫存變更
    await page.locator('#ed-zone-cur .fx-item[data-fx="particle"] .name').click();
    await page.locator('#ed-meta-label').fill('粒子爆散 7n');
    await expect(page.locator('#ed-dirty')).toHaveText('未暫存變更');

    const seen = [];
    let acceptNext = false;
    page.on('dialog', async (d) => {
      if (d.type() === 'confirm') {
        seen.push(d.message());
        if (acceptNext) await d.accept();
        else await d.dismiss();
      } else await d.accept();
    });

    // (a) 取消→不切換、變更保留
    await page.locator('#ed-zone-cur .fx-item[data-fx="ripple"] .name').click();
    await page.waitForTimeout(400);
    expect(seen).toEqual(['有未暫存的 manifest 欄位變更，切換特效將捨棄。確定繼續？']);
    await expect(page.locator('#ed-meta-title')).toHaveText('Meta · particle');
    await expect(page.locator('#ed-meta-label')).toHaveValue('粒子爆散 7n');
    await expect(page.locator('#ed-dirty')).toHaveText('未暫存變更');

    // (b) 確認→切換、變更丟棄
    acceptNext = true;
    await page.locator('#ed-zone-cur .fx-item[data-fx="ripple"] .name').click();
    await page.waitForTimeout(400);
    expect(seen.length).toBe(2);
    await expect(page.locator('#ed-meta-title')).toHaveText('Meta · ripple');
    await expect(page.locator('#ed-meta-label')).toHaveValue('漣漪圈');
    await expect(page.locator('#ed-dirty')).toHaveText('未保存變更');
    expect(errs, errs).toEqual([]);
  });

  test('7n：欄位未暫存→[新增特效] confirm（取消→不建立／確認→建立、變更丟棄）', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);

    // 選定 particle、改 label→未暫存變更
    await page.locator('#ed-zone-cur .fx-item[data-fx="particle"] .name').click();
    await page.locator('#ed-meta-label').fill('粒子爆散 7n');
    await expect(page.locator('#ed-dirty')).toHaveText('未暫存變更');

    const seen = [];
    let acceptNext = false;
    page.on('dialog', async (d) => {
      if (d.type() === 'confirm') {
        seen.push(d.message());
        if (acceptNext) await d.accept();
        else await d.dismiss();
      } else await d.accept();
    });

    // (a) 取消→不建立、選取不變
    await page.locator('#ed-add-btn').click();
    await page.locator('#ed-add-new').click();
    await page.waitForTimeout(400);
    expect(seen).toEqual(['有未暫存的 manifest 欄位變更，建立新特效將捨棄。確定繼續？']);
    await expect(page.locator('#ed-meta-title')).toHaveText('Meta · particle');
    await expect(page.locator('#ed-meta-label')).toHaveValue('粒子爆散 7n');
    await expect(page.locator('#ed-dirty')).toHaveText('未暫存變更');

    // (b) 確認→建立（自動標籤）、變更丟棄
    acceptNext = true;
    await page.locator('#ed-add-btn').click();
    await page.locator('#ed-add-new').click();
    const defId = await page.locator('#ed-meta-id').inputValue();
    expect(defId).toMatch(/^effect-\d+$/);
    await expect(page.locator('#ed-meta-label')).toHaveValue(`新特效 ${defId.replace('effect-', '')}`);
    await expect(page.locator('#ed-dirty')).toHaveText('未保存變更');
    expect(errs, errs).toEqual([]);
  });

  test('7n：欄位未暫存→zip 匯入 confirm（取消→不匯入／確認→匯入＋選取切到匯入 effect）', async ({ page }) => {
    const errs = trackPageErrors(page);
    await waitRateLimit();
    writeFixture(v2Fixture(readFixture()));
    await page.request.post('/api/effects/reload');
    await openEditorPage(page);

    // 選定 particle、改 label→未暫存變更
    await page.locator('#ed-zone-cur .fx-item[data-fx="particle"] .name').click();
    await page.locator('#ed-meta-label').fill('粒子爆散 7n');
    await expect(page.locator('#ed-dirty')).toHaveText('未暫存變更');

    const importedManifest = {
      version: 2,
      effects: { 'imported-7n': { label: 'Imported 7n', enabled: true, params: {} } },
      currentEffects: ['imported-7n'],
      alternateEffects: []
    };
    const zipBytes = buildZip([
      { name: 'effects.json', data: Buffer.from(JSON.stringify(importedManifest, null, 2), 'utf8') }
    ]);

    const seen = [];
    let acceptNext = false;
    page.on('dialog', async (d) => {
      if (d.type() === 'confirm') {
        seen.push(d.message());
        if (acceptNext) await d.accept();
        else await d.dismiss();
      } else await d.accept();
    });

    // (a) 取消→無匯入、無新 effect
    await page
      .locator('#ed-file-import-effects')
      .setInputFiles({ name: 'effect.zip', mimeType: 'application/zip', buffer: zipBytes });
    await page.waitForTimeout(600);
    expect(seen).toEqual(['有未暫存的 manifest 欄位變更，匯入將捨棄。確定繼續？']);
    expect(await page.locator('#ed-zone-cur .fx-item[data-fx="imported-7n"]').count()).toBe(0);
    await expect(page.locator('#ed-meta-label')).toHaveValue('粒子爆散 7n');
    await expect(page.locator('#ed-dirty')).toHaveText('未暫存變更');

    // (b) 確認→匯入、選取切到匯入 effect、變更丟棄
    acceptNext = true;
    const importResp = page.waitForResponse(
      (r) => r.url().includes('/api/editor/import') && r.request().method() === 'POST' && r.ok()
    );
    await page
      .locator('#ed-file-import-effects')
      .setInputFiles({ name: 'effect.zip', mimeType: 'application/zip', buffer: zipBytes });
    await importResp;
    await expect(page.locator('#ed-zone-cur .fx-item[data-fx="imported-7n"]')).toBeVisible();
    await expect(page.locator('#ed-meta-title')).toHaveText('Meta · imported-7n');
    await expect(page.locator('#ed-dirty')).toHaveText('未保存變更');
    expect(errs, errs).toEqual([]);
  });
});


