# 工作完成報告

- **日期**：2026-09-23
- **任務**：處理 `docs/temp/effects-editor/EDITOR_REVIEW.md` 之 U14 與 S2
- **Agent**：opencode

## 摘要

處理編輯器審查文件之兩項未決項：

**U14（復原待刪除特效遇重複 id 靜默 no-op）**：原 `undoPendingDelete`（`editor/app.js`）當 `state.manifest.effects[pd.id]` 已存在時**靜默 `return`**——不還原、無訊息、pending 項殘留「待刪除/已刪除」區。情境可達：移除 `foo`（staged、`manifest.effects["foo"]` 被刪）→ 新增特效經 effect_id 欄位 re-key 回 `foo`（`validateId` 只查 `manifest.effects`，pending 的 `foo` 不在其中→成功）→ [↺] 還原 pending `foo` 撞 id。**修正（6x）**：該分支改顯示 `setWarnings('復原失敗：effect_id「」已存在，待刪除項保留', 'err')`（經 6w 併入預覽面板結果區）——待刪項**保留**、**不覆蓋**已佔用該 id 的新特效（安全：可先解衝突再還原），與其他錯誤訊息呈現一致。

**S2（PUT 檔案內容無大小上限）**：原 `_put_file`（PUT 單檔 `viewer.js`/`console.js`/`/file`）與 `_write_staged_file`（manifest `files` 的 staged 檔案）對 `content` 無上限（僅 import 有 10MB 上限）。**修正（6x）**：`server/editor.py` 新增 `FILE_CONTENT_MAX_BYTES = 1024 * 1024`（1MB），兩寫入路徑於 `content`（UTF-8 字節）超限時回 **413** `file content too large`（fail-fast、不落盤）。最大正式特效插件僅約 6.6KB，1MB 餘裕充足。

version `'6w'`→`'6x'`。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `undoPendingDelete` 於 `manifest.effects[pd.id]` 已存在時改顯示 `setWarnings('復原失敗：effect_id「」已存在，待刪除項保留','err')`（不再靜默 return）；version `'6w'`→`'6x'` |
| `server/editor.py` | 修改 | 新增 `FILE_CONTENT_MAX_BYTES = 1024 * 1024`；`_put_file` 與 `_write_staged_file` 於 `content`（UTF-8 字節）超限回 413 `file content too large` |
| `tests/test_editor.mjs` | 修改 | 新增「5d U14 復原待刪除遇重複 id：顯示錯誤＋待刪項保留（不覆蓋新特效）」（以 [✕] 移除 fx-b→`newEffect`＋re-key 回 fx-b 自然重現衝突）；test_editor 98→99 |
| `tests/test_editor_api.py` | 修改 | 新增 `test_put_file_too_large_413`（PUT 單檔＋`/file`）與 `test_put_manifest_staged_file_too_large_413`（manifest staged 檔案）；test_editor_api 83→85 |
| `README.md` | 修改 | 特效編輯器「儲存」項補「PUT 單檔／staged 檔案內容超 1MB 回 `413`」 |
| `docs/agents/CALL_GRAPH.md` | 修改 | ED 節點補「PUT 內容 1MB 上限→413 S2」；TED（test_editor_api）83→85＋413 說明；TEX（test_editor）98→99＋「U14 復原待刪重複 id 顯示錯誤＋待刪項保留（6x）」 |
| `docs/agents/TODO.md` | 修改 | 新增完成項「復原待刪衝突訊息＋PUT 檔案內容上限（U14/S2/6x）」 |

> 註：`docs/temp/effects-editor/EDITOR_REVIEW.md`（gitignored）現行版本 6w→6x、U14／S2 標記 ✅ 已修正（6x），不 commit。`docs/agents/TODO.md` 另有一條「前端網頁記憶體管理」待辦為先前指示暫不 commit，本次未納入本 commit（仍以工作樹未提交狀態保留）。

## 測試與驗證

- 執行命令：
  - `node --test tests\test_effects.mjs tests\test_console.mjs tests\test_effect_examples.mjs tests\test_effect_catalog.mjs tests\test_editor.mjs`
  - `python -m pytest tests/ -q`
  - `npx playwright test`
- 結果：全綠——node **208** passed（`test_editor` 99）；pytest **159** passed（`test_editor_api` 85）；Playwright E2E **75** passed（`editor.spec.js` 47）。node＋pytest 併行、E2E 獨立依序執行（不與 pytest 併行）。

## Git Commit

- Commit：`c70c9ee` — `fix: 復原待刪衝突顯示錯誤訊息（U14）＋PUT 檔案內容 1MB 上限 413（S2，6x）`
