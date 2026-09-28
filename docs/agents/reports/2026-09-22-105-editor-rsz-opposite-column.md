# 工作完成報告

- **日期**：2026-09-22
- **任務**：修正編輯器 `.rsz` 拖曳調寬時對側欄恆被設為 220px（EDITOR_REVIEW.md 之 B7）
- **Agent**：opencode

## 摘要

`.rsz` 拖曳調寬時，**對側內容欄**（拖 rsz[1] 的中欄 c2、拖 rsz[2] 的預覽欄 c3）恆被設為 220px 下限，而非依拖曳量等量收縮；c3 更從 `1fr` 變固定 px 而失去「填滿剩餘寬」。

根因在 `editor/app.js` `initListDrag` 前的 `.rsz` mousedown 處理器：`.main` 是 5 軌 grid `[c1, 8px, c2, 8px, c3]`，`getCols()` 回全部 5 值，但 `colA=start[(idx-1)*2]`、`colB=start[(idx-1)*2+1]` 的索引只對「無 8px 隔條」成立 → `colB` 恆讀到 8px 隔條軌（rsz1 讀 `start[1]`、rsz2 讀 `start[3]`）→ `nb=max(220, 8-dx)≈220`，對側欄被釘死在下限。

採用修正（6a）：`getCols()` 改回 3 條內容欄 `[c1,c2,c3]`（取 5 軌的 `[0,2,4]`），`colA=start[idx-1]`／`colB=start[idx]` → rsz1 讀 `[c1,c2]`、rsz2 讀 `[c2,c3]`。拖曳時對側欄依 `dx` 等量收縮（左增右減），c3 保留實際寬度。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `getCols()` 跳 8px 隔條回 `[c1,c2,c3]`（取 `[0,2,4]`）；`colA/colB` 索引改 `start[idx-1]`／`start[idx]`（修 B7）；`window.__rtxEditor.version` 5z→6a |
| `tests/test_editor.mjs` | 修改 | version 斷言 5z→6a |
| `tests/e2e/editor.spec.js` | 修改 | 強化 `.rsz 可拖曳調整欄寬`（補斷言 c1 增 ≈ c2 減）；新增 `B7 拖曳 .rsz[2]：中欄增、預覽欄等量減（非釘 220px）`（c2 增 ≈ c3 減）（39→40 項） |
| `README.md` | 修改 | Playwright E2E 67→68（`editor.spec.js` 39→40） |
| `docs/agents/CALL_GRAPH.md` | 修改 | TP 節點 E2E 67→68、editor.spec 39→40、補 B7 .rsz 對側欄等量收縮 |
| `docs/agents/TODO.md` | 修改 | 子任務 5a–5z→5a–6a（26→27 項）、補 6a `.rsz` 對側欄索引說明；E2E 67→68、editor.spec 39→40 |

> 註：本報告檔案本身不列入上表。`docs/temp/effects-editor/EDITOR_REVIEW.md`（B1–S4／U1–U13 審查）已將 **B7** 標記已修正（6a）、版本 5z→6a、P1 優先序（B7 移出）與結尾註同步（該檔位於 `.gitignore` 的 `docs/temp`，不納入版本控制）。

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`、`node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`、`npx playwright test`
- 結果：全綠——pytest 154 passed；node 189 passed（test_editor 80）；E2E 68 passed（含強化＋新增 2 項 `.rsz` 測試）。
- 關鍵驗證：修正前對側欄被釘 220px（拖 40px 卻縮 ~260px），`|c1d - c2d|` 會 ~224 > 12 而失敗；修正後 `c1 增 ≈ c2 減`（皆 ~36px）、`c2 增 ≈ c3 減`，兩支新斷言通過。既有 `.rsz 可拖曳調整欄寬`（c1 變寬）不回歸。

## Git Commit

- Commit：`f0cd364` — `fix(editor): .rsz 拖曳 getCols 跳 8px 隔條＋對側欄索引（修 B7 對側欄恆 220px）`

## 後續待辦

- `EDITOR_REVIEW.md` 其餘待辦：B6、P1–P3、U1、U3、U5–U12、U13、S2–S4 及一致性小點。
- 下一步建議（依優先序）：P3（把成組檔案寫入合併成單端點，消除存檔時延）或 P1（staged 變更改就地更新，避免 40+ 特效整列重繪）。
