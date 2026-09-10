# 工作完成報告

- **日期**：2026-09-09
- **任務**：將 a/b/c 目錄改名為 console/viewer/server
- **Agent**：opencode

## 摘要

依角色語意將三個目錄改名：`a`（控制端）→`console`、`b`（顯示端）→`viewer`、`c`（中繼後端）→`server`。同步更新 Python 匯入（`server.main`）、uvicorn 啟動命令、README 執行方式、console/viewer 前端頁面與 JS 變數/元素 id（`cUrl`/`cKey`→`srvUrl`/`srvKey`），以及 TODO.md、CALL_GRAPH.md 的架構描述。以 `git mv` 保留 git 歷史。

> 註：歷史報告（init-project、implement-relay-effects、venv-setup）為時點記錄，保留原始 a/b/c 名稱不改寫。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `console/app.js`（原 `a/app.js`） | 移動＋修改 | 變數 `cUrl`/`cKey`→`srvUrl`/`srvKey`、迴圈變數 `b`→`el` |
| `console/index.html`（原 `a/index.html`） | 移動＋修改 | 標題、`中繼 c`→`中繼 server`、元素 id `cUrl`/`cKey`→`srvUrl`/`srvKey` |
| `viewer/index.html`（原 `b/index.html`） | 移動＋修改 | 標題、嵌入提示 `&lt;c-host&gt;`→`&lt;server-host&gt;` |
| `server/main.py`（原 `c/main.py`） | 移動 | 內容不變（無 a/b/c 引用） |
| `server/requirements.txt`（原 `c/`） | 移動 | 內容不變 |
| `server/requirements-dev.txt`（原 `c/`） | 移動 | 內容不變 |
| `conftest.py` | 修改 | 註解 `import c.main`→`import server.main` |
| `tests/test_api.py` | 修改 | `import c.main`→`import server.main`、uvicorn `c.main:app`→`server.main:app`、TestClient 變數 `c`→`tc` |
| `README.md` | 修改 | 執行方式與各端說明改用 console/viewer/server |
| `docs/agents/TODO.md` | 修改 | 規格與任務清單的 a/b/c 角色改用 console/viewer/server |
| `docs/agents/CALL_GRAPH.md` | 修改 | 模組表、mermaid 圖、呼叫路徑改用 server.main 與 console/viewer |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`.venv\Scripts\python -m pytest tests/ -q`、`node --test tests/test_effects.mjs`
- 結果：通過（Python 12 passed、Node 9 pass / 0 fail）
- `server.main:app` 經 `live_server` fixture 實測可正常啟動（uvicorn 匯入路徑有效）

## Git Commit

- Commit：`a2ed36c` — `refactor: rename a/b/c dirs to console/viewer/server`
