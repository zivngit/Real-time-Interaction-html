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
- 前端（console/viewer/editor）已有 Playwright 瀏覽器 E2E（`tests/e2e/`，88 項，含 `editor.spec.js` 60 項；webServer stdout/stderr 重定向 gitignored `e2e-server.log`、測試輸出不混 server log；webServer 以 `RTX_EFFECTS_DIR` 指向 `pre-server-copy.mjs` 複製的隔離 `tmp/e2e-effects/`（僅 fixture 4 特效）、`globalTeardown` 清理，E2E 不碰正式 `effects/`）；console 另有 node vm 冒煙測試（`tests/test_console.mjs`，74 項），viewer 另有 node vm 冒煙測試（`tests/test_effects.mjs`，19 項），特效編輯器另有 node vm 測試（`tests/test_editor.mjs`，132 項）與 pytest API 測試（`tests/test_editor_api.py`，85 項），特效範例另有 node vm 冒煙測試（`tests/test_effect_examples.mjs`，16 項），正式 catalog 另有 node vm 驗證測試（`tests/test_effect_catalog.mjs`，2 項）

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
- [x] effects：manifest 驅動架構（`effects/effects.json` 為唯一清單；`effects/<id>/viewer.js` 註冊 `window.Effects`、選用 `effects/<id>/console.js` 註冊 `window.RTX_EFFECT_CONSOLE`；server 新增 `GET /api/effects` 清洗 schema、`POST /api/effect` 依 schema 驗證 params（無效值回退預設）、靜態路由 `/effects/effects.json`、`/effects/{id}/viewer.js`、`/effects/{id}/console.js`（path traversal 防護、no-store）；viewer/app.js 載入 `/api/effects` 後動態載入各 viewer.js；console/app.js 改 schema 驅動渲染＋選用 console 插件（失敗回退 schema）；tests/test_api.py 33 項、tests/test_effects.mjs 17 項、tests/test_console.mjs 45 項）（2026-09-10）
- [x] effects：新增特效指南與範例（`docs/HOW_TO_ADD_EFFECT.md`；`examples/effects/sample-burst/` 完整範例展示全部 manifest 欄位與 params 型別、`examples/effects/effect-interface/` 最小介面參考；兩者非正式 server manifest；tests/test_effect_examples.mjs 16 項）（2026-09-10）
- [x] console：console 插件 `icon` 支援 raw SVG 字串／icon key 優先解析（優先於 manifest `icon`；raw SVG 按鈕不標記 `generic`；manifest `icon` 仍為 icon key；範例 sample-burst／effect-interface 改為 raw SVG icon 示範；tests/test_console.mjs 再增 4 項，共 49 項）（2026-09-10）
- [x] console：console 插件 icon 改為 `iconID`／`iconSVG` 兩個欄位（解析優先序 plugin `iconSVG` → plugin `iconID` → manifest `icon` → `RTX_EFFECT_ICONS[type]` → `RTX_EFFECT_ICONS.generic` → 內建 fallback icon；有效 `iconSVG`／`iconID` 優先於 manifest `icon` 且不標記 `generic`；舊 `icon` 欄位不再讀取；particle／ripple／text 改用 `iconID`，sample-burst 示範 `iconID`＋`iconSVG` 且 render 改依 `api.fields` 迭代、effect-interface 只示範 `iconSVG` 且 render 建立 `rtx-p-duration`；HOW_TO_ADD_EFFECT.md 第 8 節改寫為 `iconID`／`iconSVG` 並新增 8.1 server params 傳遞說明（`paramsFor()`、`rtx-p-<key>` id、各型別輸入項與送 server 行為）；tests/test_console.mjs 再增 2 項，共 51 項）（2026-09-10）
- [x] effects：自動測試改用 `tests/fixtures/effects.json`（`tests/test_api.py` 以 `RTX_EFFECTS_MANIFEST` 指向測試 manifest；正式 `effects/effects.json` 可加入新特效但不自動進入測試）（2026-09-11）
- [x] browser E2E：Playwright 自動啟動 uvicorn（port 8123、`SERVE_EXAMPLES=1`、`RTX_EFFECTS_MANIFEST=tests/fixtures/effects.json`），驗證 examples smoke、console→server→viewer flow、effect params（9 項）（2026-09-11）
- [x] README：改以專案特色、系統架構、目錄結構、嵌入方式與測試說明為主，減少 AI 協作流程說明；`.gitignore` 補上 `.pytest_cache/`（2026-09-11）
- [x] 測試結構整理：`e2e/` 移至 `tests/e2e/`、`conftest.py` 移至 `tests/conftest.py` 並補 `sys.path`；`playwright.config.js` 改為 `testDir: "./tests/e2e"`；`package.json test:unit` 加 Python dependency preflight（2026-09-11）
- [x] server 重構：`server/main.py` 只保留 app／middleware／API 與資源路由；`config`、`security`、`params`、`relay`、`static_files` 拆離為獨立模組；`normalize_params` 接受 effects catalog；`tests/test_api.py` 改 patch `main.broadcast` 與 `relay._subscribers`（2026-09-11）
- [x] effects manifest 手動重載：`POST /api/effects/reload` 以 `X-Access-Key`／`?key=` 驗證、獨立 1/s 限頻、thread-safe 重讀 manifest 並依 manifest＋`viewer.js`／`console.js` fingerprint `rev` 更新 catalog；驗證失敗保留舊 catalog 並回 `400`；`GET /api/effects` 回傳 `rev`；viewer 於 SSE `open`／`manifest` 依 `rev` 自動重載插件且不清除 active effects；console 新增 `#rtx-reload-btn` 手動重載（重新整理亦可）；tests/test_api.py 41 項、node 86 項、Playwright E2E 10 項（2026-09-12）
- [x] effects manifest 多 Console E2E：新增 `tests/e2e/multi-console-reload.spec.js`，以兩個獨立 uvicorn server、不同 port／manifest／`ACCESS_KEY`，驗證不同 server URL / key 的多 Console 端各自手動重載、被移除 effect 的 selected fallback 且互不影響；Playwright E2E 更新為 11 項（2026-09-12）
- [x] 重新核對 effects manifest reload 實作與 SPEC 第 13 節修正記錄：功能行為一致；更新 `A-10` cache header、`Q-01` temp manifest 覆蓋範圍、`MC-01` selected fallback 的完成狀態措辭（2026-09-12）
- [x] POST 存取金鑰改為 header-only：`POST /api/effects/reload`、`POST /api/effect`、`POST /api/clear` 移除 `?key=` query fallback，僅接受 `X-Access-Key` header；SSE `GET /api/stream` 維持 `?key=`（2026-09-12）
- [x] console［重載］改為 SVG 圖示並移入［連線設定］下拉面板；更新 console vm 測試與 Playwright reload E2E（2026-09-12）
- [x] console 特效按鈕布局改為 4 欄固定 grid；更新 console vm 測試與 Playwright layout E2E（2026-09-12）
- [x] console 特效按鈕 1/8/20/50 可點擊測試：新增 node vm 測試與 Playwright E2E；`#rtx-fx-buttons` 增加 `max-height: 180px` 與 `overflow-y: auto`，確保 50 個特效按鈕可滾動並逐一點擊（2026-09-12）
- [x] console 特效按鈕滑動條樣式：`#rtx-fx-buttons` 增加 themed scrollbar（`scrollbar-width`／`scrollbar-color` 與 WebKit scrollbar pseudo-elements），並更新 console vm 測試（2026-09-12）
- [x] examples 淺色／深色主題切換：新增 `examples/theme.css`、`examples/theme.js`，四個 example HTML 加入右上角主題切換、`localStorage` 記憶與系統偏好 fallback；更新 API 測試、Playwright E2E、README 與 CALL_GRAPH（2026-09-12）
- [x] effects catalog 自動檢測與正式特效擴充：新增 `tests/test_effect_catalog.mjs` 動態驗證正式 `effects/effects.json`、`effects/<id>/viewer.js`、選用 `console.js`、manifest/plugin 一致性、param schema、viewer smoke run、console render 與 icon/source warnings；納入 `chrono-vortex`、`pixel-melt`、`hyper-warp`、`aurora`、`fire-dragon`、`orbital-strike`、`magic-circle` 7 個正式特效；修正 `slash`／`tear-slash` 的 viewer defaults；`package.json test:unit` 納入新測試（2026-09-13）
- [x] effects catalog 測試訊息中文化：將 `tests/test_effect_catalog.mjs` 的 warning、error message 與測試標題改為中文顯示，測試邏輯維持不變（2026-09-13）
- [x] effects manifest v2 與 console 雙區特效布局：server `GET /api/effects` 回傳 `version`、`currentEffects`、`alternateEffects`；`effects/effects.json` 升級 v2；個別特效可設定 `enabled`，停用時不進入 API catalog、不被 viewer 載入、不被 `POST /api/effect` 接受；console 將原 `#rtx-fx-buttons` 改為 `#rtx-fx-current` 與 `#rtx-fx-alternate`，新增 `#rtx-fx-layout-btn` 展開/收合次要區塊，支援拖曳與 `window.__rtxConsoleLayout.move` 移動特效並寫入 `rtx.fx.layout.v2`；console 測試涵蓋 move hook、dragover/drop 拖曳布局與移入次要區再移回主要區；`.rtx-fx-zone` 增加 `min-height: 52px`，確保空區域仍可作為拖曳目標；`#rtx-fx-alternate.open` 增加 dashed border、background 與圓角，使次要區可被明確區分；新增 `tests/fixtures/effects-v2.json` 與 `tests/e2e/fx-layout.spec.js`，Playwright E2E 亦涵蓋 browser drag 往返、空次要區拖曳並更新為 22 項（2026-09-13）
- [x] manifest v2 disabled-in-layout 改為過濾與警告：`server/effects.py` 的 `_normalize_manifest_layout` 遇 `currentEffects`／`alternateEffects` 中的 disabled ID 時於正規化過濾並記 `logger.warning`（不視為驗證錯誤）；正式 `effects/effects.json`（`magic-circle` 同時在 `currentEffects` 且 `enabled: false`）現可正常啟動並被排除於 layout 外；`tests/test_effect_catalog.mjs` 對應情境改為 warn 並新增「disabled effect 在 layout 陣列時給 warn（正規化後排除），不視為錯誤」測試；`tests/test_api.py` 新增 `test_reload_v2_filters_disabled_effect_from_layout` 回歸測試，並在 `test_sse_manifest_broadcast_on_reload` 補 SSE `manifest` event 含 `currentEffects`／`alternateEffects` 的結構斷言（pytest 47 項、Node 99 項）（2026-09-13）
- [x] console 特效按鈕移動流暢動畫：`console/app.js` 於 `renderFxZone` 重建與 `dragover` 即時移動時播放 FLIP 動畫（`fxCaptureRects`／`fxPlayMove`／`fxNextFrame`，180ms transform transition、`__fxMoveSeq` 序列號防舊 frame 誤清、`transitionend` 與 timeout 雙重清理），`prefers-reduced-motion: reduce` 時自動停用；`tests/test_console.mjs` harness 新增確定性 `getBoundingClientRect`（子元素 index × 60px）與 `matchMedia` stub，並新增 move hook FLIP、dragover 重排動畫、reduced motion 跳過 3 項測試（共 66 項）；`tests/e2e/fx-layout.spec.js` 補 move 後同步讀取 `style.transform` 非空斷言，並新增真實瀏覽器相鄰按鈕動畫驗證（move 移入主區使同區按鈕順移、drag 移出主區使剩餘按鈕順移，皆於同一 evaluate 同步讀取 Invert 階段 transform），Playwright E2E 更新為 23 項（2026-09-13）
- [x] console 特效按鈕改為 pointer 拖曳：移除原生 HTML5 drag-and-drop，改以 `.rtx-fx` `pointerdown`＋`window` `pointermove`／`pointerup`／`pointercancel` 實作；`DRAG_SLOP_PX` 8px 避免點擊誤觸發拖曳；拖曳中套用 `.rtx-fx.dragging`、`zIndex: 30`、`pointerEvents: none` 與 `translate() scale(1.08)`；`pointerup`／`pointercancel` 以 `syncLayoutFromDom(preRects)` 同步布局、寫入 `rtx.fx.layout.v2`、重建按鈕並播放 FLIP 動畫，且以 `fxClickSuppressed` 抑制下一次 click；`.rtx-fx` 增加 `cursor: grab` 與 `touch-action: none`；`tests/test_console.mjs` 改用 pointer helper 並新增 pointer reorder、slop、click suppression、pointercancel 測試（共 69 項）；`tests/e2e/fx-layout.spec.js` 改用 Playwright mouse pointer drag 驗證同區重排、移入次要區再移回、空次要區接受拖曳，Playwright E2E 維持 23 項（2026-09-13）
- [x] console 特效按鈕 pointer 拖曳插入改為 grid-aware row-major：修復拖曳時與其他按鈕高度重疊、放開後回到重疊按鈕旁邊的問題；原因是舊 `fxInsertionRef()` 以 `document.elementFromPoint()`／`.closest(".rtx-fx")` 判斷 hovered button 並無條件插入其前，當拖曳按鈕已在 hovered button 之前時 DOM 順序不變、相鄰按鈕未順移；新增 `fxLayoutRect()`／`fxStoreLayoutRects()` 與 `__fxLayoutRect` 暫存 layout rect，`fxInsertionRef()` 改以 4 欄 grid 的 row-major 位置決定插入點（同欄以 pointer x 與 non-dragged button center 比較、行末後插入下一行、空欄不跨行跳動），`fxPlayMove()`／`fxFollowCursor()` 在讀取 layout rect 前先暫時移除 FLIP transform；`tests/test_console.mjs` 假 `getBoundingClientRect` 改為 4 欄 grid 並新增 row-major 插入與空欄不跨行 2 項測試（共 71 項）；`tests/e2e/fx-layout.spec.js` 新增 pointer drag 置於 hovered button 右半側時插入其後的 E2E 驗證，Playwright E2E 更新為 24 項（2026-09-13）
- [x] console 特效按鈕 pointer 拖曳插入修復 stale layout rects：針對垂直方向拖曳時 row boundary 因 `__fxLayoutRect` 未即時刷新而偏移的問題，新增 `fxMeasureLayoutRect()` 在讀取 rect 前暫時移除 `transform` 再還原；`fxStoreLayoutRects()` 改用該安全量測，`fxFollowCursor()` 於套用 drag transform 前先刷新 `__fxLayoutRect`，pointermove 激活後與 `fxReorderTo()` 插入 DOM 後皆呼叫 `fxStoreLayoutRects()`，確保 row-major 插入使用目前 layout 位置；`tests/e2e/helpers.js` 的 `ensurePanelOpen()` 等待 `#rtx-panel` transform 完成，避免 panel open transition 污染 drag 起始幾何；`tests/e2e/fx-layout.spec.js` 新增從上方／下方接近 target row 的 2 項 pointer drag regression tests，Playwright E2E 更新為 26 項（2026-09-13）
- [x] console 特效按鈕 pointer 拖曳觸發距離統一：同區 pointer 拖曳時 `fxInsertionRef()` 改以 pointer 到 non-dragged button center 的最小距離判斷，在 `FX_DRAG_TRIGGER_PX`（30px）內才依該按鈕決定插入 before／after（pointer x 與該按鈕 center 比較、`nextAfter` 取 row-major 順序）且僅在結果順序與目前 layout 不同時回傳 reorder ref；超出範圍回傳「維持目前位置」ref，`fxReorderTo()` 改以完整目前順序 vs target 順序比較，相等時跳過 `insertBefore` 與 FLIP；跨區拖曳維持原 row-major 插入；將 `tests/e2e/fx-drag-trigger-distance.tmp.spec.js` 轉為正式 `tests/e2e/fx-drag-trigger-distance.spec.js`，以 8 方向驗證真實觸發距離皆約 30px、無 overshoot 且結果 order 符合預期，Playwright E2E 更新為 27 項（2026-09-14）
- [x] console 特效按鈕在次要區關閉時禁止移動：`#rtx-fx-alternate` 未 `.open` 時 `.rtx-fx` 的 `pointerdown` 不啟動拖曳（不 `preventDefault`、不設 `fxDrag`，click 選擇維持有效），`#rtx-fx-layout` 初始並同步攜帶 `fx-locked` class，CSS `#rtx-fx-layout.fx-locked .rtx-fx { cursor: pointer; }` 顯示不可抓握；layout 按鈕 toggle 時同步 `fx-locked`；既有 drag 測試（console vm 8 項、`fx-layout.spec.js` 3 項、`fx-drag-trigger-distance.spec.js` 1 項）改先開啟次要區再拖曳；新增「次要區關閉時拖曳停用、click 仍可選、開啟後拖曳恢復」的 vm 與 e2e 測試；console vm 測試更新為 72 項、Playwright E2E 更新為 28 項（2026-09-14）
- [x] AGENTS.md：新增第 4 節 Git commit 慣例（Conventional Commits 中文主旨、type/scope、功能＋文件雙 commit 配對、提交順序、分支 kebab-case 命名），SOP 3.4 加註引用（2026-09-14）
- [x] server log 紀錄規格規劃：評估現行 server log 現況，規劃統一格式／層級策略／事件目錄、env 設定（`RTX_LOG_LEVEL`／`RTX_LOG_FILE`）與安全規則；規劃、規格確認清單、完成核對確認清單於 `docs/temp/server-log/`（PLAN／SPEC／CHECK；2026-09-14）
- [x] 實作 server log 紀錄規格（依 `docs/temp/server-log/PLAN_SERVER_LOG.md`＋SPEC 確認結論：新 `server/logging.py`、事件 log 接線、caplog 測試；完成後依 `CHECK_SERVER_LOG.md` 核對）
  - [x] server log Phase 1（logging 基礎）：`server/logging.py`（`configure_logging()`／`client_host()`／`resolve_level()`）、config 4 個 env 常數、`main.py` import 階段 `configure_logging()`＋lifespan 生命週期 log（`server_started`／`server_stopped`）、`relay.py` `subscriber_count()`、`tests/test_server_logging.py` 12 項（2026-09-15）
  - [x] server log Phase 2（broadcast／SSE／限頻審計 log）：relay 事件 log、SSE connect/disconnect/ping、rate_limited、test_api caplog 測試（2026-09-15）
  - [x] server log Phase 3（安全／manifest／params／assets 事件 log）：auth_denied、manifest_loaded/reloaded/reload_failed/layout_filtered、params_fallback、asset_missing、test_api caplog 測試（2026-09-15）
  - [x] server log 整合核對：`CHECK_SERVER_LOG.md` K-01~K-43 以 file:line 證據回填、`CALL_GRAPH.md` 更新（logging 模組依賴＋日誌事件流）、`README.md` 環境變數表（log 4 變數）、pytest 73 項通過（2026-09-15）
  - [x] server log 獨立再核對（R2）與落差修正：不依賴舊表、以 SPEC 原編號逐項重核 74 項（`CHECK_SERVER_LOG_R2.md`）；修正 SPEC E-12「30 秒 ping」文字為 15 秒、`manifest_reload_failed` 之 `error` 值加引號（`server/main.py`）、舊表 C-02 計數修正為 test_api.py 61 支（2026-09-15）
  - [x] server log 計數文件修正與測試加強：README pytest 41→73、CALL_GRAPH test_api 節點 73→61、報告 058 計數（47→61）修正；`test_manifest_reloaded_log` 補 changed=false 無 `manifest_broadcast` 斷言（2026-09-15）
