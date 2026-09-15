# 工作完成報告

- **日期**：2026-09-15
- **任務**：server log 計數文件修正＋`manifest_reloaded` 測試補強
- **Agent**：opencode

## 摘要

用戶指定檢查 3 處（README.md:267、報告 058 line 12、`docs/temp/server-log/PLAN_SERVER_LOG.md` §12 第 7 項），結果：

1. **README.md:267**：「pytest 41 項」過時 → 改為 73 項（test_api 61＋test_server_logging 12）。
2. **報告 058 line 12**：「`test_api.py` 計數（47→73）」計數誤植（同舊表 C-02 問題）→ 改為「47→61；套件合計 73」。連帶修正 `CALL_GRAPH.md` §6 test_api 節點（73→61）。
3. **PLAN §12 第 7 項**：`test_manifest_reloaded_log` 應含「第二次 changed=false 且無 `manifest_broadcast`」，實際測試未斷言 → 採用「加強測試」方案：補 `manifest_broadcast` 計數＝1 之斷言（僅第一次 changed=true 觸發；main.py:96 `if changed:` 才 broadcast）。PLAN 為 gitignored temp 檔，行為描述本就正確，未改動。

附帶發現（未改動）：`docs/temp/server-log/sub_agents/CHECK_SERVER_LOG.md:43` 舊草稿 K-20 仍寫「30 秒 ping」（歷史草稿，現行規格以 SPEC／R2 為準）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `tests/test_api.py` | 修改 | `test_manifest_reloaded_log` 末尾新增斷言：`manifest_broadcast` 記錄數＝1（第二次 changed=false 無 broadcast） |
| `README.md` | 修改 | 測試數量 pytest 41→73 |
| `docs/agents/CALL_GRAPH.md` | 修改 | §6 `test_api.py` 節點計數 73→61 |
| `docs/agents/reports/2026-09-15-058-server-log-integration-055~057.md` | 修改 | line 12 計數（47→73）改為（47→61；套件合計 73） |
| `docs/agents/TODO.md` | 修改 | server log 主項下新增「計數文件修正與測試加強」子項 |

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`
- 結果：73 passed，全數通過（`test_manifest_reloaded_log` 含新斷言通過）
- 無新增 warning（僅既有 2 項第三方 deprecation warnings）
- 無 lint 設定可執行

## Git Commit

- 功能 commit：`bd9885a`（`test(api): manifest_reloaded 測試補 changed=false 無 manifest_broadcast 斷言`）
- 文件 commit：`8b87172`（`docs: 修正 server log 測試計數（README、CALL_GRAPH）並更新 TODO`）
- 本次文件 commit：記錄本報告（060）；報告 058 line 12 計數修正同於此 commit 提交（058 與 060 同一 commit）
