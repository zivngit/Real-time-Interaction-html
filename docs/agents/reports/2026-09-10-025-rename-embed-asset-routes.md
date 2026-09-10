# 工作完成報告

- **日期**：2026-09-10
- **任務**：改名 embed asset routes 為 namespaced paths
- **Agent**：opencode

## 摘要

依使用者選擇，將 server 的 embed asset routes 從根路徑改為與目錄結構一致的 namespaced paths，並同步更新 client script、examples、README、tests 與 agent docs。

本次為 **breaking change**：舊根路徑 asset routes 已移除並回 404。

新 asset routes：

- `GET /viewer/app.js`
- `GET /viewer/effects.js`
- `GET /console/app.js`
- `GET /console/icons.js`
- `GET /console/style.css`

同時補充小範圍 API 回應整理：

- `429` 回應加入 `Retry-After: 1`
- SSE 不再手動發送 `Connection: keep-alive`（由 HTTP/1.1 預設語意與 server framework 處理）

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/main.py` | 修改 | 改名 embed asset routes 為 `/viewer/*` 與 `/console/*`；抽出 `_file_response()`；429 加 `Retry-After`；SSE headers 移除 `Connection: keep-alive` |
| `viewer/app.js` | 修改 | script origin 判斷改為 `/viewer/app.js`；動態載入 effects 改為 `/viewer/effects.js` |
| `console/app.js` | 修改 | script origin 判斷改為 `/console/app.js` |
| `examples/index.html` | 修改 | 更新 examples 索引頁所列 asset URLs |
| `examples/embed-viewer.html` | 修改 | viewer 示範頁改載入 `/viewer/app.js` |
| `examples/embed-console.html` | 修改 | console 示範頁改載入 `/console/style.css`、`/console/icons.js`、`/console/app.js` |
| `examples/embed-both.html` | 修改 | 同時嵌入示範頁改載入新 viewer 與 console asset URLs |
| `README.md` | 修改 | 更新 viewer／console 嵌入方式與 examples 說明 |
| `tests/test_api.py` | 修改 | asset route 測試改為新 routes；新增舊根路徑 asset routes 404 測試；examples assertions 更新；429 `Retry-After` 驗證 |
| `tests/test_console.mjs` | 修改 | console script origin 測試改為 `/console/app.js`，negative case 使用 `/viewer/app.js` |
| `docs/agents/TODO.md` | 修改 | 更新 viewer 嵌入規格、console 測試數量，並記錄本次 asset route 改名 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 更新 asset routes、client 載入關係、429 行為與 pytest 數量 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`node --test tests/test_effects.mjs tests/test_console.mjs`、`python -m pytest tests/ -q`
- 結果：node 52 項通過（effects 13＋console 39）、pytest 18 項通過（2 項 warnings）

## Git Commit

- Commit：`227f43a22dbc28d2cfea1132c9500548f109d915` — `refactor(server): 改名 embed asset routes 為 namespaced paths`

## 後續待辦

- 既有宿主網頁若仍使用舊 embed asset URL，需同步更新為新 namespaced paths：
  - `/app.js` → `/viewer/app.js`
  - `/effects.js` → `/viewer/effects.js`
  - `/console.js` → `/console/app.js`
  - `/icons.js` → `/console/icons.js`
  - `/console.css` → `/console/style.css`
- 請用戶於瀏覽器手動驗證（啟用 examples 後）：
  - `http://localhost:8000/examples/embed-viewer.html`
  - `http://localhost:8000/examples/embed-console.html`
  - `http://localhost:8000/examples/embed-both.html`
