# 工作完成報告

- **日期**：2026-09-23
- **任務**：zip 匯出邏輯修正——[暫存]後匯出 `.zip` 未含 `.js`（Approach A）＋子集 `effects.json` 缺 `currentEffects`／`alternateEffects`（report 125 同類）＋[匯入] 帶 layout 鍵改「合併」
- **Agent**：opencode

## 摘要

依使用者指示修正 zip 匯出邏輯（A 方案＋一併修復 report 125「缺 `currentEffects`／`alternateEffects`」狀況）：

- **匯出反映暫存（Approach A）**：原 `exportZip` 走 `GET /api/editor/export`、server 讀**磁碟** `_effects.MANIFEST`＋`EFFECTS_DIR/<id>/*.js`，而 [暫存] 把變更留在 client（`state.manifest`＋`state.pendingCode`）→ 匯出 zip 不含未 [保存] 的 `.js`／manifest 變更。修正：`GET`→`POST /api/editor/export`、body `{manifest, files, ids}`；client 送 `buildManifest()`（暫存 manifest）＋`state.pendingCode` 的暫存檔；server 以**提供的 manifest＋files** 組 zip（檔案優先取 `files`、否則磁碟）。
- **子集補 layout 鍵**：子集 zip `effects.json` 原為乾淨子集（無 `currentEffects`／`alternateEffects`）、與 B11 修正後的單項匯出不一致。修正：子集補上二鍵，由完整 manifest 之**分區陣列過濾**至所選（非依 `enabled` 推導——v2 分區由 layout 陣列決定、`enabled` 非等價）→ 與 B11 一致。
- **[匯入] 改「合併」**：帶 layout 鍵的 zip 原採**整區取代**，子集 匯出→刪除→再匯入 會把子集外特效移出 layout。修正：`POST /api/editor/import` 與 client `stageImport` 皆改**合併**（只把匯入特效放回其 zone、保留其他特效）→ 子集 round-trip 正確還原、全量 backup 匯入結果不變（`test_import_adopts_layout_when_present`／`keeps_layout_when_absent` 結果不變）。

`window.__rtxEditor.version` 6s→6t。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/editor.py` | 修改 | 新增 `ExportBody`（`manifest`/`files`/`ids`）；`GET /api/editor/export`→`POST`（以提供 manifest＋files 組 zip、子集補 `currentEffects`/`alternateEffects`、檔案優先暫存否則磁碟）；`POST /api/editor/import` 由整區取代改**合併**（依匯入特效的 zone 放回、保留其他） |
| `editor/app.js` | 修改 | `exportZip` 改 `POST /api/editor/export`（body 含 `buildManifest()`＋`state.pendingCode` 暫存檔＋`ids`）；`stageImport` 的 staged layout 由整區取代改**合併**；version 6s→6t |
| `tests/test_editor_api.py` | 修改 | 5 匯出測試 `GET`→`POST`（帶 manifest/files/ids body）＋子集 layout 斷言；round-trip `alternateEffects` 補回 `text`；新增 `test_export_uses_staged_files`（驗證暫存 `.js` 入 zip） |
| `tests/e2e/editor.spec.js` | 修改 | 直接匯出 `page.request.get`→`post`（帶 manifest body）；子集/單選/批次全選 `effects.json` layout 鍵斷言（`undefined`→實際值）；round-trip 匯入特效回原 zone（particle/text 回主區）＋`currentEffects` 斷言同步 |
| `README.md` | 修改 | 端點表 `GET /api/editor/export`→`POST`（說明 body、子集 layout 鍵、暫存優先）＋import「合併」註記；mermaid 邊改 `POST /api/editor/export` |
| `docs/agents/CALL_GRAPH.md` | 修改 | 3 處 `GET /api/editor/export`→`POST /api/editor/export` |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | 讀取端點列表 `GET /api/editor/export`→`POST /api/editor/export` |

> 註：本報告檔案本身不列入上表；`docs/temp/effects-editor/EDITOR_REVIEW.md`（gitignored）同步加 B13＋版本 6t。

## 測試與驗證

- 執行命令：`node --test tests\test_effects.mjs tests\test_console.mjs tests\test_effect_examples.mjs tests\test_effect_catalog.mjs tests\test_editor.mjs`、`python -m pytest tests/ -q`、`npx playwright test`
- 結果：全綠——node **205**（`test_editor` 96）、pytest **157**（156＋新增 `test_export_uses_staged_files`）、Playwright E2E **74**（`editor.spec.js` 46）

## Git Commit

- Commit：`3d1c573` — `fix(editor): zip 匯出改 POST 以反映暫存 .js／manifest、子集補 currentEffects/alternateEffects、[匯入] 由整區取代改合併（6t）`

## 後續待辦

- 無新增。U16（特效列表加回 icon＋保存 iconSVG）維持待評估（見 EDITOR_REVIEW）。
