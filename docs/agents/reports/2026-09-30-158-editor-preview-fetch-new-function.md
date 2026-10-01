# 工作完成報告

- **日期**：2026-09-30
- **任務**：editor 單一特效 preview 未-staged 路徑改「fetch 文字＋new Function」（Phase 2 editor E2）
- **Agent**：opencode

## 摘要

editor 單一特效 preview 的插件載入（`injectPlugin` 未-staged 路徑）由「向 `document.body` 注入 `<script data-rtx-effect>` 節點」改為「fetch 檔案文字＋`new Function('window','document',text)` 執行」，根除 E-M2 body 插件 script 節點累積（E-M1 只剩 head 側 mini-console）。並與 E5 程式碼預覽共用 rev-keyed `codeCache`（key `id + '/' + filename`、值 `{content, rev}`）：同 id＋同 rev 命中免 request，rev 變化重 fetch；`!resp.ok`／fetch throw／`new Function` 語法錯誤皆回 `false` 且不寫 cache、不設 `preview.loadedId`。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `injectPlugin` 未-staged 路徑改：`effRev = spec.viewerRev \|\| state.rev \|\| ''`；cache key `id + '/' + filename`；`codeCache` 命中（`rev === effRev`）免 request，miss 則 `fetch('/effects/{id}/viewer.js?v=' + encodeURIComponent(effRev))` 文字→寫 `codeCache`→`previewDangerWarn`→`new Function('window','document',text)(window, document)`；不注入 body `<script data-rtx-effect>`；與 E5 `loadCodeFile` 共用 `codeCache` |
| `tests/test_editor.mjs` | 修改 | 137 項（淨 0）：替換 1 項 S1 測試為「S1 preview plugin（E2）：fetch 文字＋new Function、?v=viewerRev（fallback state.rev）、不注入 body script、同 rev 免 request、rev 變化重 fetch」；新增「S1 preview（E2 無 body 節點）與 mini-console（head）同 id 並存、各容器獨立 prune」、「S1 preview fetch 失敗／語法錯誤：404 或插件語法錯誤→false、loadedId 不設、失敗不寫 codeCache」；新增 `effectGet`/`effectGetSeq` env stub 支援 `GET /effects/{id}/viewer.js` |
| `tests/e2e/editor.spec.js` | 修改 | S1 E2E 改斷言 body `script[data-rtx-effect]` 恆 0（不累積）＋同 rev 免重複 request；修正 Playwright `expect.poll` 誤用（poll 為純斷言、改獨立 `manifestRev()` 讀值）與 CRLF 比較（`viewerBytes.replace(/\r\n/g,'\n')`） |
| `README.md` | 修改 | 即時預覽項補「preview 插件改以 fetch 文字＋new Function 執行（不注入 body `<script>` 節點、同 id＋同 rev 由 rev-keyed codeCache 提供免重抓）」；editor.spec.js 覆蓋項改為「S1 preview E2（body script[data-rtx-effect] 不累積＋同 rev 免重複 request）、console head script[data-rtx-effect] 不累積」 |
| `docs/agents/TODO.md` | 修改 | 標記「前端記憶體治理 Phase 2（editor，E2）」完成；後續前端記憶體治理項改為剩餘 Phase 2（E3＝S3 registry 收斂）＋Phase 3（S5 可觀測性） |
| `docs/agents/CALL_GRAPH.md` | 修改 | `codeCache` 欄補「E5＋E2 共用 rev-keyed cache」；`EditorPage ..> Effects` 邊改 `injectPlugin`（E2：fetch 文字經 new Function 執行、註冊 effect type）；`EditorPage ..> Server` 加 `GET /effects/{id}/viewer.js`（E2 preview fetch 文字→new Function、per-effect ?v=viewerRev、共用 codeCache）；TEX/TP 節補 S1 preview E2 描述 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`npm run test:unit`（pytest＋node --test 5 支）、`npx playwright test tests/e2e/editor.spec.js`
- 結果：
  - pytest：161 項通過（server 未改動）
  - node：248 項通過（test_editor.mjs 137 項、淨 0）
  - Playwright E2E：editor.spec.js 60 項通過（本次重跑）；全套 88 項通過（editor 60＋其餘 9 spec 28，上一輪驗證、其後無程式碼改動）

## Git Commit

- Commit：`c2ce0fb` — `feat(editor): preview 未-staged 路徑改 fetch 文字＋new Function、與 E5 共用 rev-keyed codeCache（Phase 2 editor E2）`

## 後續待辦

- Phase 2 剩餘 E3（S3 registry 收斂）：manifest rev 變後 prune `window.Effects.registry`／`window.RTX_EFFECT_CONSOLE.registry` 移除殘留 id（報告 159）
- Phase 3：S5 可觀測性（選做）
