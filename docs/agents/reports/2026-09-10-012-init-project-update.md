# 工作完成報告

- **日期**：2026-09-10
- **任務**：依 init-project skill 更新本專案 agents 規則（模板合併）
- **Agent**：opencode

## 摘要

依 `init-project` skill 流程，將模板與本專案 `docs/agents` 現況比對後以**合併策略**更新規則（絕不覆蓋既有內容）：

- **AGENTS.md**（2 處較舊，合併模板字句）：
  1. `CALL_GRAPH.md` 用途描述改為「記錄系統架構、模組依賴與呼叫／互動關係；mermaid 圖型（flowchart、class diagram、sequence diagram 等）由 Agent 依內容評估選擇，不固定」。
  2. 報告檔名慣例改為 `YYYY-MM-DD-NNN-<任務摘要>.md`；NNN 為 3 位數零填充序列號，依 `reports/` 既有報告總數 + 1 累計連編（不重複使用、不含 `REPORT_TEMPLATE.md`）。
- **CALL_GRAPH.md**：標題下補「圖型不固定」說明（保留既有標題與全部內容）。
- **.gitignore**：逐行追加模板中缺少之 `.env`、`.env.*`（原有規則不改寫）。

比對後無異動項目：

| 項目 | 結果 |
| --- | --- |
| `reports/REPORT_TEMPLATE.md` | 與模板完全一致，不改 |
| `TODO.md` | 含專案實際任務清單，保留 |
| `CALL_GRAPH.md` 本體 | 含專案實際架構，保留 |
| `README.md` | 已含「Agent 工作週期 (SOP)」與「文件維護原則」章節，不改 |
| `docs/temp/` | 已存在，不改 |
| git 倉庫 | 已存在，不執行 `git init` |

本報告即為套用新 NNN 連編慣例之第一份（既有 11 份報告 → `012`）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `docs/agents/AGENTS.md` | 修改 | 合併模板：CALL_GRAPH 用途（圖型不固定）＋報告 NNN 連編命名慣例 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 標題下補「圖型不固定」說明 |
| `.gitignore` | 修改 | 追加 `.env`、`.env.*` |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：純文件／規則更新，無程式碼異動；未變更任何可執行檔案（`node --check`、pytest 基線不受影響：node 24＋pytest 12 於前次變更已全綠）
- 結果：N/A（無程式碼異動）

## Git Commit

- Commit：`f08cc1a` — `docs: 依 init-project 模板更新 agents 規則（NNN 報告連編、圖型不固定、.env 忽略）`

## 後續待辦

- （無）
