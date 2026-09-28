**日期**: 2026-09-28
**任務**: 未暫存變更 切換特效／[新增特效]／匯入先 confirm（7n）
**Agent**: opencode

## 摘要

7m 把 `#ed-dirty` 的「未暫存變更」擴充到 manifest 欄位編輯後，仍有動作會**靜默丟棄**這些未 [暫存] 變更（切換特效原本只 confirm 程式碼未暫存，不涵蓋欄位；[新增特效]、匯入則完全沒 confirm）。本任務為 4 處會丟棄未暫存變更的動作加 `confirm`：

1. **切換特效**（fx-item click）——原 code-only confirm 改用新 helper，同時涵蓋欄位；
2. **`[新增特效]`**（`newEffect`）；
3. **zip 匯入**（`importZip`）；
4. **單項匯入**（`doImportEntry`）。

`editor/app.js` 新增 `unstagedDiscardMsg(action)`：無未暫存變更回 `null`（照舊執行）；否則依組合回訊息——code only `有未暫存的程式碼變更，<action>將捨棄。確定繼續？`、fields only `有未暫存的 manifest 欄位變更，<action>將捨棄。確定繼續？`、both `有未暫存的程式碼和 manifest 欄位變更，<action>將捨棄。確定繼續？`。取消→中止操作（不切換／不建立／不匯入、變更保留）；確認→執行原動作（未暫存變更隨重繪／staged 重建丟棄）。

切換特效的 code-only 訊息統一為新格式 `有未暫存的程式碼變更，切換特效將捨棄。確定繼續？`（不保留舊字串「切換將捨棄。確定切換？」），既有 E2E 測試 B 斷言同步更新。

另修 stale chip：`newEffect` 中 `renderMeta`／`renderParams` 重繪會清 `unstagedFields`，原流程未再調 `setDirtyUI()` 致 chip 仍顯示「未暫存變更」——於 `clearMiniConsole()` 後補 `setDirtyUI()`（欄位旗標已清＋`state.dirty` 已設→「未保存變更」）。

不改：`reloadManifest` confirm、`[保存至伺服器]` confirm（7d）、`removeEffect`、`doImportFile`、`applyIdRekey`、manifest tab [存檔]。純 editor 前端改動，version 7m→7n。

## 文件異動

| 路徑 | 異動 |
|------|------|
| `editor/app.js` | 新增 `unstagedDiscardMsg(action)` helper（code only／fields only／both 三訊息、無則回 `null`）；fx-item click 切換特效 confirm 改用 helper（action=`切換特效`）；`newEffect`／`importZip`／`doImportEntry` 加 confirm（取消→中止）；`newEffect` 於 `renderMeta`／`renderParams`／`clearMiniConsole` 後補 `setDirtyUI()` 重算四態指示；version 7m→7n |
| `tests/test_editor.mjs` | 新增 4 項（欄位未暫存→切換特效 confirm（取消→不切換變更保留／確認→切換變更丟棄）、[新增特效] confirm（取消→不建立／確認→建立）、zip 匯入 confirm（確認→匯入＋選取切到匯入 effect）、程式碼＋欄位皆未暫存→確認訊息提及兩者）；124→128 項 |
| `tests/e2e/editor.spec.js` | 新增 7n describe block 3 項（欄位未暫存→切換特效／[新增特效]／zip 匯入 confirm，各斷言取消→不變更／確認→執行＋變更丟棄）；既有測試 B 斷言改新統一訊息「有未暫存的程式碼變更，切換特效將捨棄。確定繼續？」；56→59 項 |
| `docs/agents/TODO.md` | 新增 7n 項；測試計數更新（E2E 87、editor.spec.js 59、test_editor.mjs 128） |
| `docs/agents/CALL_GRAPH.md` | TEX/TP 測試節點加 7n 描述；計數更新（128、87、59） |

## 測試與驗證

- [x] `node --test tests/test_editor.mjs` — 128/128 pass（含 4 項新 7n 測試）
- [x] `npx playwright test tests/e2e/editor.spec.js` — 59/59 pass（含 3 項新 7n 測試）
- [x] `npx playwright test`（全量 E2E）— 87 passed（3.5m）
- [x] `python -m pytest tests -q` — 159 passed

## Git commit

- `bf75f8d` feat(editor): 未暫存變更 切換特效／[新增特效]／匯入先 confirm（7n）
