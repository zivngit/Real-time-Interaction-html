# 工作完成報告

- **日期**：2026-09-25
- **任務**：effects 編輯器 #ed-dirty 四態指標（加「未暫存變更」）＋[保存至伺服器] 一律 confirm 警告未暫存變更（7d）
- **Agent**：opencode

## 摘要

使用者要求 `#ed-dirty` 狀態指標加入第四態「未暫存變更」（code 編輯框有變更但尚未按 [暫存]），且 `[保存至伺服器]`（`save()`）一律彈 confirm 對話框；若尚有未暫存變更，需警告這些變更不會保存到伺服器（請先按 [暫存]）。

實作（7d，純 editor 前端）：

- `editor/app.js`：
  - `setDirtyUI()` 改四態、優先序 `saving > unstaged > dirty > clean`；文字：`已同步`／`未保存變更`／`未暫存變更`／`保存中…`。code 編輯框 `input` 與 Tab `keydown` 無條件呼叫 `setDirtyUI()`；`showCode()` 更新基準後亦呼叫。
  - `save()` 於 effect_id 驗證後一律 confirm：有未暫存變更→「有未暫存的程式碼變更：未暫存變更不會保存到伺服器（請先按 [暫存]）。仍要保存至伺服器？」；否則→「要將目前變更保存至伺服器？」；取消→不發 PUT。
  - 保存成功且 active tab 為 `viewer`／`console` 時 `await loadCodeFile()` 重抓檔案更新基準（指標回「已同步」；該檔案 GET 不受 rate-limit）。
  - `window.__rtxEditor` version `'7c'`→`'7d'`。
- `editor/style.css`：新增 `.sync[data-state="unstaged"]` 與 `::before`（`var(--err)`／`#ff6b6b` 紅點）。
- 測試：`tests/test_editor.mjs` 新增 3 項 7d 測試（四態循環、confirm 取消不 PUT／確認 PUT 且編輯框回 server 基準、無未暫存→一般確認無警告）；`tests/e2e/editor.spec.js` 既有保存流程測試補 confirm 自動接受、B 測試斷言改「未暫存變更」、新增 7d E2E 測試。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `setDirtyUI()` 四態（saving>unstaged>dirty>clean）；`save()` 一律 confirm（未暫存警告／取消不 PUT）；保存成功 viewer/console tab `loadCodeFile()` 重抓基準；version `'7c'`→`'7d'` |
| `editor/style.css` | 修改 | 新增 `.sync[data-state="unstaged"]` 與 `::before` 紅點樣式 |
| `tests/test_editor.mjs` | 修改 | 新增 3 項 7d 測試（102→105） |
| `tests/e2e/editor.spec.js` | 修改 | 既有保存測試加 `page.on('dialog')` 自動接受 confirm；B 測試斷言改「未暫存變更」；新增 7d confirm E2E 測試（47→48） |
| `docs/agents/CALL_GRAPH.md` | 修改 | EditorPage 類別節點補 `+setDirtyUI()`／`+hasUnstagedCode()`；TEX 節點 102→105＋7d 說明；TP 節點 47→48、Playwright 75→76、三態→四態＋7d 說明 |
| `docs/agents/TODO.md` | 修改 | 新增 7d 完成項 |

## 測試與驗證

- 執行命令：
  - `npm run test:unit`
  - `npx playwright test`
- 結果：全綠——node **214** passed（`test_editor` 105，含 3 項新 7d 測試）；pytest **159** passed；Playwright E2E **76** passed（`editor.spec.js` 48，含 7d confirm 測試——取消不 PUT、確認 PUT 且編輯框回到 server 基準）。

## Git Commit

- Commit：`84fb29e` — `feat(editor): #ed-dirty 四態指標（加「未暫存變更」）＋[保存至伺服器] 一律 confirm 警告未暫存變更（7d）`
