# 工作完成報告

- **日期**：2026-09-21
- **任務**：effects 編輯器子任務 5m — 所有操作只變更前端資料、只有按下[保存]才更新伺服器檔案
- **Agent**：opencode

## 摘要

依使用者指示修正：effects 編輯器中**所有操作只變更前端（staged）資料，只有按下[保存]後才寫入 server 檔案**（經確認 code 區 [存檔]／[匯入] 與 zip [匯入] 皆改 staged）。

改動前，三類操作會**立即**寫入 server：code 區 [存檔]（`saveFile` 直接 `PUT /api/editor/effect/{id}/viewer.js|console.js`）、code 區 [匯入]（`doImportFile` 讀檔後自動 `saveFile`）、zip [匯入 effects.zip/effect.zip]（`importZip` 直接 `POST /api/editor/import` 落盤）。改動後三者皆改為 staged，[保存] 統一寫入。

staged 設計（`editor/app.js`）：
- 新增 `state.pendingCode`（map `<effectId>/<filename>` → `{effectId, filename, content}`）。
- `saveFile()` 由 `PUT` 改為 staged：存 `pendingCode`、`setDirty(true)`、訊息「code staged（按 [保存] 寫入伺服器）」、**不再**觸發 `onCodeSaved`。
- 新增 `writePendingCode()`：對每項 `pendingCode` 以 `PUT /api/editor/effect/{id}/file`（body `{filename, content}`）寫入；成功清 `pendingCode` 回 `{ok, warnings}`，失敗回 `{ok:false, error}` 並保留 `pendingCode`。
- `save()` 於 `PUT /api/editor/manifest` 2xx 後調 `writePendingCode()`：失敗顯示「save failed: code file …」並 return（保留 staged）；成功 `loadManifest()`＋`onCodeSaved(state.selected)`（重載預覽）＋合併 code warnings。
- `importZip()` 改 `POST /api/editor/import?dryRun=true`：2xx 調 `stageImport(r.data)`（非 `loadManifest`）、訊息「import staged: <ids>（按 [保存] 寫入伺服器）」。
- 新增 `stageImport(data)`：合併 `data.importedEffects` 進 `state.manifest.effects`；若有 `data.importedLayout`（currentEffects＋alternateEffects）設入 manifest；`data.files`（key＝`effectId/filename`）拆成 `pendingCode`；`setDirty`＋`renderAll`＋`selectItem(firstId)`。
- `onCodeSaved` 現僅由 `save()` 觸發（[保存] 成功後重載預覽）。
- version `'5l'`→`'5m'`；`__rtxEditor` 新增 `writePendingCode`／`stageImport` 匯出。

