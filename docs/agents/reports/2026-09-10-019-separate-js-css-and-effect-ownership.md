# 工作完成報告

- **日期**：2026-09-10
- **任務**：console/server/viewer 分離 JS/CSS，並明確化特效列表與特效實作歸屬
- **Agent**：opencode

## 摘要

本次將 console、server、viewer 的資產結構重新整理：

- **console JS/CSS 分離**：`console/app.js` 不再內嵌 CSS；console 樣式抽至 `console/style.css`；server 新增 `GET /console.css`。
- **viewer JS/CSS 分離**：`viewer/index.html` 的 inline CSS 抽至 `viewer/style.css`；viewer 預覽頁改為外部 CSS。
- **特效實作移至 viewer**：`shared/effects.js` 移至 `viewer/effects.js`；`viewer/index.html` 直接載入 `viewer/effects.js`；server `GET /effects.js` 改為 serve `viewer/effects.js`。
- **server 只保留特效列表**：`server/main.py` 原本的 `EFFECTS` 字典抽至 `server/effects.py`；server 負責提供 `/api/effects`、驗證 effect 名稱，不再內嵌特效列表定義。
- **嵌入方式更新**：console 嵌入其他網頁需同時載入 `/console.css` 與 `/console.js`；viewer 嵌入仍使用 `/app.js`，`/app.js` 需要時仍會動態載入 `/effects.js`。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `console/style.css` | 新增 | 承接原 `console/app.js` 內的 console scoped CSS |
| `console/app.js` | 修改 | 移除內嵌 CSS 與 `<style>` 注入邏輯；保留 console JS 行為 |
| `console/index.html` | 修改 | 載入 `console/style.css` |
| `viewer/style.css` | 新增 | 承接原 `viewer/index.html` 的 viewer 預覽頁 CSS |
| `viewer/index.html` | 修改 | 移除 inline CSS；改載入 `viewer/style.css` 與 `viewer/effects.js` |
| `viewer/effects.js` | 移動 | 由 `shared/effects.js` 移至 `viewer/effects.js`，內容不變 |
| `server/effects.py` | 新增 | 保存 server 使用的 `EFFECTS` 特效列表 |
| `server/main.py` | 修改 | 改從 `server/effects.py` 讀取 `EFFECTS`；`/effects.js` 改 serve `viewer/effects.js`；新增 `/console.css` |
| `tests/test_effects.mjs` | 修改 | 改 import `viewer/effects.js` |
| `tests/test_console.mjs` | 修改 | 改驗證外部 `console/style.css`；移除 `<style>` 注入相關斷言 |
| `tests/test_api.py` | 修改 | 新增 `/console.css` serve 測試 |
| `README.md` | 修改 | 更新 console 嵌入方式（`/console.css`＋`/console.js`） |
| `docs/agents/TODO.md` | 修改 | 記錄本次 JS/CSS 分離與特效歸屬調整已完成 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 更新資產路徑、`/console.css`、`server/effects.py`、測試數量與 viewer 載入關係 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`node --test tests/test_effects.mjs tests/test_console.mjs`、`python -m pytest tests/ -q`
- 結果：node 50 項通過（effects 13＋console 37）、pytest 14 項通過（2 項 warnings）

## Git Commit

- Commit：`46958f1ed5869f7d518e1a684a343a066ebead57` — `refactor: 分離 console/server/viewer JS/CSS 並抽離特效列表`

## 後續待辦

- 請用戶於瀏覽器手動驗證：
  - `console/index.html` 開啟後樣式正常（FAB、面板、按鈕、參數區）
  - `viewer/index.html` 開啟後預覽頁樣式正常，特效仍可渲染
  - console 嵌入其他網頁時，同時載入 `/console.css` 與 `/console.js` 後樣式與功能正常
  - viewer 嵌入其他網頁時，`/app.js` 仍能自動載入 `/effects.js` 並渲染特效
