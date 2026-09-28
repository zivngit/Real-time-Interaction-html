# 工作完成報告

- **日期**：2026-09-20
- **任務**：effects 編輯器子任務 5a — 頂列下拉間隙、category 選項重複、[＋新增參數] 布局修正
- **Agent**：opencode（sub_agent_5 implementer）

## 摘要

修正使用者回報的 3 項 editor UI 問題（CHECK.md 項 1~3）：

1. **[匯出 ▾]／[＋新增特效 ▾] 下拉間隙**：原 `.dd-menu` 以 `top: calc(100% + 4px)` 定位，4px 空隙使 hover 中斷、選項無法點選。改為 `top: 100%`（選單緊貼按鈕、無視覺間隙），開啟機制由 `.dd:hover` 改為 click 開啟＋點擊外部關閉（另支援 Esc 關閉、兩 dropdown 互斥）：`editor/app.js` 新增 `initDropdowns()`／`closeAllDropdowns()`，以 `.dd.open` class 驅動 `.dd-menu` 顯示（`editor/style.css` 同步）。
2. **[Change category…] 選項重複**：`syncBatchUI()` 重建選項時只移除 index 1 之後的選項，保留 HTML 靜態 placeholder 再 append 新 placeholder，造成「Change category…」重複 2 次。改為全清空後重填（`while (options.length > 0) remove(0)`），manifest category 以 object 去重＋`sort()` 穩定排序；`#ed-batch-cat` 加上既有 `batch-cat` class 套用深色主題樣式（`#0b1117` 背景、`--line` 邊框、focus accent）。
3. **[＋新增參數] 重疊**：由 `.editor-body` 底部的 `.toolbar` 列移至 [Params schema] 標題行——新結構 `#ed-params-head`（`.section-title` flex 行）：標題 `#ed-params-title`（icon＋文字）在左、`.grow`、hint「拖曳列排序」與 `#ed-add-param` 按鈕在右（等同 space-between）；`.toolbar` DOM 與 CSS 規則移除。

E2E：`tests/e2e/editor.spec.js` 新增 5a 3 項（dropdown 點按開啟＋選單緊貼無空隙 boundingBox＋互斥＋外部點擊關閉；`#ed-batch-cat` 選項唯一（`['','burst','ripple','text']`）＋深色樣式 computed style 斷言；[＋新增參數] 與 [Params schema] 標題同行不重疊 boundingBox 斷言），既有 2d 兩處 `.hover()` 開啟改 `.click()`。editor.spec.js 19→22 項全綠；`tests/test_editor.mjs` node vm 34 項回歸全綠（vm fake DOM 無 `document.addEventListener`，新函式已 guard）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/index.html` | 修改 | `#ed-batch-cat` 加 `batch-cat` class；Params schema 標題改為 `#ed-params-head` 行（`#ed-params-title` 左、hint＋`#ed-add-param` 右），移除 `.toolbar`（165 行） |
| `editor/app.js` | 修改 | `syncBatchUI()` 選項全清空重建（去重＋穩定排序）；新增 `initDropdowns()`／`closeAllDropdowns()`（click 開啟、外部點擊／Esc 關閉、互斥、`document.addEventListener` guard）並於 init 呼叫、`window.__rtxEditor` 匯出（2124 行） |
| `editor/style.css` | 修改 | `.dd-menu` `top: 100%`（無 4px 間隙）、`.dd:hover`→`.dd.open`；移除 `.toolbar` 規則（727 行） |
| `tests/e2e/editor.spec.js` | 修改 | 新增 5a describe 3 項；2d 兩處 dropdown hover 開啟改 click（915 行） |
| `docs/agents/TODO.md` | 修改 | effects 編輯器項下新增子任務 5a 完成子項（103 行） |
| `docs/agents/CALL_GRAPH.md` | 修改 | EDP 節點描述與 id 清單（`#ed-params-head`／`#ed-params-title`／`.dd.open .dd-menu`）、TP 節點 editor.spec.js 19→22 項＋5a 內容、第 7 節 editor 現況（503 行） |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`npx playwright test tests/e2e/editor.spec.js`
- 結果：22 項全部通過（含既有 19 項＋新增 5a 3 項），57.8s；E2E 結束後 `git status` 乾淨（本任務無 server 寫入，fixture 經 afterEach 還原）
- 執行命令：`node --test tests/test_editor.mjs`
- 結果：34 項全部通過（新 dropdown 函式於 vm fake DOM 下 guard 不破壞既有測試）

## Git Commit

- Commit：`507175d` — `fix(editor): 頂列下拉間隙、category 選項重複與新增參數按鈕布局修正`

## 後續待辦

- 子任務 5b（CHECK 項 4、7）：effects.json tab 單項 JSON 顯示、預覽 canvas 選定座標；沿用本任務 dropdown 機制（click 開啟、`.dd.open`、選項容器 class `.dd-menu`／`.dd-item`）與 Params schema 標題行結構（`#ed-params-head` > `#ed-params-title` + `.grow` + 右側控件）
- 子任務 5c（CHECK 項 5a、5b、6、T2、T3）：console.js 專屬匯入匯出、單個 effect effects.json 匯入匯出、子集匯出 zip 行為
