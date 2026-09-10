# 工作完成報告

- **日期**：2026-09-10
- **任務**：examples 嵌入示範（opt-in）
- **Agent**：opencode

## 摘要

新增 `examples/` 嵌入示範頁，展示 viewer／console 如何嵌入既有宿主網頁；server 以環境變數 `SERVE_EXAMPLES` 控制啟用（opt-in），預設停用、所有 `/examples*` 路線回 404。

- **`examples/` 四頁**：
  - `examples/index.html`：示範索引，連結三個嵌入示範頁與 `viewer/index.html`、`console/index.html`，並說明預設停用、需 `SERVE_EXAMPLES=1`
  - `examples/embed-viewer.html`：宿主頁內容＋`<script src="/app.js"></script>`
  - `examples/embed-console.html`：宿主頁內容＋`/console.css`、`/icons.js`、`/console.js`（`data-key=""`，附 HTML 註解說明 `ACCESS_KEY` 已設定時需填入金鑰）
  - `examples/embed-both.html`：宿主頁內容＋同時載入 viewer 與 console 資產
- **`server/main.py`**：
  - 新增 `EXAMPLES_DIR`、`_examples_enabled()`（`SERVE_EXAMPLES` 取值 `1`／`true`／`yes`，不分大小寫）、`_examples_response(path)`（停用→404；路徑解析後須位於 `EXAMPLES_DIR` 內且為檔案，否則 404；`Cache-Control: no-store`）
  - 新增路由 `GET /examples`、`GET /examples/`、`GET /examples/{path:path}`（不使用 `StaticFiles` mount）
- **`tests/test_api.py`**：新增 `test_examples_disabled_by_default`、`test_examples_enabled_when_serve_examples_set`（共 17 項）

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `examples/index.html` | 新增 | 示範索引頁；連結 embed-viewer／embed-console／embed-both 與 viewer／console 獨立頁；說明預設停用與 `SERVE_EXAMPLES=1` |
| `examples/embed-viewer.html` | 新增 | 宿主頁嵌入 viewer 示範（`/app.js`） |
| `examples/embed-console.html` | 新增 | 宿主頁嵌入 console 示範（`/console.css`＋`/icons.js`＋`/console.js`；`data-key=""` 附註解） |
| `examples/embed-both.html` | 新增 | 宿主頁同時嵌入 viewer 與 console 示範 |
| `server/main.py` | 修改 | 新增 `EXAMPLES_DIR`、`_examples_enabled()`、`_examples_response()`；新增 `GET /examples`、`/examples/`、`/examples/{path:path}`（opt-in，預設 404） |
| `tests/test_api.py` | 修改 | 新增 examples 停用／啟用 2 項測試（共 17 項） |
| `README.md` | 修改 | 新增「嵌入示範頁（examples，opt-in）」章節：預設停用、PowerShell／cmd 啟用命令、四條 URL、`ACCESS_KEY` 與 `data-key` 說明 |
| `docs/agents/TODO.md` | 修改 | 記錄 examples opt-in 嵌入示範頁已完成（2026-09-10） |
| `docs/agents/CALL_GRAPH.md` | 修改 | 整體架構加入 examples 節點；server 路由加入 examples 三條路線與 `SERVE_EXAMPLES` 啟用判斷；API 測試數量更新為 17 項 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`node --test tests/test_effects.mjs tests/test_console.mjs`、`python -m pytest tests/ -q`
- 結果：node 52 項通過（effects 13＋console 39）、pytest 17 項通過（2 項 warnings）

## Git Commit

- Commit：`598adc9fded36a6e7bdb80747c22d8252a9d980c` — `feat(examples): 新增 opt-in 嵌入示範頁`

## 後續待辦

- 請用戶於瀏覽器手動驗證（先設定 `SERVE_EXAMPLES=1` 再啟動 server）：
  - `http://localhost:8000/examples/` 可開啟且四個連結可達
  - `http://localhost:8000/examples/embed-viewer.html` 開啟後另開 console 頁面發送特效，可在示範頁看到渲染
  - `http://localhost:8000/examples/embed-console.html` 開啟後右下角 FAB 可發送特效
  - `http://localhost:8000/examples/embed-both.html` 同頁可發送並看到特效
  - 未設定 `SERVE_EXAMPLES` 時 `/examples` 皆回 404
  - 若 server 設定 `ACCESS_KEY`，console 示範頁填入 `data-key` 後可正常發送
