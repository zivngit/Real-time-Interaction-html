# 工作完成報告

- **日期**：2026-09-22
- **任務**：effects 編輯器 6j——程式碼編輯框未[暫存]變更處理（編輯即 dirty、切換特效／[重載]前 confirm、[重載]後刷新編輯框）
- **Agent**：opencode

## 摘要

用戶回報 2 點：(1) 編輯 `viewer.js`／`console.js` 編輯框**不會即時反映三態狀態**（要等 [暫存]）；[重載]不更新編輯框。(2) **未 [暫存] 前的變更在[重載]與特效切換時被靜默捨棄**。

根因：程式碼編輯框是「草稿」，只有 [暫存]（`saveFile`）才 promotion 到 `state.pendingCode`＋dirty；`#ed-code` 的 `input` handler 原本只 `renderLineNumbers`（無 `setDirty`）；`selectItem` 切換特效直接 `loadCodeFile()` 覆寫編輯框（無 confirm）；`reloadManifest`→`loadManifest` 不刷新編輯框、且未暫存變更不算 dirty（無 confirm）。

用戶選「**B：兩者皆警告確認**」。實作：
- `state.codeLoaded`（載入基準 `{id, filename, content}`）＋`showCode()` 記錄。
- `hasUnstagedCode()`：編輯框（viewer/console tab）內容異於基準且未 staged。
- `#ed-code` `input`→`hasUnstagedCode()` 時 `setDirty(true)`（三態指標立即「未保存變更」；順帶 `beforeunload` 關頁、SSE 自動重載亦不會蓋掉編輯中內容）。
- list 點擊切換特效：`id !== selected && hasUnstagedCode()`→`confirm('有未暫存的程式碼變更，切換將捨棄。確定切換？')`（取消→不切換）。
- `reloadManifest`：`loadManifest()` 後若 viewer/console tab→`loadCodeFile()` 刷新編輯框（顯示 server 最新／或 staged）；未暫存變更因 setDirty 已被既有 reload confirm 覆蓋。
- version `6i`→`6j`。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | 加 `state.codeLoaded`＋`showCode()` 記錄基準；新增 `hasUnstagedCode()`（含 staged 判斷避免 [暫存] 後誤報）；`#ed-code` input→dirty；list 點擊切換特效加 confirm 守衛；`reloadManifest` 後刷新編輯框；version `6i`→`6j` |
| `tests/test_editor.mjs` | 修改 | 86→87 項：fake `window` 加預設 `confirm/prompt/alert`（confirm 自動接受，避免切換 guard 拋錯、維持既有測試行為）；新增「B：程式碼未[暫存]變更」測試（編輯即 dirty、切換 confirm 取消→不切換／確認→切換捨棄） |
| `tests/e2e/editor.spec.js` | 修改 | 44→45 項：3a describe 內新增「B：...編輯即 dirty、切換特效 confirm（取消→不切換）、[重載] confirm＋刷新編輯框」（dialog handler 依 `acceptNext` accept/dismiss） |
| `README.md` | 修改 | 程式碼 bullet 補「未[暫存]變更處理（編輯即 dirty、切換/重載 confirm、重載後刷新編輯框）」；node 195→196、test_editor 86→87、E2E 72→73、editor.spec.js 44→45 |
| `docs/agents/TODO.md` | 修改 | 子任務 5a–6i→5a–6j（34→35 項）、加 6j 條目 |
| `docs/agents/CALL_GRAPH.md` | 修改 | editor.spec.js 節點補 6j 行為＋E2E 72→73、editor.spec.js 44→45；editor 頁 summary 補「未[暫存]變更確認」 |

> 註：本報告檔案本身不列入上表。`docs/temp/effects-editor/EDITOR_REVIEW.md`（gitignored）補 6j 已修正，不 commit。

## 測試與驗證

- 執行命令：`node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`、`npx playwright test`、`python -m pytest tests/ -q`
- 結果：全綠——node **196** passed（test_editor 86→87）、Playwright E2E **73** passed（editor.spec.js 44→45）、pytest **156** passed。
- 關鍵驗證：(1) 編輯 `#ed-code`→三態指示器**立即**「未保存變更」（未 [暫存]）；(2) 帶未暫存變更點另一特效→彈 confirm「有未暫存的程式碼變更，切換將捨棄。確定切換？」（取消→selection 不變、編輯框未變；確認→切換＋載入新特效 code）；(3) [重載]→既有 dirty confirm→接受→編輯框**刷新為 server 內容**（未 [保存至伺服器]→原內容）。
- 附註：驗證期間遇 `effects/effect-1` **空目錄**殘留（E2E 新增特效測試的 6i 殘留、非本次改動造成）使 node `test_effect_catalog`（catalog 一致性）一度失敗；移除該空目錄後 node/E2E/pytest 皆綠。此為 E2E 與 node catalog 測試共用 `effects/` 的既有耦合（見後續待辦）。

## Git Commit

- Commit：`21ab695` — `feat(editor): 程式碼未[暫存]變更——編輯即 dirty、切換特效/[重載]前 confirm、[重載]後刷新編輯框`

## 後續待辦

- E2E 新增特效測試偶爾在 `effects/` 殘留**空目錄**（如 `effect-1`），使隨後跑的 node `test_effect_catalog`（catalog 一致性）失敗；建議讓 E2E 的 `createdFxDirs` 清理涵蓋空目錄、或讓 catalog 測試忽略空殘留目錄（本次未改、屬既有 test 衛生問題）。
- 剩餘 EDITOR_REVIEW 高價值項：U6（staged 持久化）／U3（搜尋）／U1（主題）／U13（SSE 斷流時 icon 誤報未連線）／U14（復原待刪重複 id 靜默 no-op）。