- [x] server log 預設寫入檔案：`RTX_LOG_FILE` 預設值由（空）改為 `server.log`（RotatingFileHandler 5 MB × 3；env 設為空＝僅 console）、`.gitignore` 新增 `/server.log*`；`tests/test_server_logging.py` 新增 `isolated_log_file` fixture、預設 handlers 斷言 1→2、新增 `test_default_file_output`，pytest 74 項通過（2026-09-15）
- [x] README 新增 log 參數設置文檔：新設「Log 參數設置」章節（4 個 `RTX_LOG_*` 參數說明、輪替行為、父目錄需已存在、Windows／Linux env 設定範例、格式與安全規則）；原「環境變數」節下 log 單行說明併入新章節（2026-09-15）
- [x] log 訊息中 manifest 完整路徑改顯示檔名：`server/effects.py` 之 `load_manifest` 錯誤訊息 `cannot read <完整路徑>` 改為 `cannot read <檔名>`（同步消除 400 response `detail` 之完整路徑）；`test_manifest_reload_failed_log` 加斷言 log／detail 只含檔名、不含完整路徑；pytest 74 項通過（2026-09-15）
- [x] server-log 分支統整合併至 master：26 個原始 commit 收錄為單一程式碼 commit（統整 053–064）與單一報告 commit、原歷史保留於 `server-log-history` 分支備份、`master` 快進合併（2026-09-15）
- [x] AGENTS.md：Git commit 慣例 type 清單新增 `report`（工作報告）類型，並註明自 2026-09-15 該次改動的 commit 生效、不溯及先前 commit；提交配對改為報告 commit 僅提交工作報告、訊息改用 `report:` 格式（2026-09-15）
- [x] effects 編輯器規劃：評估現行手動維護流程（手改 `effects/effects.json`＋插件檔），規劃瀏覽器端特效編輯器（manifest／params schema／layout 編輯、插件程式碼編輯、即時預覽、server 驗證與原子寫檔）；規劃於 `docs/temp/effects-editor/`（2026-09-16）
- [x] effects-tag 功能評估：現階段不引入 manifest 層 tag（需 schema v3 及與 `enabled` 優先序／layout 兩區互動等語義決定）；`feat/new-effects` 已達 42 特效（41 active、全在主區）使批次操作需求明確，多特效同時啟用/禁用改由 effects 編輯器批次操作（多選→批次翻轉 `enabled`／同區移動／改 category，無 schema 變更）覆蓋；編輯器規劃已補批次操作項，tag 設計順延至編輯器落地後重評（2026-09-16）
- [ ] 處理 pytest 的 2 個第三方 deprecation warnings：評估加入 `httpx2` 並限制 `anyio>=4.10,<4.15`（已用 temp dependencies 驗證可消除 warnings；2026-09-11 暫不處理）
- [ ] server 斷線重播暫存（最近 N 則）
- [ ] viewer 狀態回報（POST /api/status）
- [ ] 多 viewer 負載／效能測試（含 server SSE 背壓：訂閱者無界 `asyncio.Queue` 改有界＋drop-oldest 或超額斷線——`server/main.py:155`、`server/relay.py:30`；慢/卡住客戶端之 queue 現會無限累積 broadcast 訊息）
- [x] 實作 effects 編輯器（依 PLAN_EFFECTS_EDITOR.md：`server/editor.py` API、`editor/` 三欄 UI、即時預覽、批次操作、自動測試）（2026-09-20）
  - [x] 子任務 5a–6o（2026-09-20~23，39 項）：編輯器 UI 與功能改進／修正（effects.json 單項檢視、匯入匯出、staged、備份、格式檢查、即時預覽、新增特效 re-key、原子保存、列表就地更新、待刪除區、effect_id 欄位、dirty 指標、E2E 隔離、測試源改 fixtures 等）；逐項見 git 歷史
  - 各 Phase／子任務的逐項實作、測試與文件異動，詳見 git 歷史。
