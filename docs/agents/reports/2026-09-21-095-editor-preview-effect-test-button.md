# 工作完成報告

- **日期**：2026-09-21
- **任務**：effects 編輯器子任務 5r — 預覽區 [開始預覽] 旁新增 [測試特效] 按鈕
- **Agent**：opencode

## 摘要

依使用者指示，在特效編輯器預覽面板的 [開始預覽] 旁新增 [測試特效] 按鈕（`#ed-preview-test`）。按下後以**真實插件**實際運行選定特效（smoke run）：`runEffectTest(id, source, params)` 以 `checkRunSource` 執行 `viewer.js` 取 factory、以 `makeTestCtx()`（Proxy 記錄 canvas ctx 繪製呼叫）實際跑 `update`/`draw`/`done` 循環（50ms/step、上限 5000ms／200 帧），回傳 執行／註冊／生成特效／frames／繪製（paint 計數）／完成 各列與 ok 旗標；`testEffect()` 以 `checkContent(id, 'viewer.js', true)`（viewer tab 取 code、否則 staged `pendingCode`、否則 fetch server）＋`collectPreviewParams()` 跑測試，並以 `setWarnings` 把結果顯示於編輯器網頁的 warnings 區（與 [檢查格式] 同區、同用 ok/err class，但為實際 smoke run 而非輕量格式檢查）。與 [檢查格式] 不同：[檢查格式] 只驗證語法＋註冊＋結構，[測試特效] 真正執行特效並驗證它可渲染、可完成。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/index.html` | 修改 | 預覽 actions 於 [開始預覽] 旁新增 `#ed-preview-test`（[測試特效]）按鈕 |
| `editor/app.js` | 修改 | 新增 `els.previewTest`；`TEST_PAINT`（fill/stroke/fillText/… 繪製方法集）、`makeTestCtx()`（Proxy 記錄 canvas ctx 繪製呼叫）、`runEffectTest(id, source, params)`（真實插件 smoke run：checkRunSource 取 factory→createEffect→update/draw/done 循環→列 執行/註冊/生成/frames/繪製/完成＋ok）、`testEffect()`（checkContent 取 viewer.js＋collectPreviewParams→runEffectTest→setWarnings 顯示 ok/err）；`els.previewTest` click handler；`__rtxEditor` 加 `testEffect`／`runEffectTest` 匯出；version `'5p'`→`'5r'` |
| `tests/test_editor.mjs` | 修改 | harness 加 `previewTest` 假元素；新增 5r 2 項：`runEffectTest` 真實特效（particle）通過（繪製＋done）＋語法錯／未註冊／不繪製 未通過、[測試特效] 按鈕未選定 err／staged 真實 source 通過／語法錯 未通過；測試數 73→75 |
| `tests/e2e/editor.spec.js` | 修改 | 新增 5r describe 2 項：[測試特效]→真實插件實際運行＋warnings 顯示 結果：通過、未選定→請先選擇特效；editor.spec.js 34→36 |
| `README.md` | 修改 | 測試數量 node 182→184、E2E 62→64、editor.spec.js 34→36、test_editor 73→75；E2E 描述補 [測試特效] |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | 即時預覽 bullet 補 [測試特效]（真實插件實際運行＋結果顯示於 warnings） |
| `docs/agents/CALL_GRAPH.md` | 修改 | EDP 節點補 5r＋`#ed-preview-test`；EditorPage class 加 `testEffect()`／`runEffectTest()`；TEX 節點 73→75＋5r；TP 節點 62→64、editor.spec.js 34→36＋5r；現況表補 5r |
| `docs/agents/TODO.md` | 修改 | 測試數量更新（node 75、E2E 64、editor.spec.js 36）；新增子任務 5r 完成項目 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：
  - `python -m pytest tests/ -q`
  - `node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`
  - `npx playwright test`
- 結果：全綠——`pytest` 153 passed；node 184 passed（`test_editor` 75）；Playwright E2E 64 passed。新增 vm 測試（ok 32／33）與 E2E 5r 2 項（ok 10／11）通過。

## Git Commit

- Commit：`6da7a2b8f89367327b9727e091270eb16db067e1` — `feat(editor): 預覽區 [開始預覽] 旁新增 [測試特效] 按鈕（真實插件實際運行、結果顯示於 warnings）`
