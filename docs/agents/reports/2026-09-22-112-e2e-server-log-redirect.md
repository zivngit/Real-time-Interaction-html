# 工作完成報告

- **日期**：2026-09-22
- **任務**：E2E 測試輸出不再混入 server log——webServer（uvicorn）stdout/stderr 重定向至 gitignored `e2e-server.log`
- **Agent**：opencode

## 摘要

用戶評估「測試時是否要輸出 server log」：上次 E2E 錯誤報告 68 KB（69,632 bytes）中 **42%（373/885 行）是 `[WebServer]` 行**——`playwright.config.js` 的 `webServer` 預設 `stdout`/`stderr: "pipe"`，把 uvicorn console（app log＋access log）轉發進測試輸出。

關鍵發現：`server/logging.py` 的 `server` logger 已同時掛 `StreamHandler`（console）＋`RotatingFileHandler`（`server.log`、gitignored）→ app log **已**寫入 `server.log`，console 是重複副本；唯獨 **uvicorn 自身 log（startup/access）＋未捕獲 crash traceback**（走 stderr、uvicorn logger 不 propagate 到 `server` logger）不在 `server.log`。

採用方案（用戶選「方案 A 重定向到檔」）：`webServer.command` 加 shell 重定向 `> e2e-server.log 2>&1`＋`stdout`/`stderr: "ignore"`。

技術要點：Playwright 1.63 的 `webServer` `stdout`/`stderr` **只支援 `"pipe"`/`"ignore"`（不支援 Writable stream）**——先前試傳 `fs.createWriteStream` 被忽略（結果 console 乾淨但 log 檔為 0 bytes）。因 `launchProcess` 用 `spawn(..., shell: true)`（Windows→`cmd.exe /c "<command>"`），改用 shell 層 `>` 重定向成功（`2>&1` 併 stderr、crash traceback 亦入檔）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `playwright.config.js` | 修改 | `webServer.command` 加 `> e2e-server.log 2>&1`（shell 重定向到 CWD 相對檔）、`stdout`/`stderr` 設 `"ignore"`（不再轉發到測試輸出） |
| `.gitignore` | 修改 | 加 `/e2e-server.log` |
| `README.md` | 修改 | E2E 段補「webServer stdout/stderr 重定向至 `e2e-server.log`（測試輸出不再混 server log、失敗可查 app log＋uvicorn access＋crash traceback）」 |
| `docs/agents/CALL_GRAPH.md` | 修改 | TP 節點補「webServer port 8123（stdout/stderr→e2e-server.log、測試輸出乾淨）」 |
| `docs/agents/TODO.md` | 修改 | E2E 項補「webServer stdout/stderr 重定向 gitignored `e2e-server.log`」 |

> 註：本報告檔案本身不列入上表。`e2e-server.log` 為運行產物（gitignored，每次 run 由 shell `>` 截斷重建）。

## 測試與驗證

- 執行命令：`npx playwright test`
- 結果：全綠——E2E 72 passed（redirect 純輸出捕获、server 行為不變）。
- 關鍵驗證：(1) 測試輸出 `[WebServer]` 行 **0**、bytes **66869→12590**（約 5.3× 縮減）；(2) `e2e-server.log` 含完整 app log（`server.effects`/`server.main`/`server.static_files`/`server.relay`）＋uvicorn access log（`GET/POST … 200/404`）＋startup（`Uvicorn running`），全量 run 約 137 KB——crash traceback 亦經 `2>&1` 入此檔；(3) node 194／pytest 156 不受影響（未改程式邏輯、僅 E2E runner 設定）。

## Git Commit

- Commit：`bd2d340` — `chore(e2e): webServer stdout/stderr 重定向至 e2e-server.log（測試輸出不再混入 server log）`

## 後續待辦

- 失敗時可搭配 `e2e-server.log` 定位 server 端問題；如需 E2E 失敗時自動附帶該檔尾部到報告，可再加 reporter／global teardown 處理（本次未做）。
