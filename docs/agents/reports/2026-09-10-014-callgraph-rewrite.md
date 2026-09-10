# 工作完成報告

- **日期**：2026-09-10
- **任務**：依新規則重寫函式呼叫關係圖（CALL_GRAPH.md）
- **Agent**：opencode

## 摘要

依 AGENTS.md 新規則「mermaid 圖型依內容性質評估選擇，不得一律 flowchart」重寫 `docs/agents/CALL_GRAPH.md`，並移除標題下之「（圖型不固定：…）」註記行。各節圖型選擇：整體架構＝flowchart、server 路由與請求驗證＝flowchart、即時互動序列＝sequenceDiagram、viewer 特效渲染生命週期＝stateDiagram-v2、模組依賴與主要呼叫路徑＝classDiagram、測試關係＝flowchart。圖中函式名、路由、參數與閾值（20/s rate limit、15s ping、8px drag slop、50ms 子步、45s ping 逾時）皆已逐一核對 `server/main.py`、`shared/app.js`、`shared/effects.js`、`console/app.js` 原始碼；並補入既有圖遺漏之 `tests/test_console.mjs → console/app.js` 測試關係。事後依回饋重排第 2 節 server 路由圖：節點依管線階層（進入點 → 驗證 → 廣播/串流）分層、同階層以 subgraph 分組、併合共用之 `_check_key`／`_rate_limit` 節點、`generate` 回邊改為自環，減少關係線交錯。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `docs/agents/CALL_GRAPH.md` | 改寫 | 移除「圖型不固定」註記；7 節重寫（flowchart×3、sequenceDiagram、stateDiagram-v2、classDiagram、未接線節點表）；補 test_console.mjs 測試關係；更新測試執行命令含 console 測試；事後以 subgraph 分層＋併合共用驗證節點重排 server 路由圖 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：純文件改動，無程式碼異動
- 結果：N/A（無程式碼異動；node 24 passed＋pytest 12 passed 基線不受影響）

## Git Commit

- Commit：`46cfdab` — `docs: 依新規則重寫函式呼叫關係圖（依內容選擇 mermaid 圖型）`（已 amend 納入 server 路由圖布局修訂）

## 後續待辦

- （無）
