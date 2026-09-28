# 工作完成報告

- **日期**：2026-09-23
- **任務**：B6「無法把檔案存成空」（依使用者指示：僅 `console.js` 可清空）＋U12「匯入 .js 不自動跑格式檢查」
- **Agent**：opencode

## 摘要

依使用者指示處理 EDITOR_REVIEW 的 B6 與 U12：

- **B6 空檔（僅 console.js 可清空）**：原 `server/editor.py` `_put_file`／`_write_staged_file` 一律要求 `content` 非空，清空 `viewer.js`／`console.js` 再存檔會 400；client `exportSource` 亦略過空 staged。修正：
  - **server**：`content` 改為「須為字串；**僅 `viewer.js` 須非空**」——`viewer.js` 空/純空白 → 400（`viewer.js content must be non-empty`，enabled 特效 viewer 不可缺）；`console.js` **允許空**（＝該特效無 console 插件）；`console.js` 的「無 `window.RTX_EFFECT_CONSOLE.register(`」警告僅對**非空**內容觸發（空檔不警告）。
  - **client**：`saveFile`（[暫存]）對空 `viewer.js` 直接擋下（顯示 `viewer.js 不可為空…`、不 staged、不 dirty）；`exportSource` 移除 `staged.content !== ''` 判斷 → 回傳**空 staged**（不 fallback 到 server 檔）。
  - **未採**：`viewer.js` 不允許清空（清空 enabled 特效的 viewer.js 會留下「已啟用但無 viewer」的殘缺特效）——要停用請取消啟用或 [✕ 移除]。
- **U12 匯入 .js 自動跑格式檢查**：原 `doImportFile` 匯入 .js 後只 `showCode`＋`saveFile`（staged）即止、不檢查，與 `doImportEntry`（匯入 .json 會 `computeCheck`＋`displayCheck`）行為不一致。修正：`doImportFile` 在 `saveFile()` 後補跑 `computeCheck(id, [kind], false)`＋`displayCheck`（依當前 tab 取 viewer/console、**只用 staged/編輯框內容、不 fetch**），與匯入 .json 一致。

`window.__rtxEditor.version` 6t→6u。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/editor.py` | 修改 | `_put_file`／`_write_staged_file`：`content` 改「須為字串、僅 `viewer.js` 須非空」（`viewer.js` 空→400、`console.js` 可空）；`console.js` 的「無 register」警告加 `content.strip()` 守衛（空檔不警告） |
| `editor/app.js` | 修改 | `saveFile`（[暫存]）擋下空 `viewer.js`（顯示提示、不 staged）；`doImportFile` 匯入 .js 後補跑 `computeCheck`＋`displayCheck`（staged、不 fetch）；`exportSource` 移除 `!== ''` → 回空 staged；version 6t→6u |
| `tests/test_editor.mjs` | 修改 | 測試 98（匯入 .js）warnings 斷言由 `code staged` 改「檢查格式＋viewer.js」（U12）；新增 B6 測試「viewer.js 不可[暫存]空、console.js 可[暫存]空＋exportSource 回空 staged」（96→97） |
| `tests/test_editor_api.py` | 修改 | `test_put_file_empty_content` 補「`viewer.js` 空→400（含 `non-empty` detail）、`console.js` 空→200 寫入空檔」（82→83） |
| `tests/e2e/editor.spec.js` | 修改 | 5c console 匯入測試（1604）匯入後 warnings 斷言由 `code staged` 改「檢查格式＋console.js」（U12；46 不變） |
| `README.md` | 修改 | 端點表 `PUT /api/editor/effect/{id}/viewer.js`／`console.js` 補空檔規則（`viewer.js` 不可空、`console.js` 可空）；code 區說明補「匯入 .js／effects.json 後自動對該內容跑[檢查格式]」 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 測試節點計數 `test_editor_api.py` 82→83、`test_editor.mjs` 96→97＋補 B6/U12 說明；E2E 節點補「匯入 .js 後自動跑格式檢查 U12」 |
| `docs/agents/TODO.md` | 修改 | 新增「空檔＋匯入格式檢查（B6/U12/6u）」完成項（version 6t→6u） |

> 註：本報告檔案本身不列入上表；`docs/temp/effects-editor/EDITOR_REVIEW.md`（gitignored）同步 B6→✅、U12→✅、版本 6t→6u、§6 優先序表。

## 測試與驗證

- 執行命令：`node --test tests\test_effects.mjs tests\test_console.mjs tests\test_effect_examples.mjs tests\test_effect_catalog.mjs tests\test_editor.mjs`、`python -m pytest tests/ -q`、`npx playwright test`
- 結果：全綠——node **206**（`test_editor` 97、含 1 項新增 B6）、pytest **157**（`test_editor_api` 83）、Playwright E2E **74**（`editor.spec.js` 46）

## Git Commit

- Commit：`b357e45` — `fix(editor): 允許 console.js 存空（viewer.js 不可空）＋匯入 .js 自動跑格式檢查（B6/U12）`

## 後續待辦

- 無新增。U16（特效列表加回 icon＋保存 iconSVG）維持待評估；U3／U4／U6 依指示不做（見 EDITOR_REVIEW）。
