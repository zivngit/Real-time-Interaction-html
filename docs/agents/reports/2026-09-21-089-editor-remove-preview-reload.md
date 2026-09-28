# 工作完成報告

- **日期**：2026-09-21
- **任務**：effects 編輯器子任務 5l — 程式碼區塊移除 [重新預覽] 按鈕
- **Agent**：opencode

## 摘要

依使用者指示從程式碼區塊移除 [重新預覽] 按鈕（使用者原回報「程式碼區塊移除 [重新預覽][存檔]」，經確認**只移除 [重新預覽]、保留 [存檔]**）。

`#ed-preview-reload` 按鈕的 `previewReload()` 原本僅轉呼 `previewStart()`，與右欄預覽面板之 [開始預覽]（`previewStart`）功能完全相同；移除後預覽改由 [開始預覽] 觸發，`onCodeSaved()` 存檔成功後自動重載預覽（running 時 `previewStart()`／停止時同 id 重新注入插件）維持不變。

移除項：
- `editor/index.html`：code 區 `#ed-preview-reload` 按鈕（[存檔] `#ed-save-file` 保留）。
- `editor/app.js`：`els.previewReload` 元素引用、`previewReload()` 函式、其 click handler、`__rtxEditor` 之 `previewReload` 匯出；version `'5k'`→`'5l'`。

`saveFile()` 與 [存檔] 按鈕維持不變（3a viewer.js/console.js 手動存檔＋匯入自動存檔不受影響）。`server/editor.py` 無改動。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/index.html` | 修改 | 移除 code 區 `#ed-preview-reload`（[重新預覽]）按鈕，保留 [存檔] |
| `editor/app.js` | 修改 | 移除 `els.previewReload`、`previewReload()` 函式（僅轉呼 `previewStart()`）、其 click handler 與 `__rtxEditor` 匯出；version `'5k'`→`'5l'` |
| `tests/test_editor.mjs` | 修改 | 59 項不變：harness 移除 `previewReload` 假元素；3b「重新預覽」測試改直接調 `ed.previewStart()` 驗證 plugin 注入（bodyScripts）＋loadedId＋createEffect 座標參數＋running＋label/hint，改稱「3b previewStart」 |
| `docs/agents/CALL_GRAPH.md` | 修改 | `EditorPage` class 移除 `+previewReload()`；EDP 節點補 5l；TEX 節點補 5l 描述（計數 59 不變）；現況表補 5l |
| `docs/agents/TODO.md` | 修改 | 新增子任務 5l 完成項 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：
  - `python -m pytest tests/ -q`
  - `node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`
  - `npx playwright test`
- 結果：全綠——pytest 147 通過；node 168 通過（`test_editor.mjs` 59 項）；Playwright E2E 59 通過（`editor.spec.js` 31 項，無 [重新預覽] 相關 E2E 測試）。

## Git Commit

- Commit：`4a9e748` — `feat(editor): 程式碼區塊移除 [重新預覽] 按鈕（預覽改由 [開始預覽] 觸發）`

## 後續待辦

- 無新增項；TODO「effects 編輯器後續小項」（E2E `.backup/` 清理、import 422 先於 401、兩情境人工瀏覽器確認）維持待辦。
