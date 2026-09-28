# 工作完成報告

- **日期**：2026-09-22
- **任務**：編輯器列表新增「待刪除/已刪除」專屬區（staged 還原 UI）＋評估「一同刪除檔案/deleteFiles」選項（EDITOR_REVIEW.md 之 S1/S4）
- **Agent**：opencode

## 摘要

用戶指令「做 S1、S4」：在 `[主區 · currentEffects]`／`[次區 · alternateEffects]` 下方新增「待刪除/已刪除」區域（**不做該區域拖移邏輯**）；並「先了解 server 啟動檢測、評估[一同刪除檔案選項]」。

**Server 啟動檢測（研究）**：
- `_validate_manifest`（`server/effects.py:115`）：每個 **enabled** 特效的 `viewer.js` 必須存在，否則 `ManifestError` → 整份 manifest 被拒、catalog 載入失敗；啟動／`put_manifest`／`reload_effects` 皆走此路徑 → **enabled 特效不可刪檔**（除非同時移出 manifest）。
- `_sanitize_effect`：`consoleUrl` 僅當檔案存在才設定；`_catalog_fingerprint` 缺檔 → `"missing"`（不 crash）。

**deleteFiles 選項（評估）**：
- **含檔案 (true)**：移出 manifest ＋ 刪目錄 ＋ 備份到 `effects/.backup/` → 一致、真刪除；保存後還原需 server「從備份還原」端點＋UI（本次無 UI）。
- **保留檔案 (false)**：移出 manifest、目錄變 orphan → 運行無害，但 orphan 累積、且重加同 id 時 `_ensure_new_effect_files` 見目錄存在即跳過 → **stale 舊檔**。
- **S4**：`DELETE /api/editor/effect/{id}` 端點前端未用（改用 staged `put_manifest` 的 `deleteRemoved`）→ 冗餘；保留供直接 API／測試，不移除。

**採用修正（6e）**：`#ed-zone-alt` 下方新增 `#ed-zone-pending`（`.zone-group.pending`、head「待刪除 / 已刪除（0）」）。`removeEffect` 後待刪列（`buildPendingItem`）一律移入該專屬區（`renderList`→`renderPendingZone`），不再散落在原主/次區；head 顯示「待刪除 / 已刪除（N）」計數；`[↺]` 還原（`undoPendingDelete`）將特效移回原區並清空該區。該區**無拖移邏輯**（`initListDrag` 只綁主/次區）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | els 加 `zonePending`／`zonePendingHead`；新增 `renderPendingZone()`（清空 `.fx-item`、重建 pending 項）；`renderList` 先從主/次區清除 pending 殘留、`layoutZone` 移除內聯 pending 重建與 `zoneName`、head 顯示「待刪除 / 已刪除（N）」；version 6d→6e |
| `editor/index.html` | 修改 | `#ed-zone-alt` 下新增 `#ed-zone-pending`（`.zone-group.pending`）＋`#ed-zone-pending-head` |
| `editor/style.css` | 修改 | 新增 `.zone-group.pending`（紅調＋虛線邊框）＋`.zone-head.pending`（左邊框紅） |
| `tests/test_editor.mjs` | 修改 | fake DOM 加 `ed-zone-pending`／`ed-zone-pending-head`；2 處 pending 斷言改指 `zonePending`；新增「5d S1 待刪列顯示於專屬區（非原區）、head 計數、↺ 還原清空」；version 斷言 6d→6e（81→82 項） |
| `tests/e2e/editor.spec.js` | 修改 | B8 zone 數 2→3；removeEffect 斷言待刪列在 `#ed-zone-pending`（非主/次區） |
| `README.md` | 修改 | node 190→191（`test_editor` 81→82） |
| `docs/agents/CALL_GRAPH.md` | 修改 | TEX 節點 81→82＋補 S1 專屬區；TP 節點 editor.spec 補 S1（B8 zone 2→3、`#ed-zone-pending`） |
| `docs/agents/TODO.md` | 修改 | 子任務 5a–6d→5a–6e（30→31 項）、補 6e「待刪除/已刪除」專屬區＋S4 deleteFiles 評估 |

> 註：本報告檔案本身不列入上表。`docs/temp/effects-editor/EDITOR_REVIEW.md`（B1–S4／U1–U13 審查）已將 **S1**（staged 還原 UI，6e）與 **S4**（已評估、保留冗餘端點）標記、版本 6d→6e、第 6 節優先表（S1 移入已完成、S4 已評估）與結尾註同步（該檔位於 `.gitignore` 的 `docs/temp`，不納入版本控制）。

## 測試與驗證

- 執行命令：`python -m pytest tests/ -q`、`node --test tests/test_effects.mjs tests/test_console.mjs tests/test_effect_examples.mjs tests/test_effect_catalog.mjs tests/test_editor.mjs`、`npx playwright test`
- 結果：全綠——pytest 156 passed（純前端、server 未改）；node 191 passed（test_editor 82，含新增 1 項 S1）；E2E 70 passed。
- 關鍵驗證：vm 斷言待刪列在 `#ed-zone-pending`（`zoneAlt`／`zoneCur` 無 pending-delete）、head「待刪除 / 已刪除（1）」、`[↺]` 還原後專屬區清空＋fx-b 回到 `alternateEffects`；E2E removeEffect 斷言待刪列在 `#ed-zone-pending` 且主/次區無該項、B8 三區（cur/alt/pending）皆不溢出。既有 5d 批次/拖曳/新增/移除、v1/v2 分區、P1 就地協調、B7/B9/B10 等不回歸。

## Git Commit

- Commit：`8b1bc7b` — `feat(editor): 列表新增「待刪除/已刪除」專屬區（staged 還原 UI、無拖移）`

## 後續待辦

- S1「保存後還原」：真正被刪（deleteFiles）特效的還原需 server「從 `effects/.backup/` 還原」端點＋UI，屬獨立後續項（本次未做）。
- `EDITOR_REVIEW.md` 其餘待辦：B6、P2、U1、U3、U5–U12、U13、S2、S3 及一致性小點。
- 下一步建議（依優先序）：P2（以 id+rev 快取 script、避免 N 個 script 注入）——現為第 1 序剩餘唯一項。
