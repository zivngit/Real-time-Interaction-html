# 工作完成報告

- **日期**：2026-09-12
- **任務**：POST 存取金鑰改為 header-only（移除 `?key=` query fallback）
- **Agent**：opencode

## 摘要

本次依使用者要求，將存取金鑰限制為「POST 端僅能 Header，不能以 POST 參數傳遞」。

現行調整後行為：

- `POST /api/effects/reload`、`POST /api/effect`、`POST /api/clear` 僅接受 `X-Access-Key` header。
- POST 端不再接受 `?key=` query 金鑰；`tests/test_api.py` 已加入 query 金鑰回 `401` 的斷言。
- POST body 仍不作為金鑰傳遞管道。
- SSE `GET /api/stream` 因瀏覽器 `EventSource` 無法自訂 header，仍維持 `?key=` query。
- `server/security.py::check_key()` 保留 header / query 兩種參數以相容 SSE 路徑，但 POST endpoints 現在明確只傳入 header 金鑰。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/main.py` | 修改 | `POST /api/effects/reload`、`POST /api/effect`、`POST /api/clear` 移除 `key: Query(default=None)` 參數，改為只以 `x_access_key: Header(default=None)` 呼叫 `check_key()` |
| `tests/test_api.py` | 修改 | `test_reload_requires_access_key` 改為驗證 POST reload 的 `?key=` query 回 `401`；`test_access_key_enforced` 改為驗證 `POST /api/effect` 與 `POST /api/clear` 的 `?key=` query 回 `401` |
| `README.md` | 修改 | 存取金鑰說明更新為 POST API 使用 `X-Access-Key` header、SSE 使用 `?key=` query |
| `docs/HOW_TO_ADD_EFFECT.md` | 修改 | `POST /api/effects/reload` 說明改為僅可透過 `X-Access-Key` header 提供金鑰，不接受 `?key=` query 或 POST body 金鑰 |
| `docs/agents/CALL_GRAPH.md` | 修改 | `check_key` 節點更新為「POST 用 `X-Access-Key`、SSE 用 `?key=`」 |
| `docs/agents/TODO.md` | 修改 | 新增「POST 存取金鑰改為 header-only」完成項目 |
| `docs/temp/SPEC_EFFECTS_JSON_RELOAD.md` | 修改 | 更新 `A-03`、`A-10`、最終確認與第 13 節修正記錄，明確 POST 端金鑰僅接受 `X-Access-Key` header，SSE 維持 `?key=` |
| `docs/temp/PLAN_EFFECTS_JSON_RELOAD.md` | 修改 | 更新 production 安全、reload API auth、route 範例、access key 測試預期與開放決策表，移除 POST query fallback 描述 |
| `docs/temp/PLAN.md` | 修改 | 存取金鑰章節更新為 POST endpoints 使用 `X-Access-Key` header only，SSE 維持 `?key=` |
| `docs/temp/MANUAL_TEST.md` | 修改 | 存取金鑰手動測試項更新為 POST 用 header、SSE 用 query |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- 執行命令：`npm run test`
- 結果：通過
  - Python dependency preflight 通過
  - pytest：41 passed，2 warnings
  - node tests：86 passed
    - `tests/test_console.mjs`：52 passed
    - `tests/test_effect_examples.mjs`：16 passed
    - `tests/test_effects.mjs`：18 passed
  - Playwright E2E：11 passed
    - 包含 `tests/e2e/reload-manifest.spec.js`：viewer auto-updates manifest; consoles require manual reload or refresh
    - 包含 `tests/e2e/multi-console-reload.spec.js`：multiple consoles with different server URL and key reload independently with selected-effect fallback

## Git Commit

- Commit：`daec6341add01ee0151ed5ce799ff04dbab2ea2d` — `feat(effects): 新增 manifest 手動重載與 POST 金鑰 header-only`

## 後續待辦

- pytest 的 2 個第三方 deprecation warnings 仍維持暫不處理（見 `docs/agents/TODO.md`）。
- 若未來要讓 SSE 也完全不使用 `?key=` query，需另行評估替代機制（例如 token 換發、WebSocket、proxy header 注入），因為瀏覽器 `EventSource` 無法自訂 header。
