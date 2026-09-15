# 工作完成報告

- **日期**：2026-09-15
- **任務**：server log Phase 2（broadcast／SSE／限頻審計 log）
- **Agent**：agent-2-audit-events

## 摘要

依 `docs/temp/server-log/sub_agents/agent-2-audit-events/SPEC.md`／`PLAN.md` 實作 Phase 2 審計事件 log：

- `server/relay.py`：新增模組 `logger` 與 `PING_TIMEOUT = 15` 常數（`event_stream` 空閒 timeout 改用它，間隔維持 15s 不變）；`broadcast()` 於 subscriber 分發後依 type 記 `effect_broadcast`／`clear_broadcast`／`manifest_broadcast`（INFO）；`event_stream()` 簽名加 `client=None` 參數，進入時記 `sse_connected`（INFO）、空閒 ping 分支 yield 前記 `sse_ping`（DEBUG）、finally 內 `remove_subscriber` 後記 `sse_disconnected`（INFO）；`RateLimiter.check` 簽名加 keyword-only `path`／`client` 參數，拒絕時於 429 前記 `rate_limited`（WARNING）。
- `server/main.py`：import `client_host`；`post_effect`／`post_clear`／`reload_manifest` 簽名加 `request: Request`；3 處 limiter `check(...)` 傳 `path=str(request.url.path)`、`client=client_host(request)`；`stream` 傳 `client=client_host(request)` 給 `event_stream`。`check_key` 呼叫、lifespan、`configure_logging()` 行與全部回應行為未改。
- `tests/test_api.py`：新增 6 支 caplog 測試（effect/clear/manifest broadcast、SSE connect/disconnect、SSE ping（monkeypatch `PING_TIMEOUT=0.05`＋DEBUG）、rate_limited（monkeypatch `RATE_LIMIT_PER_SEC=2`））；既有測試未改。

對 PLAN 的偏離（皆為使測試可通過／行為等價之必要調整）：

1. broadcast 測試 regex 由 PLAN 之 `id=\w+` 改為 `id=\S+`：`msg["id"]` 為 uuid4（含連字號），`\w+` 無法匹配致測試必失敗；`rev` 為 sha256 hexdigest，維持 `rev=\w+`。
2. `test_sse_connect_disconnect_log` 改用 PLAN 預留之 fallback：`live_server`＋httpx stream（TestClient stream 在 SSE 長連線 teardown 會掛起，無法取得 `sse_disconnected`）；另加 `_wait_for_log` 輪詢（10s 上限）吸收斷線 log 的短暫異步延遲。
3. ping 測試 break 條件由 PLAN 之 `chunk.startswith(": ping")` 改為 `chunk.startswith("event: ping")`：實際 ping chunk 為 `event: ping\ndata: {...}\n\n`，原條件永不成立會致測試無限迴圈。
4. ping 測試使用檔案既有的 `import server.relay as relay` 別名（PLAN 文字假設檔首為 `server_relay`；同模組、等價）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/relay.py` | 修改 | 新增 `logger`、`PING_TIMEOUT = 15`；`broadcast()` 記 3 種 broadcast 事件；`event_stream()` 加 `client` 參數＋`sse_connected`／`sse_ping`／`sse_disconnected` log、timeout 改 `PING_TIMEOUT`；`RateLimiter.check` 加 `path`／`client` keyword 參數＋拒絕記 `rate_limited` |
| `server/main.py` | 修改 | import `client_host`；`post_effect`／`post_clear`／`reload_manifest` 加 `request: Request` 參數並傳 `path`／`client` 給 limiter `check`；`stream` 傳 `client` 給 `event_stream` |
| `tests/test_api.py` | 修改 | 新增 6 支 caplog 測試（broadcast×3、SSE connect/disconnect、SSE ping、rate_limited）與 `asyncio`／`logging`／`re` imports、`_wait_for_log` helper |
| `docs/agents/TODO.md` | 修改 | 「實作 server log 紀錄規格」下新增 Phase 2 完成子項 |

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`
- 結果：通過——`65 passed`（59 基線＋6 新增），2 warnings（既有第三方 deprecation，未處理項）；`python -B -c "import server.main"` 無例外

## Git Commit

- Commit：`13fe70cca7c4af81d0c4e395dd43bd0087ae83b8` — `feat(server): 新增 broadcast、SSE 連線與限頻審計 log`

## 後續待辦

- 無（本階段範圍已完成；Phase 3 與整合階段依母規劃另行排程）
