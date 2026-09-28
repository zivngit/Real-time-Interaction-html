# 工作完成報告

- **日期**：2026-09-23
- **任務**：E2E 隔離——測試不再改動正式 `effects/`，只動 `tests/fixtures` 與 `tmp/`
- **Agent**：opencode

## 摘要

審計所有測試對 `effects/`（正式特效目錄）與 `tests/fixtures` 的改動，確認「測試不應改動正式 `effects/`、只能改 `tests/fixtures`」原則下**唯一違規者＝`tests/e2e/editor.spec.js`**：它經編輯器 API 寫入 `effects/particle/viewer.js`、`console.js`，server 端另建 `effects/<新特效>/` 與 `effects/.backup/`。其餘皆已隔離——node 5 測試用假 DOM（無 fs）；`test_api.py` 只讀 `effects/` 建 catalog、manifest 寫 `tmp_path`；`test_editor_api.py` 以 `copytree`＋monkeypatch `EFFECTS_DIR` 到 temp；`reload-manifest.spec.js`／`multi-console-reload.spec.js` 自建 server＋temp manifest（reload 只讀）。

根因：`server/effects.py` 的 `EFFECTS_DIR = ROOT/"effects"` 是**硬編碼**，只有 manifest 有 env（`RTX_EFFECTS_MANIFEST`）；playwright webServer 只把 manifest 指到 fixture，effect 檔案仍落正式 `effects/`。

修法（讓 E2E 共用 server 也隔離，且**只複製與 `tests/fixtures` 相同的 4 個特效**）：
1. `server/effects.py`：`EFFECTS_DIR` 改為可被 `RTX_EFFECTS_DIR` env 覆寫（預設仍 `effects/`）。
2. `tests/e2e/pre-server-copy.mjs`（新增、獨立 ESM）：webServer command 先於 uvicorn 執行，把 `tests/fixtures/effects.json` manifest 引用的 4 特效（particle／ripple／firework／text）自 `effects/` 複製到 `tmp/e2e-effects/`。
3. `tests/e2e/global-teardown.js`（新增）：測試後移除 `tmp/e2e-effects/`。
4. `playwright.config.js`：webServer command 改為 `node tests/e2e/pre-server-copy.mjs && python -m uvicorn …`、env 加 `RTX_EFFECTS_DIR`、加 `globalTeardown`。
5. `tests/e2e/e2e-paths.js`（新增）：共用路徑常數；`editor.spec.js` 的 `VIEWER_JS_PATH`／`CONSOLE_JS_PATH`／新特效目錄斷言／cleanup 全改指 `tmp/e2e-effects/`。
6. `.gitignore`：加 `/tmp/`。

> 採用「webServer command 內先跑 copy」而非 `globalSetup`，是因 Playwright 的 `globalSetup` 與 `webServer` 啟動順序不保證在 server 讀 `EFFECTS_DIR` 前完成（首跑曾因 temp 目錄未就緒而 `ManifestError: missing viewer file`）；把 copy 放進 webServer command（`&&` 鏈接）可確保 uvicorn 啟動前目錄已就緒。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/effects.py` | 修改 | `EFFECTS_DIR` 改為 `Path(os.environ.get("RTX_EFFECTS_DIR", str(ROOT/"effects")))` |
| `playwright.config.js` | 修改 | webServer command 先跑 `pre-server-copy.mjs`、env 加 `RTX_EFFECTS_DIR`、加 `globalTeardown`、import `TEST_EFFECTS_DIR` |
| `tests/e2e/pre-server-copy.mjs` | 新增 | webServer 前置：自 `effects/` 複製 fixture manifest 引用的 4 特效到 `tmp/e2e-effects/` |
| `tests/e2e/global-teardown.js` | 新增 | 測試後移除 `tmp/e2e-effects/` |
| `tests/e2e/e2e-paths.js` | 新增 | 共用路徑常數（`REAL_EFFECTS_DIR`／`TEST_EFFECTS_DIR`／`FIXTURE_MANIFEST_PATH`） |
| `tests/e2e/editor.spec.js` | 修改 | `VIEWER_JS_PATH`／`CONSOLE_JS_PATH`／新特效目錄斷言／cleanup 改指 `tmp/e2e-effects/`、移除未用的 `ROOT` |
| `.gitignore` | 修改 | 加 `/tmp/`（E2E 隔離特效目錄） |
| `README.md` | 修改 | 環境變數表加 `RTX_EFFECTS_DIR`、E2E 說明補隔離機制 |
| `docs/agents/TODO.md` | 修改 | 子任務 5a–6j→5a–6k（35→36 項）加 6k E2E 隔離、E2E 計數 72→73／editor.spec 44→45、移除已解決的 `.backup` 待辦 |
| `docs/agents/CALL_GRAPH.md` | 修改 | server 節點加 `EFFECTS_DIR`（`RTX_EFFECTS_DIR` 可覆寫）、E2E 節點補隔離說明 |

> 註：`docs/temp/effects-editor/EDITOR_REVIEW.md`（gitignored）就地記審計＋修正結論，不 commit。

## 測試與驗證

- 執行命令：`npx playwright test`、`python -m pytest tests/ -q`、`node --test tests/test_*.mjs`
- 結果：全綠——Playwright E2E **73**（含 `editor.spec.js` 45）、pytest **156**、node **196**。E2E 全程後 `git status` 顯示正式 `effects/` 與 `tests/fixtures` **皆 clean**（未被改動），`tmp/e2e-effects/` 經 `globalTeardown` 移除。

## Git Commit

- Commit：`751efd5` — `test(e2e): 隔離 E2E 特效目錄（RTX_EFFECTS_DIR→tmp/e2e-effects、pre-server-copy 複製 fixture 4 特效、不碰正式 effects/）`

## 後續待辦

- `playwright.config.js` 的 webServer `reuseExistingServer: !process.env.CI`：本地若已有 dev server 佔用 port 8123，Playwright 會**重用該 server**（未帶 `RTX_EFFECTS_DIR` env）→ E2E 可能打到非隔離 server。CI 恆為 `false`（已隔離）；本地執行 E2E 前建議確認 8123 無 dev server（本次驗證前已以 `netstat -ano | findstr :8123` 確認 port 空閒）。
