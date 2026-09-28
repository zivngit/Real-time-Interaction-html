# 工作完成報告

- **日期**：2026-09-21
- **任務**：effects 編輯器子任務 5g — [匯出 ▾] 收為 2 項＋單選所選 zip 匯出匯入驗證
- **Agent**：opencode

## 摘要

使用者回報 editor 頁面特效列表的匯出匯入 bug 修正需求：

1. 確認「匯出所選 effect.zip」單選時，zip 內 `effects.json` 只含該單個 effect，且該 zip 可匯入。
2. [匯出 ▾] 選單固定為 2 項：[匯出 effects.zip]、[匯出所選 effect.zip]。
3. 移除 [匯出單個 effect 的 effects.json]。

驗證結論：`GET /api/editor/export?ids=` 既有子集語義正確（`server/editor.py` 無需修改）——單選時 zip 內 `effects.json`＝`{"version": 2, "effects": {<id>: entry}}`（省略 `currentEffects`／`alternateEffects` layout 鍵），且 zip 只含該 effect 的 `viewer.js`／`console.js`；匯入端（`POST /api/editor/import`）保留現有 layout、新 id 由 server 正規化 append 到 `alternateEffects`。本次以 E2E UI 完整流程固定該行為：勾選單項 → `#ed-export-sel` 下載 `<id>.zip` → zip 內容斷言（effects.json 單項、無 layout 鍵、無其他特效檔）→ 移除該特效＋重載 → `#ed-file-import-effect` 匯入 → `created` 與 layout 保留斷言。

移除項目：[匯出 ▾] 之 `#ed-export-entry`（與「匯出所選 effect.zip」單選能力重疊）；`editor/app.js` 移除 `els.exportEntry`、`exportEffectEntry()`、`downloadText()`（僅供單項匯出使用）與 click handler 及 `__rtxEditor` 匯出；`selectedEffectEntry()`／`effectEntryJson()` 維持供 [effects.json] tab（5b）使用。[＋新增特效 ▾] 之「匯入單個 effect 的 effects.json」（`doImportEntry`）依指示維持。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/index.html` | 修改 | [匯出 ▾] 移除 `#ed-export-entry`（匯出單個 effect 的 effects.json），選單收為 2 項 |
| `editor/app.js` | 修改 | 移除 `els.exportEntry`、`exportEffectEntry()`、`downloadText()`、click handler 與 `__rtxEditor` 匯出；`window.__rtxEditor` version `'5f'`→`'5g'` |
| `tests/test_editor.mjs` | 修改 | 58→57 項：移除 5c 單項匯出 vm 測試（vm 無 Blob／未選定 err）、harness `exportEntry`、code tab 標籤測試 `exportEntry.disabled` 斷言 |
| `tests/e2e/editor.spec.js` | 修改 | 29 項：移除 5c「匯出單個 effect 的 effects.json shape」測試；新增 5g「匯出所選 effect.zip（單選）：effects.json 只含該 effect、[匯入 effect.zip] 匯入還原」（UI 單選→下載 `<id>.zip`→zip 內容斷言→移除＋重載→匯入→created/layout 斷言）；5a dropdown 測試補 [匯出 ▾] 選單 2 項斷言 |
| `README.md` | 修改 | 編輯器功能 bullet×2 改「zip／console 匯入匯出、單個 effect JSON 匯入」；`/editor` 章節 zip bullet 補 [匯出 ▾] 2 項＋單選下載 `<id>.zip` 語義；console/單個 effect JSON bullet 改「匯入」並移除 [匯出 ▾] 單項匯出描述；測試說明段補單選子集 zip round-trip |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | zip bullet 補 [匯出 ▾] 單選下載 `<id>.zip`；「單個 effect JSON 匯入匯出」改「單個 effect JSON 匯入」（移除匯出項描述） |
| `docs/agents/CALL_GRAPH.md` | 修改 | EDP 節點補 5g 說明（移除 5c 單項匯出描述）；`EditorPage` class 移除 `+exportEffectEntry()`／`+downloadText()`；`test_editor.mjs` 節點 58→57 項並移除單項匯出描述；E2E 節點補 5g 測試描述；`editor/` 現況表補 5g |
| `docs/agents/TODO.md` | 修改 | 已知優先風險測試計數更新（E2E 57／editor.spec.js 29／test_editor.mjs 57／test_editor_api.py 73）；新增子任務 5g 完成項 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：
  - `python -m pytest tests/ -q`
  - `node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`
  - `npx playwright test`
- 結果：全綠——pytest 147 通過；node 166 通過（`test_editor.mjs` 57 項）；Playwright E2E 57 通過（`editor.spec.js` 29 項，含新增 5g 單選 zip 匯出＋匯入還原測試與 5a 選單 2 項斷言）。E2E 後 `git status` 乾淨（`effects/.backup/` 測試備份目錄為 gitignore）。

## Git Commit

- Commit：`96346fd` — `fix(editor): [匯出 ▾] 移除匯出單個 effect 的 effects.json，單選所選 zip 只含該 effect 匯入還原驗證`

## 後續待辦

- 無新增項；TODO「effects 編輯器後續小項」（E2E `.backup/` 清理、import 422 先於 401、兩情境人工瀏覽器確認）維持待辦。
