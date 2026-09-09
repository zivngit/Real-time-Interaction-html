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
- 前端（console/viewer）無瀏覽器自動化測試，僅 server 與 effects.js 有測試

## 第一階段：建立可維護的執行基礎

- [x] 確認專案規格與通訊方式（docs/temp/PLAN.md）
- [x] 實作 server（Python FastAPI 中繼：/api/effect、/api/clear、/api/stream、/app.js）
- [x] 實作 shared（effects.js、app.js 嵌入腳本）與 console（控制端）、viewer（顯示端預覽頁）
- [x] 依實作結果更新 TODO.md 與 CALL_GRAPH.md

## 第二階段：測試、效能與發布

- [ ] 瀏覽器端手動驗收（console 發送 → viewer 渲染、嵌入宿主網頁不影響互動）
- [ ] server 斷線重播暫存（最近 N 則）
- [ ] viewer 狀態回報（POST /api/status）
- [ ] 多 viewer 負載／效能測試
