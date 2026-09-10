# 工作完成報告

- **日期**：2026-09-09
- **任務**：console 懸浮按鈕長按拖曳移動（視窗內限制、面板跟隨）
- **Agent**：opencode

## 摘要

為 `#fab` 懸浮按鈕增加長按拖曳功能，滿足三項約束：

1. **限制不可移出視窗**：`applyFabPos()` 將 FAB 座標 clamp 至 `[0, innerWidth-44] × [0, innerHeight-44]`；window `resize` 時重新 clamp。
2. **長按範圍僅 FAB**：pointerdown 只綁在 `#fab`；面板無此功能。
3. **收合/展開皆可移動且面板跟隨**：拖曳時同步寫入 `#panel` 的 left/top（FAB 下方 54px；若底部空間不足則翻至 FAB 上方，最少留 8px）。

操作定義：

- 長按 350ms（`CONTROL_CONFIG.longPressMs` 可覆寫）後進入拖曳（FAB 加 `.dragging` class、cursor grabbing）；長按前位移超過 8px（slop）則取消拖曳。
- 拖曳結束後隨後的 `click` 被抑制（`suppressClick` flag，`setTimeout 0` 清除），不會誤觸發展開/收合。
- 短按（未達長按）仍為原 toggle 行為；`pointer capture` 讓指標移出 FAB 後仍持續拖曳；`touch-action: none` 支援觸控拖曳。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `console/app.js` | 修改 | 新增拖曳狀態機（pointerdown/move/up、`applyFabPos` clamp＋panel 跟隨、click 抑制、resize 再 clamp） |
| `console/index.html` | 修改 | `#fab` 加 `touch-action: none`、cursor grab/grabbing（`.dragging`）；hint 補長按拖曳說明 |
| `tests/test_console.mjs` | 修改 | stub 加 `style/offsetHeight/pointer capture`、sandbox 加 timers、`makeEnv(opts)` 注入 `longPressMs`；新增 4 項測試（拖曳跟隨、短按 toggle、slop 取消、視窗 clamp），共 11 項 |
| `docs/agents/CALL_GRAPH.md` | 修改 | console 行補長按拖曳描述；前端 flowchart 加長按→拖曳→applyFabPos 分支 |
| `docs/agents/TODO.md` | 修改 | 二階段勾選長按拖曳條目 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`node --check console\app.js`、`node --test tests/test_console.mjs tests/test_effects.mjs`、`.venv\Scripts\python -m pytest tests -q`
- 結果：全綠——node 24 passed（console 11＋effects 13）、pytest 12 passed。

## Git Commit

- Commit：`8d6474e` — `feat(console): 長按懸浮按鈕拖曳移動（視窗內限制、面板跟隨）`

## 後續待辦

- 請用戶於瀏覽器重新開啟 `console/index.html` 手動驗證：長按 FAB 拖曳（含拖到視窗邊緣）、收合/展開狀態下拖曳、短按仍 toggle、拖曳後不誤 toggle。
