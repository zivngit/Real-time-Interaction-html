# 工作完成報告

- **日期**：2026-09-22
- **任務**：effects 編輯器 4 項改進——(1) effects.json 預覽以 effect_id 為鍵顯示；(2) 處理 U10：新增特效去彈出視窗（預設名稱＋流水號、增加 effect_id 欄位、[存檔]後合理性檢查）；(3) 更新 manifest 編輯邏輯（確認 [匯入 effects.json]、[存檔]後依上方欄位更新預覽）；(4) 程式碼預覽下方 5 按鈕分組
- **Agent**：opencode

## 摘要

用戶下達 4 項功能（依 `docs/temp/effects-editor/EDITOR_REVIEW.md`），實作於 version 6g→6h：

1. **effects.json 預覽顯示 effect_id（Task1）**：`renderManifestView` 由顯示選定特效的 spec 物件，改為以 **effect_id 為鍵**顯示 `{ [id]: spec }`（`JSON.stringify({[id]:spec}, null, 2)`）。

2. **U10 新增特效去彈窗（Task2）**：`newEffect` 移除兩段 `window.prompt`，改預設 `effect-<N>`／`新特效 <N>`（`nextEffectSerial` 掃 `^effect-(\d+)$` max+1 流水號、`while(m.effects[id])` 防碰撞）。新增 `#ed-meta-id` 欄位＋`state.unsavedNew` 追蹤未存檔新特效，`syncMetaIdEditable` 使**僅新增可改、既有特效只讀**（使用者決策：改名會使 server `put_manifest` 對新 id 走 `_ensure_new_effect_files` 以模板重建 viewer/console→舊碼遺失＋舊目錄 orphan，故僅新增可改）。[存檔]／[保存] 經 `validateId`（`EFFECT_ID_RE`＋重複＋既有不可改名）合理性檢查＋`applyIdRekey` re-key（含 `currentEffects`/`alternateEffects` 分區鍵同步）。

3. **manifest 編輯邏輯（Task3）**：`saveFile` 改 async，manifest tab 分支→`applyManifestFields`（label/icon/enabled/params 套入 `state.manifest`）＋`renderManifestView`（[存檔]後 effects.json 預覽依上方欄位即時更新）；`buildManifest` 加 id re-key 兜底；[匯入 effects.json]（`doImportEntry`）確認正確（單一 entry re-key 到 selected、多 effect wrapper 維持 bulk）。

4. **5 按鈕分組（Task4）**：程式碼預覽下方 5 按鈕重組為 2 個 `.act-group`（[匯入/匯出]＋[檢查此檔/檢查 3 檔]）＋[存檔] primary 置右（`.act-group + .act-group` 加 border-left 分隔線）；`檢查格式`→`檢查此檔`（warnings 標題 `displayCheck` 仍「檢查格式」不變）。

測試基建：`tests/e2e/helpers.js` 之 `restoreFixture`/`writeFixture` 加 `writeFileSyncRetry`（Windows 檔案鎖定 `UNKNOWN`/EBUSY/EPERM 重試、`Atomics.wait` 同步 sleep），消除 fixture 寫入競態導致的 cascade 假失敗。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | 新增 `EFFECT_ID_RE`、`state.unsavedNew`、`els.metaId`、`syncMetaIdEditable()`/`validateId()`/`applyIdRekey()`/`applyManifestFields()`/`nextEffectSerial()`；`newEffect` 去 prompt（`effect-<N>` 預設＋unsavedNew）、`renderManifestView` 顯示 `{[id]:spec}`、`saveFile` 改 async（manifest tab 分支＋id re-key）、`buildManifest` id re-key 兜底、`removeEffect`/`loadManifest` 清 unsavedNew、`renderMeta`/`setEditable` 接 `syncMetaIdEditable`；version 6g→6h；exports 加 5 新方法 |
| `editor/index.html` | 修改 | `#ed-meta-form` 加 `#ed-meta-id`（置 label 前）；程式碼預覽下方 5 按鈕重組為 2 個 `.act-group`＋[存檔] primary 置右、`檢查格式`→`檢查此檔` |
| `editor/style.css` | 修改 | `.actions .act-group`＋`.actions .act-group + .act-group`（border-left 分隔線） |
| `tests/test_editor.mjs` | 修改 | fake DOM 加 `metaId`；4 個 newEffect test 去 prompt（`effect-1`/`新特效 1`）；新增 3 test（id re-key 含分區鍵／id 驗證＋既有唯讀／預覽顯示 `{[id]:spec}`）；移除 version 斷言（依用戶「取消編輯器版本檢查」）；82→85 |
| `tests/e2e/editor.spec.js` | 修改 | 2 個 newEffect test 去 prompt（`sawPrompt` 斷言）＋`#ed-meta-id` fill＋`#ed-save-file` re-key；check 標籤 `檢查此檔`；5b 加 `"particle"`/`"ripple"` id 鍵斷言；新增 U10 describe（2 test：id 欄位＋5 按鈕分組）＋fixture snapshot/restore afterEach；42→44 |
| `tests/e2e/helpers.js` | 修改 | 新增 `writeFileSyncRetry`（Windows 檔案鎖定重試）用於 `restoreFixture`/`writeFixture` |
| `README.md` | 修改 | 測試數量 node 191→194（test_editor 82→85）、E2E 70→72（editor.spec 42→44）；effect_id 功能＋[檢查此檔] 說明 |
| `docs/agents/TODO.md` | 修改 | 子任務 5a–6f→5a–6h（32→33 項）＋6h 說明；測試計數 E2E 72／editor.spec 44／test_editor 85 |
| `docs/agents/CALL_GRAPH.md` | 修改 | `EditorPage` class 加 `unsavedNew` state＋5 新方法；EDP 節點（effect_id＋effects.json 以 id 為鍵＋5 按鈕）、TEX（82→85＋re-key 描述）、TP（70→72、42→44＋U10）、§7 現況補 effect_id |

