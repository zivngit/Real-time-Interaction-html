# 工作完成報告

- **日期**：2026-09-15
- **任務**：server log 預設寫入檔案
- **Agent**：opencode

## 摘要

將 server log 由「預設僅 console」改為「預設同時寫入檔案」：`server/config.py` 的 `RTX_LOG_FILE` 預設值由空改為 `server.log`，server 啟動即寫入 RotatingFileHandler 檔案 log（5 MB × 3；`RTX_LOG_FILE_MAX_BYTES`／`RTX_LOG_FILE_BACKUP_COUNT` 可調，`RTX_LOG_FILE` 設為空仍可停用檔案輸出、僅 console）。`.gitignore` 新增 `/server.log*` 忽略預設 log 檔與輪替備份檔（`.1`~`.3`）。測試側：新增 autouse `isolated_log_file` fixture（將測試期間預設 log 檔重定向至 `tmp_path`，避免污染工作區）、`test_configure_idempotent` 預設 handlers 斷言 1→2（StreamHandler＋RotatingFileHandler）、新增 `test_default_file_output`、`test_config_defaults` 預設值更新。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/config.py` | 修改 | `LOG_FILE` 預設值 `""`→`"server.log"`（server/config.py:7） |
| `.gitignore` | 修改 | 新增 `/server.log*`（預設 log 檔＋輪替備份檔 `.1`~`.3`） |
| `tests/test_server_logging.py` | 修改 | 新增 `isolated_log_file` autouse fixture；`test_configure_idempotent` handlers 斷言 1→2 並驗 RotatingFileHandler 存在；新增 `test_default_file_output`；`test_config_defaults` `LOG_FILE` 預設值更新 |
| `README.md` | 修改 | 環境變數表 `RTX_LOG_FILE` 預設值（空）→`server.log`、說明改為「設為空＝僅 console」 |
| `docs/agents/CALL_GRAPH.md` | 修改 | §8 日誌輸出說明改為預設 `server.log`（RotatingFileHandler 不再僅選配）、mermaid `File` 節點同步更新 |
| `docs/agents/TODO.md` | 修改 | server log 主項下新增「預設寫入檔案」子項 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`
- 結果：74 passed，全數通過（`test_server_logging.py` 13 支＋`test_api.py` 61 支；含新增 `test_default_file_output`）
- 無新增 warning（僅既有 2 項第三方 deprecation warnings）
- 無 lint 設定可執行

## Git Commit

- 功能 commit：`e56993c`（`feat(server): server log 預設寫入檔案 server.log 並加入 .gitignore`）
- 文件同步 commit：`f448014`（`docs: 更新 server log 預設寫檔之 README、CALL_GRAPH 與 TODO`）
- 本次文件 commit：記錄本報告（061）
