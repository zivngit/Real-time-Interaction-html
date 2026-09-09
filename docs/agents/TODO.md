# Real-time Interaction html TODO

## 已確認規格與交付優先順序

- console（控制）選特效＋位置 → server（Python FastAPI 中繼）→ viewer（顯示）以 SSE 即時渲染相對位置
- 通訊：console→server `POST`；server→viewer `SSE /api/stream`（15s 心跳 ping）
- 座標：整個視窗百分比 0–100；特效：particle/ripple/firework/text；`clear` 事件清屏
- viewer 可嵌入：`GET /app.js` 一行嵌入，canvas 疊層 `pointer-events: none` 不影響宿主網頁
- 存取金鑰：`ACCESS_KEY` 環境變數，空白＝全開放；POST 用 `X-Access-Key`、SSE 用 `?key=`

## 已知優先風險

- SSE 斷線期間特效遺失（規格：不重播）
- 限頻為全域滑動視窗（未區分客戶端）
- 前端（console/viewer）無瀏覽器自動化測試；console 有 node vm 冒煙測試（tests/test_console.mjs），viewer 仍無

## 第一階段：建立可維護的執行基礎

- [x] 確認專案規格與通訊方式（docs/temp/PLAN.md）
- [x] 實作 server（Python FastAPI 中繼：/api/effect、/api/clear、/api/stream、/app.js）
- [x] 實作 shared（effects.js、app.js 嵌入腳本）與 console（控制端）、viewer（顯示端預覽頁）
- [x] 依實作結果更新 TODO.md 與 CALL_GRAPH.md

## 第二階段：測試、效能與發布

- [x] 瀏覽器端手動驗收（2026-09-09 完成，結果見 docs/temp/MANUAL_TEST.md；發現之 L30 背景特效凍結、L34 斷線 log 刷屏已修復）
- [x] 修復後續（2026-09-09）：用戶複測仍見舊版行為——舊分頁記憶體中仍是舊 JS；已為 `/app.js`、`/effects.js` 加 `Cache-Control: no-store`、app.js 啟動 log 版本標記 v2，複測須開新分頁並於 F12 確認 v2 log
- [x] 修復後續 2（2026-09-09）：v2 已載入但「持續發送時特效不消失、空閒數秒後才消失」仍在——真因為渲染迴圈附加式繪製（僅 active 空時才 clearRect）造成殘影累積；已重寫 tick 為「移除完成特效 → clearRect → 重繪 active」（v3，每幀清除重繪），harness 假 canvas 建模像素持久並新增 G/G-old 回歸情境；**2026-09-09 用戶複測通過（F12 確認 v3、特效 bug 已修復）**
- [x] console UI：面板改為懸浮按鈕 `#fab`（預設收合，點擊展開/收合，過渡動畫＋aria-expanded；新增 tests/test_console.mjs vm 冒煙測試 7 項）（2026-09-09）
- [x] console UI：長按 `#fab` 拖曳移動位置（限制視窗內、panel 收合/展開皆跟隨；vm 冒煙測試再增 4 項，共 11 項）（2026-09-09）
- [ ] server 斷線重播暫存（最近 N 則）
- [ ] viewer 狀態回報（POST /api/status）
- [ ] 多 viewer 負載／效能測試
