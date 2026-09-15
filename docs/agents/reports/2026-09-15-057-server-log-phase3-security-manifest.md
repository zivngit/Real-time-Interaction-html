# 工作完成報告

- **日期**：2026-09-15
- **任務**：server log Phase 3（安全／manifest／params／assets 事件 log）
- **Agent**：opencode

## 摘要

依 `docs/temp/server-log/PLAN_SERVER_LOG.md` 與 SPEC 確認結論實作 Phase 3 事件 log：

- `server/security.py`：`check_key()` 加 keyword-only `path`／`client` 參數，401 前記 `auth_denied`（WARNING）；不記錄金鑰值。
- `server/effects.py`：`_initialize_catalog` 成功後記 `manifest_loaded`（INFO，rev／version／enabled）；`reload_effects` 成功記 `manifest_reloaded`（INFO，changed true／false 皆記）；既有 2 處 layout warning 改為 `manifest_layout_filtered`（WARNING，加 `zone=current`／`zone=alternate`）；回傳值與鎖行為不變。
- `server/params.py`：`normalize_params` 參數回退預設時記 `params_fallback`（DEBUG，`reason=missing`／`reason=invalid`）；`editable: false` 不記；不記錄任何參數值。
- `server/static_files.py`：`effect_asset` 加 `client` keyword 參數，兩處 404 前記 `asset_missing`（WARNING）；`file_response`／`examples_response` 不改。
- `server/main.py`：4 處 `check_key` 傳入 `path=str(request.url.path)`、`client=client_host(request)`；reload `except ManifestError` 先記 `manifest_reload_failed`（ERROR）再 raise 400；2 個 asset 路由加 `request: Request` 並傳 client。
- `tests/test_api.py`：檔末新增 8 支 caplog 測試（auth_denied 含金鑰不洩漏回歸、manifest_loaded／reloaded／reload_failed／layout_filtered、params_fallback DEBUG／INFO 層級、asset_missing）；既有測試未修改。

未改：`server/logging.py`、`server/config.py`、`server/relay.py`、lifespan、`configure_logging()`、任何 route 回應／狀態碼／header 行為。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/security.py` | 修改 | `check_key` 加 keyword `path`／`client`，401 前記 `auth_denied` |
| `server/effects.py` | 修改 | 新增 `manifest_loaded`／`manifest_reloaded` log；2 處 layout warning 改 `manifest_layout_filtered`（加 zone） |
| `server/params.py` | 修改 | 新增 `params_fallback` DEBUG log（missing／invalid） |
| `server/static_files.py` | 修改 | `effect_asset` 加 `client` 參數＋2 處 404 記 `asset_missing` |
| `server/main.py` | 修改 | 4 處 `check_key` 傳 path／client；reload `ManifestError` 記 ERROR 後 raise；2 個 asset 路由傳 client |
| `tests/test_api.py` | 修改 | 新增 8 支 caplog 測試 |
| `docs/agents/TODO.md` | 修改 | 新增 Phase 3 完成子項 |

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`
- 結果：73 passed（既有 65＋新增 8），全數通過
- `python -B -c "import server.main"` 無例外

## Git Commit

- Commit：`c01ecd90c9903100219685b839245aa7ade22dca` — `feat(server): 新增 auth、manifest、params 與 asset 事件 log`
