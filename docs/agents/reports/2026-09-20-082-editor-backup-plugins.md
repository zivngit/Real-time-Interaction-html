# 工作完成報告

- **日期**：2026-09-20
- **任務**：sub_agent_5 子任務 5e — `.backup` 包含修改前的 effect 插件檔（CHECK.md 項 9a）
- **Agent**：opencode（implementer）

## 摘要

將 effects 編輯器的備份由「只有 manifest JSON」（`effects/.backup/effects-<timestamp>.json` flat 檔）擴充為「修改前狀態快照」目錄：每次會修改 effect 資料的寫入，於變更前建立 `effects/.backup/<timestamp>/` 目錄，內含 `effects.json`（修改前 manifest，沿用 `copy2`）與本次受影響的 `<effect-id>/viewer.js`／`console.js` 修改前 bytes（相對路徑）。同秒重複以 `-NN` 續號；保留最近 5 份（依 mtime，新目錄與舊格式 flat 檔混合計數、舊者刪除）。觸發點由原 3 個 manifest 寫入端點擴為全部 5 個 effect 資料寫入端點（含 5d 的 `deleteRemoved` 目錄刪除）。維持 `new==old`（JSON 語意相等／bytes 相等）不備份、不 broadcast；新增特效的插件檔無修改前內容（僅備份 manifest）。`.gitignore` 之 `/effects/.backup/` 已核實存在。備份過程無新增 server log 事件（維持現行無 backup 專屬 log 行為）。

最終備份結構與觸發時機：

