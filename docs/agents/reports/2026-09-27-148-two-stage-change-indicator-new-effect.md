**日期**: 2026-09-27
**任務**: 兩段式變更指示器＋[新增特效] 清空簡化 console（7m）
**Agent**: opencode

## 摘要

editor 的 `#ed-dirty` 狀態指標（7d 四態：已同步／未保存變更／未暫存變更／保存中…）原先「未暫存變更」只適用於**程式碼編輯框**（viewer.js/console.js 未 [暫存]）。本任務把它擴充為 manifest **欄位編輯**的兩段式變更指示器：

1. **改 manifest 欄位**（meta label/icon/enabled、params 卡 default/type/子項列、effects.json tab 欄位等 input/change 事件）→ **「未暫存變更」**（欄位尚未套用至 `state.manifest`，即未 [暫存] 前）；
2. **[暫存]**（`applyManifestFields` 把欄位套入 manifest）→ **「未保存變更」**；
3. **[保存至伺服器]** PUT 成功 → **「已同步」**（優先序 `saving > unstaged > dirty > clean`）。

切換特效時 DOM 自 manifest 重繪 → `unstagedFields` 清空（回到「未保存變更」）。**[新增特效]** 為 staged 操作（→「未保存變更」非「未暫存變更」），且改為**只清空簡化 console**（FAB 收合、`#ed-mini-fx-name`／`-icon`／`#ed-mini-params-body` 內容清空，直到下次 [開始預覽]）、**保留自動標籤「新特效 N」**。

`editor/app.js` 新增 `state.unstagedFields`＋`setFieldsUnstaged()`（設 flag＋`setDirty(true)`，掛於所有 manifest 欄位 input/change 事件）；`setDirtyUI` unstaged 判斷含 `unstagedFields`；flag 於 manifest 載入／`renderMeta`／`renderParams` 重繪／`applyManifestFields` 套用／匯入（staged 操作）時清空；`newEffect` 調 `clearMiniConsole()`。純 editor 前端改動，version 7l→7m。

測試維護：`tests/fixtures/effects.json` 是 **git 追蹤的 live 檔**（server `RTX_EFFECTS_MANIFEST` 直指它、不像 `RTX_EFFECTS_DIR` 複製到 tmp），且 `fullyParallel` 下各 test block 不按檔序執行——7m describe block 加 `beforeAll` fixture snapshot＋`afterEach` restore（restore＋wait rate limit＋`POST /api/effects/reload`）防跨 test 污染；2 處舊欄位編輯斷言（2c v2／7k）改「未暫存變更」。

## 文件異動

| 路徑 | 異動 |
|------|------|
| `editor/app.js` | 新增 `state.unstagedFields`＋`setFieldsUnstaged()`；`setDirtyUI` unstaged 判斷含 `unstagedFields`；manifest 欄位 input/change 事件掛 `setFieldsUnstaged()`；`applyManifestFields`／`renderMeta`／`renderParams`／manifest 載入／匯入清空 flag；`newEffect` 調 `clearMiniConsole()`；version 7l→7m |
| `tests/test_editor.mjs` | 5 處舊欄位編輯斷言改 `unstaged`（meta＋params 編輯、保存失敗 400 仍 unstaged、7j color 編輯、7k array 子項列、params 卡 drag 重排）＋新增 3 項（兩段式指示器 [暫存]→未保存變更＋PUT 含編輯欄位→已同步、切換特效清空 flag、[新增特效] 保留自動標籤＋清空簡化 console）；121→124 項 |
| `tests/e2e/editor.spec.js` | 新增 7m describe block 2 項（欄位→未暫存變更→[暫存]未保存變更→[保存至伺服器]已同步＋fixture 落盤；[新增特效] 清空簡化 console＋保留自動標籤＋未保存變更）＋block `beforeAll`/`afterEach` fixture snapshot/restore；2 處舊斷言改「未暫存變更」；54→56 項 |
| `docs/agents/TODO.md` | 新增 7m 項；測試計數更新（E2E 84、editor.spec.js 56、test_editor.mjs 124） |
| `docs/agents/CALL_GRAPH.md` | TEX/TP 測試節點加 7m 描述；計數更新（124、84、56） |

## 測試與驗證

- [x] `node --test tests/test_editor.mjs` — 124/124 pass（含 3 項新 7m 測試＋5 處更新斷言）
- [x] `npx playwright test tests/e2e/editor.spec.js` — 56/56 pass（含 2 項新 7m 測試）
- [x] `npx playwright test`（全量 E2E）— 84 passed（3.4m）
- [x] `python -m pytest tests -q` — 159 passed

## Git commit

- `5bc1564` feat(editor): 兩段式變更指示器＋[新增特效]（7m）
