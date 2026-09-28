# 工作完成報告

- **日期**：2026-09-23
- **任務**：編輯器預覽區簡化 console 面板（U15）＋特效列表去 icon
- **Agent**：opencode

## 摘要

依用戶指示，在特效編輯器右欄預覽區加入**簡化 console 面板**（mini-console），並讓特效列表不再顯示 icon（console 插件改按需載入、解 P2）。`window.__rtxEditor.version` 6k→6l。

**mini-console（U15）**：預覽區原只渲染特效（canvas）＋動作列，無法預覽該特效 console.js（icon＋參數面板）長什麼樣。採用修正：
- **浮動 FAB**（`#ed-mini-fab`）：仿 console 的 FAB，拖曳移動＋點擊展開/收合，位置**限 preview 區**（`miniApplyFabPos` 依 `.preview-body` rect clamp、初始右上角）。
- **1 特效鈕**（`#ed-mini-fx`，icon＋label）＋**[參數] 折疊**（`#ed-mini-params`）＋「僅展示」提示。
- **互動**：[開始預覽] 讀**暫存/已存** console.js（staged 用 `applyStagedConsole`、否則 `loadConsolePlugin` 按需載入）→ 更新特效鈕 icon（`iconFor`）＋參數體（插件 `render` 優先、否則 schema 預設值展示）。**欄位不設唯讀但編輯器不讀回**（`collectPreviewParams()` 維持 schema default、預覽仍用 manifest 預設參數）、切換特效（`selectItem` `!same`）清空。

**特效列表去 icon（解 P2）**：`buildItem`/`refreshItem` 移除 `.icon`；移除 `loadConsolePlugins()`（manifest 載入時 eager 全載）＋`refreshListIcons()`；console 插件改由 mini-console 在 [開始預覽] **按需** `loadConsolePlugin`（`pluginCache` 快取），不再 N 個 script 全載。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | 新增 mini-console state＋13 函式（miniBounds/miniClamp/miniClampPos/miniApplyFabPos/miniToggle/miniToggleParams/clearMiniConsole/miniFields/miniConsoleApi/renderMiniSchemaBody/renderMiniConsole/prepareMiniConsole/miniInit）、wire `previewStart`/`selectItem`/init、導出 7 函式；移除 `buildItem`/`refreshItem` 的 `.icon`、`loadConsolePlugins`/`refreshListIcons`（＋export）；version 6k→6l |
| `editor/index.html` | 修改 | `.preview-body` 加 `#ed-mini-fab`＋`#ed-mini-console`（mini-head/mini-fx(-icon/-name)/mini-params/mini-params-body/mini-hint） |
| `editor/style.css` | 修改 | `.preview-body{position:relative}`＋全部 `.mini-*` 樣式（含 `.mini-params .rtx-field` 插件 render 樣式） |
| `tests/test_editor.mjs` | 修改 | 92→94 項；`makeEl` 補 `style:{}`＋`id` property 同步、`buildTree` 加 7 mini els；新增 4 個 U15 mini 測試（staged render、schema fallback、切換清空、FAB 折疊）；移除列表 icon 測試＋調整 iconFor/script 注入/載入失敗/保存後新特效為按需載入模型；修 fx-item 子元素順序（去 `.icon`）＋name-click 索引 |
| `tests/e2e/editor.spec.js` | 修改 | 45 項；移除 5f 特效列表 icon 區塊、新增 U15 mini-console describe（1 測試） |
| `README.md` | 修改 | 特效列表（去 icon）、即時預覽（＋mini-console）、測試數（node 203、test_editor 94） |
| `docs/agents/TODO.md` | 修改 | 子任務 5a–6n→5a–6o（39 項）＋6o（mini-console）；test_editor 計數 94 |
| `docs/agents/CALL_GRAPH.md` | 修改 | `EditorPage` class 補 mini 函式＋移除 `loadConsolePlugins`/`refreshListIcons`、Server 邊改按需、EDP/TEX/TP/E2E 節點補 mini-console、test_editor 92→94 |

> 註：`docs/temp/effects-editor/EDITOR_REVIEW.md`（gitignored）就地記 U15（version 6l、date/status、UX 節 U15 條目、優先序表），不 commit。

## 測試與驗證

- 執行命令：`node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`＋`python -m pytest tests/ -q`＋`npx playwright test tests/e2e/editor.spec.js`
- 結果：全綠——node **203**（`test_editor` **94**、含 4 個 U15 mini 測試）、pytest **156**、Playwright E2E **45**（editor.spec.js、含 U15 mini-console 測試）。E2E 後正式 `effects/` **clean**、`tmp/` 經 `globalTeardown` 移除。

## Git Commit

- Commit：`c49166c` — `feat(editor): 預覽區簡化 console 面板（浮動 FAB 限 preview 區、[開始預覽] 顯示 icon＋參數 render 僅展示）＋特效列表去 icon（console.js 改按需載入）`

## 後續待辦

- U15 為 🔵 次要 UX；剩餘最划算的 U 項仍為 **U6（staged 持久化）／U3（搜尋）／U1（主題）**，見 `EDITOR_REVIEW.md` 優先序表（gitignored）。
