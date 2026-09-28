# 工作完成報告

- **日期**：2026-09-20
- **任務**：effects 編輯器子任務 5c — console 與單個 effect JSON 匯入匯出＋子集 zip
- **Agent**：opencode（effects 編輯器專案 implementer）

## 摘要

依 `docs/temp/effects-editor/sub_agents/sub_agent_5/task_5c/PLAN.md` 完成 CHECK.md 項 5a（console 匯入匯出）、5b（單個 effect JSON 匯入匯出）、6（子集 zip）與測試項 T2/T3：

1. **console.js 匯入匯出**（CHECK 項 5a）：code 區 `#ed-import-file`／`#ed-export-file` 按鈕標籤隨目前 tab 動態切換（`importExportLabel()`：viewer tab→「匯入/匯出 viewer.js」、console tab→「匯入/匯出 console」、effects.json tab→「匯入/匯出檔案」），`syncCodeEditable()` 於 tab 切換／manifest 重抓時同步；匯入走 3a 既有流程（讀檔→`showCode`→自動 `saveFile`），匯出走既有 `exportFile()`（fetch 目前檔→Blob 下載）。v1 只讀時兩者 disabled（`setEditable` 新增 `dis(els.importEntry)` 一併禁用 [＋新增特效 ▾] 的匯入項）。
2. **單個 effect 的 effects.json 匯入匯出**（CHECK 項 5b）：
   - 匯出：`[匯出 ▾]` 新增 `#ed-export-entry`「匯出單個 effect 的 effects.json」，`exportEffectEntry()` 純瀏覽器端下載 `<id>.effects.json`，shape `{"version": 2, "effects": {<id>: <entry>}}`（與子集 zip 內 `effects.json` 片段一致，複用 5b `selectedEffectEntry()`）；未選定顯示「請先選擇特效」。
   - 匯入：`[＋新增特效 ▾]` 新增 `#ed-import-entry`「匯入單個 effect 的 effects.json」＋hidden `#ed-file-import-entry`（accept `.json`），`doImportEntry()` 接受兩種形制——`effects` wrapper 物件（取全部 entries、id 依 key）或 raw entry（單一 spec 物件，id 依檔名 `<id>.effects.json`／`<id>.json` 推、`entryIdFromFilename()` 以 `^[A-Za-z0-9_-]+$` 校驗）；整組替換該 id 的 entry（同 zip import 語義）、不動 layout，經 `putManifest`（`baseRev`）提交——新增特效由 server 正規化補插件模板並 append 到 `alternateEffects`，429/409/warnings 處理同 2c；v1 只讀、invalid JSON、無 id 皆顯示錯誤且不發 PUT。
3. **子集 zip**（CHECK 項 6）：`server/editor.py` 之 `GET /api/editor/export?ids=` 於 `ids` 非空時，zip 內 `effects.json` 改回 `{"version": 2, "effects": {<id>: <entry>}}`（只含所匯出 effects、**省略 `currentEffects`／`alternateEffects`**，`json.dumps(indent=2)`）；`ids` 空維持原樣（磁碟原始 bytes 或 fallback）。匯入端不需修改：zip import 合併邏輯對省略的 zone 鍵保留現有 layout，新 id 由 server 正規化 append 到 `alternate`（既有行為，round-trip 測試驗證）。client 端 `exportZip()` 補「選取＝全部特效」判定（`isFull`）：此时 URL 不帶 `ids`，回完整 manifest zip（含 layout），避免全選時拿到無 layout 的子集。
4. `window.__rtxEditor` version `'5b'`→`'5c'`，新增 5 個匯出（給 5d 交接）：`exportEffectEntry()`、`doImportEntry(inputEl)`、`downloadText(filename, text, mime)`（無 Blob/URL 環境回 `false` 並顯示提示）、`entryIdFromFilename(name)`（回 id 或 `null`）、`importExportLabel(isImport)`。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/editor.py` | 修改 | `export_effects()`：`ids` 非空→zip 內 `effects.json` 只含所匯出 effects（`{"version": 2, "effects": {…}}`、省略 layout zone 鍵）；`ids` 空→原樣（721 行） |
| `editor/app.js` | 修改 | `els` 加 `exportEntry`／`importEntry`／`fileImportEntry`；`setEditable()` 加 `dis(els.importEntry)`；新增 `importExportLabel()` 且 `syncCodeEditable()` 同步匯入/匯出按鈕標籤；新增 `downloadText()`／`exportEffectEntry()`／`entryIdFromFilename()`／`doImportEntry()` 與事件綁定；`exportZip()` 加 `isFull`（選取＝全部時不帶 `ids`）；version `'5c'`＋5 個新匯出（2302 行） |
| `editor/index.html` | 修改 | `[匯出 ▾]` 加 `#ed-export-entry`、`[＋新增特效 ▾]` 加 `#ed-import-entry`、hidden `#ed-file-import-entry`（168 行） |
| `tests/test_editor_api.py` | 修改 | 64→65 項：`test_export_selected_ids` 補子集 manifest 斷言（`effects.json` 只含 2 特效、無 zone 鍵）；新增 `test_export_subset_roundtrip`（匯出→縮 manifest 刪特效→reload→匯入還原、created 與 layout 保留斷言）（812 行） |
| `tests/e2e/helpers.js` | 修改 | 新增 `readZipEntries(buf)`：純 JS zip EOCD/central dir 掃描＋`inflateRawSync`，回 name→Buffer Map（174 行） |
| `tests/e2e/editor.spec.js` | 修改 | 24→28 項：新增 5c describe 4 項（console tab 標籤＋匯出下載＋匯入存檔、匯出單個 `<id>.effects.json` shape、匯入新增 `json-fx`＋既有特效更新保留分區、子集 zip round-trip 移除特效後匯入還原）；2d 匯出測試補全量/子集 `effects.json` 內容斷言（1208 行） |
| `tests/test_editor.mjs` | 修改 | 40→45 項：harness 加 `exportEntry`／`importEntry`／`fileImportEntry`；新增 5c 5 項（vm 無 Blob 提示＋未選定 err、effects wrapper 匯入 PUT 合併斷言、raw entry 檔名定 id、invalid JSON／無 id／v1 只讀不發 PUT、標籤隨 tab＋v1 匯入項 disabled）（1707 行） |
| `README.md` | 修改 | editor 功能 bullet×2（zip／console／單個 effect JSON 匯入匯出）、`/editor` 章節 zip bullet 改子集語義＋新增 console/單個 JSON bullet、API 表 export 行、測試說明段（344 行） |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | 「用編輯器（推薦）」：程式碼編輯 bullet 補標籤隨 tab、zip bullet 補子集語義、新增「單個 effect JSON 匯入匯出」bullet（221 行） |
| `docs/agents/TODO.md` | 修改 | 測試計數更新（E2E 47→56／editor.spec.js 19→28／test_editor.mjs 34→45／test_editor_api.py 64→65）；新增「子任務 5c」進度子項（105 行） |
| `docs/agents/CALL_GRAPH.md` | 修改 | EDP 節點加 5c 說明與 3 個新 DOM id；EZ 節點補子集語義；`EditorPage` class 加 5 個新方法；TED 64→65＋subset round-trip；TEX 40→45＋5c 描述；TP 51→56、editor.spec.js 24→28＋5c 描述＋`readZipEntries`；§7 editor/ 行加 5c（510 行） |

