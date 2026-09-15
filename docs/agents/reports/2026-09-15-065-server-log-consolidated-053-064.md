# 工作完成報告

- 日期：2026-09-15
- 任務：server-log 分支統整合併至 master（統整報告 053–064）
- Agent：opencode

## 摘要

本報告將 `server-log` 分支自 `ac92a27`（052）以來的 26 個 commit 統整為單一程式碼 commit（程式碼與文件變更）與單一報告 commit（原 053（紀錄規格規劃）、054（規格資料夾）、055（Phase 1 基礎模組）、056（Phase 2 審計事件）、057（Phase 3 安全與 manifest 事件）、058（三階段整合核對）、059（error 欄位加引號）、060（計數修正與測試補強）、061（預設寫檔 server.log）、062（README log 參數文檔）、063（OS temp 寫檔測試後撤銷）、064（manifest 路徑改顯示檔名）共 12 份工作報告），並以快進方式合併至 `master`（無 merge commit）。原始 26 commit 歷史保留於 `server-log-history` 分支備份；兩 commit 之合併樹與合併前分支端點（`1f928bf`）完全一致。最終功能：

- **logging 基礎**：新 `server/logging.py`（`configure_logging()`／`client_host()`／`resolve_level()`），`server` logger 掛 console StreamHandler＋可選 RotatingFileHandler；`server/config.py` 4 個 env 常數（`RTX_LOG_LEVEL`、`RTX_LOG_FILE` 預設 `server.log`、`RTX_LOG_FILE_MAX_BYTES` 5 MB、`RTX_LOG_FILE_BACKUP_COUNT` 3）；`RTX_LOG_FILE` 設為空＝僅 console。
- **事件 log**：lifespan `server_started`／`server_stopped`；`relay.py` `effect_broadcast`／`clear_broadcast`／`manifest_broadcast`、`sse_connected`／`sse_disconnected`／`sse_ping`、`rate_limited`；`security.py` `auth_denied`；`effects.py` `manifest_loaded`／`manifest_reloaded`／`manifest_layout_filtered`；`main.py` `manifest_reload_failed`（`error` 值加引號）；`params.py` `params_fallback`；`static_files.py` `asset_missing`。
- **安全規則**：log 不含 `ACCESS_KEY` 值與 client 參數值；`client` 欄位 host-only（`client_host()` 優先 `X-Forwarded-For` 第一跳）；`manifest_reload_failed` 訊息與 400 response `detail` 僅含 manifest 檔名、不含完整路徑。
- **文件同步**：README 新增「環境變數」表與「Log 參數設置」章節；CALL_GRAPH 新增 Logging 類別、依賴邊與第 8 節「日誌事件與輸出流」；`.gitignore` 新增 `/server.log*`。

## 文件異動表

