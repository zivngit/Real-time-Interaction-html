# 工作完成報告

- 日期：2026-09-14
- 任務：AGENTS.md 新增 Git commit 慣例章節
- Agent：opencode

## 摘要

依 git 歷史中既有的 commit 慣例，於 AGENTS.md 新增「第 4 節 Git commit 慣例」，內容涵蓋：Conventional Commits 格式 `type(scope): 描述`（中文主旨、不寫 body）、type 與 scope 定義、每項任務「功能 commit＋文件 commit」配對（文件 commit 訊息 `docs: 記錄<任務摘要>工作報告（NNN）`，多份報告以區間表示）、提交順序（先功能 commit、取得 hash 後再寫報告並提交文件 commit）、分支命名（`master` 為主分支、功能分支 kebab-case 英文短名）。同步更新 SOP 第 3.4 步加註引用第 4 節，並於 TODO.md 標記本項完成。

## 文件異動表

| 檔案路徑 | 異動類型 | 異動內容摘要 |
| --- | --- | --- |
| `docs/agents/AGENTS.md` | 修改 | 新增第 4 節「Git commit 慣例」；SOP 3.4「生成具描述性的 Git commit」改為「依第 4 節 Git commit 慣例生成 commit」 |
| `docs/agents/TODO.md` | 修改 | 新增已完成項「AGENTS.md：新增第 4 節 Git commit 慣例」（2026-09-14） |

> 註：本報告檔本身未列入上方表格。

## 測試與驗證

- 執行命令：無（純文件變更，無程式碼異動）
- 結果：不影響既有測試；新增章節所述慣例已與 `git log` 歷史（feat/docs 配對、NNN 區間、分支命名）核對一致

## Git Commit

- Commit：`0a337f044416852ac82071ca3aa73378c203736b` — `docs: AGENTS.md 新增 Git commit 慣例章節`
