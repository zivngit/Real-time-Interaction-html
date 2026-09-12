# 工作完成報告

- **日期**：2026-09-12
- **任務**：effects manifest 多 Console 重載 E2E（不同 server URL / key、selected-effect fallback）與 SPEC / PLAN 文件同步
- **Agent**：opencode

## 摘要

本次依使用者選擇「直接補齊 E2E」，補上 `MC-01` 要求的多 Console 情境：多個不同 Console 端同時連線、使用不同 server URL 與不同 `ACCESS_KEY` 時，各自手動觸發 `POST /api/effects/reload` 並套用 manifest，且互不影響。

新增 `tests/e2e/multi-console-reload.spec.js`：

- 啟動兩個獨立 uvicorn server，分別使用不同 free port、temp manifest 與 `ACCESS_KEY`。
- Console A 使用 `localStorage` 設定 `rtx.srvUrl` / `rtx.srvKey`。
- Console B 使用 `window.CONTROL_CONFIG` 設定 `url` / `key`。
- 以 `effects.particle.label` 區分 server A / B 的初始與重載後 manifest。
- 驗證兩個 Console 各自讀取自己的 `#rtx-srv-url` / `#rtx-srv-key`、初始 effect label、手動重載後 label 更新，且 A 的重載不影響 B、B 的重載不影響 A。
- 重載 manifest 分別移除 `ripple` / `firework`，並驗證原本 selected 的 effect 被移除後 fallback 到第一個可用 effect。

文件同步：

- `README.md`、`docs/agents/CALL_GRAPH.md`、`docs/agents/TODO.md` 更新 Playwright E2E 數量為 11 項。
- `docs/temp/SPEC_EFFECTS_JSON_RELOAD.md` 更新為已確認並完成，修正 `R-04`、`A-03`、`F-06`、Section 10、Section 11、Section 12、Section 13 與 Section 14。
- `docs/temp/PLAN_EFFECTS_JSON_RELOAD.md` 更新多 Console E2E 已完成、temp 報告文件異動表措辭、`server/main.py` 使用 `effects.MANIFEST_REV` 的實作說明，以及 missing `console.js` fingerprint 語意。
- 重新核對 `docs/temp/SPEC_EFFECTS_JSON_RELOAD.md` 第 13 節「修正記錄」與現行實作：功能行為一致；已將 `A-10`、`Q-01`、`MC-01` 的完成狀態措辭更新為與現行 code / tests 一致。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `tests/e2e/multi-console-reload.spec.js` | 新增 | 新增多 Console Playwright E2E，以兩個獨立 uvicorn server、不同 port / temp manifest / `ACCESS_KEY` 驗證不同 server URL / key 的 console 各自手動重載、被移除 effect 的 selected fallback 且互不影響 |
| `README.md` | 修改 | Playwright E2E 數量更新為 11 項，並補充 `tests/e2e/multi-console-reload.spec.js` 的用途說明 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 測試關係圖更新 Playwright E2E 數量為 11，並加入多 Console reload spec 說明 |
| `docs/agents/TODO.md` | 修改 | 新增 effects manifest 多 Console E2E 完成項目，記錄 Playwright E2E 更新為 11 項 |
| `docs/temp/SPEC_EFFECTS_JSON_RELOAD.md` | 修改 | 更新規格狀態為已確認並完成；修正 viewer auto / console manual、auth header 為主 / query fallback、missing console fingerprint、dev auto reload 不採用、多 Console E2E 覆蓋與確認簽核；重新核對第 13 節修正記錄後，更新 `A-10` cache header、`Q-01` temp manifest 覆蓋範圍、`MC-01` selected fallback 的完成狀態措辭 |
| `docs/temp/PLAN_EFFECTS_JSON_RELOAD.md` | 修改 | 更新多 Console E2E 已完成、報告文件異動表措辭、`effects.MANIFEST_REV` 實作說明與 missing `console.js` fingerprint 語意 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`npx playwright test tests/e2e/multi-console-reload.spec.js --reporter=list`
- 結果：1 passed
  - `multiple consoles with different server URL and key reload independently with selected-effect fallback` 通過

- 執行命令：`npm run test`
- 結果：通過
  - Python dependency preflight 通過
  - pytest：41 passed，2 warnings
  - node tests：86 passed
    - `tests/test_console.mjs`：52 passed
    - `tests/test_effect_examples.mjs`：16 passed
    - `tests/test_effects.mjs`：18 passed
  - Playwright E2E：11 passed
    - 包含 `tests/e2e/reload-manifest.spec.js`：viewer auto-updates manifest; consoles require manual reload or refresh
    - 包含 `tests/e2e/multi-console-reload.spec.js`：multiple consoles with different server URL and key reload independently with selected-effect fallback

## Git Commit

- Commit：`daec6341add01ee0151ed5ce799ff04dbab2ea2d` — `feat(effects): 新增 manifest 手動重載與 POST 金鑰 header-only`

## 後續待辦

- pytest 的 2 個第三方 deprecation warnings 仍維持暫不處理（見 `docs/agents/TODO.md`）。
- 待使用者驗收本次多 Console E2E 與文件同步結果。
