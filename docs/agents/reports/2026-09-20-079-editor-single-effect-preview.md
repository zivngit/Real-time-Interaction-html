# 工作完成報告

- **日期**：2026-09-20
- **任務**：effects 編輯器子任務 5b — effects.json tab 單個 effect 檢視＋預覽選定座標
- **Agent**：opencode（effects 編輯器專案 implementer）

## 摘要

依 `docs/temp/effects-editor/sub_agents/sub_agent_5/task_5b/PLAN.md` 完成使用者回報 2 項修正（CHECK.md 項 4、7）：

1. **[effects.json] tab 改顯示單個 effect**（CHECK 項 4）：`renderManifestView()` 由顯示整個 manifest raw JSON 改為顯示**選定 effect** 在 manifest 中的完整 entry（label/category/icon/enabled/viewer/console/params，`JSON.stringify(spec, null, 2)` pretty、唯讀）；未選定特效時顯示「請先選擇特效」；選定變更（`selectItem` 新增 `activeTab() === 'manifest'` 同步）與 manifest 重抓（`loadManifest` 既有同步路徑）皆更新 tab 內容；tab 名稱維持 `effects.json`（`data-tab="manifest"` 不變）。新增 `selectedEffectEntry()`（回傳選定 effect 的 spec 物件或 null）與 `effectEntryJson(id)`（回傳單項 pretty JSON 字串或 null）供 5c 匯出單個 effect 的 effects.json 複用。
2. **預覽選定座標**（CHECK 項 7）：預覽 canvas 點擊設定選定座標 0–100 percent（`onPreviewClick` 寫入 `preview.pos = {x, y}`，預設 50/50，取代 3b 的 `preview.lastClick`），`#ed-preview-hint` 顯示 `<label>（選定）· x=…, y=…`（`renderPreviewLabel` 更新）；`previewStart` 的 `createEffect` 改用選定座標 percent→canvas px 換算（`Math.round(pos/100 * canvas.width|height)`，不再固定 400/225）；`previewSend` 的 `POST /api/effect` 亦用同一選定座標。**預覽中改變座標→下次開始預覽生效**（採用簡單一致方案；send 則永遠用最新選定座標）。canvas cursor 維持 crosshair（既有 CSS）。`window.__rtxEditor` version `'3b'`→`'5b'`，新增 `selectedEffectEntry`／`effectEntryJson` 匯出。

最終 tab 名稱：`effects.json`（維持不變）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `preview.lastClick`→`preview.pos {x:50,y:50}`；`renderManifestView()` 改顯示選定 effect 單項 entry（未選定「請先選擇特效」）；新增 `selectedEffectEntry()`／`effectEntryJson(id)`；`selectItem` 於 manifest tab 激活時同步 `renderManifestView()`；`previewStart` createEffect 改用選定座標 percent→px；`previewSend` 改用 `preview.pos`；`onPreviewClick` 寫 `preview.pos` 並刷新 hint；`renderPreviewLabel` hint 加 `x=…, y=…`；version `'5b'`＋2 個新匯出（2150 行） |
| `editor/index.html` | 修改 | 預覽 canvas `title` 改「點按設定選定座標（預設 50/50）；開始預覽與发送到 viewer 皆用此座標」（165 行） |
| `tests/test_editor.mjs` | 修改 | 34→40 項：新增 5b 6 項（manifest tab 單項 entry＋唯讀、未選定提示、選定變更同步、previewStart 選定座標 percent→px＋hint、previewSend 選定座標、預覽中改座標下次生效）；既有「3a tabs」manifest tab 斷言改單項、hint 斷言加座標、`lastClick`→`pos`（1586 行） |
| `tests/e2e/editor.spec.js` | 修改 | 22→24 項：新增 5b describe 2 項（effects.json tab 顯示選定特效單項 entry 非整個 manifest＋選定變更同步、canvas 點擊設座標→hint 顯示→createEffect 座標符合＋send 用選定座標）；2c v1 測試 manifest tab 斷言由整份 raw 改為單項 entry（983 行） |
| `docs/agents/TODO.md` | 修改 | 新增「子任務 5b」進度子項（effects.json tab 單項檢視＋預覽選定座標、測試計數）（104 行） |
| `docs/agents/CALL_GRAPH.md` | 修改 | EDP 節點加 5b 說明；`EditorPage` class 加 `selectedEffectEntry()`／`effectEntryJson(id)`；TEX 節點 34→40＋5b 描述；TP 節點 editor.spec.js 22→24、E2E 總數 47→51＋5b 描述；「未完成或未接線節點」editor/ 行加 5b（505 行） |

> 註：本報告檔案本身不列入上表。`editor/style.css` 無需修改（cursor: crosshair 既有）。

## 測試與驗證

- 執行命令：`node --test tests/test_editor.mjs`
- 結果：通過（40 項全綠）
- 執行命令：`npx playwright test tests/e2e/editor.spec.js`
- 結果：通過（24 項全綠；E2E 全量計數 51 項中 editor.spec.js 佔 24）
- `git status` 乾淨（本任務無 server 寫入；E2E 寫入類測試由既有 `beforeAll`/`afterEach` snapshot/restore 還原 fixture，無殘留）

## Git Commit

- Commit：`8fd102d` — `feat(editor): 單個 effect JSON 檢視與預覽選定座標`

## 給 5c 的交接

- **effects.json tab 單項函式**（5c「匯出單個 effect 的 effects.json」可複用）：
  - `window.__rtxEditor.selectedEffectEntry()` → 選定 effect 的 spec 物件（`state.manifest.effects[state.selected]`）或 `null`；
  - `window.__rtxEditor.effectEntryJson(id)` → 指定 id 的單項 pretty JSON（2 空格縮排）字串或 `null`；
  - `window.__rtxEditor.renderManifestView()` → 重繪 [effects.json] tab（內容＝`effectEntryJson(state.selected)`，未選定＝「請先選擇特效」）。
- **預覽選定座標 state**：
  - 欄位：`window.__rtxEditor.preview.pos = { x, y }`，x/y 為 0–100 **percent** 數字（預設 `{x: 50, y: 50}`；3b 的 `preview.lastClick` 已移除）；
  - 寫入：canvas click → `onPreviewClick()` 自動計算並刷新 `#ed-preview-hint`（格式 `<label>（選定）· x=…, y=…`）；
  - 使用：`previewStart()` 以 `Math.round(pos/100 * canvas.width|height)` 換算 createEffect 的 px/py；`previewSend()` 直接以 `pos.x/pos.y` 送 `POST /api/effect`；
  - 5c「匯入 console 後自動重預覽」掛鉤：重預覽直接調 `window.__rtxEditor.previewReload()`（＝`previewStart()`）即會使用目前 `preview.pos`；如需外部設定座標，直接寫 `window.__rtxEditor.preview.pos = {x, y}` 後調 `renderPreviewLabel()` 刷新顯示。
