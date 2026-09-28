# 工作完成報告

- **日期**：2026-09-25
- **任務**：effects 編輯器批次列改回常駐顯示——未選取特效時計數顯示「已選 0 項」（7b，修正 7a）
- **Agent**：opencode

## 摘要

7a 把「未選取特效時隱藏整條批次列」，依使用者回饋改回**批次列常駐顯示**——未選取任何特效時 `#ed-batch-count` 顯示「**已選 0 項**」（而非空白）。

修正（7b，純 editor 前端）：

- `editor/app.js`：`syncBatchUI` 之 `#ed-batch-count` 恆顯示「已選 N 項」（含 N＝0）；移除 7a 加的 `syncBatchUI` display 切換（`els.batchBar.style.display`）與 `els.batchBar` 讀取。`editor/index.html` 之 `id="ed-batch-bar"` 保留（E2E 定位用）。批次按鈕未選取時停用之行為不變。
- `window.__rtxEditor` version `'7a'`→`'7b'`。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `syncBatchUI` 計數恆顯示「已選 N 項」（含 0）；移除 `els.batchBar` 與 display 切換；version `'7a'`→`'7b'` |
| `tests/test_editor.mjs` | 修改 | fake DOM 移除 `batchBar`；「5d 批次列」測試改斷言未選取＝「已選 0 項」、選 2 項＝「已選 2 項」、取消＝「已選 0 項」（102 項不變） |
| `tests/e2e/editor.spec.js` | 修改 | 批次測試改斷言初始 `#ed-batch-bar` 可見＋`#ed-batch-count`「已選 0 項」、選 2 項後「已選 2 項」（47 項不變） |
| `docs/agents/CALL_GRAPH.md` | 修改 | TEX 節點改「批次列計數常顯示（含已選 0 項、7b）」；TP 節點改「批次測試補初始『已選 0 項』計數斷言（7b）」 |
| `docs/agents/TODO.md` | 修改 | 完成項改「批次列計數常顯示＋操作結果訊息中文化（7b）」（註 7a 曾隱藏、依使用者改回） |

## 測試與驗證

- 執行命令：
  - `npm run test:unit`
  - `npx playwright test`
- 結果：全綠——node **211** passed（`test_editor` 102）；pytest **159** passed；Playwright E2E **75** passed（`editor.spec.js` 47，含更新後的「已選 0 項」斷言）。

## Git Commit

- Commit：`e100d8d` — `fix(editor): 批次列常駐顯示、未選取顯示「已選 0 項」計數（7b）`
