# 工作完成報告

- **日期**：2026-09-15
- **任務**：AGENTS.md Git commit 慣例新增 `report` 類型與更新提交配對
- **Agent**：opencode

## 摘要

依用戶指示，於 `AGENTS.md` 第 4 節「Git commit 慣例」：(1) type 清單加入新類型 `report`（工作報告），並註明生效對象為具體改動——自 2026-09-15「AGENTS.md Git commit 慣例 type 清單新增 report」改動的 commit 生效，該改動前的 commit 不溯及；(2) 提交配對改為「先功能後報告」，功能 commit 包含所有非報告文件變更，報告 commit 僅提交工作報告且訊息格式改用 `report: 記錄<任務摘要>工作報告（NNN）`；同步於 `TODO.md` 記錄本項完成。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `docs/agents/AGENTS.md` | 修改 | 第 4 節 type 清單加入 `report`（工作報告）及生效說明；提交配對改為先功能後報告、報告 commit 訊息格式改用 `report:` |
| `docs/agents/TODO.md` | 修改 | 新增完成項：AGENTS.md commit 慣例新增 `report` 類型與提交配對更新（2026-09-15） |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`git diff`（文件改動核對）
- 結果：通過（僅文件變更，無程式碼變動，不影響既有測試）

## Git Commit

- Commit：`cecf64b` — `docs: AGENTS.md commit 慣例新增 report 類型並更新提交配對`