> 註：本報告檔案本身不列入上表。`docs/temp/effects-editor/EDITOR_REVIEW.md` 已將 **U10** 標記「✅ 已修正（6h 新增彈窗→effect_id 欄位／6g 刪除彈窗）」、優先序表＋結尾註同步、第 5 節「id 規則前後不一」標「已對齊（6h）」（該檔位於 `.gitignore` 的 `docs/temp`，不納入版本控制）。

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`、`node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`、`npx playwright test`
- 結果：全綠——pytest 156 passed（server 未改）；node 194 passed（test_editor 82→85，＋3）；E2E 72 passed（editor.spec 42→44，＋2）。
- 關鍵驗證：vm 斷言 `applyIdRekey` re-key（`effects[newId]` 建立＋`delete effects[id]`＋`currentEffects` 分區鍵同步＋`state.selected` 更新）、`validateId` 拒絕（格式不符／重複／既有特效不可改名）、`renderManifestView` 顯示 `{ "id": spec }`；E2E U10 斷言新增特效無 prompt（`sawPrompt === false`）、`#ed-meta-id` 預設 `effect-<N>` 可編輯／既有特效 `toBeDisabled`、[存檔] 後列表 `data-fx="custom-id"` selected＋effects.json 預覽 `toHaveValue(/"custom-id"/)`、5 按鈕 `.act-group` 計數 2＋`#ed-save-file` `toHaveClass(/primary/)`。
- 偏差說明：(1) E2E `#ed-code`（manifest 預覽）為 `<textarea>`——`toContainText` 讀 `textContent`（空字串）須改 `toHaveValue` 讀 `.value`（診斷確認 re-key 成功、預覽值含 `"custom-id"`，純測試斷言手法問題）；(2) 先前全量 E2E 曾遇 `restoreFixture` Windows 檔案鎖定（`UNKNOWN: unknown error, open effects.json`）失敗→fixture 未還原→次跑 v1 用例（2c/3a 期望 version 1）級聯假失敗；`git checkout` 還原 fixture＋`writeFileSyncRetry` 後消除，`editor.spec.js` 44 項、全量 E2E 72 項皆綠。

## Git Commit

- Commit：`03308d8` — `feat(editor): effect_id 欄位（新增預設流水號、僅新增可改、[存檔] re-key）＋effects.json 預覽以 id 為鍵＋5 按鈕分組`

## 後續待辦

- `EDITOR_REVIEW.md` 其餘待辦：B6、P2（defer，id+rev 快取已實作但首次載入仍 N 個 script、真解需把 11 個內嵌 iconSVG 收進 console/icons.js）、U1（主題）、U3（搜尋）、U4（捷徑）、U5（生成點）、U6（staged 持久化）、U7（存檔直覺）、U8（a11y）、U9（過渡態）、U11（DPR）、U12（.js 格式檢查）、U13（SSE 斷流 icon）、S2（檔案上限）、S3（沙箱）及一致性小點。
- 建議：E2E 加全域 `afterAll`/globalTeardown 統一還原 fixture（各用例 snapshot/restore 散落、中途失敗易遺漏，本次即以此機制＋retry 兜底）。
