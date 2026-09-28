# 工作完成報告

- **日期**：2026-09-23
- **任務**：匯入匯出修正——單項匯出補 layout 鍵＋匯入強制恰好 1 特效（B11/B12）
- **Agent**：opencode

## 摘要

修正編輯器單項（effects.json）匯入匯出兩項問題：

- **B11（單項匯出 effects.json 缺 layout 鍵）**：`selectedEffectFileJson`（[匯出 effects.json] 按鈕、manifest tab）原產出 `{ version: 2, effects: { <id>: spec } }`、**缺 `currentEffects`/`alternateEffects`**；v2 manifest 必備此二鍵（server `_normalize_manifest_layout` 見非 array 即回 400）→ 匯出檔作為獨立 v2 manifest 是格式錯誤。修正：補上 `currentEffects`/`alternateEffects`（依該特效 `enabled` 派生：enabled→`currentEffects:[id]`、disabled→`alternateEffects:[id]`）→ 匯出為**完整 v2 迷你 manifest**。單項匯入只讀 `data.effects`（忽略 layout 鍵）、不受影響；zip 子集匯出（`exportZip`）維持乾淨子集（無 layout 鍵）、不在此範圍。
- **B12（[匯入 effects.json] 未阻止特效數 ≠1）**：`doImportEntry` 原只擋 0 個、多於 1 個時把所有 effects 合併進 manifest（bulk 匯入）→ 與「單項 effects.json」語意不符、可意外新增多特效。修正：解析後強制**恰好 1 個**——`ids.length>1` 報「匯入 effects.json 只能含 1 個特效（現為 N 個）」、0 個維持「no effect entry」；多特效改走 [匯入 effects.zip]／[匯入 effect.zip]（zip 匯入為獨立路徑、不受此限）。

`window.__rtxEditor.version` 6p→6q。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `selectedEffectFileJson` 補 `currentEffects`/`alternateEffects`（依 enabled，B11）；`doImportEntry` 強制恰好 1 特效（`ids.length>1` 報錯，B12）；version 6p→6q |
| `tests/test_editor.mjs` | 修改 | 5j 匯出斷言補 `currentEffects:[fx-a]`／`alternateEffects:[]`；5o 多 effect wrapper 測試改斷言「被阻止」（未匯入／不 dirty／warnings 錯誤） |
| `docs/agents/TODO.md` | 修改 | 新增 B11/B12/6q 完成項 |
| `docs/agents/CALL_GRAPH.md` | 修改 | EDP 節點中欄補單項匯入（強制 1 特效）／匯出（含 layout 鍵）描述 |

> 註：本報告檔案本身不列入上表。`docs/temp/effects-editor/EDITOR_REVIEW.md`（gitignored）新增 B11/B12 條目（已修正 6q）、version 6p→6q、狀態列與優先序表，不入库。

## 測試與驗證

- 執行命令：`node --test tests\test_effects.mjs tests\test_console.mjs tests\test_effect_examples.mjs tests\test_effect_catalog.mjs tests\test_editor.mjs`、`python -m pytest tests/ -q`、`npx playwright test`
- 結果：全綠——node **207**（`test_editor` 98）、pytest **156**、Playwright E2E **75**（`editor.spec.js` 47）

## Git Commit

- Commit：`b0c2f88` — `fix(editor): 匯入匯出修正——單項[匯出 effects.json]補 currentEffects/alternateEffects（完整 v2 迷你 manifest）＋[匯入 effects.json]強制恰好 1 個特效（多特效改走 zip 匯入）（B11/B12/6q）`

## 後續待辦

- U16（特效列表加回 icon）、C3（預覽結果區語義）、C7（`commitMove` self-adjacent）維持待辦（見 EDITOR_REVIEW）。
