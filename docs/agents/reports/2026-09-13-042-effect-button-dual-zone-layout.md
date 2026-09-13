# 工作完成報告

- **日期**：2026-09-13
- **任務**：effects manifest v2 與 console 特效按鈕雙區布局
- **Agent**：opencode

## 摘要

本次將正式 effects manifest 升級到 version 2，讓 server 可回傳 `currentEffects` 與 `alternateEffects`，並支援個別特效以 `enabled: false` 停用。console 原本的單一 `#rtx-fx-buttons` 容器改為 `#rtx-fx-current` 與 `#rtx-fx-alternate` 雙區塊，新增 `#rtx-fx-layout-btn` 開關次要區塊，並支援拖曳、`window.__rtxConsoleLayout.move()` 與 `localStorage` 個人布局記憶。

server 端維持 fail-fast 驗證，確保 v2 layout 不存在、未知、重複、停用或跨區重複的 effect ID。console 端以個人布局優先，其次採用 server 正規化 layout，最後落回 version 1／fallback 的全 current 布局；manifest reload 後會移除未知、停用或重複 ID。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/effects.py` | 修改 | 新增 manifest v1／v2 驗證、`enabled` 過濾、`currentEffects`／`alternateEffects` 正規化、停用特效 viewer 檔跳過與 reload 驗證 |
| `server/main.py` | 修改 | `GET /api/effects` 回傳 `version`、`currentEffects`、`alternateEffects`；reload SSE 同步攜帶 layout；`POST /api/effect` 只接受 enabled effects |
| `effects/effects.json` | 修改 | 正式 manifest 升級為 `version: 2`，15 個既有特效全部放入 `currentEffects`，`alternateEffects` 為空 |
| `console/app.js` | 修改 | 新增雙區特效布局、`rtx.fx.layout.v2` 個人布局、layout 正規化、拖曳與 `window.__rtxConsoleLayout.move()`、reload 後 selected effect fallback |
| `console/icons.js` | 修改 | 新增特效布局按鈕 SVG icon |
| `console/style.css` | 修改 | 將舊 `#rtx-fx-buttons` 樣式改為 `.rtx-fx-zone` 雙區樣式，增加 `min-height: 52px` 確保空區域仍可拖曳，並以 dashed border、background 與圓角明確區分次要區，並支援次要區塊展開／收合 |
| `tests/test_api.py` | 修改 | 新增 v2 API、enabled 過濾、layout 正規化、v1／v2 invalid reload 與 disabled effect POST 測試 |
| `tests/test_console.mjs` | 修改 | 新增雙區 DOM、layout 開關、localStorage 優先序、fx drag、fx drag 往返、move hook、reload fallback 與 CSS selector 測試 |
| `tests/test_effect_catalog.mjs` | 修改 | 正式 catalog 測試納入 version 2、`currentEffects`／`alternateEffects` 與 `enabled` 行為驗證 |
| `tests/fixtures/effects-v2.json` | 新增 | 提供 v2 manifest fixture，涵蓋 current／alternate layout 與 enabled 行為 |
| `tests/e2e/fx-layout.spec.js` | 新增 | 新增 browser E2E 驗證 v2 雙區、layout 正規化、localStorage 持久化、move hook、browser drag 往返、空次要區拖曳、次要區視覺區分與 reload fallback |
| `tests/e2e/helpers.js` | 修改 | E2E 輔助函數改為以 `#rtx-fx-current` 為主查詢範圍，並在需要時展開 `#rtx-fx-alternate` |
| `tests/e2e/fx-button-counts.spec.js` | 修改 | 多數量特效按鈕點擊測試改為 current 區計數，並清理 `rtx.fx.layout.v2` 避免個人布局影響 |
| `tests/e2e/examples-smoke.spec.js` | 修改 | examples smoke 改為驗證 current／alternate 雙區、layout 按鈕與 grid display |
| `README.md` | 修改 | 補充 v2 manifest、enabled 行為、API 回傳欄位、console 雙區布局與測試 fixture 說明 |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | 補充 v2 manifest 欄位、`enabled` 規則、新增特效時加入 layout 陣列與 catalog 測試範圍 |
| `docs/agents/TODO.md` | 修改 | 更新測試數量，並新增本次 v2 manifest 與 console 雙區布局完成項目 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 更新 `GET /api/effects` 回傳、localStorage layout、console 雙區 DOM、layout 方法與測試關係 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`npm run test:unit`
- 結果：通過；pytest 46 項通過、2 個 warning，Node 測試 98 項通過、0 項失敗。

- 執行命令：`npm run test:e2e`
- 結果：通過；Playwright chromium 22 項通過、0 項失敗。

## Git Commit

- Commit：`9363276` — `feat(effects): 支援 manifest v2 與 console 雙區特效布局`