- [x] 預覽結果區固定高度＋滑動條：`.test-result` 高 96px＋overflow-y auto，多行結果不壓縮 canvas（純 CSS、2026-09-23）
- [x] 簡化 console 面板收尾：[重載] 清除 icon＋render、2 按鈕圓形仿 console、參數橫式布局對齊 console、FAB 限縮至 canvas 內（純 editor 前端、2026-09-23）
- [x] 簡化 console 面板邊界＋生成點標記修正：面板 clamp 至 canvas 內＋canvas 大小變化自動重 clamp（ResizeObserver）、十字標記反縮放繪製不隨 canvas 拉伸變形（純 editor 前端、2026-09-23）
- [x] 簡化 console 參數可編輯輸入＋預覽參數同步（7l）：無 console.js 插件特效的參數面板改為真實可編輯 input/select、參數未存變更同步進 manifest（version 7k→7l、純 editor 前端、2026-09-27）
- [x] 兩段式變更指示器＋[新增特效] 清空簡化 console（7m）：欄位編輯→「未暫存變更」、[暫存]→「未保存變更」、[保存至伺服器]→「已同步」；[新增特效] 為 staged 操作且只清空簡化 console（version 7l→7m、純 editor 前端、2026-09-27）
- [x] 未暫存變更 切換特效／[新增特效]／匯入先 confirm（7n）：4 個會靜默丟棄未暫存變更的動作先彈 confirm、取消即中止（version 7m→7n、純 editor 前端、2026-09-28）
- [x] topbar 連線 badge 過渡態＋SSE 斷流不轉紅：初始「連線中…」、icon/badge 跟隨 manifest 連線、SSE 斷流由 state.streamOk 獨立追蹤（version 6n→6o、純 editor 前端、2026-09-23）
- [x] 次要一致性小點收尾（6p）：tabs-hint 中性佔位、移除多選提示、v1 區頭「已啟用/未啟用」、「已選 N 項」中文化、zone head 自動換行、batch-bar space-evenly（version 6o→6p、純 editor 前端、2026-09-23）
- [x] 匯入匯出修正（6q）：單項 [匯出 effects.json] 補 currentEffects/alternateEffects 成完整 v2 迷你 manifest；單項 [匯入 effects.json] 強制恰好 1 特效（version 6p→6q、純 editor 前端、2026-09-23）
- [x] 空檔＋匯入格式檢查（6u）：僅 viewer.js 須非空（空→400）、console.js 可空＝無 console 插件；匯入 .js 後自動跑格式檢查（version 6t→6u、2026-09-23）
- [x] 程式碼語法高亮（6v）：底層 pre token 上色＋行號＋Tab 縮排＋scroll 同步、表層 textarea 透明、is-readonly 淡色（version 6u→6v、純 editor 前端、2026-09-23）
- [x] 結果區合併（6w）：移除 code 面板 #ed-warnings、所有狀態/結果訊息併顯示於預覽面板結果區 #ed-ops-result（version 6v→6w、純 editor 前端、2026-09-23）
- [x] 復原待刪衝突訊息＋PUT 檔案內容上限（6x）：復原遇重複 id 改顯示錯誤並保留待刪項（不再靜默 no-op）、檔案內容超 1MB 回 413 fail-fast（version 6w→6x、2026-09-23）
- [x] 預覽前危險 API 靜態預警（6y）：插件碼於當前頁 realm 執行、預覽/測試前引用 localStorage/cookie/fetch 等者顯示非阻斷「預覽預警」（version 6x→6y、純 editor 前端、2026-09-23）
- [x] 語法高亮 scroll 同步改 transform（6z）：修自訂 scrollbar 寬度 clamp 造成錯位、底層 code/gutter 以平移跟隨（version 6y→6z、純 editor 前端、2026-09-25）
- [x] 批次列計數常顯示＋操作結果訊息中文化（7b）：#ed-batch-count 未選取亦顯示「已選 0 項」、英文結果訊息全改中文（version 6z→7b、純 editor 前端、2026-09-25）
- [x] 拖曳把柄限 grip（7c）：僅 ⋮⋮ grip 可拖曳、setDragImage 顯示整條項目（version 7b→7c、純 editor 前端、2026-09-25）
- [x] #ed-dirty 四態指標＋[保存至伺服器] confirm（7d）：加第四態「未暫存變更」（unstaged、紅）、優先序 saving>unstaged>dirty>clean、[保存至伺服器] 一律 confirm（version 7c→7d、純 editor 前端、2026-09-25）
- [x] 特效預覽時間軸（A 方案）規劃與實作：速率滑桿 0.25×–4×、暫停/繼續、重播、vtime 累積時間模型（規劃於 `docs/temp/effect-timeline/`、2026-09-26）
  - [x] 7e 實作預覽時間軸：速率滑桿＋暫停/繼續＋重播＋控制狀態同步＋window.__rtxEditor 掛鉤（version 7e、2026-09-26）
  - [x] 7f 預覽時間軸 UX 修正：速率滑桿常可調、[重播]「已預覽且為目前選定」即啟用（重用已載入插件、不重請求 .js）、控制列合併單一 .actions 列（version 7e→7f、2026-09-26）
  - [x] 7g 預覽播放期間不顯示生成點十字標記：marker 僅 idle 顯示、停止/清屏後重現（version 7f→7g、2026-09-26）
  - [x] 7h 預覽控制改影片撥放器式圖示：重播/暫停/清屏 icon 按鈕、icons.js 新增 play/pause/replay/end（version 7g→7h、2026-09-26）
  - [x] 7i [清屏] 圖示改 >|（end）＋訊息精簡＋啟用邏輯統一於 [重播][暫停]（version 7h→7i、2026-09-26）
