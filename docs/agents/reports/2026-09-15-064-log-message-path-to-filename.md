# 工作完成報告

- **日期**: 2026-09-15
- **任務**: log 訊息中 manifest 完整路徑改顯示檔名
- **Agent**: opencode
- **前置狀態**: 063 方案（`f8aa672`）已撤銷（revert commit `a6e1c92`）；063 報告已更名標明撤銷（`2026-09-15-063-test-server-log-temp-output-reverted.md`），不再生效

## 概述

使用者發現 `manifest_reload_failed` log 行揭露機器特定完整路徑（如 pytest tmp 路徑 `pytest-of-…/invalid.json`）。先前「測試 log 改寫 OS temp」方案（063，`f8aa672`）已依要求於 `a6e1c92` 撤銷、不再生效（063 報告已更名並標明撤銷，僅作嘗試記錄）。本次採使用者指定方案：修改程式碼，將訊息中「完整路徑」改為「檔案名稱」。`server/effects.py` 之 `load_manifest` 異常訊息由 `cannot read {MANIFEST_PATH}` 改為 `cannot read {MANIFEST_PATH.name}`；同一訊息經 `server/main.py` 之 `HTTPException(detail=str(exc))` 流入 400 response `detail`，故 log 與 API 回應同時不再外洩完整路徑。`test_manifest_reload_failed_log` 加強斷言：log 與 detail 均含檔名（`invalid.json`）且不含完整路徑。注意：測試跑完仍會於 workspace 產生 gitignored 之 `server.log`（063 撤銷後恢復原行為），本次只解決「訊息揭露路徑」問題。

## 檔案改動表

| 檔案路徑 | 改動類型 | 改動摘要 |
| --- | --- | --- |
| `server/effects.py` | 修改 | `load_manifest` 之 `ManifestError` 訊息 `cannot read {MANIFEST_PATH}` 改為 `cannot read {MANIFEST_PATH.name}`（:149） |
| `tests/test_api.py` | 修改 | `test_manifest_reload_failed_log` 加斷言：log 與 400 `detail` 含檔名、不含完整路徑 |
| `docs/agents/TODO.md` | 修改 | server log 主項新增「log 訊息中 manifest 完整路徑改顯示檔名」子項 |

> 註：本報告檔本身未列入上表；063 報告之更名（`2026-09-15-063-test-server-log-temp-output.md` → `2026-09-15-063-test-server-log-temp-output-reverted.md`）與撤銷標明亦同屬本次文件 commit，未列入上表。

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`
- 結果：74 passed
- 驗證：`manifest_reload_failed` log 行改為 `error="cannot read invalid.json: …"`（僅檔名）；400 response `detail` 同為僅檔名

## Git Commit

- 功能 commit：`8114540`（`fix: log 訊息中 manifest 路徑改顯示檔名並更新 TODO`）
- 本次文件 commit：記錄本報告（064）

## 後續 TODO

（略）
