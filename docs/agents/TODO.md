# Real-time Interaction html TODO

## 已確認規格與交付優先順序

- console（控制）選特效＋位置 → server（Python FastAPI 中繼）→ viewer（顯示）以 SSE 即時渲染相對位置
- 通訊：console→server `POST`；server→viewer `SSE /api/stream`（15s 心跳 ping）
- 座標：整個視窗百分比 0–100；特效：particle/ripple/firework/text；`clear` 事件清屏
- viewer 可嵌入：`GET /viewer/app.js` 一行嵌入，canvas 疊層 `pointer-events: none` 不影響宿主網頁
- 存取金鑰：`ACCESS_KEY` 環境變數，空白＝全開放；POST 用 `X-Access-Key`、SSE 用 `?key=`

## 已知優先風險

- SSE 斷線期間特效遺失（規格：不重播）
- 限頻為全域滑動視窗（未區分客戶端）
- 前端（console/viewer）無瀏覽器自動化測試；console 有 node vm 冒煙測試（tests/test_console.mjs，39 項），viewer 仍無

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
- [x] console UI：拖曳改為按住即啟動（移除 350ms 等待）、panel 跟隨後亦 clamp 於視窗內（含水平）（2026-09-09）
- [x] console UI：特效分組（爆散／漣漪／文字）＋［參數］按鍵（依目前特效展開參數輸入）＋［連線設定］按鍵（收合 srvUrl/srvKey 至展開面板；vm 冒煙測試再增 4 項，共 15 項）（2026-09-10）
- [x] console UI：統一圓形圖示按鈕（方形→圓形、文字→SVG 圖示、懸停顯示名稱；特效按鈕 52px 主視覺，［參數］／［連線設定］／［清屏］縮小 34px 次要，聚焦特效按鈕）（2026-09-10）
- [x] console：server 特效表動態建立按鈕（`GET /api/effects`；未知特效使用通用樣式與參數；載入失敗時 fallback 至內建特效；vm 測試擴充至 34 項）（2026-09-10）
- [x] console：可嵌入其他網頁（self-contained、scoped style、unique IDs、double-load guard；server 新增 `GET /console.js`；支援 `window.CONTROL_CONFIG`／script origin／`data-key`／localStorage 設定優先序）（2026-09-10）
- [x] console UI：FAB 永遠在面板上層；面板跟隨 FAB 並以 below/above/left/right 候選位置避免重疊（除非視窗太小；vm 測試再增 3 項，共 37 項）（2026-09-10）
- [x] console/server/viewer：分離 JS/CSS；console 樣式抽至 `console/style.css`、viewer 樣式抽至 `viewer/style.css`；特效實作移至 `viewer/effects.js`；server 特效列表抽至 `server/effects.py`（2026-09-10）
- [x] console：SVG icons 抽至 `console/icons.js`（server 新增 `GET /icons.js`；console 嵌入需先載入 `/icons.js`）（2026-09-10）
- [x] console：剩餘 UI SVG 亦移入 `console/icons.js`（以 `RTX_EFFECT_ICONS`／`RTX_UI_ICONS` 區分特效與 console UI icons）（2026-09-10）
- [x] examples：opt-in 嵌入示範頁（`examples/` 四頁；server 新增 `GET /examples`、`/examples/`、`/examples/{path:path}`，預設 404，`SERVE_EXAMPLES=1` 啟用；tests/test_api.py 新增 2 項）（2026-09-10）
- [x] examples 改為 demo／showcase 頁：移除 standalone 展示頁 `console/index.html`、`viewer/index.html`；`shared/app.js` 移至 `viewer/app.js`（server `/app.js` 改 serve `viewer/app.js`，`shared/` 目錄移除；`examples/index.html` 不再連結 standalone 頁）（2026-09-10）
- [x] viewer：移除無頁面引用的 `viewer/style.css`（standalone viewer 頁與 examples 嵌入頁皆不再使用）（2026-09-10）
- [x] server API：embed asset routes 改名為 namespaced paths（`/viewer/app.js`、`/viewer/effects.js`、`/console/app.js`、`/console/icons.js`、`/console/style.css`；舊根路徑 asset routes 回 404）；429 回應加 `Retry-After: 1`，SSE 不再手動發送 `Connection: keep-alive`（2026-09-10）
- [ ] server 斷線重播暫存（最近 N 則）
- [ ] viewer 狀態回報（POST /api/status）
- [ ] 多 viewer 負載／效能測試
