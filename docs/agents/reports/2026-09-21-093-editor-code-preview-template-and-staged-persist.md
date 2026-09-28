# 工作完成報告

- **日期**：2026-09-21
- **任務**：effects 編輯器子任務 5p — 修正程式碼預覽（新增特效套用模板、[存檔] staged 切換特效不遺忘變更）
- **Agent**：opencode

## 摘要

依使用者指示修正程式碼預覽 2 項（注意：**[存檔] 不更改 server 檔案**）：

1. **新增特效直接套用模板**：新增特效時 viewer.js／console.js 預覽原本為空（檔案未建立、404）。現改為直接套用 server 模板——`server/editor.py` 之 `get_viewer_file`／`get_console_file` 加 `template: bool = Query(default=False)` 參數，新增 `_template_response(effect_id, filename)` 回傳 `VIEWER_TEMPLATE`／`CONSOLE_TEMPLATE`（`__ID__` 置換為 effect_id、不要求檔案存在、**不落盤**、GET 不需金鑰、invalid id 404）；`editor/app.js` 之 `loadCodeFile()` 於檔案 404 時改 `fetch(path + '?template=true')` 套用模板（非錯誤提示「\<id\> 套用 viewer.js／console.js 模板」）。
2. **[存檔] staged 切換特效不遺忘變更**：`loadCodeFile()` 原一律 `fetch` server，導致 [存檔]（staged、存 `state.pendingCode`）後切換特效再切回時，預覽重新抓 server 舊內容、遺忘 staged 變更。修法：`loadCodeFile()` 載入前先看 `state.pendingCode`——已 [存檔] 的檔案直接顯示 staged 內容（不 fetch、非錯誤提示「\<id\> 顯示 [存檔] 的 staged 內容」）；無 staged 才 fetch server（404 則走第 1 點模板）。[保存] 時 `writePendingCode()` 清 `pendingCode` 並寫入，語義不變。

version `'5o'`→`'5p'`。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/editor.py` | 修改 | `get_viewer_file`／`get_console_file` 加 `template: bool = Query(default=False)`；新增 `_template_response(effect_id, filename)` 回傳 `VIEWER_TEMPLATE`／`CONSOLE_TEMPLATE`（`__ID__` 置換、不要求檔案存在、不落盤、GET 不需金鑰、invalid id 404） |
| `editor/app.js` | 修改 | `loadCodeFile()` 載入前先看 `state.pendingCode`（已 [存檔] staged → 顯示 staged 內容、不 fetch、切換特效不遺忘變更）＋404（新特效無檔案）→ `fetch(path + '?template=true')` 套用模板（非錯誤）；version `'5o'`→`'5p'` |
| `tests/test_editor.mjs` | 修改 | 71→72 項：harness 加 `fileTemplate`＋`?template=true` 路由；5o 新增特效測試改斷言套用模板（404→?template=true）；新增 5p 2 項（新增特效 viewer tab 套用模板、[存檔] staged 切換特效再切回不遺忘（顯示 staged 不 fetch）） |
| `tests/test_editor_api.py` | 修改 | 77→79 項：新增 template 端點測試（`__ID__` 置換＋ghost 不落盤＋invalid id 404、template GET 不需金鑰） |
| `tests/e2e/editor.spec.js` | 修改 | 32→34 項：新增 5p 2 項（新增特效 viewer tab 直接套用 server 模板（含 id、不落盤）、[存檔] staged 切換 ripple→particle 不遺忘（server 檔未變）） |
| `README.md` | 修改 | code 區匯入匯出 bullet 補新增特效套用模板＋[存檔] staged 不遺忘；修正「目前測試數量」為 pytest 153／node 181／E2E 62（editor.spec.js 34、test_editor 72、test_editor_api 79） |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | 程式碼編輯 bullet 補新增特效套用模板＋[存檔] staged 不遺忘 |
| `docs/agents/CALL_GRAPH.md` | 修改 | EDP/TEX/TP 節點補 5p（TEX 71→72、TP 60→62 與 editor.spec.js 34）；server API 節點補 `GET ?template=true`；現況表補 5p |
| `docs/agents/TODO.md` | 修改 | 新增子任務 5p 完成項；「已知優先風險」概況修正（E2E 62／editor.spec.js 34／test_editor 72／test_editor_api 79） |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：
  - `python -m pytest tests/ -q`
  - `node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`
  - `npx playwright test`
- 結果：全綠——pytest 153 通過（`test_editor_api.py` 77→79）；node 181 通過（`test_editor.mjs` 71→72）；Playwright E2E 62 通過（`editor.spec.js` 32→34，含 5p 新增特效模板＋staged 不遺忘）。

## Git Commit

- Commit：`14d09ff53a0385b36fbb7d79e6693c0e75e9736b` — `feat(editor): 修正程式碼預覽（新增特效套用 server 模板、[存檔] staged 切換特效不遺忘變更）`

## 後續待辦

- 無新增項；TODO「effects 編輯器後續小項」（E2E `.backup/` 清理、import 422 先於 401、兩情境人工瀏覽器確認）維持待辦。
