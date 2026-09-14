# 工作完成報告

- 日期：2026-09-14
- 任務：console 特效按鈕在次要區關閉時禁止 pointer 拖曳，click 選擇維持有效
- Agent：opencode

## 摘要

本次變更將 console 特效按鈕的 pointer 拖曳限制為「次要區開啟時才可進行」。當 `#rtx-fx-alternate` 未帶 `.open` class 時，`.rtx-fx` 的 `pointerdown` 會直接回傳，不啟動 `fxDrag`、不 `preventDefault()`，因此原本的 click 選擇行為維持有效。`#rtx-fx-layout` 初始即攜帶 `fx-locked` class，並由 layout 按鈕 toggle 同步次要區開啟狀態；CSS 在 `fx-locked` 時將特效按鈕 cursor 從 `grab` 改為 `pointer`，讓使用者可辨識目前不可拖曳。

本次也將既有 pointer drag 測試改為先開啟次要區再拖曳，並新增 vm 與 Playwright E2E 測試，驗證次要區關閉時拖曳停用、layout 順序不變、click 仍可选中，以及重新開啟次要區後拖曳可恢復。console vm 測試更新為 72 項、Playwright E2E 更新為 28 項。

## 文件異動表

| 檔案路徑 | 異動類型 | 異動內容摘要 |
| --- | --- | --- |
| `console/app.js` | 修改 | `#rtx-fx-layout` 初始加入 `fx-locked`；新增 `fxDragEnabled()` 判斷 `#rtx-fx-alternate` 是否 `.open`；`.rtx-fx` `pointerdown` 於次要區關閉時直接回傳，不啟動拖曳且保留 click；`bindToggle()` 加入第三參數 `locked`，layout 按鈕 toggle 時同步 `#rtx-fx-layout.fx-locked` |
| `console/style.css` | 修改 | 新增 `#rtx-fx-layout.fx-locked .rtx-fx { cursor: pointer; }`，次要區關閉時顯示不可抓握的 pointer cursor |
| `docs/agents/CALL_GRAPH.md` | 修改 | 更新 console 流程說明：layout toggle 同步 `fx-locked`、`pointerdown` 先經 `fxDragEnabled()` 判斷；更新 console vm 72 項與 Playwright E2E 28 項測試清單 |
| `docs/agents/TODO.md` | 修改 | 更新 Playwright E2E 28 項與 console vm 72 項計數；新增「console 特效按鈕在次要區關閉時禁止移動」已完成項目 |
| `tests/e2e/fx-drag-trigger-distance.spec.js` | 修改 | 8 方向觸發距離測試改先點擊 `#rtx-fx-layout-btn` 開啟次要區，再進行 pointer drag |
| `tests/e2e/fx-layout.spec.js` | 修改 | 新增「fx drag is disabled while alternate zone is closed」E2E：驗證關閉時 cursor pointer、drag 不啟動、layout 不變、click 仍可選、開啟後拖曳恢復；既有 3 項 pointer drag 測試改先開啟次要區 |
| `tests/test_console.mjs` | 修改 | 新增「fx drag is disabled while alternate zone is closed」vm 測試；layout toggle 測試加入 `fx-locked` 斷言；既有 drag 相關 vm 測試改先開啟次要區；console vm 測試更新為 72 項 |

> 註：本報告檔本身未列入上方表格。

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`
- 結果：通過；Python 47 項通過（2 個第三方 deprecation warnings）

- 執行命令：`node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs`
- 結果：通過；Node 108 項總計通過（effects 18、console 72、examples 16、catalog 2）

- 執行命令：`npx playwright test --reporter=line`
- 結果：通過；Playwright E2E 28 項通過（含「fx drag is disabled while alternate zone is closed」）

## Git Commit

- Commit：`601d21ca6fa0a72299ed363f78eeea3773dc5472` — `feat(console): 次要區關閉時禁止特效按鈕 pointer 拖曳（click 選擇維持有效）`

## 後續 TODO

- 無；本次變更已完成對應 vm、E2E、TODO 與 CALL_GRAPH 更新。