# 工作完成報告

- **日期**：2026-09-23
- **任務**：其餘測試改以 `tests/fixtures/` 為特效來源（除 catalog 驗證器外不依賴正式 `effects/`）
- **Agent**：opencode

## 摘要

依用戶指示「全改 7 個（最大一致性，node smoke 改測副本）」，把其餘 7 個仍指正式 `effects/` 的測試改以 `tests/fixtures/` 為特效來源，達成測試與正式 `effects/` 的最大分離。唯一例外是 `test_effect_catalog.mjs`（驗證**正式** `effects/` catalog 一致性，刻意不改）。

做法：
1. pytest `test_api.py`：加 `os.environ["RTX_EFFECTS_DIR"] = tests/fixtures`（manifest 本已指 `tests/fixtures/effects.json`）。
2. pytest `test_editor_api.py`：`REAL_EFFECTS_DIR`（`effects`）→ `FIXTURE_EFFECTS_DIR`（`tests/fixtures`）。
3. node `test_effects.mjs`／`test_console.mjs`／`test_editor.mjs`：讀取路徑 `effects/<id>/` → `tests/fixtures/<id>/`。
4. E2E `reload-manifest.spec.js`／`multi-console-reload.spec.js`：自建 server 的 env 加 `RTX_EFFECTS_DIR` → `tests/fixtures`。
5. node smoke 的 canvas gradient 測試需 3 個 gradient 特效（`chrono-vortex`／`aurora`／`fire-dragon`）→ 自正式 `effects/` 複製入 `tests/fixtures/<id>/`（一次性設置）。

結果：除 `test_effect_catalog.mjs`（驗正式 catalog）外，全部測試（pytest／node vm／E2E）皆以 `tests/fixtures/` 為特效來源、不依賴正式 `effects/`；`tests/fixtures/` 現含 7 特效（4 基礎＋3 gradient）＋2 manifest。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `tests/fixtures/chrono-vortex/`、`aurora/`、`fire-dragon/`（`viewer.js`＋`console.js`） | 新增 | 3 個 canvas gradient 特效複製入 `tests/fixtures/`（自正式 `effects/<id>/`），供 node smoke 的 gradient 測試 |
| `tests/test_api.py` | 修改 | 加 `os.environ["RTX_EFFECTS_DIR"] = tests/fixtures`（與既有 `RTX_EFFECTS_MANIFEST` 並列） |
| `tests/test_editor_api.py` | 修改 | `REAL_EFFECTS_DIR`（`effects`）→ `FIXTURE_EFFECTS_DIR`（`tests/fixtures`） |
| `tests/test_effects.mjs` | 修改 | 讀取路徑 `effects/<id>/viewer.js` → `tests/fixtures/<id>/viewer.js`（3 處） |
| `tests/test_console.mjs` | 修改 | 讀取路徑 `effects/particle/console.js` → `tests/fixtures/particle/console.js`（2 處） |
| `tests/test_editor.mjs` | 修改 | 讀取路徑 `effects/<id>/` → `tests/fixtures/<id>/`（4 處，含 gradient smoke 的 `registerRealEffect`） |
| `tests/e2e/reload-manifest.spec.js` | 修改 | 自建 server env 加 `RTX_EFFECTS_DIR` → `tests/fixtures` |
| `tests/e2e/multi-console-reload.spec.js` | 修改 | `startServer` env 加 `RTX_EFFECTS_DIR` → `tests/fixtures` |
| `README.md` | 修改 | 測試特效段改述：全部測試（除 catalog 驗證）以 `tests/fixtures/` 為來源（7 特效＝4 基礎＋3 gradient） |
| `docs/agents/TODO.md` | 修改 | 子任務 5a–6k（36 項）→ 5a–6m（37 項）；補 6m 描述 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 測試節點目標改指 `tests/fixtures/*`（test_effects／test_console／test_editor）；catalog 驗證器（TG）改指獨立 `S_REAL`（正式 `effects/`）；E2E 節點補 reload-manifest／multi-console-reload 用 `RTX_EFFECTS_DIR`→`tests/fixtures` |

> 註：`docs/temp/effects-editor/EDITOR_REVIEW.md`（gitignored）就地記 6m 結論，不 commit。

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`、`node --test tests/test_*.mjs`、`npx playwright test`
- 結果：全綠——pytest **156**、node **196**、Playwright E2E **73**。全部測試後正式 `effects/` **clean**（未被改動）；`tests/fixtures/` 新增 3 gradient 特效（tracked）；`tmp/` 經 `globalTeardown` 移除。

## Git Commit

- Commit：`91951c1` — `test: 其餘測試改以 tests/fixtures/ 為特效來源（pytest/node/E2E 共 7 個；node smoke 補 3 canvas gradient 特效；除 test_effect_catalog.mjs 外不依賴正式 effects/）`

## 後續待辦

- `tests/fixtures/` 現為正式 `effects/` 的**測試副本**（7 特效）：若正式特效行為改動，需同步更新 `tests/fixtures/<id>/`（否則 node smoke／E2E 測的是舊副本）。
- `test_effect_catalog.mjs` 仍驗證**正式** `effects/`（生產 catalog 一致性），是唯一依賴正式 `effects/` 的測試（刻意保留）。
