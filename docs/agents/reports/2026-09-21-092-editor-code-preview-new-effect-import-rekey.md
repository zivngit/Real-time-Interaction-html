# 工作完成報告

- **日期**：2026-09-21
- **任務**：effects 編輯器子任務 5o — 修正程式碼預覽邏輯（新增特效清空 viewer/console 預覽、[匯入 effects.json] 單一 entry 改寫為選定特效 id）
- **Agent**：opencode

## 摘要

依使用者指示修正程式碼預覽邏輯 2 項：

1. **新增特效時同步清空 viewer.js／console.js 預覽**：`newEffect()` 在 `renderAll()` 前先把 `state.selected` 設為新特效，導致 `selectItem()` 視為「同一項」而跳過 `loadCodeFile()`，viewer／console tab 仍顯示舊特效代碼。修法：
   - `newEffect()` 結尾補 `if (activeTab() !== 'manifest') loadCodeFile();` → 新特效（無檔案）觸發載入。
   - `loadCodeFile()` 於 `!ok` 加 **404 特判**：特效尚無此檔案 → `showCode('')` 清空預覽＋非錯誤提示「（\<id\> 尚無 viewer.js/console.js，[保存]後由 server 以模板產生）」（不帶 `err` class）；其他狀態維持 `load failed <status>` 錯誤。
2. **[匯入 effects.json] 單一 entry 改寫為選定特效 id**：`doImportEntry()` 原以檔名／wrapper key 定 id，與選定特效不同時會**意外新增**新的特效欄位。經與使用者確認採「一律改寫為選定特效 id」：`doImportEntry()` 於 id 驗證後、合併前補 re-key——`state.selected && ids.length === 1 && state.selected !== ids[0]` 時把 entry 改掛 `state.selected`（單一 entry＝raw 或只含 1 個 effect 的 wrapper，覆蓋選定特效、不新增；多 effect wrapper 維持各自 id bulk 匯入）。要新增特效請用 [＋新增特效]／[匯入 effect.zip]。

version `'5n'`→`'5o'`。`server/editor.py` 無改動。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `loadCodeFile()` 於 `!ok` 加 404 特判（特效尚無檔案 → `showCode('')` 清空＋非錯誤提示、其他狀態維持錯誤）；`newEffect()` 結尾補 `if (activeTab() !== 'manifest') loadCodeFile();`（新特效無檔案 → 404 → 清空 viewer/console 預覽）；`doImportEntry()` 於 id 驗證後、合併前補 re-key（單一 entry 改掛 `state.selected`、多 effect wrapper 維持 bulk）；version `'5n'`→`'5o'` |
| `tests/test_editor.mjs` | 修改 | 69→71 項：5j wrapper／5j raw entry 匯入測試改斷言 re-key 至選定 fx-a 覆蓋、無新增；新增 5o 2 項（newEffect viewer tab 清空預覽（`fileGetSeq` 200→404、code 清空＋非錯誤提示）、多 effect wrapper 不改寫 id（bulk 各 id）） |
| `tests/e2e/editor.spec.js` | 修改 | 32 項不變：[匯入 effects.json] 本機 .json 測試改 re-key 至選定 particle（覆蓋 particle、無 json-fx、[保存] 寫入磁碟） |
| `README.md` | 修改 | code 區匯入匯出 bullet 補單一 entry re-key＋新增特效清空 viewer/console 預覽；修正「目前測試數量」為 node 180（`test_editor` 71） |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | 程式碼編輯 bullet 補新增特效清空 viewer/console 預覽；effects.json tab bullet 補單一 entry re-key 至選定特效 |
| `docs/agents/CALL_GRAPH.md` | 修改 | EDP/TEX/TP 節點補 5o（TEX 69→71、TP editor.spec.js 匯入測試改 re-key）；現況表補 5o |
| `docs/agents/TODO.md` | 修改 | 新增子任務 5o 完成項；「已知優先風險」概況 test_editor 69→71 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：
  - `python -m pytest tests/ -q`
  - `node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`
  - `npx playwright test`
- 結果：全綠——pytest 151 通過；node 180 通過（`test_editor.mjs` 69→71）；Playwright E2E 60 通過（`editor.spec.js` 32 項，含 [匯入 effects.json] re-key 測試）。

## Git Commit

- Commit：`3ba2b23b58d216737a23dbae7b2c61cd66931bb2` — `fix(editor): 修正程式碼預覽（新增特效清空 viewer/console 預覽、[匯入 effects.json] 單一 entry 改寫為選定特效 id）`

## 後續待辦

- 無新增項；TODO「effects 編輯器後續小項」（E2E `.backup/` 清理、import 422 先於 401、兩情境人工瀏覽器確認）維持待辦。
