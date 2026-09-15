# 工作完成報告

- **日期**：2026-09-15
- **任務**：server log 紀錄規格 Phase 1（logging 基礎）
- **Agent**：agent-1-logging-core

## 摘要

依 `docs/temp/server-log/sub_agents/agent-1-logging-core/PLAN.md` 實作 Phase 1：新增 `server/logging.py`（`configure_logging()`、`client_host()`、`resolve_level()`，handler 只掛 `server` logger、idempotent、不設 `propagate=False`）；`server/config.py` 新增 4 個 env 常數（`RTX_LOG_LEVEL`／`RTX_LOG_FILE`／`RTX_LOG_FILE_MAX_BYTES`／`RTX_LOG_FILE_BACKUP_COUNT`，無效整數 fallback 預設值）；`server/main.py` import 階段先呼叫 `configure_logging()` 再 `import server.effects`（effects import 加 `# noqa: E402`）、新增 module logger 與 lifespan（`server_started`／`server_stopped`）；`server/relay.py` 僅新增 `subscriber_count()`；新增 `tests/test_server_logging.py` 12 支測試。未修改任何 route 簽名／行為、`tests/test_api.py`、`security.py`／`effects.py`／`params.py`／`static_files.py`。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/logging.py` | 新增 | `configure_logging()`（env 預設、idempotent 重建 handler、stdout＋選用 RotatingFileHandler）、`client_host()`（XFF 第一跳優先）、`resolve_level()`（無效層級回落 INFO） |
| `server/config.py` | 修改 | 新增 `LOG_LEVEL`／`LOG_FILE`／`LOG_FILE_MAX_BYTES`／`LOG_FILE_BACKUP_COUNT` 4 個 env 常數（預設 `INFO`／`""`／5242880／3；無效整數 fallback 預設值，config.py:6-19） |
| `server/main.py` | 修改 | import 階段 `configure_logging()`（main.py:13-15）先於 `import server.effects`（main.py:17-18，`# noqa: E402`）；新增 module logger（main.py:33）；lifespan 記 `server_started`／`server_stopped`（main.py:36-46）；`FastAPI(..., lifespan=lifespan)`（main.py:49）；relay import 行加入 `subscriber_count`（main.py:20） |
| `server/relay.py` | 修改 | 僅新增 `subscriber_count() -> int`（relay.py:19-20）；`broadcast()`／`event_stream()`／`RateLimiter` 未改 |
| `tests/test_server_logging.py` | 新增 | 12 支測試：idempotent、預設層級、無效層級 fallback、DEBUG 啟用、ISO 格式、檔案輸出（stdout 保留）、rotation、`client_host` 3 情境、lifespan 啟動／關閉 log、config 預設值 |
| `docs/agents/TODO.md` | 修改 | 「實作 server log 紀錄規格」待辦項下新增 Phase 1 完成子項（TODO.md:75） |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`
- 結果：**59 passed**（既有 47＋新增 12；`tests/test_api.py` 未修改），2 個第三方 deprecation warnings（既有，非本次引入）
- 附加驗證（PLAN §6）：`python -B -c "import server.main"` 無例外，effects 啟動期 log 走正式 handler（ISO 格式）；`import server.main` 後 `logging.getLogger("server").handlers` 長度為 1、`logging.root.handlers` 為空、`server` logger `propagate` 為 True

## Git Commit

- Commit：`88e1c73f239a7c1df4267d71236aebd04174b390` — `feat(server): 新增 server logging 基礎模組（env 層級／檔案設定、client_host、生命週期 log）`

## 後續待辦

- Phase 2（relay 事件 log：broadcast／sse／rate_limited、`tests/test_api.py` caplog 測試）與 Phase 3（security／effects／params／static_files 的 log 與 route `request` 參數接線）屬後續階段
- `docs/agents/CALL_GRAPH.md`、`README.md` 更新屬整合階段
