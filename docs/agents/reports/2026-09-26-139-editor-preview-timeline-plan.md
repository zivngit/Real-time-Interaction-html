# 工作完成報告

- **日期**：2026-09-26
- **任務**：規劃特效預覽時間軸（A 方案）——editor 預覽速率滑桿／暫停/繼續／重播
- **Agent**：opencode

## 摘要

依 AGENTS.md SOP 完成「使用者可調整特效時間軸」評估中 A 方案（editor 預覽時間軸）的規劃：檢視現行預覽時間模型（`editor/app.js` `previewTick` 以 wall-clock `nowMs() - preview.born` 傳入 `Effects.stepEffect`、maxStep 50ms catch-up；`preview` 狀態無速率／暫停概念；預覽控制僅 [開始預覽]／[測試特效]／[清屏]／[重設 50/50]）與相關互動（`onCodeSaved` 重啟、切換特效 stop、`refreshPreviewIdle`／ResizeObserver 的 `!preview.running` 守衛、`testEffect` headless 不觸 preview 狀態），並核對正式特效時間推進方式（`effects/*/viewer.js` 全部 `update(dt)` 推進、無內部自時鐘，故 dt 縮放可完整控制速率）。規劃內容：`preview` 擴充 `rate`（0.25–4、step 0.25、預設 1×）／`paused`／`vtime`（每 tick 累積 `dt×rate`）／`lastTick`（取代 `born`）；`previewTick` 改以 `vtime` 驅動 `stepEffect`；暫停＝`stopPreviewLoop`＋保留靜幀、繼續先重錨定 `lastTick` 使暫停時長不計入；重播＝重啟 `previewStart`（保持目前速率）；`previewStop` 重置時間狀態；UI 在 `.preview-box` 與 `.actions` 間加 `.pv-timeline` 行（rate range＋數值顯示＋[暫停/繼續]＋[重播]，未 running disabled）；`window.__rtxEditor` 加時間軸掛鉤（version 7e）。範圍明確不含 B（mini-console 參數可編輯）、C（viewer 全域時間軸）、D（scrub seek）。附 8 項 vm 測試＋1 項 E2E 測試計畫（以 fixture ripple duration 1200ms 為基準）、邊界情境表、文件同步清單（CALL_GRAPH/TODO）、風險（自時鐘插件不受影響、CPU 有界、vtime 浮點誤差無影響、不觸 SSE 斷線不變式）與工時估算（1 子任務 7e、1–2 小時）。規劃寫入 `docs/temp/effect-timeline/PLAN_EFFECT_TIMELINE.md`，並在 TODO.md 標記規劃完成、新增 7e 實作待辦；另修正 TODO.md「已知優先風險」行過期測試計數（Playwright 75→76、`editor.spec.js` 47→48、`test_editor.mjs` 102→105，與 7d 完成後實際結果一致）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `docs/agents/TODO.md` | 修改 | 新增已完成項「特效預覽時間軸（A 方案）規劃」（2026-09-26）與待辦項「7e 實作特效預覽時間軸（A 方案）」；修正「已知優先風險」行測試計數（75/47/102 → 76/48/105） |

> 註：`docs/temp/effect-timeline/PLAN_EFFECT_TIMELINE.md` 位於 `.gitignore` 的 `docs/temp` 中，不納入版本控制，未列入上表。本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：無（純規劃／文件變更，無程式碼異動）
- 結果：不影響既有測試；規劃內容已與現行程式碼逐項核對（`editor/app.js` preview 狀態／`previewTick`／`previewStart`／`previewStop`／`schedulePreviewTick`／`onCodeSaved`／`testEffect`／`__rtxEditor`、`editor/index.html` 預覽面板、`viewer/effects.js` `stepEffect`、`tests/fixtures/ripple/viewer.js` duration 1200、`effects/*/viewer.js` 時間推進方式、`docs/agents/TODO.md`）

## Git Commit

- Commit：`6005b2a` — `docs: TODO 標記特效預覽時間軸 A 方案規劃完成、新增 7e 實作待辦並修正測試計數`

## 後續待辦

- 7e 實作特效預覽時間軸（A 方案）（已加入 TODO.md）：速率滑桿＋暫停/繼續＋重播＋控制狀態同步＋測試掛鉤（version 7e）＋vm 測試 +8／E2E +1＋CALL_GRAPH/TODO 同步
- 候選 7f：B 方案（mini-console 參數可編輯）；C 方案（viewer 全域時間軸）待需求再評估