| 觸發端點 | 備份內容（修改前） |
| --- | --- |
| `PUT /api/editor/manifest` | `effects.json`＋`deleteRemoved` 待刪 `effects/<id>/` 目錄之全部檔案（snapshot 先於 rmtree） |
| `DELETE /api/editor/effect/{id}?deleteFiles=true` | `effects.json`＋該 `effects/<id>/` 目錄之全部檔案（snapshot 先於 rmtree） |
| `PUT /api/editor/effect/{id}/viewer.js`／`console.js` | `effects.json`＋該檔修改前 bytes（檔不存在時僅 `effects.json`；內容 bytes 相同不備份） |
| `DELETE /api/editor/effect/{id}/console.js` | `effects.json`＋該檔修改前 bytes |
| `POST /api/editor/import` | `effects.json`＋zip 內將覆蓋之既有插件檔的修改前 bytes（新增檔無修改前內容） |

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `server/editor.py` | 修改 | `_backup_manifest()`（:151-177）改為 `_backup_state(files)`＋`_prune_backups()`（:151-186）：備份改 `<timestamp>/` 目錄（`effects.json`＋受影響插件檔相對路徑）、同秒 `-NN` 續號、保留 5 份（目錄/舊 flat 檔混合依 mtime 清理）；`_write_manifest(raw, files=None)`（:189-200）傳受影響檔案快照；`put_manifest`（:341-359）`deleteRemoved` 目錄 rmtree 前 snapshot；`delete_effect`（:405-419）`deleteFiles` rmtree 前 snapshot；`_put_file`（:508-515）內容不同備份修改前 bytes、檔不存在僅備份 manifest；`delete_console_file`（:548）unlink 前備份；`import_effects`（:706）傳 `original` 中既有檔的修改前 bytes |
| `tests/test_editor_api.py` | 修改 | 67→73 項：`test_put_manifest_backup_retention` 改目錄結構斷言（維持 6 次改動→5 份）、`test_put_manifest_no_change` 補「無變更不建 .backup」、`test_put_manifest_creates_new_effect_with_templates` 補「新特效僅 effects.json、無 spark/ 插件備份」；新增 `_backup_dirs()` helper 與 6 項：`test_backup_put_viewer_file_includes_previous_content`、`test_backup_put_console_file_includes_previous_content`、`test_backup_delete_console_file_includes_previous_content`、`test_backup_delete_effect_dir_includes_previous_files`、`test_backup_put_file_unchanged_not_created`、`test_backup_retention_mixed_writes` |
| `README.md` | 修改 | 特效編輯器「儲存」項備份說明改「`effects/.backup/<timestamp>/`（含修改前 manifest 與受影響插件檔、保留最近 5 份）」並新增「插件檔備份」項；架構圖備份邊標籤更新；測試計數行更新為實測（pytest 147／node 162／E2E 56，修正 5c/5d 未同步之舊計數） |
| `docs/agents/TODO.md` | 修改 | 新增「子任務 5e」進度子項（2026-09-20） |
| `docs/agents/CALL_GRAPH.md` | 修改 | §2 `EDOP` 節點補 `.backup/<timestamp>/` 目錄備份行為（new==old 不備份、snapshot 先於 rmtree）；§6 `TED` 測試節點 67→73 與備份測試描述更新 |

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`
- 結果：通過（147 passed，2 warnings；改前基線 141 passed，`test_editor_api` 67→73）
- E2E：`tests/e2e/` 無 backup 結構斷言、`helpers.js` 只 snapshot/restore fixture manifest 檔，不受影響（未跑 Playwright，屬 5f 收尾全測範圍）；E2E 寫入類測試會於 repo `effects/.backup/` 產生新格式目錄，該路徑已 gitignore，`git status` 維持乾淨（既有後續小項已追蹤）
- `git status`：乾淨（僅本任務 5 個文件已 commit；`effects/.backup/` 殘留為舊格式 flat 檔，gitignore 不計入，新 prune 邏輯會於下次真實備份時將其計入 5 份並逐步清理）

## 偏離處與說明

1. **備份結構由 flat JSON 檔改為 `<timestamp>/` 目錄**（task_5e PLAN 建議方向、讀實作後定案）：既有釘死測試 `test_put_manifest_backup_retention`（6 次改動→5 份）之「份」定義隨之改為目錄，測試已同步更新，行為（保留 5 份）不變。舊格式 flat 檔由 `_prune_backups` 混合計數、自然淘汰。
2. **`PUT viewer.js|console.js` 之「無變更」判定為 bytes 相等**（非文字語意）：工作樹檔案為 CRLF，經 `read_text`（universal newlines）再 PUT 會歸一為 LF、bytes 改變→視為有變更（備份＋rev 變更）；此為 byte-level 契約，測試以 `read_bytes().decode()` 確保真正無變更情境。
3. **README 測試計數行順手更新**：該行自 5c/5d 起未同步（仍為 138/143/47），本次改 README 時一併改為實測值，屬文件同步非範圍擴充。
4. **無新增 backup 專屬 log 事件**：現行備份即無 log（README log 章節事件目錄未列 backup），維持最小改動；若需審計可另開任務。
5. 任務書所引既有釘死測試行號 `tests/test_editor_api.py:289-298` 為舊版行號，現行位置 :323-335（`test_put_manifest_backup_retention`），內容一致。

## Git Commit

- Commit：`12c4e76` — `feat(server): 編輯器備份包含修改前的 effect 插件檔`

## 後續待辦

- 給 5f 交接：
  - 最終備份結構：`effects/.backup/<YYYYmmddHHMMSS>[-NN]/`（同秒重複 `-01` 起續號），內含 `effects.json`（修改前 manifest）＋受影響之 `<effect-id>/viewer.js`／`console.js`（修改前 bytes、相對路徑）；保留最近 5 份（目錄與舊 flat 檔混合、依 mtime 排序，`BACKUP_KEEP=5`、`BACKUP_DIRNAME=".backup"`、`server/editor.py:28-29`）。
  - 觸發時機：上表 5 端點；`new==old`（manifest JSON 語意相等／檔案 bytes 相等）不備份；新特效無修改前內容；備份快照一律先於實際變更（rmtree/unlink/write）。
  - 相關函式：`_backup_state(files)`／`_prune_backups()`（`server/editor.py:151-186`）、`_write_manifest(raw, files=None)`（:189-200）。
  - 5f 跑 `npm run test` 全測時注意：E2E 寫入類測試會在 repo `effects/.backup/` 新增目錄（gitignored，`git status` 不受影響）；既有 TODO 後續小項（E2E backup 指向 temp/teardown 清理）仍有效。
- 既有未結項（非本任務）：pytest 第三方 deprecation warnings、server 斷線重播暫存、viewer 狀態回報、多 viewer 效能測試、effects-tag 重評、E2E backup 殘留清理等（見 TODO.md）。
