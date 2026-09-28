# 工作完成報告

- **日期**：2026-09-22
- **任務**：修正編輯器列表每次 staged 變更整列重建 DOM（EDITOR_REVIEW.md 之 P1）
- **Agent**：opencode

## 摘要

用戶指令「修正 P1」。

根因在 `editor/app.js` `renderList`：開關 enabled、批次操作、拖曳（`commitMove`）、切換選定等都會 `renderAll()` → `clearZone`＋逐項 `buildItem`（每次重建全部節點、重掛全部事件監聽）。40+ 特效時每次操作 O(n) DOM churn、列表捲動位置丢失、可能閃爍。

採用修正（6d）：`renderList` 改**就地協調（reconcile）**——先收集兩區既有真實項（`data-fx`→節點，排除 pending-delete）；對目標順序**復用**既有節點（`refreshItem` 更新 disabled class／off-tag／switch／name／icon）、僅以 `insertBefore` **移動錯位節點**、移除已不在本區的節點、pending 項重建於區尾；並保存／還原 `#ed-fx-list` 的 `scrollTop`。未受影響項的節點與監聽原樣保留，消除 O(n) churn 與閃爍；`loadManifest` 等結構性重載走同一路徑（無既有節點時才 `buildItem`）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `renderList` 改就地協調（收集既有節點→`nodeFor` 復用或新建、`layoutZone` 移除 stale／`insertBefore` 移動錯位節點／重建 pending 於區尾、保存還原 `#ed-fx-list` scrollTop）；新增 `refreshItem`（更新 disabled／off-tag／switch／name／icon）；移除已無用的 `clearZone`；version 6c→6d |
| `tests/test_editor.mjs` | 修改 | 新增 `P1 就地更新：拖曳 commitMove 只 move 既有節點、不重建（保留節點 identity）`（斷言跨區移動後 fx-a／fx-b 節點為同一物件）；version 斷言 6c→6d（80→81 項） |
| `tests/e2e/editor.spec.js` | 修改 | 2d 新增 `P1 就地更新：staged 變更復用未受影響列表節點`（標記 firework 節點→對 particle setEnabled→firework 節點 `data-p1-tag` 保留＝identity 未重建、particle 顯 [未啟用]）（41→42 項） |
| `README.md` | 修改 | node 189→190（`test_editor` 80→81）、Playwright E2E 69→70（`editor.spec.js` 41→42） |
| `docs/agents/CALL_GRAPH.md` | 修改 | TEX 節點 80→81＋補 P1 列表就地協調；TP 節點 E2E 69→70、editor.spec 41→42、補 P1 |
| `docs/agents/TODO.md` | 修改 | 子任務 5a–6c→5a–6d（29→30 項）、補 6d 列表就地協調說明；node test_editor 80→81、E2E 69→70、editor.spec 41→42 |

> 註：本報告檔案本身不列入上表。`docs/temp/effects-editor/EDITOR_REVIEW.md`（B1–S4／U1–U13 審查）已將 **P1** 標記已修正（6d）、版本 6c→6d、第 1 序優先表（P1 移出、僅餘 P2）與結尾註同步（該檔位於 `.gitignore` 的 `docs/temp`，不納入版本控制）。

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`、`node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`、`npx playwright test`
- 結果：全綠——pytest 156 passed（P1 純前端、server 未改）；node 190 passed（test_editor 81，含新增 1 項 P1）；E2E 70 passed（含新增 1 項 P1）。
- 關鍵驗證：新增 vm 測試斷言 `commitMove` 跨區後 fx-a／fx-b 節點 `===` 原始物件（復用而非重建）；E2E 測試標記 firework 節點 `data-p1-tag`、對 particle 做 staged 變更後 tag 仍保留（identity 未重建）且 particle 顯示 `[未啟用]`。既有 5d 批次/拖曳/新增/移除、v1/v2 分區、B7/B9/B10 等不回歸。

## Git Commit

- Commit：`402bd2b` — `perf(editor): 列表改就地協調 renderList（復用／移動既有節點＋保存還原捲動位置，修 P1 每次 staged 變更整列重建）`

## 後續待辦

- `EDITOR_REVIEW.md` 其餘待辦：B6、P2、U1、U3、U5–U12、U13、S2–S4 及一致性小點。
- 下一步建議（依優先序）：P2（以 id+rev 快取 script、避免 N 個 script 注入）——現為第 1 序剩餘唯一項。
