# 工作完成報告

- **日期**：2026-09-09
- **任務**：修復特效殘影（重寫渲染迴圈，v3）
- **Agent**：opencode

## 摘要

用戶複測確認 v2 已載入，但「console 持續發送時 viewer 特效不消失、空閒數秒後才消失」仍在。診斷出真正根因與前兩輪不同：**渲染迴圈附加式繪製**——`tick()` 只在 `active` 為空時才 `clearRect`，而各特效 `draw` 是直接繪上現有 canvas（不擦舊像素）。因此完成特效的最後一幀永久殘留；console 持續發送時 `active` 永不為空 → 殘影持續累積、永不清除；console 空閒後最後一個特效完成 → `active` 空 → 一次性清空（即用戶看到的「空閒數秒後才消失」）。此 bug 與前後景無關，舊新版皆有，v2 的牆時計時修復無法涵蓋。

**方案評估**（用戶指定評估 div 重寫與其他方案）：

| 方案 | 評估 |
| --- | --- |
| A：canvas 每幀 clearRect 重繪 | 各特效 draw 本就是「以 elapsed 無狀態重繪」，逐幀清除後視覺不變；背景 1Hz 下殘影 ≤1s；改動最小、測試與嵌入規格全保留 → **採用** |
| B：div/DOM＋CSS keyframes | 移除＝移除節點（結構上無像素殘留），但重力/阻力粒子物理需 JS 或近似、90 顆煙火＝90 個 div、draw 與測試全數重寫、視覺改變、多特效併發時合成成本較高 → 不採用 |
| D：Web Animations API | 與 B 同樣需重寫特效代碼，物理 burst 仍需每幀 JS → 相對 A 無優勢 → 不採用 |

實作：`tick()` 重寫為「推進牆時 → 移除完成特效 → clearRect → 重繪全部 active → 排程」，canvas 成為當下狀態的純函數（任何時刻畫面＝目前 active 特效，無累積）。版本標記 v2→v3（F12 可確認）。

**測試盲點修復**：原 harness 假 canvas 以 Proxy 計數、未模擬像素持久，故前兩輪無法捕捉此 bug。已升級假 ctx 建模像素緩衝（`fill/stroke/fillText` 記為已繪像素、`clearRect` 清空），並新增情境 G/G-old：G 驗證新版持續發送時緩衝永遠 ≤ 目前 active 特效像素、切回前景即為 0；G-old 以舊版完整重現殘影（補趕期間緩衝 5→285 無界成長，直到 ≈2.3s 後全部移除才清空）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `shared/app.js` | 修改 | `tick()` 重寫：先移除完成特效、再 `clearRect`、再重繪全部 active（每幀清除重繪，消除殘影累積）；啟動 log 版本標記 v2→v3 |
| `docs/agents/CALL_GRAPH.md` | 修改 | app.js 模組責任與 B3 節點更新為「每 tick 清除重繪」並標記 v3 |
| `docs/agents/TODO.md` | 修改 | 增補「修復後續 2」完成條目（根因＋v3＋複測須見 v3 log） |

## 測試與驗證

- 執行命令：
  - `.venv\Scripts\python -m pytest tests/ -q` → **12 passed**
  - `node --test tests/test_effects.mjs` → **13 passed**
  - `node C:\Users\zairp1\AppData\Local\Temp\opencode\retest.mjs`（harness，抓取 live `/app.js`）→ **ALL CHECKS PASSED（A–G 共 34 項）**
- 關鍵結果：
  - G（新版）：背景持續發送像素緩衝 `[1,4,7,7,7,3,0]`（每幀僅含目前 active 特效）；切回前景 `[0,0,...,0]`（立即乾淨）
  - G-old（舊版）：背景全凍結 `[0,...,0]`；切回後緩衝 `5,10,...,285` 單調無界成長（殘影），`t=7400`（≈2.3s）才歸零＝用戶症狀完整重現
  - 既有 A–F 情境全數維持通過（L30 背景牆時、L34 log、F 持續發送移除時序）
- live 驗證：`GET /app.js` 已回傳 v3 代碼（FileResponse 每請求讀盤，無需重啟 server；`no-store` 頭維持）
- 說明：harness 位於 `C:\Users\zairp1\AppData\Local\Temp\opencode\retest.mjs`（沿用前兩輪慣例，不納入 repo）

## Git Commit

- Commit：`fde2154` — `fix(viewer): 每幀清除重繪渲染迴圈，消除殘影累積（v3）`

## 後續待辦

- 用戶複測：開**新分頁** viewer（F12 確認 `[effects] v3 已載入` log），console 持續發送並切背景/回前景，確認特效即時消失、無殘影；`ERR_CONNECTION_REFUSED` 仍為 server 離線期間瀏覽器 EventSource 自動重連的 network log（L36 規格行為，server 恢復即止，JS 無法抑制）
- 既有未實作項維持：server 斷線重播暫存、viewer 狀態回報、多 viewer 負載測試
