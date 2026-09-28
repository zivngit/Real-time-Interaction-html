# 工作完成報告

- **日期**：2026-09-22
- **任務**：修正編輯器拖曳「放置位置」指示線只出現於第 1 個物件下方（EDITOR_REVIEW.md 新增 B9）
- **Agent**：opencode

## 摘要

用戶回報：拖曳排序／跨區時，「放置位置」指示線**只出現於第 1 個物件下方**、不隨滑鼠下移。

根因在 `editor/app.js` `initListDrag` 的 `dragover` 迴圈：對每個 item 判斷游標 `clientY`，但一旦 `clientY > afterY`（該 item 底邊之上）即 `afterEl = el; break;`。因 item 由上而下排列，游標只要低於第 1 個 item，迴圈就停在**第 1 個** item → `afterEl` 恆為第 1 項；`drop-before` 又只在「游標高於第 1 項頂」才設 → 指示線永遠卡在第 1 個物件下方（拖非第 1 項時尤明顯）。另原 4px 門檻（`top+4`／`bottom-4`）使每個 item 中段成「死區」。

採用修正（5z）：改以 item **中點**（`midY = top + height/2`）判斷——游標在中點之上 → `drop-before`（break）；之下 → `afterEl = el` 且**不 break**（續讓更下方 item 覆蓋）→ 最後一個在游標上方的 item 勝出。指示線隨 cursor 正確上／下移到對應 item。`drop`／`commitMove` 解讀 marker class 的邏輯不變。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `initListDrag` 的 `dragover` 迴圈改中點判斷＋`afterEl` 不 break（修 B9）；`window.__rtxEditor.version` 5y→5z |
| `tests/test_editor.mjs` | 修改 | version 斷言 5y→5z |
| `tests/e2e/editor.spec.js` | 修改 | 2d 節新增「拖曳指示線隨 cursor 位置落到正確項目（非固定第 1 項）」（拖第 2 項、cursor 滑最後一項下半，斷言 marker 落最後項 `drop-after`、非第 1 項）（38→39 項） |
| `README.md` | 修改 | Playwright E2E 66→67（`editor.spec.js` 38→39） |
| `docs/agents/CALL_GRAPH.md` | 修改 | TP 節點 E2E 66→67、editor.spec 38→39、補 B9 拖曳指示線隨 cursor 落正確項目 |
| `docs/agents/TODO.md` | 修改 | 子任務 5a–5y→5a–5z（25→26 項）、補 5z 拖曳指示線中點判斷說明；E2E 66→67、editor.spec 38→39 |

> 註：本報告檔案本身不列入上表。`docs/temp/effects-editor/EDITOR_REVIEW.md`（B1–S4／U1–U13 審查）已新增 **B9** 並標記已修正（5z）、版本 5y→5z、P1 優先序與結尾註同步（該檔位於 `.gitignore` 的 `docs/temp`，不納入版本控制）。

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`、`node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`、`npx playwright test`
- 結果：全綠——pytest 154 passed；node 189 passed（test_editor 80）；E2E 67 passed（含新增 1 項 B9 回歸測試）。
- 關鍵驗證：新增 B9 測試於修正前會失敗（marker 卡第 1／2 項）；既有 `拖曳同區排序與跨區移動`（`dragTo` targetPosition）不回歸，確認中點判斷未破壞原「before particle」與「空區 drop-target」場景。

## Git Commit

- Commit：`f377361` — `fix(editor): 拖曳放置指示線改中點判斷＋不 break（修 B9 指示線恆卡第 1 項）`

## 後續待辦

- `EDITOR_REVIEW.md` 其餘待辦：B6、B7（.rsz 右欄索引錯）、P1–P3、U1、U3、U5、U6、U7、U8–U12、U13、S2–S4 及一致性小點。
- 下一步建議（依 ②）：B7（`.rsz` 右欄索引錯→對側欄恆 220px，`getCols` 跳 8px 隔條＋對側欄索引）。
