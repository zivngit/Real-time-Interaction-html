# 工作完成報告

- **日期**：2026-09-17
- **任務**：effects 編輯器子任務 3a — 程式碼編輯（viewer.js / console.js）
- **Agent**：opencode

## 摘要

依 `docs/temp/effects-editor/sub_agents/sub_agent_3/task_3a/PLAN.md` 完成 editor 頁面 Phase 3a：`editor/app.js` 由 2d 的拖曳/批次/zip 擴充為程式碼編輯——`#ed-code` 由 pre 改為 textarea 並新增 `#ed-code-gutter` 行號（`renderLineNumbers()`）、`selectTab('viewer'|'console')` 改調 `loadCodeFile()` 抓 `GET /api/editor/effect/{id}/viewer.js|console.js`（未選特效／網路失敗／!ok 顯示 `load failed` 訊息）；`saveFile()` 以 `PUT` 同上 path、body `{"content"}`——2xx 同步 `state.rev`／`state.baseRev` 自 `r.data.rev`、更新 `#ed-chip-rev`（rev 前 10 字＋（base））、**不設 `state.dirty`**（dirty 屬 manifest 層，2c 定義）、有 `warnings` 陣列時於 `#ed-warnings` 黃字顯示 `warnings: …`（不阻擋存檔）否則顯示 `save succeeded`；409 重抓最新檔並顯示衝突訊息、429/401/網路/其他狀態各顯示訊息；`importFile()`／`doImportFile()`（hidden `#ed-file-import-file` 選本機 .js→讀文字→`showCode`→自動 `saveFile`）、`exportFile()`（fetch 目前檔→Blob 下載、檔名 viewer.js/console.js）、`previewReload()`（3a 階段顯示 `preview coming in 3b` 的 noop 占位、3b 接線）、`syncCodeEditable()`（v1 或未選特效時 textarea readOnly＋code 按鈕 disabled）。`editor/index.html` 新增代碼區（`#ed-code-gutter`＋`#ed-code` textarea＋`#ed-import-file`／`#ed-export-file`／`#ed-preview-reload`／`#ed-save-file` 靜態標籤按鈕＋hidden `#ed-file-import-file`）；`editor/style.css` 新增 gutter／textarea／代碼工具列樣式。`window.__rtxEditor` version `'2d'`→`'3a'`，公開方法新增 `codeFilePath`／`showCode`／`renderLineNumbers`／`loadCodeFile`／`saveFile`／`importFile`／`doImportFile`／`exportFile`／`previewReload`／`syncCodeEditable`。

3b 交接：目前選定特效為 `window.__rtxEditor.state.selected`、目前 tab 為 `window.__rtxEditor.activeTab()`（`manifest`／`viewer`／`console`）、目前 code source 為 `#ed-code` textarea 的 `.value`、檔案 path 用 `codeFilePath()` 取得；warnings 顯示函式 `setWarnings(text, kind)`（`kind`：`ok`／`err`／未指定＝info、渲染於 `#ed-warnings`）；file save 函式 `saveFile()`（async、`PUT {"content"}`、2xx 同步 `state.rev`／`state.baseRev`）；`previewReload()` 為 3a 的 noop 占位，3b 替換其內容即可掛「存檔成功自動重預覽」與手動重預覽。

測試：`tests/test_editor.mjs` 由 18 項擴充至 27 項（loadCodeFile 成功／未選項／!ok、saveFile 2xx 同步 rev 不設 dirty＋warnings、saveFile 409 重抓、429/401/其他狀態、importFile→doImportFile 自動存檔、exportFile Blob、v1 readOnly、previewReload noop 訊息、selectTab viewer/console 觸發 loadCodeFile、renderLineNumbers）；`tests/e2e/editor.spec.js` 新增 Phase 3a 3 項（v2 viewer.js 載入→編輯→存檔→檔案同步＋rev chip＋save succeeded、v2 console.js 載入＋匯出下載內容一致、v1 code 控件 disabled＋textarea readOnly），`editor.spec.js` 共 16 項，`beforeAll`／`afterEach` snapshot/restore 防止 fixture 污染。同步 `TODO.md`（Phase 3a 子項）與 `CALL_GRAPH.md`（EDP 節點、editor 檔案 API 邊、`EditorPage` class、測試節點計數與 `editor/` 現況）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `#ed-code` 改 textarea＋`#ed-code-gutter` 行號；新增 `loadCodeFile()`／`saveFile()`／`importFile()`／`doImportFile()`／`exportFile()`／`previewReload()`／`syncCodeEditable()`；`selectTab` 於 viewer/console 觸發代碼抓取；存檔 2xx 同步 rev/baseRev 不設 dirty＋warnings 顯示；`window.__rtxEditor` version `'3a'` 與 10 個新公開方法 |
| `editor/index.html` | 修改 | 代碼區：`#ed-code-gutter`、`#ed-code` textarea、`#ed-import-file`／`#ed-export-file`／`#ed-preview-reload`／`#ed-save-file` 按鈕、hidden `#ed-file-import-file` |
| `editor/style.css` | 修改 | 行號 gutter、code textarea 與代碼工具列樣式 |
| `tests/test_editor.mjs` | 修改 | 18→27 項：code 載入／存檔（2xx/409/429/401）、匯入／匯出、preview noop、v1 readOnly、tab 觸發、行號等 3a vm 測試 |
| `tests/e2e/editor.spec.js` | 修改 | 新增 Phase 3a 3 項（viewer.js 存檔檔案同步＋rev chip、console.js 載入＋匯出內容一致、v1 控件 disabled＋readOnly）與 fixture snapshot/restore；editor spec 共 16 項 |
| `docs/agents/TODO.md` | 修改 | 主項「實作 effects 編輯器」下新增 Phase 3a 完成子項 |
| `docs/agents/CALL_GRAPH.md` | 修改 | §1 EDP 節點改 Phase 3a 並補 3a DOM id／檔案 API 邊；§5 `EditorPage` class 補 3a 方法與檔案 API 依賴；§6 `TEX` 18→27、`TP` 41→44 並補 3a 說明；§7 `editor/` 現況更新 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：
  - `node --test tests/test_editor.mjs`
  - `npx playwright test "tests/e2e/editor.spec.js"`
  - `npm run test:unit`
  - `npx playwright test`
- 結果：全綠——`pytest` 138 passed；node `--test` 5 檔共 136 passed；`tests/test_editor.mjs` 27/27；`tests/e2e/editor.spec.js` 16/16（2a 2＋2b 3＋2c 3＋2d 5＋3a 3）；Playwright 全套 E2E 44 passed；E2E 後 `git status --short` 乾淨（僅預期修改檔）。

## Git Commit

- Commit：`277df1df034f2f9666a76359788995d1c2e6b194` — `feat(editor): 程式碼編輯（viewer.js/console.js 存檔、warnings、匯入匯出）`

## 後續待辦

- Phase 3b：右側即時預覽＋发送到 viewer（sub_agent_3；掛鉤點見本報告 3b 交接說明）
- 重評 effects-tag 設計（effects 編輯器落地後）
