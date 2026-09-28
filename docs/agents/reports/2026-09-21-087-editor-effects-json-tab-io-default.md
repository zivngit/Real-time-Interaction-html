# 工作完成報告

- **日期**：2026-09-21
- **任務**：effects 編輯器子任務 5j — 程式碼預覽 [effects.json] tab 修正 4 項
- **Agent**：opencode

## 摘要

使用者回報程式碼預覽 [effects.json] tab 4 項修正：

1. **選取副檔名**：code 區匯入的檔案選擇器副檔名過濾器隨 tab——effects.json tab 為 `.json`、viewer.js／console tab 為 `.js`（`importFile()` 點開前依 `activeTab()` 設 `#ed-file-import-file` 之 `accept`）。
2. **按鈕顯示**：[匯入]／[匯出] 標籤在 effects.json tab 顯示「匯入/匯出 effects.json」（原「匯入檔案/匯出檔案」）；該 tab 兩按鈕改回 enabled（v2）並實際運作——[匯入] 走 `doImportEntry()`（5h 自選單移除後復用：`effects` wrapper 或 raw entry、raw entry 依檔名 `<id>.effects.json` 定 id、staged 本地合併＋dirty、[保存]才 PUT、合併後檢視重繪）；[匯出] 走新增 `selectedEffectFileJson()` 下載 `<id>.effects.json`（`{"version": 2, "effects": {<id>: entry}}` 單項子集，與子集 zip 片段同 shape）；v1 時 [匯入] disabled、effects.json tab 未選定時 [匯出] disabled。
3. **預設頁面顯示**：code 區預設 tab 由 viewer.js 改為 effects.json（`editor/index.html` active class 移至 manifest tab、`activeTab()` 預設回傳 manifest、初始按鈕標籤與 accept 同步；`loadManifest`／`selectItem` 既有 manifest tab 重繪路徑自動承接初繪）。
4. **匯入 [匯出所選 effect.zip] 中的 effects.json 沒有過濾乾淨**：根因在 client `exportZip()` 之 `isFull` 自動判定——批次勾選恰好涵蓋全部特效時 URL 不帶 `ids`，server 回**完整** manifest（含 `currentEffects`／`alternateEffects`/layout），zip 內 `effects.json` 未過濾。修正：`exportZip(ids, asFull)` 由呼叫端決定——[匯出 effects.zip]（`exportAll`）維持不帶 ids（完整備份）、[匯出所選 effect.zip]（`exportSel`）一律帶 `ids`，zip 內 `effects.json` 恆為只含選取 effects 的乾淨子集（選取＝全部亦同）。`server/editor.py` 無改動（server 子集語義本就正確）。

`window.__rtxEditor` version `'5i'`→`'5j'`，加回 `doImportEntry`／`entryIdFromFilename` 匯出並新增 `selectedEffectFileJson`。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `activeTab()` 預設 manifest；`importExportLabel()` effects.json tab 標籤；`syncCodeEditable()` 改 [匯入] v1 disabled、[匯出] v1 或未選定 disabled；`importFile()` 依 tab 設 accept；`doImportFile()` manifest tab 路由 `doImportEntry()`；新增 `selectedEffectFileJson()`、復用 `entryIdFromFilename()`／`doImportEntry()`（合併後 manifest 檢視重繪）；`exportFile()` manifest tab 分支下載單項子集；`exportZip(ids, asFull)` 移除 isFull；version `'5j'`＋3 個 `__rtxEditor` 匯出 |
| `editor/index.html` | 修改 | active class 移至 effects.json tab；[匯入]／[匯出] 初始標籤改 effects.json；`#ed-file-import-file` accept 改 `.json` |
| `tests/test_editor.mjs` | 修改 | 54→58 項：harness 預設 active tab 改 manifest＋fake element 補 `click()`；3a tabs 初態改 manifest；3b 存檔自動重載補先切 viewer tab；5c 標籤測試改 5j（標籤/accept 隨 tab、v1 disabled）；新增 5j 4 項（wrapper staged 匯入＋檢視同步、raw entry 檔名定 id、invalid JSON／無 id／v1 只讀不發 PUT、匯出 wrapper shape／vm 無 Blob 提示／未選定失敗） |
| `tests/e2e/editor.spec.js` | 修改 | 28→31 項：2a/3a 預設 tab 斷言改 effects.json；3a viewer/console 載入斷言改 `toHaveValue`（code 區不再初態為空，防競態）；5b 改 v1 disabled＋effects.json 標籤；5c 初始標籤改 effects.json；5c 新增「批次全選 [匯出所選 effect.zip]：zip 內 effects.json 為乾淨子集」；新增 5j describe 2 項（預設 tab＋[匯出 effects.json] 單項 wrapper 下載、[匯入 effects.json] 本機 .json staged→[保存]寫入磁碟） |
| `README.md` | 修改 | 「console 匯入匯出」bullet 改「code 區匯入匯出」（預設 tab effects.json、標籤/accept 隨 tab、staged 匯入、單項匯出）；zip bullet 補「選取＝全部特效亦為乾淨子集」 |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | zip bullet 補全選亦無分區鍵；新增「effects.json tab 匯入匯出」bullet |
| `docs/agents/CALL_GRAPH.md` | 修改 | EDP 節點 5j；`EditorPage` class 加 `doImportEntry`／`entryIdFromFilename`／`selectedEffectFileJson`、`exportZip(ids, asFull)`；`test_editor.mjs` 節點 54→58、E2E 節點 56→59（editor.spec.js 28→31）與 5j 描述；現況表 5j |
| `docs/agents/TODO.md` | 修改 | 已知優先風險測試計數更新（E2E 59／editor.spec.js 31／test_editor.mjs 58）；新增子任務 5j 完成項 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：
  - `python -m pytest tests/ -q`
  - `node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`
  - `npx playwright test`
- 結果：全綠——pytest 147 通過；node 167 通過（`test_editor.mjs` 58 項）；Playwright E2E 59 通過（`editor.spec.js` 31 項，含 5j 2 項與批次全選乾淨子集斷言）。

## Git Commit

- Commit：`489543c` — `feat(editor): effects.json tab 預設顯示＋匯入(.json staged)/匯出單項子集、[匯出所選 effect.zip] 恆為乾淨子集`

## 後續待辦

- 無新增項；TODO「effects 編輯器後續小項」（E2E `.backup/` 清理、import 422 先於 401、兩情境人工瀏覽器確認）維持待辦。
