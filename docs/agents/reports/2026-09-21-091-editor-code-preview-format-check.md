# 工作完成報告

- **日期**：2026-09-21
- **任務**：effects 編輯器子任務 5n — 修正程式碼預覽區塊（console.js 標籤、切換特效預覽、匯入格式檢查、檢查按鈕）
- **Agent**：opencode

## 摘要

依使用者指示修正程式碼預覽區塊 5 項（經確認格式檢查採**輕量**：語法＋註冊＋結構、不含 smoke run；按鈕採**單檔＋3 檔**兩個動作）：

1. **console 標籤加 `.js`**：code 區 [匯入 console]／[匯出 console] 改為 [匯入 console.js]／[匯出 console.js]（`importExportLabel()`）。
2. **切換特效時 viewer.js／console.js 預覽跟隨**：`selectItem(id)` 切換特效（`!same`）且 active tab 為 viewer／console 時補 `loadCodeFile()` 重抓 → 預覽跟著變更；effects.json tab 維持只改該項 entry（不重抓 viewer／console）。
3. **匯入 effects.json id 變更時前端同步**：由第 2 點覆蓋——`doImportEntry()` 成功後 `selectItem(targetId)`，id 不同時觸發 viewer／console 重抓（id 相同時補 `renderMeta`／`renderParams`）。
4. **匯入時自動 3 檔格式檢查**：匯入 effects.json（`doImportEntry`）／zip（`importZip`）成功後，對選定特效的 3 檔（effects.json entry＋viewer.js＋console.js）自動跑格式檢查並顯示於 warnings（`computeCheck(id, files, allowFetch=false)`——只用 staged 內容、不 fetch，維持 staged 語義不發請求）。
5. **新增 [檢查格式]（單檔）＋[檢查 3 檔] 按鈕**：`#ed-check-file`（依 `activeTab()` 檢查 effects.json／viewer.js／console.js 單檔）與 `#ed-check-all`（3 檔一併檢查，viewer／console 未 staged 時 fetch server）；無選定特效時 disabled。

輕量格式檢查（`editor/app.js`，參考 `tests/test_effect_catalog.mjs`）：
- `checkEffectsEntry(id, entry, errors, warnings)`：entry 結構（label/category/icon/enabled/viewer/console 型別＋未知欄位 warn）＋`checkParam`（type 支援、default 型別/min/max、select options、color 格式）。
- `checkViewerSource(id, source, entry, errors, warnings)`：`new Function('window','document','console', source)` sandbox 執行＋Proxy mock DOM；`window.Effects.register` 恰好一次、註冊 id 正確、factory 回 object 且含 `update`/`draw`/`done`；語法錯誤／註冊次數／id／factory 缺函式皆報錯。
- `checkConsoleSource(id, source, entry, errors, warnings)`：`window.RTX_EFFECT_CONSOLE.register` 恰好一次、id 正確、plugin 含 `render`；`iconID` 非有效 `RTX_EFFECT_ICONS` key 時 warn。
- `checkSourceWarns`：import／export／require／fetch／XMLHttpRequest／WebSocket 使用 warn。
- `computeCheck(id, files, allowFetch)`／`displayCheck(lines, prefix)`／`checkSingleFile()`／`checkAllFiles()`；`checkContent` 依 active tab→textarea、staged `pendingCode`、（allowFetch 時）fetch server 取內容。

version `'5m'`→`'5n'`；`__rtxEditor` 新增 `checkSingleFile`／`checkAllFiles`／`checkEffectsEntry`／`checkViewerSource`／`checkConsoleSource`／`computeCheck`／`displayCheck` 匯出。`server/editor.py` 無改動。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `importExportLabel()` console tab 標籤加 `.js`（匯入/匯出 console.js）；`selectItem(id)` 切換特效（`!same`）且 active tab 為 viewer/console 時補 `loadCodeFile()`；`doImportEntry()`／`importZip()` 成功後對選定特效 3 檔跑 `computeCheck(id, files, false)`＋`displayCheck`；新增輕量格式檢查 `checkEffectsEntry`／`checkViewerSource`／`checkConsoleSource`／`checkRunSource`（Proxy mock DOM）／`checkContent`／`computeCheck`／`displayCheck`／`checkSingleFile`／`checkAllFiles` 等；`#ed-check-file`／`#ed-check-all` click handler＋`syncCodeEditable` 依 `state.selected` 設 disabled；version `'5m'`→`'5n'`＋7 個 `__rtxEditor` 匯出 |
| `editor/index.html` | 修改 | code 區 actions 列加 `#ed-check-file`（[檢查格式]）／`#ed-check-all`（[檢查 3 檔]）兩按鈕（title 說明） |
| `editor/style.css` | 修改 | `.warnings` 加 `white-space: pre-line`（支援格式檢查多行輸出） |
| `tests/test_editor.mjs` | 修改 | 60→69 項：5j console 標籤改 console.js、5j wrapper／5k 匯入測試改測匯入後 3 檔檢查 warnings、3a zip 匯入測試改測 staged＋檢查；新增 5n 9 項（`checkEffectsEntry` valid/未知欄位/不支援 type、`checkViewerSource` valid/wrong id/語法錯/缺少 draw、`checkConsoleSource` valid/missing render/wrong id、`computeCheck` effects/staged 3 檔、`checkSingleFile` effects tab OK＋viewer tab 語法錯、`checkAllFiles` 3 檔列示） |
| `tests/e2e/editor.spec.js` | 修改 | 31→32 項：5c console 標籤改 console.js、5j 匯入測試改測匯入後 3 檔檢查 warnings、新增 5n [檢查格式]/[檢查 3 檔] 按鈕測試（v2 可選定時 enabled、單檔檢查 effects entry、[檢查 3 檔] 列示 effects.json/viewer.js/console.js OK，async fetch 用重試斷言） |
| `README.md` | 修改 | code 區匯入匯出 bullet 補 console.js 標籤＋[檢查格式]/[檢查 3 檔]＋自動 3 檔檢查＋切換特效重抓；修正「目前測試數量」為 pytest 151／node 178／E2E 60 |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | 程式碼編輯 bullet 補 console.js 標籤＋[檢查格式]/[檢查 3 檔] 輕量格式檢查＋自動 3 檔檢查＋切換特效重抓 |
| `docs/agents/CALL_GRAPH.md` | 修改 | `EditorPage` class 加 7 個格式檢查方法；EDP/TEX/TP 節點補 5n（TEX 60→69、TP 59→60 與 editor.spec.js 31→32、5c 標籤改 console.js）；現況表補 5n |
| `docs/agents/TODO.md` | 修改 | 新增子任務 5n 完成項；「目前測試數量」概況修正（E2E 60／editor.spec.js 32／test_editor 69／test_editor_api 77） |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：
  - `python -m pytest tests/ -q`
  - `node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`
  - `npx playwright test tests/e2e/editor.spec.js`
- 結果：全綠——pytest 151 通過；node 178 通過（`test_editor.mjs` 60→69）；Playwright E2E editor.spec.js 32 通過（31→32，含 5n 格式檢查按鈕測試）。

## Git Commit

- Commit：`ed0f959` — `feat(editor): 修正程式碼預覽區塊（console.js 標籤、切換特效重抓 viewer/console、匯入 3 檔格式檢查、[檢查格式]/[檢查 3 檔] 按鈕）`

## 後續待辦

- 無新增項；TODO「effects 編輯器後續小項」（E2E `.backup/` 清理、import 422 先於 401、兩情境人工瀏覽器確認）維持待辦。
