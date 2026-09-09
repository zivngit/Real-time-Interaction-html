# 工作完成報告

- **日期**：2026-09-09
- **任務**：L30/L34 修復後續——防止瀏覽器載入舊版腳本（no-store＋版本標記）
- **Agent**：opencode

## 摘要

用戶複測回報「bug 未改善」：console 持續發送時 viewer 特效不消失（回前景數秒後才消失）、斷線時反覆出現 `GET .../api/stream net::ERR_CONNECTION_REFUSED`。

診斷：

1. **主因**：用戶所看的 viewer 分頁仍在執行**修復前的舊 JS**（JS 於頁面載入時讀取一次，重啟 server 或更新磁碟檔案不影響已開啟的分頁）。用戶描述的症狀與舊版行為完全吻合：背景分頁 rAF 暫停 → 特效凍結 → 切回前景後靠 dt 補趕、數秒內才消失。
2. **附帶真實漏洞**：server 以 `FileResponse` 提供 `/app.js`、`/effects.js` 時未附 `Cache-Control`，瀏覽器可對嵌入式載入（`http://…/app.js`）做啟發式快取，重載後仍可能拿到舊版。
3. **`ERR_CONNECTION_REFUSED` 說明**：紅色 `GET … net::ERR_CONNECTION_REFUSED` 是**瀏覽器自身的 network log**（EventSource 自動重連嘗試失敗時各記一筆），無法以 JS 抑制，且正是規格要求的自動重連機制；server 恢復後即停止。應用程式自己的 log（黃色 `[effects]`）已修為狀態切換才出現一次。

對應處理：

- `/app.js`、`/effects.js` 回應加 `Cache-Control: no-store`（嵌入式載入永不快取）。
- `shared/app.js` 啟動時 log 版本標記 `[effects] v2 已載入（…）<script src>`，用戶可於 F12 直接確認分頁執行的版本與來源。
- 複測須**關閉舊分頁、開啟新分頁**（或 Ctrl+F5），並確認 F12 出現 v2 log。

驗證：以 vm sandbox 直接執行 server 實際下发的腳本，新增「console 持續發送＋viewer 背景」情境（F/F-old）：新版背景期間即依牆時移除、切回前景時畫布已清；舊版對照組完整復現用戶症狀（切回前景 2.3 秒後才逐個消失）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/main.py` | 修改 | `/app.js`、`/effects.js` 回應加 `Cache-Control: no-store` |
| `shared/app.js` | 修改 | 啟動時 log 版本標記 v2（含 script src） |
| `tests/test_api.py` | 修改 | `test_serves_app_js`/`test_serves_effects_js` 加斷言 `cache-control == "no-store"` |
| `docs/agents/CALL_GRAPH.md` | 修改 | 模組責任表與路由節點補 no-store、版本標記說明 |
| `docs/agents/TODO.md` | 修改 | 補記後續項（no-store＋v2 標記、複測須開新分頁） |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`.venv\Scripts\python -m pytest tests/ -q`
- 結果：12 passed（含新增 no-store header 斷言）
- 執行命令：`node --test tests/test_effects.mjs`
- 結果：13 passed
- 執行命令：`node <temp>/retest.mjs`（vm sandbox 執行 server 实际下发之 app.js/effects.js，情境 A–F）
- 結果：28 項檢查全過；情境 F-old 以舊版代碼完整復現用戶症狀（背景凍結、切回前景後 ≈2.3 秒才消失），情境 F 確認新版背景期間即依牆時移除

## Git Commit

- Commit：`bf3eb96` — `fix: no-store for served scripts, v2 startup log marker`

## 後續待辦

- 用戶於**新分頁**複測 L30（F12 須見 `[effects] v2 已載入`）與 L34（log 一次；紅色 GET 錯誤為瀏覽器 network log，屬自動重連機制）
