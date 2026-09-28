# 工作完成報告

- **日期**：2026-09-25
- **任務**：修正 effects 編輯器語法高亮（6v）在捲動時底層 `<pre>` 高亮（及行號）與選取文字錯位——scroll 同步改 transform 平移（6z）
- **Agent**：opencode

## 摘要

6v 的語法高亮以 `scroll` 事件把底層 `#ed-code-highlight`（`<pre>`，`overflow:hidden`）與行號 `#ed-code-gutter` 的 `scrollTop`/`scrollLeft` 同步到表層 `#ed-code` textarea。問題：textarea 有自訂 scrollbar 寬度（`::-webkit-scrollbar`），其 `clientWidth`/`clientHeight` 比同尺寸的 `overflow:hidden` pre/gutter 小；textarea 捲到最底/最右時其 max scroll 比 pre/gutter 小，同步寫入的 `scrollTop`/`scrollLeft` 被各自 maxScroll **clamp** 到不同值 → 底層高亮（含行號）相對 textarea 內容偏移，選取文字與上色文字錯位。

修正（6z，純 editor 前端）：改用 **transform 平移**（不經 scrollTop/scrollLeft，無 clamp 問題）——

- `editor/index.html`：行號 `#ed-code-gutter` 內加內層 `<div class="code-gutter-inner" id="ed-code-gutter-inner">`（行號文字寫入內層）。
- `editor/style.css`：`.code-gutter-inner` 加 `display:block`＋`will-change:transform`；`.code-hl code`（原 `display:inline`）改 `display:block`＋`will-change:transform`（`<code>` 為 inline 無法可靠以 transform 平移）。
- `editor/app.js`：新增 `syncCodeScroll()`——讀 `#ed-code` 的 `scrollLeft`/`scrollTop`（`|| 0`），對底層 `#ed-code-highlight-code` 設 `transform: translate(-x px, -y px)`、對 gutter inner 設 `transform: translateY(-y px)`；`scroll` 事件、`showCode`（載入/匯入/模板）、`keydown` Tab 縮排三處改調用（原 scroll 事件手動同步 scrollTop/Left 移除）；`renderLineNumbers` 改寫入 `codeGutterInner`（無則 fallback `codeGutter`）；`els` 加 `codeGutterInner`。`window.__rtxEditor` version `'6y'`→`'6z'`。

高亮層仍為純展示（`pointer-events:none`、`els.code.value` 唯一來源），暫存/存檔/匯入/格式檢查等邏輯不受影響。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/index.html` | 修改 | `#ed-code-gutter` 內加 `<div class="code-gutter-inner" id="ed-code-gutter-inner">`（行號文字移入內層） |
| `editor/style.css` | 修改 | 新增 `.code-gutter-inner`（`display:block`＋`will-change:transform`）；`.code-hl code` 改 `display:block`＋`will-change:transform` |
| `editor/app.js` | 修改 | 新增 `syncCodeScroll()`（textarea scrollLeft/scrollTop→底層 code `translate(-x,-y)`＋gutter inner `translateY(-y)`）；`scroll` 事件、`showCode`、Tab 縮排三處改調用；`renderLineNumbers` 寫入 `codeGutterInner`（fallback `codeGutter`）；`els` 加 `codeGutterInner`；version `'6y'`→`'6z'` |
| `tests/test_editor.mjs` | 修改 | fake DOM 加 `codeGutterInner`（行號文字寫內層）＋行號斷言改 `codeGutterInner.textContent`；新增「語法高亮：scroll 同步改用 transform（底層 code 與 gutter inner 平移、不經 scrollTop clamp）」（100→101） |
| `tests/e2e/editor.spec.js` | 修改 | 3a 語法高亮測試補真實 scroll 同步斷言：`scrollTop`/`scrollLeft` 設 max→底層 code transform＝`translate(-x,-y)`、gutter inner＝`translateY(-y)`（項數不變，47） |
| `docs/agents/CALL_GRAPH.md` | 修改 | TEX（test_editor）100→101＋「scroll 同步改 transform（6z）」；TP（E2E）語法高亮補 transform 同步說明（6v/6z）；現況表「語法高亮」補「scroll 同步改 transform 平移（6z）」 |
| `docs/agents/TODO.md` | 修改 | 新增完成項「語法高亮 scroll 同步改 transform（6z）」 |

## 測試與驗證

- 執行命令：
  - `node --test tests\test_editor.mjs`
  - `npm run test:unit`
  - `npx playwright test`
- 結果：全綠——node **210** passed（`test_editor` 101，含 1 項新增 transform scroll 同步）；pytest **159** passed；Playwright E2E **75** passed（`editor.spec.js` 47，含更新後的 3a 語法高亮 scroll 同步斷言）。

## Git Commit

- Commit：`7f60d1d` — `fix(editor): 語法高亮 scroll 同步改 transform 平移（底層 code／gutter inner、不經 scrollTop clamp，6z）`
