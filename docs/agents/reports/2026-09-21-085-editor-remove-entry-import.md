# 工作完成報告

- **日期**：2026-09-21
- **任務**：effects 編輯器子任務 5h — 移除 [匯入單個 effect 的 effects.json]
- **Agent**：opencode

## 摘要

依使用者指示移除 [＋新增特效 ▾] 之「匯入單個 effect 的 effects.json」（`#ed-import-entry`），選單收為 3 項：[新增特效]、[匯入 effects.zip]、[匯入 effect.zip]。zip 匯入（`POST /api/editor/import`）與 console 匯入匯出（code 區按鈕）不受影響，`server/editor.py` 無改動。

移除內容：

- `editor/index.html`：`#ed-import-entry` dd-item 與 hidden `#ed-file-import-entry`（accept .json）。
- `editor/app.js`：`els.importEntry`／`els.fileImportEntry`、`setEditable()` 之 `dis(els.importEntry)`、`doImportEntry()`（staged 合併 effects wrapper／raw entry）、`entryIdFromFilename()`、click/change handler 與 `__rtxEditor` 匯出；`window.__rtxEditor` version `'5g'`→`'5h'`。
- 測試：`tests/test_editor.mjs` 57→54 項（移除單項匯入 3 項 vm 測試：staged 本地合併、raw entry 檔名定 id、invalid JSON／無 id／v1 只讀；harness 移除 `importEntry`／`fileImportEntry`；code tab 標籤測試移除 `importEntry.disabled` 斷言）；`tests/e2e/editor.spec.js` 29→28 項（移除 5c 單項匯入 staged 合併測試、describe 標題改「5c console 匯入匯出與子集 zip」；5a dropdown 測試補 [＋新增特效 ▾] 選單 3 項斷言）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/index.html` | 修改 | [＋新增特效 ▾] 移除 `#ed-import-entry`；移除 hidden `#ed-file-import-entry` |
| `editor/app.js` | 修改 | 移除 `els.importEntry`／`els.fileImportEntry`、`dis(els.importEntry)`、`doImportEntry()`／`entryIdFromFilename()`、click/change handler 與 `__rtxEditor` 匯出；version `'5g'`→`'5h'` |
| `tests/test_editor.mjs` | 修改 | 57→54 項：移除單項匯入 3 項 vm 測試；harness 移除 `importEntry`／`fileImportEntry`；code tab 標籤測試移除 `importEntry.disabled` 斷言（標題改「v1 code 匯入/匯出 disabled」） |
| `tests/e2e/editor.spec.js` | 修改 | 29→28 項：移除 5c 單項匯入 staged 合併測試；5c describe 標題改「5c console 匯入匯出與子集 zip」；5a dropdown 測試補 [＋新增特效 ▾] 選單 3 項斷言 |
| `README.md` | 修改 | 編輯器功能 bullet×2 移除「單個 effect JSON 匯入」；「console／單個 effect JSON 匯入」bullet 改「console 匯入匯出」（`GET/PUT /api/editor/effect/{id}/console.js`）；測試說明段同步 |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | 移除「單個 effect JSON 匯入」bullet |
| `docs/agents/CALL_GRAPH.md` | 修改 | EDP 節點補 5h（5d 描述移除 `doImportEntry`）；`EditorPage` class 移除 `+doImportEntry()`／`+entryIdFromFilename()`；`test_editor.mjs` 節點 57→54 項、E2E 節點 57→56 項與 editor.spec.js 28 項、5c/5h 描述；現況表 5c/5d 更新＋5h |
| `docs/agents/TODO.md` | 修改 | 已知優先風險測試計數更新（E2E 56／editor.spec.js 28／test_editor.mjs 54）；新增子任務 5h 完成項 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：
  - `python -m pytest tests/ -q`
  - `node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`
  - `npx playwright test`
- 結果：全綠——pytest 147 通過；node 163 通過（`test_editor.mjs` 54 項）；Playwright E2E 56 通過（`editor.spec.js` 28 項，含 5a [＋新增特效 ▾] 選單 3 項斷言）。E2E 後 `git status` 乾淨（`effects/.backup/` 測試備份目錄為 gitignore）。

## Git Commit

- Commit：`7efd53f` — `refactor(editor): [＋新增特效 ▾] 移除匯入單個 effect 的 effects.json，選單收為 3 項`

## 後續待辦

- 無新增項；TODO「effects 編輯器後續小項」（E2E `.backup/` 清理、import 422 先於 401、兩情境人工瀏覽器確認）維持待辦。
