# 工作完成報告

- **日期**：2026-09-11
- **任務**：新增四特效並改用測試用 `effects.json` manifest
- **Agent**：opencode

## 摘要

本次工作將使用者新增的 4 個特效登記到正式 `effects/effects.json`，並建立測試用 manifest，使自動測試不會被新特效影響。

主要內容：

- 正式 manifest `effects/effects.json` 新增 `slash`、`vortex`、`tear-slash`、`rocket` 4 個特效。
- 新增 4 個特效資料夾：`effects/slash/`、`effects/vortex/`、`effects/tear-slash/`、`effects/rocket/`，各包含 `viewer.js` 與 `console.js`。
- 新增 `tests/fixtures/effects.json` 作為測試用 manifest，只包含原四特效：`particle`、`ripple`、`firework`、`text`。
- `server/effects.py` 支援環境變數 `RTX_EFFECTS_MANIFEST` 覆寫 manifest 路徑；生產 server 預設仍讀 `effects/effects.json`。
- `tests/test_api.py` 在導入 server 前設定 `RTX_EFFECTS_MANIFEST` 指向 `tests/fixtures/effects.json`，因此 pytest 的 `/api/effects` 測試仍固定看到 4 個特效。
- 正式 `effects/effects.json` 現在共 8 個特效；正常啟動 server 時 `/api/effects` 會回傳 8 個，自動測試仍只測試 fixture 中的 4 個。
- 同步更新 `README.md`、`docs/HOW_TO_ADD_EFFECT.md`、`docs/agents/TODO.md`、`docs/agents/CALL_GRAPH.md`，說明測試用 manifest 與 `RTX_EFFECTS_MANIFEST` 行為。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `effects/effects.json` | 修改 | 正式 manifest 新增 `slash`、`vortex`、`tear-slash`、`rocket` |
| `effects/slash/viewer.js` | 新增 | slash viewer plugin |
| `effects/slash/console.js` | 新增 | slash console plugin |
| `effects/vortex/viewer.js` | 新增 | vortex viewer plugin |
| `effects/vortex/console.js` | 新增 | vortex console plugin |
| `effects/tear-slash/viewer.js` | 新增 | tear-slash viewer plugin |
| `effects/tear-slash/console.js` | 新增 | tear-slash console plugin |
| `effects/rocket/viewer.js` | 新增 | rocket viewer plugin |
| `effects/rocket/console.js` | 新增 | rocket console plugin |
| `tests/fixtures/effects.json` | 新增 | 測試用 manifest；只包含 `particle`、`ripple`、`firework`、`text` |
| `server/effects.py` | 修改 | `MANIFEST_PATH` 支援 `RTX_EFFECTS_MANIFEST` 環境變數覆寫；預設仍為 `effects/effects.json` |
| `tests/test_api.py` | 修改 | pytest 導入 server 前設定 `RTX_EFFECTS_MANIFEST` 指向 `tests/fixtures/effects.json` |
| `README.md` | 修改 | 說明自動測試使用 `tests/fixtures/effects.json`，新特效加入正式 manifest 後不會自動進入測試 |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | 第 9 節補充測試 manifest 行為，說明新特效需另行加入 fixture 與 node 測試才會納入自動測試 |
| `docs/agents/TODO.md` | 修改 | 記錄自動測試改用 `tests/fixtures/effects.json` 的完成項目 |
| `docs/agents/CALL_GRAPH.md` | 修改 | 更新 server manifest 可被 `RTX_EFFECTS_MANIFEST` 覆寫、test_api 使用測試 manifest 的測試關係 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`
- 執行命令：`node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs`
- 執行命令：`node --check effects/rocket/viewer.js && node --check effects/rocket/console.js && node --check effects/slash/viewer.js && node --check effects/slash/console.js && node --check effects/tear-slash/viewer.js && node --check effects/tear-slash/console.js && node --check effects/vortex/viewer.js && node --check effects/vortex/console.js`
- 結果：pytest 33 項通過（2 項 warnings）；node 84 項通過（effects 17、console 51、effect examples 16）；新增 4 個特效的 8 個 JS 檔案通過 `node --check` 語法檢查。

## Git Commit

- Commit：`09c496ddeb6b7df876a43040f0ca275b7728573c` — `feat(effects): 新增四特效並改用測試用 effects.json manifest`
- 該 commit 建立時倉庫處於 detached HEAD；之後已將 `master` fast-forward 到此 commit。

## 後續待辦

- 若要把 `slash`、`vortex`、`tear-slash`、`rocket` 納入自動測試，需更新 `tests/fixtures/effects.json`，並視需要更新 `tests/test_effects.mjs`、`tests/test_console.mjs` 的固定 effect 清單。
- 請使用者於瀏覽器手動驗證新特效（需 `SERVE_EXAMPLES=1`）：
  - `http://localhost:8000/examples/embed-console.html`
  - `http://localhost:8000/examples/embed-viewer.html`
  - `http://localhost:8000/examples/embed-both.html`