server（`server/editor.py`）：
- 新增 `EffectFileBody`（`filename: str`、`content: str`）。
- 新增 `PUT /api/editor/effect/{effect_id}/file`（`put_effect_file`）：驗證 filename（不可含 `/`、`\`、`.`、`..`）→ 轉呼既有 `_put_file()`（寫檔＋備份＋warnings＋`reload_effects`＋broadcast）。
- `import_effects` 加 `dryRun: bool = Query(default=False)`：dry-run 分支於寫檔**前**回 `{ok, dryRun, importedEffects, importedLayout, files, baseRev}`，`files` key 為相對於 `EFFECTS_DIR` 的 `effectId/filename`（含新特效模板 `viewer.js`／`console.js`），**不寫檔**；viewer 檔存在性驗證延至 [保存] 落盤時（dry-run 結構驗證 version/effects/id 已於上方完成）。
- 原 `POST /api/editor/import`（非 dryRun）維持立即寫檔（後相容）。

`onCodeSaved` 現僅於 `save()` 成功後觸發（3b 存檔後自動重載預覽的時點由「[存檔]」延至「[保存]」）。`RateLimiter`（`server/relay.py`）為全域 1/s 共用，`[保存]` 連續 PUT manifest＋/file 時 client `putJson` 內建 429 `Retry-After` 重試。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/editor.py` | 修改 | 新增 `EffectFileBody`（filename/content）、`PUT /api/editor/effect/{id}/file`（`put_effect_file`，filename 驗證不可含 `/`、`\`、`.`、`..`）→`_put_file`；`import_effects` 加 `dryRun: bool = Query(default=False)`（dry-run 於寫檔前回 `{ok, dryRun, importedEffects, importedLayout, files, baseRev}`、`files` key 為相對 `EFFECTS_DIR` 的 `effectId/filename`、不寫檔；viewer 檔存在性驗證延至[保存]落盤） |
| `editor/app.js` | 修改 | 新增 `state.pendingCode`；`saveFile()` 改 staged（存 pendingCode、setDirty、訊息「code staged」、不再 onCodeSaved）；新增 `writePendingCode()`（`PUT /file` 寫入、成功清 pendingCode 回 `{ok,warnings}`、失敗回 `{ok:false,error}` 保留）；`save()` 於 manifest 2xx 後調 `writePendingCode()`（失敗顯示 save failed 並 return、成功 loadManifest＋onCodeSaved＋合併 warnings）；`importZip()` 改 `?dryRun=true`（2xx 調 `stageImport` 非 loadManifest、訊息「import staged」）；新增 `stageImport(data)`（合併 importedEffects/importedLayout、files 拆 pendingCode、setDirty＋renderAll＋selectItem）；version `'5l'`→`'5m'`、新增 `writePendingCode`／`stageImport` 匯出 |
| `tests/test_editor.mjs` | 修改 | 59→60 項：harness 補 `importSeq`／`PUT /file` 路由／`POST /import` dryRun 路由／zip inputs／`FakeFormData`；3a 存檔/warnings/409/429 改測 staged＋[保存] `PUT /file` 寫入、3a 匯入改 staged＋[保存]、3b 存檔自動重載改[保存]觸發 `onCodeSaved`、新增「3a zip 匯入 dry-run staged→[保存] 寫 manifest＋/file」 |
| `tests/e2e/editor.spec.js` | 修改 | 31 項不變：5 項改 staged 流程（effect.zip 匯入 dry-run→[保存]建立新特效、viewer.js 存檔 staged→[保存]寫、console 匯入 staged→[保存]、子集 zip round-trip／單選 staged→[保存]）；effect.zip 匯入測試補 `toHaveProperty(['imported-fx/viewer.js'])`（array path 避開 key 內 `.` 被當巢狀路徑） |
| `tests/test_editor_api.py` | 修改 | 73→77 項：新增 dry-run import 不落盤（`importedEffects`／`files`／`baseRev`、manifest 與目錄不變）＋invalid manifest 400、generic `PUT /file` 寫檔＋invalid filename（`../`、`a/`）400 |
| `README.md` | 修改 | code 區 [存檔] staged＋[保存]回 warnings＋保存後重載預覽；zip [匯入] `?dryRun=true` staged（回 importedEffects/files、[保存]經 /file＋manifest 落盤）；code 區 viewer/console 匯入 staged 經 `PUT /file` 寫入、`GET` 讀取 |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | code 編輯 bullet 補 [存檔] staged、[保存]回 warnings、匯入 staged |
| `docs/agents/CALL_GRAPH.md` | 修改 | `EditorPage` class 加 `+writePendingCode()`／`+stageImport(data)`；EDP 節點補 5m；TEX 節點 59→60＋5m 描述；現況表補 5m |
| `docs/agents/TODO.md` | 修改 | 新增子任務 5m 完成項 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：
  - `python -m pytest tests/ -q`
  - `node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`
  - `npx playwright test`
- 結果：全綠——pytest 151 通過（`test_editor_api.py` 73→77）；node 169 通過（`test_editor.mjs` 59→60）；Playwright E2E 59 通過（`editor.spec.js` 31 項，含 5 項 staged 流程）。

## Git Commit

- Commit：`8c7cda9` — `feat(editor): code 存檔/匯入與 zip 匯入改 staged，只有[保存]才寫入 server`

## 後續待辦

- 無新增項；TODO「effects 編輯器後續小項」（E2E `.backup/` 清理、import 422 先於 401、兩情境人工瀏覽器確認）維持待辦。
