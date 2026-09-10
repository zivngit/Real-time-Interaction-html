# 工作完成報告

- **日期**：2026-09-10
- **任務**：console SVG icons 抽離至 `console/icons.js`
- **Agent**：opencode

## 摘要

本次將 console 的特效 SVG icons 從 `console/app.js` 抽離至獨立 JS 資產：

- **新增 `console/icons.js`**：定義 `window.RTX_ICONS`，包含 `particle`、`ripple`、`firework`、`text`、`generic` 五個 SVG icon。
- **`console/app.js` 改讀外部 icons**：移除內嵌 `ICONS` map；改以 `window.RTX_ICONS` 提供 icon，並以 `iconFor(type)` 處理已知特效與 generic fallback。
- **server 新增 `GET /icons.js`**：serve `console/icons.js`（`application/javascript`、`Cache-Control: no-store`）。
- **console 載入順序更新**：`console/index.html` 先載入 `icons.js`，再載入 `app.js`；嵌入其他網頁時需先載入 `/icons.js`，再載入 `/console.js`。
- 保留原有行為：server 動態特效清單、未知特效 generic 樣式、特效按鈕選擇、參數區、FAB／面板拖曳與層級行為。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `console/icons.js` | 新增 | 定義 `window.RTX_ICONS`（particle / ripple / firework / text / generic SVG icons） |
| `console/app.js` | 修改 | 移除內嵌 `ICONS` map；改讀 `window.RTX_ICONS`；新增 `iconFor(type)` 與 fallback icon |
| `console/index.html` | 修改 | 在 `app.js` 前載入 `icons.js` |
| `server/main.py` | 修改 | 新增 `GET /icons.js` serve `console/icons.js` |
| `tests/test_console.mjs` | 修改 | vm 環境先載入 `console/icons.js`；新增外部 icons 測試；console vm 測試由 37 項擴充至 38 項 |
| `tests/test_api.py` | 修改 | 新增 `test_serves_icons_js`（驗證 `/icons.js` 內容、Content-Type、no-store） |
| `README.md` | 修改 | 更新 console 嵌入方式（`/console.css`＋`/icons.js`＋`/console.js`） |
| `docs/agents/TODO.md` | 修改 | 記錄 console SVG icons 抽離已完成 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 更新 console 資產載入、`/icons.js`、`iconFor(type)`、測試數量 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`node --test tests/test_effects.mjs tests/test_console.mjs`、`python -m pytest tests/ -q`
- 結果：node 51 項通過（effects 13＋console 38）、pytest 15 項通過（2 項 warnings）

## Git Commit

- Commit：`1b595513c44a4923b56121c24773594c76869a9e` — `refactor(console): 抽離 SVG icons 至 console/icons.js`

## 後續待辦

- 請用戶於瀏覽器手動驗證：
  - `console/index.html` 開啟後特效按鈕圖示正常顯示
  - 未知特效仍顯示 generic 圖示
  - console 嵌入其他網頁時，按 `/console.css`＋`/icons.js`＋`/console.js` 順序載入後圖示與功能正常
