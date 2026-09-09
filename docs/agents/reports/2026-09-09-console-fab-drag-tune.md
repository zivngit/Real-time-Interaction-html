# 工作完成報告

- **日期**：2026-09-09
- **任務**：console 拖曳手勢調整（移除長按等待）＋panel 跟隨 clamp 視窗內
- **Agent**：opencode

## 摘要

用戶回饋兩點，皆已處理：

1. **長按 350ms 太長、不直覺**：評估後決定移除等待。350ms 是沿用一般 mobile long-press 常數（Android ~500ms / iOS ~350ms），但本按鈕是「抓握式拖曳」（同視窗標題列），等待就是延遲。改為**按住 `#fab` 後位移 >8px（slop）立即啟動拖曳**，零延遲。短按（位移 ≤8px）仍為展開/收合，拖曳後 click 抑制不變。
2. **panel 跟隨不可移出視窗**：原 `applyFabPos` 只 clamp FAB 本身，panel（280px 寬）在 FAB 靠右/靠下邊緣時會溢出視窗。現改為 panel 水平、垂直皆 clamp 至 `[8, innerWidth-pw-8] × [8, innerHeight-ph-8]`；底部空間不足仍先翻至 FAB 上方，再行 clamp。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `console/app.js` | 修改 | 移除 long-press timer 與 `LONG_PRESS_MS`/`CONTROL_CONFIG.longPressMs`；pointermove 位移 >slop 即 `drag.active`；`applyFabPos` 加 panel 水平/垂直 clamp |
| `console/index.html` | 修改 | hint 文案改為「按住圓形按鈕拖曳可移動位置」 |
| `tests/test_console.mjs` | 修改 | 4 項拖曳測試改同步（移除 sleep/longPressMs）；clamp 測試以 panel 280×400 驗證水平+垂直邊界（右緣 712px、翻上 46px） |
| `docs/agents/CALL_GRAPH.md` | 修改 | console 行與 flowchart 更新為「按住＋位移 >8px 啟動」「fab/panel 皆 clamp」 |
| `docs/agents/TODO.md` | 修改 | 勾選本輪調整條目 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`node --check console\app.js`、`node --test tests/test_console.mjs tests/test_effects.mjs`、`.venv\Scripts\python -m pytest tests -q`
- 結果：全綠——node 24 passed（console 11＋effects 13）、pytest 12 passed。

## Git Commit

- Commit：`062cda7` — `fix(console): 拖曳改為按住即啟動（移除 350ms 等待）＋panel 跟隨亦 clamp 視窗內`

## 後續待辦

- 請用戶於瀏覽器重新開啟 `console/index.html` 手動驗證：按住 FAB 拖曳是否跟手（無等待）、拖到四角時 panel 是否完整留在視窗內、短按仍 toggle。