> 註：本報告檔案本身不列入上表。`editor/style.css` 無需修改（新節點沿用既有 `.dd-item`／按鈕樣式）。

## 測試與驗證

- 執行命令：`npm run test`（5c 為子任務 5 收尾，跑全套）
- 結果：全綠
  - `python -m pytest tests/ -q`：139 passed（含 editor 65 項；2 warnings 為既有 httpx/anyio deprecation，見 TODO 待辦）
  - `node --test`（5 支 mjs）：154 passed（含 `test_editor.mjs` 45 項）
  - `npx playwright test`（全部 10 支 spec）：56 passed（含 `editor.spec.js` 28 項）
- `git status`：E2E 跑完後工作樹乾淨（5c describe `beforeAll`/`afterEach` snapshot/restore fixture bytes＋刪 `createdFxDirs`＋`POST /api/effects/reload`，無污染殘留）

## 與規格的偏差

- console 匯入匯出採「既有按鈕動態標籤」方案（CHECK 項 5a 原案為獨立 [匯入 console]／[匯出 console] 按鈕）：複用 3a 的 `#ed-import-file`／`#ed-export-file` 與匯入/存檔流程，避免 code 區多一組重疊按鈕；功能範圍相同（console.js 可匯入本機檔/匯出下載、標籤明確標示目前對象）。
- `GET /api/editor/export?ids=` 的 `ids` 非空時，即使 ids 等於全部特效亦回子集 shape（server 語義固定為「非空＝子集」）；client `exportZip()` 已於全選時改走無 `ids` 路徑以回完整 manifest，兩端行為於測試中分別固定。

## Git Commit

- Commit：`a0b5794` — `feat(editor): console 與單個 effect JSON 匯入匯出，子集 zip 只含所匯出 effect`

## 給 5d 的交接

- **新公開函式**（`window.__rtxEditor`，version `'5c'`）：
  - `exportEffectEntry()` → 選定特效的 `<id>.effects.json` Blob 下載（未選定顯示「請先選擇特效」；無 Blob/URL 環境顯示提示）；
  - `doImportEntry(inputEl)` → 讀取 file input 的 `.effects.json`（effects wrapper 或 raw entry）→ 整組替換 entry → `putManifest` 提交；回傳 Promise；
  - `downloadText(filename, text, mime)` → Blob 下載工具（無 Blob/URL 回 `false`）；
  - `entryIdFromFilename(name)` → 自 `<id>.effects.json`／`<id>.json` 推 id（不合法回 `null`）；
  - `importExportLabel(isImport)` → code 區匯入/匯出按鈕依 tab 的標籤文字。
- **子集 effects.json shape**：`{"version": 2, "effects": {<id>: <entry>}}`（無 layout zone 鍵）；匯入端（zip import / `doImportEntry`）皆經 `PUT /api/editor/manifest` 合併，省略 zone 鍵時 server 保留現有 layout、新 id append 到 `alternateEffects`。
- **DOM**：`#ed-export-entry`（[匯出 ▾] 項）、`#ed-import-entry`（[＋新增特效 ▾] 項）、`#ed-file-import-entry`（hidden input）；code 區 `#ed-import-file`／`#ed-export-file` 標籤隨 tab 變動（勿在測試中以固定文字斷言）。
- **E2E 輔助**：`tests/e2e/helpers.js` 之 `readZipEntries(buf)` 可直接讀 zip 內容斷言。