- [x] params 卡 type 為 color 時 default 用原生顏色選取器（7j）：color→input type=color（非法值→#000000）、其他型別為文字；v1 唯讀、v2 可編輯（version 7i→7j、純 editor 前端、2026-09-27）
- [x] params 卡 type 為 array 時 default 用可編輯子項列＋[+ item] 按鈕（7k）：每個 default 值一行＋✕ 刪行、[+ item] 加空行、值依 items.type 轉回（version 7j→7k、純 editor 前端、2026-09-27）
- [x] examples 索引頁加入 effects 編輯器連結：`examples/index.html` 示範頁清單下新增指向 `/editor` 的連結（簡述編輯器功能、註明不需 `SERVE_EXAMPLES`）；`tests/test_api.py` `test_examples_enabled_when_serve_examples_set` 補 `href="/editor"` 斷言、`tests/e2e/examples-smoke.spec.js` 索引測試補 `/editor` 連結可見斷言（2026-09-20）
- [x] effects-editor 分支統整合併至 master：169 個原始 commit 收錄為單一 feat commit（統整 067–149）＋單一 docs commit＋2 份報告 commit（067~149、150），原歷史保留於 `effects-editor-plan` 分支備份、`master` 快進合併（2026-09-28）
- [ ] 重評 effects-tag 設計（effects 編輯器落地後：多特效同時啟用/禁用、場景組、與 category 之關係；編輯器已移除 category 編輯欄位（5v，修正 B1 靜默丟資料），重評須決定 category/tag 資料模型；`feat/new-effects` 已達 42 特效為規模依據）
- [ ] effects 編輯器後續小項：`POST /api/editor/import` 缺 `file` 欄位回 422 先於 401（FastAPI body 驗證先於 auth）；「zip 清目錄後匯入回補」情境建議人工瀏覽器確認（2026-09-20 Phase 4 核對提出；原「发送到 viewer 後 viewer 渲染」情境隨 [发送到 viewer] 按鈕移除而作廢）
- [x] 前端記憶體治理 Phase 1（viewer，S1）：插件 script 節點以 `data-rtx-effect` 標記、重載前移除舊節點，防 `document.head` 累積（2026-09-29）
- [x] 前端記憶體治理 Phase 1（console，S1）：插件 script 節點以 `data-rtx-effect` 標記、手動重載前移除舊節點，防 `document.head` 累積（2026-09-29）
- [x] 前端記憶體治理 Phase 3（viewer＋server，S4）：manifest 每個特效加 `viewerRev`／`consoleRev`（插件檔 SHA-256）、主體與插件靜態資產 `no-store`→`no-cache`＋`ETag`、`If-None-Match` 未變回 304、viewer 以 `?v=viewerRev` per-effect cache-busting（2026-09-29）
- [x] 前端記憶體治理 Phase 3（console，S4 剩餘）：console 插件改以 per-effect `consoleRev` 做 cache-busting（`?v=consoleRev`、缺時 fallback manifest rev），未變插件 ETag 304 重驗證（2026-09-29）
- [x] 前端記憶體治理 Phase 1（editor，S1）：preview/console 插件 script 節點以 `data-rtx-effect`／`data-rtx-rev` 標記、注入前移除已完成舊節點（container-scoped prune、in-flight 保留）、cache-busting 改 per-effect `viewerRev`／`consoleRev`（缺時 fallback manifest rev）（2026-09-30）
- [ ] 前端記憶體治理後續（依 `docs/temp/frontend-memory/FRONTEND_MEMORY_PLAN.md`）：Phase 2（S2＋S3）、Phase 3（S5 可觀測性）（2026-09-30）
