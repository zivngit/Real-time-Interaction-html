# 工作完成報告

- **日期**：2026-09-30
- **任務**：editor `loadManifest` 成功後收斂雙 registry（Phase 2 editor E3）
- **Agent**：opencode

## 摘要

editor `loadManifest()` 成功套用新 manifest 後，收斂 `window.Effects.registry` 與 `window.RTX_EFFECT_CONSOLE.registry`（新增 `pruneEffectRegistries`）：移除 id 已不在 `state.manifest.effects` 的條目，保留 id 條目不受影響。根除 M3「曾預覽/測試的特效 id 永久殘留至重新整理」——此前移除特效前曾預覽過的 id（含 factory closure）會留在兩份 registry。呼叫點在 `loadManifest`（`state.manifest = data.manifest` 後），覆蓋首次載入、SSE `manifest` 事件（rev 變且非 dirty）、[重載]、匯入、[保存至伺服器] 成功與初始化；執行中 preview 實體持有自身 closure、不受 registry 移除影響，再預覽時 `injectPlugin` 重新註冊（與 E2 的 fetch＋`new Function` 路徑相容）。Phase 2（E2＋E3＋E5）至此全部完成。同步更新 gitignored 之 `docs/temp/frontend-memory/`（`FRONTEND_MEMORY_CHANGES.md` §10、`FRONTEND_MEMORY_PLAN_EDITOR.md` E3 ✅）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | 新增 `pruneEffectRegistries()`（:282-295）：掃 `window.Effects.registry` 與 `consoleRegistry.registry`，移除 id 不在 `state.manifest.effects` 的條目（`state.manifest.effects` 缺失時 no-op）；`loadManifest()` 成功套用 `state.manifest` 後呼叫（:324）；執行中 preview 實體不受影響（持有自身 closure）、再預覽時 `injectPlugin` 重新註冊 |
| `tests/test_editor.mjs` | 修改 | 137→139（新增 2 項 E3）：「E3：SSE manifest rev 變化→loadManifest 收斂雙 registry（移除 id 清除、保留 id 不受影響）」（particle 保留／ghost 清除、兩 registry 同斷言）、「E3：[重載] 重抓 manifest 後收斂雙 registry（firework 移除、其餘維持）」 |
| `tests/e2e/editor.spec.js` | 修改 | 60→61：新增 `test.describe('S3 雙 registry 收斂（memory governance E3）')`——預覽 particle→新增 zz-test（staged console.js＋viewer 模板）預覽→[保存] #1（manifest 仍含 zz-test、registry 維持）→[✕ 移除]＋[保存] #2→斷言 `window.Effects.registry`／`window.RTX_EFFECT_CONSOLE.registry` 均無 `zz-test`、particle 不受影響；`[保存至伺服器]` 恆彈 `window.confirm`，需 `page.on('dialog', (d) => d.accept())` 自動接受（未處理 dialog 被 Playwright auto-dismiss＝cancel） |
| `README.md` | 修改 | 測試計數更新（node 248→250（test_editor 137→139）、E2E 88→89（editor.spec.js 60→61））；自動更新項補「manifest 載入／重載／SSE 更新後收斂雙 registry」；editor.spec.js 覆蓋項補「S3 雙 registry 收斂（新增→預覽→移除→保存後兩 registry 無殘留 id、保留 id 不受影響）」 |
| `docs/agents/TODO.md` | 修改 | 測試計數更新（E2E 88→89、editor.spec.js 60→61、test_editor.mjs 137→139）；標記「前端記憶體治理 Phase 2（editor，E3）」完成；後續前端記憶體治理項收縮為僅剩 Phase 3（S5 可觀測性） |
| `docs/agents/CALL_GRAPH.md` | 修改 | EditorPage class 補 `pruneEffectRegistries()`；`EditorPage ..> Effects` 邊補 E3 收斂說明；TEX 節 137→139＋S3 描述、TP 節 88→89（editor.spec.js 60→61）＋S3 描述；最後更新日 2026-09-30 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`npm run test:unit`（pytest＋node --test 5 支）、`npx playwright test tests/e2e/editor.spec.js`、`npm run test:e2e`
- 結果：
  - pytest：161 項通過（`test_api` 63、`test_server_logging` 13、`test_editor_api` 85；server 未改動）
  - node：250 項通過（test_editor.mjs 139 項，＋2）
  - Playwright E2E：editor.spec.js 61 項通過（本次實跑）；全套 89 項通過（editor 61＋其餘 9 spec 28，本次實跑）

## Git Commit

- Commit：`c232349` — `feat(editor): loadManifest 成功後收斂雙 registry（manifest 不具之 id 自 Effects.registry／consoleRegistry 移除、保留 id 不受影響）（Phase 2 editor E3）`

## 後續待辦

- Phase 3：S5 可觀測性（E4，`window.__rtxMem`，選做）
