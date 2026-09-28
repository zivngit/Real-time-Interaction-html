# 工作完成報告

- **日期**：2026-09-22
- **任務**：修正編輯器 `.rsz` 拖曳至對側欄觸底後、另一欄意外加大（EDITOR_REVIEW.md 新增 B10）
- **Agent**：opencode

## 摘要

用戶回報：`.rsz` 拖移時，當某一欄縮減到最小（220px 下限）後繼續拖，對側欄會「意外加大」。

根因在 `editor/app.js` `.rsz` mousedown 的 `onMove`：`na = max(MIN, colA+dx)` 與 `nb = max(MIN, colB-dx)` 各自**獨立 clamp**。當收縮側（`nb`）撞到 220px 下限後，拖動側（`na = colA+dx`）仍隨原始 `dx` 繼續加大、不受 `nb` 下限約束 → 兩欄總寬隨繼續拖曳而膨脹（rsz1：c1 無上限增大、c2 恆 220；rsz2 同理），整體布局變寬（可能觸發 U2 橫向捲動）。

採用修正（6b）：改以「**兩欄總寬守恆**」——`total = colA + colB`，`na` 隨 cursor 但 clamp 到 `[MIN, total-MIN]`、`nb = total - na`。收縮側觸底時拖動側被 cap 在 `total-MIN`、不再膨脹；反方向（拖動側觸底）對稱。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `.rsz` `onMove` 改兩欄總寬守恆（`na` clamp 到 `[MIN, total-MIN]`、`nb=total-na`，修 B10）；`window.__rtxEditor.version` 6a→6b |
| `tests/test_editor.mjs` | 修改 | version 斷言 6a→6b |
| `tests/e2e/editor.spec.js` | 修改 | 2a 節新增 `B10 拖曳 .rsz 至對側欄觸底：另一欄不意外加大（兩欄總寬守恆）`（rsz1 大幅右拖 dx≈420 使 c2 觸 220px、斷言 c2≤230 且兩欄總寬前後差 <12）（40→41 項） |
| `README.md` | 修改 | Playwright E2E 68→69（`editor.spec.js` 40→41） |
| `docs/agents/CALL_GRAPH.md` | 修改 | TP 節點 E2E 68→69、editor.spec 40→41、補 B10 .rsz 觸底總寬守恆 |
| `docs/agents/TODO.md` | 修改 | 子任務 5a–6a→5a–6b（27→28 項）、補 6b `.rsz` 兩欄總寬守恆說明；E2E 68→69、editor.spec 40→41 |

> 註：本報告檔案本身不列入上表。`docs/temp/effects-editor/EDITOR_REVIEW.md`（B1–S4／U1–U13 審查）已新增 **B10** 並標記已修正（6b）、版本 6a→6b、P1 優先序註與結尾註同步（該檔位於 `.gitignore` 的 `docs/temp`，不納入版本控制）。

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`、`node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`、`npx playwright test`
- 結果：全綠——pytest 154 passed；node 189 passed（test_editor 80）；E2E 69 passed（含新增 1 項 B10 測試）。
- 關鍵驗證：修正前 c2 觸底後 c1 隨 `dx` 繼續加大（拖 dx≈420 時 c1≈720、c2=220，兩欄總寬 ~940），`|sumAfter - sumBefore|` ≈160 > 12 而失敗；修正後 c1 被 cap 在 `total-MIN`（≈560）、c2=220，兩欄總寬守恆（~780）。既有 `.rsz 可拖曳調整欄寬`、`B7 .rsz[2]` 不回歸（未觸底時行為不變）。

## Git Commit

- Commit：`129b1a9` — `fix(editor): .rsz 兩欄總寬守恆（修 B10 一欄觸底後另一欄意外加大）`

## 後續待辦

- `EDITOR_REVIEW.md` 其餘待辦：B6、P1–P3、U1、U3、U5–U12、U13、S2–S4 及一致性小點。
- 下一步建議（依優先序）：P3（把成組檔案寫入合併成單端點，消除存檔時延）或 P1（staged 變更改就地更新，避免 40+ 特效整列重繪）。
