# 工作完成報告

- **日期**：2026-09-12
- **任務**：effects manifest 手動重載（`POST /api/effects/reload`、`rev`、viewer 自動更新、console 手動重載）
- **Agent**：opencode

## 摘要

本次新增 effects manifest 手動重載機制，讓 `effects/effects.json` 與特效插件變更後，不必重啟 server 即可更新 catalog。

主要行為：

- `POST /api/effects/reload`：
  - 支援 `X-Access-Key` header 與 `?key=` query 兩種金鑰方式。
  - 使用獨立 `reload_limiter`，限制為 1 request/s。
  - 以 thread-safe 方式重新讀取 manifest、驗證 schema，並計算 manifest 與 `viewer.js`／`console.js` 內容的 fingerprint `rev`。
  - fingerprint 未變時回傳 `changed: false`；驗證失敗時保留舊 catalog 並回傳 `400`。
  - 成功變更時廣播 SSE `manifest` event，回傳 `ok`、`changed`、`rev` 與 effect id 清單。
- `GET /api/effects`：
  - 回傳 `rev` 與清洗後 `effects`。
- viewer：
  - 初始載入、SSE `open` 與 SSE `manifest` 皆會依 `rev` 重新載入 `/effects/{id}/viewer.js`。
  - 插件 URL 附加 `?v=<rev>` 作為 cache-busting。
  - manifest 更新時不清除目前進行中的 active effects。
- console：
  - 新增 `#rtx-reload-btn`［重載］按鈕。
  - 點擊後呼叫 `POST /api/effects/reload`，再重新讀取 `GET /api/effects` 並套用 manifest 與 console 插件。
  - console 不使用 SSE 自動重載；重新整理頁面亦會取得最新 `rev`。

非目標：

- 未實作 dev auto reload、background polling、file watcher、`watchfiles`、`watchdog` 或以 `uvicorn --reload` 作為重載機制。
- 未實作核心腳本（`viewer/app.js`、`viewer/effects.js`、`console/app.js`、CSS、HTML、examples）熱重載。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `docs/temp/PLAN_EFFECTS_JSON_RELOAD.md` | 新增 | 記錄 manifest 手動重載的規劃、非目標與驗收重點 |
| `docs/temp/SPEC_EFFECTS_JSON_RELOAD.md` | 新增 | 記錄 manifest 手動重載的規格確認表 |
| `server/effects.py` | 修改 | 新增 `MANIFEST_REV`、catalog lock、fingerprint、`_load_catalog()`、`_apply_catalog()`、`_initialize_catalog()` 與 `reload_effects()`；重載時 in-place 更新 `MANIFEST` 與 `EFFECTS` |
| `server/main.py` | 修改 | `GET /api/effects` 回傳 `rev`；新增 `reload_limiter` 與 `POST /api/effects/reload`；重載成功變更時廣播 SSE `manifest` event |
| `viewer/effects.js` | 修改 | 新增 `Effects.reset()`，清空 registry 但保留 `Effects.registry` 物件 identity |
| `viewer/app.js` | 修改 | 新增 `currentRev` 與 `loadViewerPlugins(effects, rev)`；SSE `open`／`manifest` 依 `rev` 更新 viewer 插件，且不清除 active effects |
| `console/app.js` | 修改 | 新增 `#rtx-reload-btn`、`currentRev`、`loadConsolePlugins(meta, rev)`、`applyManifest(meta, rev, resetRegistry)` 與 `reloadEffectsTable()`；手動重載後重新套用 manifest 與 console 插件 |
| `console/style.css` | 修改 | 新增 `#rtx-reload-btn` 最小樣式 |
| `tests/test_api.py` | 修改 | 新增 manifest reload API、SSE `manifest`、no-change、rate limit 與 temp manifest 相關測試 |
| `tests/test_effects.mjs` | 修改 | 新增 `Effects.reset clears registry but keeps registry identity` 測試 |
| `tests/test_console.mjs` | 修改 | 新增 `#rtx-reload-btn` 與手動重載後套用 changed manifest 的測試 |
| `tests/e2e/reload-manifest.spec.js` | 新增 | 新增 isolated-server Playwright E2E，驗證 viewer 自動更新 manifest，以及 console 需手動重載或重新整理 |
| `README.md` | 修改 | 更新專案特色、架構圖、目錄說明、viewer／console 嵌入說明、特效插件重載說明、API 表格與測試說明 |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | 新增 manifest 或插件變更後手動重載的說明，並更新完成驗證命令與手動驗收流程 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 更新整體架構、server 路由驗證、sequence、class diagram 與測試關係，反映 `POST /api/effects/reload`、`rev`、SSE `manifest`、viewer 自動更新與 console 手動重載 |
| `docs/agents/TODO.md` | 修改 | 新增 manifest 手動重載完成項目；更新 Playwright E2E 與 node vm 測試數量 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`npm run test`
- 結果：通過
  - Python dependency preflight 通過
  - pytest：41 passed，2 warnings
  - node tests：86 passed
    - `tests/test_console.mjs`：52 passed
    - `tests/test_effect_examples.mjs`：16 passed
    - `tests/test_effects.mjs`：18 passed
  - Playwright E2E：10 passed
    - 包含 `tests/e2e/reload-manifest.spec.js`：viewer auto-updates manifest; consoles require manual reload or refresh

## Git Commit

- Commit：`daec6341add01ee0151ed5ce799ff04dbab2ea2d` — `feat(effects): 新增 manifest 手動重載與 POST 金鑰 header-only`

## 後續待辦

- pytest 的 2 個第三方 deprecation warnings 仍維持暫不處理（見 `docs/agents/TODO.md`）。