| 檔案路徑 | 異動類型 | 異動內容摘要 |
| --- | --- | --- |
| `server/logging.py` | 新增 | `configure_logging()`（`server` logger 層級／格式、console＋RotatingFileHandler）、`client_host()`（XFF 優先、host-only）、`resolve_level()`（無效值回退 INFO） |
| `server/config.py` | 修改 | 新增 `LOG_LEVEL`／`LOG_FILE`／`LOG_FILE_MAX_BYTES`／`LOG_FILE_BACKUP_COUNT` env 常數與 `_int_env()` |
| `server/main.py` | 修改 | import 階段 `configure_logging()`；新增 lifespan（`server_started`／`server_stopped`）；reload／effect／clear／stream 接線 `client_host()` 與 `path`；`manifest_reload_failed` 之 `error` 值加引號 |
| `server/effects.py` | 修改 | 新增 `manifest_loaded`／`manifest_reloaded`（含 `changed`）log、`manifest_layout_filtered` 事件化；`load_manifest` 錯誤訊息改顯示檔名（同步消除 400 `detail` 完整路徑） |
| `server/relay.py` | 修改 | 新增 `subscriber_count()`；`broadcast` effect／clear／manifest log；`event_stream` sse_connected／sse_disconnected／sse_ping（`PING_TIMEOUT` 15s）；`RateLimiter.check` 接受 path／client 並記 `rate_limited` |
| `server/security.py` | 修改 | `check_key` 接受 path／client，失敗記 `auth_denied` |
| `server/params.py` | 修改 | `normalize_params` 補 default／型別修正時記 `params_fallback`（DEBUG） |
| `server/static_files.py` | 修改 | `effect_asset` 接受 client，404 時記 `asset_missing` |
| `tests/test_server_logging.py` | 新增 | 12 項：configure_logging／client_host／resolve_level、env 覆蓋、idempotent、lifespan log、`isolated_log_file` fixture 與 `test_default_file_output` |
| `tests/test_api.py` | 修改 | 新增 caplog 事件 log 斷言（broadcast／SSE／rate_limited／auth_denied／manifest／params_fallback／asset_missing）；`test_manifest_reloaded_log` 補 changed=false 無 `manifest_broadcast`；`test_manifest_reload_failed_log` 斷言 log／detail 只含檔名 |
| `.gitignore` | 修改 | 新增 `/server.log*`（RotatingFileHandler 備份檔 `.1`~`.3`） |
| `README.md` | 修改 | 新增「環境變數」表（7 變數）與「Log 參數設置」章節（輪替行為、父目錄需已存在、Windows／Linux env 設定範例、格式與安全規則）；測試計數 pytest 41→73 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 新增 Logging 類別與依賴邊、test_api 61 項與 test_server_logging 12 項測試節點、第 8 節「日誌事件與輸出流」mermaid 圖 |
| `docs/agents/TODO.md` | 修改 | server log 規格規劃、Phase 1–3、整合核對、R2 再核對、計數修正、預設寫檔、README 文檔、檔名顯示與 server-log 統整合併至 master 各項目標記 [x] |

> 註：本報告檔本身未列入上方表格。原 053–064 共 12 份工作報告（`2026-09-14-053-server-log-spec-plan.md`、`2026-09-14-054-server-log-docs-folder.md`、`2026-09-15-055-server-log-phase1-logging-core.md`、`2026-09-15-056-server-log-phase2-audit-events.md`、`2026-09-15-057-server-log-phase3-security-manifest.md`、`2026-09-15-058-server-log-integration-055~057.md`、`2026-09-15-059-server-log-error-quoting-fix.md`、`2026-09-15-060-server-log-count-fixes-reload-assertion.md`、`2026-09-15-061-server-log-default-file-output.md`、`2026-09-15-062-readme-log-parameter-settings.md`、`2026-09-15-063-test-server-log-temp-output-reverted.md`、`2026-09-15-064-log-message-path-to-filename.md`）依 AGENTS.md「報告檔不得與程式碼混於同一 commit」以單一獨立 docs commit 收錄於 master（見「Git Commit」節），故不列入上方表格。

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`
- 結果：通過；Python 74 項通過

- 執行命令：`node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs`
- 結果：通過；Node 108 項總計通過（effects 18、console 72、examples 16、catalog 2）

- 執行命令：`npx playwright test --reporter=line`
- 結果：通過；Playwright E2E 28 項通過

## Git Commit

- Commit：`6fce5e1ae3e7b597bd65a63e5cd453818b522e96` — `feat(server): server log 基礎模組、審計與 manifest 事件、預設寫檔與訊息修正（統整 053–064）`（`master` 自 `ac92a27` 快進合併至此 commit，無 merge commit）
- Commit：`e9d632a3d363f57cdfaa3adbc74589ce29385fbd` — `docs: 記錄 server log 相關工作報告（053~064）`

## 後續 TODO

- 無；原 26 commit 歷史保留於 `server-log-history` 分支供歷史參考。
