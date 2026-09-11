# 工作完成報告

- **日期**：2026-09-11
- **任務**：server 函式分離重構（`server/main.py` 只保留 API／資源路由）
- **Agent**：opencode

## 摘要

本次重構將 `server/main.py` 原本內嵌的 server helper 拆分到獨立模組，讓 `server/main.py` 只保留 FastAPI `app`、middleware、request schema、API 路由與資源路由。

拆離後模組：

- `server/config.py`：`ACCESS_KEY`、`RATE_LIMIT_PER_SEC`
- `server/security.py`：`check_key()`
- `server/params.py`：`normalize_params()` 與 params schema 驗證 helper
- `server/relay.py`：SSE subscribers、`broadcast()`、`RateLimiter`、`event_stream()`
- `server/static_files.py`：viewer／console／examples／effect asset 的檔案回應與 path traversal 防護

對外 route、`server.main:app`、`ACCESS_KEY`、`RTX_EFFECTS_MANIFEST`、`SERVE_EXAMPLES`、SSE ping／clear／effect 行為維持不變。測試同步改為 patch `server.main.broadcast`、`server.main.rate_limiter.reset()` 與 `server.relay._subscribers`；`normalize_params()` 可接收 effects catalog，以維持 `tests/test_api.py` monkeypatch `server.main.EFFECTS` 的行為。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/config.py` | 新增 | 保存 `ACCESS_KEY` 與 `RATE_LIMIT_PER_SEC` |
| `server/security.py` | 新增 | 實作 `check_key()`，處理空白 key 全開放與 401 invalid access key |
| `server/params.py` | 新增 | 實作 `normalize_params()`、`_to_number()`、`_normalize_value()` 與 color regex |
| `server/relay.py` | 新增 | 實作 SSE subscriber set、`broadcast()`、`RateLimiter`、`event_stream()` |
| `server/static_files.py` | 新增 | 實作 asset path constants、`file_response()`、`effect_asset()`、`examples_enabled()`、`examples_response()` |
| `server/main.py` | 修改 | 移除 inline helpers／state／path constants，只保留 app、middleware、`EffectRequest`、API 與資源路由；route 改呼叫各模組 |
| `tests/test_api.py` | 修改 | 改 patch `m.broadcast`；rate limit reset 改用 `m.rate_limiter.reset()`；SSE subscriber 數量改讀 `server.relay._subscribers` |
| `docs/agents/CALL_GRAPH.md` | 修改 | 更新整體架構、server 路由驗證、sequence、class diagram 與測試關係，反映新 server 模組 |
| `docs/agents/TODO.md` | 修改 | 新增 server 重構完成項目；同步保留先前 pytest warnings 暫不處理的待辦項目 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`.venv\Scripts\python -m pytest tests/ -q`
- 結果：通過，33 passed，2 warnings
- 執行命令：`npm run test`
- 結果：通過
  - Python dependency preflight 通過
  - pytest：33 passed，2 warnings
  - node tests：84 passed
  - Playwright E2E：9 passed

## Git Commit

- Commit：`78b5d9c51a8c702eb48e634544e8e26825ff2ef0` — `refactor: server 函式分離至獨立模組`

## 後續待辦

- pytest 的 2 個第三方 deprecation warnings 仍維持暫不處理（見 `docs/agents/TODO.md`）。
