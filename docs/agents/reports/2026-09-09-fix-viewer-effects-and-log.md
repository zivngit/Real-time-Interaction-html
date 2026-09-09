# 工作完成報告

- **日期**：2026-09-09
- **任務**：修復手動測試發現的 L30（背景分頁特效凍結不消失）與 L34（斷線 log 無限刷屏）
- **Agent**：opencode

## 摘要

用戶手動測試（docs/temp/MANUAL_TEST.md）發現兩項問題：

1. **L30 特效不消失**：console 持續發送時，viewer 位於背景分頁，特效看起來「不會消失」，直到回到 viewer 分頁才快速結束。
   - 根因：背景分頁的 `requestAnimationFrame` 被瀏覽器暫停/節流；舊 tick 以 `dt = min(50, now - last)` 累積特效內部時間，節流下特效時間遠慢於實際時間 → 凍結。
   - 修復：每個特效改記 `born`（`performance.now()` 牆時）與 `elapsed`；tick 以 `Effects.stepEffect(effect, now - born)` 推進，內部以 ≤50ms substep 補幀（物理不爆炸、生命週期貼齊牆時）。另加 `setInterval(100ms)` 作為背景分頁的備援驅動（rAF 在 hidden 分頁不觸發，節流後定時器仍會跑），前景仍由 rAF 提供平滑幀率。tick 為牆時冪等（重複呼叫不重複推進），雙驅動安全。
2. **L34 斷線 log 刷屏**：EventSource 斷線後每次自動重試都觸發 `error` 事件 → `[effects] 串流斷線，重連中…` 無限刷。
   - 修復：加 `connected` 狀態旗標，僅在「連線↔斷線」狀態切換時各 log 一次；`readyState === CLOSED`（永久關閉）改 log「串流已關閉」。45 秒 ping 逾時警告原本每 5 秒刷一次，亦改為逾時只 log 一次、收到 ping 後重置。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `shared/effects.js` | 修改 | 新增 `stepEffect(effect, targetElapsed, maxStep=50)` 牆時推進函式（substep ≤50ms、冪等、初始化 `elapsed`）並加入 UMD 匯出 |
| `shared/app.js` | 修改 | tick 改以 `born`/`stepEffect` 牆時計時（移除 `dt` cap 的 `last`）；rAF＋setInterval(100ms) 雙驅動；EventSource 僅狀態切換 log；ping 逾時 log 一次 |
| `tests/test_effects.mjs` | 修改 | 新增 4 個 `stepEffect` 測試（推進至目標、冪等、大跨距補幀模擬背景節流、particle 牆時完成） |
| `docs/agents/CALL_GRAPH.md` | 修改 | 模組表與前端 mermaid 圖同步雙驅動、`stepEffect`、狀態切換 log |
| `docs/agents/TODO.md` | 修改 | 「瀏覽器端手動驗收」標記完成（含兩項修復註記） |

> 註：`docs/temp/MANUAL_TEST.md` 在 .gitignore 中，不納入版本控制；L30/L34 條目已就地標註「已修復」。本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`node --test tests/test_effects.mjs`、`.venv\Scripts\python -m pytest tests/ -q`
- 結果：通過（Node 13 pass / 0 fail，含 4 個新增 `stepEffect` 測試；Python 12 passed）
- 開發期間測試抓出一個真實 bug：`stepEffect` 對未初始化 `elapsed` 的效果做 `+=` 得到 `NaN` → 已改為先初始化 `elapsed = 0`
- 背景節流情境以 Node 模擬驗證：16ms 前景幀後單次 5000ms 跨距補幀，特效準時 `done()`（測試 11、12）
- 瀏覽器端複測方式：重載 viewer 分頁（server 每次請求即讀取 `shared/app.js`，無需重啟），console 持續發送時切到背景分頁，特效仍按各自 duration 消失；斷線僅 log 一次

## Git Commit

- Commit：`99c59ea` — `fix: viewer effects wall-clock timing, log only on connection state change`
