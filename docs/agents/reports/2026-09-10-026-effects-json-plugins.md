# 工作完成報告

- **日期**：2026-09-10
- **任務**：插件化 effects JSON manifest 與 viewer/console plugins
- **Agent**：opencode

## 摘要

將特效系統改造成 manifest + plugin 架構：`effects/effects.json` 成為特效清單與 params schema 的單一來源；server 依 manifest 驗證並正規化 `POST /api/effect` 的 `params`；viewer 核心改為 registry，具體特效渲染拆至 `effects/<effect_id>/viewer.js`；console 核心改為 schema-driven，並支援可選 `effects/<effect_id>/console.js` 自訂 UI。

本次保留既有 effect IDs：`particle`、`ripple`、`firework`、`text`。其中 `firework` 不提供 `console.js`，用於驗證 console plugin 可選、schema 自動渲染的行為。

規劃文件位於 `docs/temp/PLAN_EFFECTS_JSON.md`（`docs/temp/` 已被 `.gitignore` 忽略，不纳入版本控制）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `effects/effects.json` | 新增 | 中央 manifest：4 個特效、labels、categories、icons、viewer/console 檔案、params schema（type/default/min/max/step/maxLength/editable 等） |
| `effects/particle/viewer.js` | 新增 | particle viewer plugin；註冊 `window.Effects.register("particle", ...)` |
| `effects/particle/console.js` | 新增 | particle console plugin（可選）；註冊 `window.RTX_EFFECT_CONSOLE.register("particle", ...)` |
| `effects/ripple/viewer.js` | 新增 | ripple viewer plugin；註冊 ripple 渲染 |
| `effects/ripple/console.js` | 新增 | ripple console plugin（可選） |
| `effects/firework/viewer.js` | 新增 | firework viewer plugin；註冊 firework 渲染 |
| `effects/text/viewer.js` | 新增 | text viewer plugin；註冊 text 渲染 |
| `effects/text/console.js` | 新增 | text console plugin（可選） |
| `server/effects.py` | 修改 | 改讀 `effects/effects.json`；manifest 解析、驗證、fail-fast；提供 effect catalog 給 server |
| `server/main.py` | 修改 | `GET /api/effects` 回傳 sanitized manifest＋`viewerUrl`／`consoleUrl`；新增 `GET /effects/effects.json`、`GET /effects/{id}/viewer.js`、`GET /effects/{id}/console.js`；`POST /api/effect` 依 schema 驗證／正規化 params；path traversal 防護與 no-store |
| `viewer/effects.js` | 修改 | 移除硬編碼特效實作；改為 Effects registry core（register/createEffect/stepEffect/toPixels/toPercent/clamp） |
| `viewer/app.js` | 修改 | 改依 `/api/effects` 動態載入各 `viewerUrl`；plugin 失敗 log 並跳過該 effect；保留既有嵌入、SSE、ping、reconnect 行為 |
| `console/app.js` | 修改 | 移除硬編碼 `PARAM_DEFS`；改依 manifest params schema 渲染；支援 integer/number/string/color/boolean/select；`editable:false` 不顯示；支援可選 console plugin 與 fallback |
| `tests/test_api.py` | 修改 | 新增 manifest/API、effect asset routes、path traversal、params normalization、optional console URL、既有 key/rate/stream 測試；pytest 由 18 增至 33 |
| `tests/test_effects.mjs` | 修改 | 改測 Effects registry core 與 per-effect viewer plugins；node effects 測試由 13 增至 17 |
| `tests/test_console.mjs` | 修改 | 新增 schema-driven params、editable:false、console plugin load/fallback/override、plugin no-op 等測試；node console 測試由 39 增至 45 |
| `README.md` | 修改 | 更新 effects 架構、`effects/` 目錄、params schema、server API/static routes、測試說明 |
| `docs/agents/TODO.md` | 修改 | 記錄 effects JSON plugin 化完成與相關規格 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 更新 manifest/plugin 架構、server routes、client 載入序列、模組依賴與測試數量 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`node --test tests/test_effects.mjs tests/test_console.mjs`、`python -m pytest tests/ -q`
- 結果：node 62 項通過（effects 17＋console 45）、pytest 33 項通過（2 項 warnings）

## Git Commit

- Commit：`b43bbcfefb974d82a0c90e91a46243a9c96e5fe8` — `feat(effects): 插件化 effects JSON manifest 與 viewer/console plugins`

## 後續待辦

- 請用戶於瀏覽器手動驗證（啟用 examples 後）：
  - `http://localhost:8000/examples/embed-viewer.html`
  - `http://localhost:8000/examples/embed-console.html`
  - `http://localhost:8000/examples/embed-both.html`
- 確認項目：
  - console 列出 particle / ripple / firework / text
  - firework 無 `colors` 輸入項（`editable: false`）
  - particle / ripple / text 的 params 面板依 schema 渲染
  - 點擊各特效後 viewer 正常渲染
  - F12 可見 viewer 載入與 plugin 狀態 log
