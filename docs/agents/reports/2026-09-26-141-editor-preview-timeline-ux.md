# 工作完成報告

- **日期**：2026-09-26
- **任務**：預覽時間軸 UX 修正（7f）：速率常可調、重播重用已載入插件、控制列合併單一列
- **Agent**：opencode

## 摘要

續 7e 特效預覽時間軸（A 方案）的 UX 修正：

1. **速率滑桿常可調**：移除 `#ed-preview-rate` 初始 `disabled`；`renderPreviewControls()` 改為常啟用（`els.previewRate.disabled = false`），預覽開始前即可調速率。
2. **[重播] 啟用規則與重用插件**：啟用條件由「running 中」改為「已預覽且為目前選定特效」（`preview.loadedId && preview.loadedId === state.selected`）——auto-stop、[清屏]、重載後仍啟用，切換選定特效後停用；`previewReplay()` 改呼叫 `previewStart(true)`，`previewStart(reusePlugin)` 在 `reusePlugin && preview.loadedId === id` 時跳過 `injectPlugin`，即重播重用已載入插件、不重請求 `/effects/{id}/viewer.js`。
3. **控制列合併單一列**：`.pv-timeline` 移除，預覽控制（開始/暫停/重播＋速率組）與既有 `.actions`（[測試特效]/[清屏]/[重設 50/50]）合併為單一 `.actions` 列、以 `.act-group` 分組；`editor/style.css` 移除 `.pv-timeline` 樣式、改 `.pv-rate`／`#ed-preview-rate`／`.pv-rate-val`。

version 7e→7f（純 editor 前端，不改 server／viewer／插件／protocol）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `previewStart(reusePlugin)` 新增參數、reuse 時跳過 `injectPlugin`；`previewReplay()` 加 guard 並呼叫 `previewStart(true)`；`renderPreviewControls()` 速率常啟用、重播啟用規則改 `preview.loadedId === state.selected`；version `'7e'`→`'7f'` |
| `editor/index.html` | 修改 | 移除 `.pv-timeline`；預覽控制併入單一 `.actions` 列（`.act-group` 分組）；`#ed-preview-rate` 移除初始 `disabled`；`#ed-preview-replay` title 更新（重用已載入插件、不重請求 .js） |
| `editor/style.css` | 修改 | 移除 `.pv-timeline` 樣式；新增 `.pv-rate`、`#ed-preview-rate`（`flex: none; width: 120px`）、`.pv-rate-val` |
| `tests/test_editor.mjs` | 修改 | 114→116 項：harness 初始 rate `disabled=false`；7e-6 補重播後 `bodyScripts` 數不變（不重注入 .js）；7e-7/7e-8/7e-9 控制狀態斷言更新；新增 7f-1（開始預覽前速率可調）、7f-2（重播啟用規則、auto-stop 後仍啟用、重播不重注入 .js、`createEffect` 再呼叫） |
| `tests/e2e/editor.spec.js` | 修改 | 49 項不變：7e 測試改斷言速率常啟用、加 `viewer.js` 請求計數（開始預覽後＝1、重播後仍＝1 驗證不重請求）、auto-stop 後重播仍啟用 |
| `docs/agents/TODO.md` | 修改 | 測試計數 114→116；7e 下新增 7f 已完成項 |
| `docs/agents/CALL_GRAPH.md` | 修改 | `+previewStart()`→`+previewStart(reusePlugin)`；TEX 節點 114→116 並補 7f 描述；TP 節點補 7f 描述 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- `node --test tests/test_editor.mjs`：116 項通過
- `npm run test:unit`：pytest 159 項通過、node 合計 225 項通過
- `npx playwright test tests/e2e/editor.spec.js`：49 項通過
- `npx playwright test`（其餘 9 個非 editor spec 檔）：28 項通過——E2E 合計 77 項通過
  - 過程註記：首次全量 E2E 執行被使用者中斷（非本專案原因），中斷使某測試對 `tests/fixtures/effects.json` 的變更未復原（缺 text 特效），導致重跑時 9 項非 editor 測試失敗；`git checkout` 還原該 fixture 後重跑 28 項全數通過。

## Git Commit

- Commit：`172a7fa` — `feat(editor): 預覽時間軸 UX（速率常可調、重播重用已載入插件不重請求 .js、控制列合併單一列）`
