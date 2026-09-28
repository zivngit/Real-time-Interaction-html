**日期**: 2026-09-27
**任務**: 簡化 console 參數可編輯輸入＋預覽參數同步（U15/7l）
**Agent**: opencode

## 摘要

簡化 console（editor 即時預覽區）對**無 console.js 插件**的特效走 schema fallback（`renderMiniSchemaBody`），原先把參數渲染成唯讀 `.mini-field-v` 文字 span，無法調整預覽參數值；且 `previewStart()` 只讀已存值，params 卡未保存變更不會反映到參數面板與即時預覽（stale value）。本任務兩處修正：

1. `renderMiniSchemaBody` 改渲染**真實可編輯** `<input id="rtx-p-<key>">`／`<select>`：type 映射 boolean→checkbox、color→color、integer/number→number、其餘 text；select options 同時支援 string 與 `{value,label}`；min/max/step/maxLength 套用到 input。
2. `previewStart()` 在 `prepareMiniConsole()` 前先調 `applyManifestFields()`——上方 manifest 欄位（含 params 卡 default）未保存變更同步進 `state.manifest`，參數面板與即時預覽讀值一致。

`editor/index.html` mini-hint 改「僅展示：同步所選特效的預覽參數（未存變更亦反映）；取自 console.js render」；`editor/style.css` 移除 `.mini-field-v` rule、加 `.mini-field` input/select 樣式（color 34×24、text/number/select flex:1、`.mini-field-k` 固定 52px）。`editor/app.js` version 7k→7l。

## 文件異動

| 路徑 | 異動 |
|------|------|
| `editor/app.js` | `renderMiniSchemaBody` schema fallback 改渲染 input/select（type 映射、select 支援 string/{value,label}、min/max/step/maxLength）；`previewStart()` 先調 `applyManifestFields()` 同步未存變更；version 7k→7l |
| `editor/style.css` | 移除 `.mini-field-v`；新增 `.mini-field` input/select 樣式；`.mini-field-k` 固定寬 52px |
| `editor/index.html` | mini-hint 文字改為「僅展示：同步所選特效的預覽參數（未存變更亦反映）；取自 console.js render」 |
| `tests/test_editor.mjs` | schema fallback 斷言改 INPUT/SELECT 值（0 個 `.mini-field-v`）；新增 stale-value 回歸測試（count 8→20 未存變更、預覽後參數面板與 createEffect params 皆 20）；120→121 項 |
| `tests/e2e/editor.spec.js` | 新增 v3 測試（firework 無 console.js → 簡化 console 亦渲染 input/select 可編輯框、未存參數變更 90→120 亦反映於參數面板）；53→54 項 |
| `docs/agents/TODO.md` | 新增 U15/7l 項；測試計數更新（E2E 82、editor.spec.js 54、test_editor.mjs 121） |
| `docs/agents/CALL_GRAPH.md` | TEX/TP 測試節點加 7l 描述；計數更新（121、82、54） |

## 測試與驗證

- [x] `node --test tests/test_editor.mjs` — 121/121 pass（含更新 schema fallback 斷言＋stale-value 回歸）
- [x] `npx playwright test tests/e2e/editor.spec.js` — 54/54 pass（含新增 v3 測試）
- [x] `npm test` 全綠 — pytest 159 pass、node 單測 230 pass、E2E 82 pass

## Git commit

- `1ec9bbc` feat(editor): 簡化 console 參數可編輯輸入＋預覽參數同步（7l）
