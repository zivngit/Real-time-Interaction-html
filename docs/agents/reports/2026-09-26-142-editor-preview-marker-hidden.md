# 工作完成報告

- **日期**：2026-09-26
- **任務**：預覽播放期間不顯示生成點十字標記（7g）
- **Agent**：opencode

## 摘要

依使用者要求：特效播放期間不顯示生成點十字標記。`previewTick()` 移除 `drawPreviewMarker()` 呼叫——播放期間（含暫停靜幀）marker 不再疊加在特效上；marker 僅 idle 顯示（`refreshPreviewIdle`／`onPreviewClick`／[重設 50/50] 皆已有 `!preview.running` guard），停止／[清屏]／auto-stop 後由 `previewStop(true)` 重現。version 7f→7g（純 editor 前端，不改 server／viewer／插件／protocol）。

## 文件異動表

| 檔案路徑 | 異動類型 | 修改摘要 |
| --- | --- | --- |
| `editor/app.js` | 修改 | `previewTick` 移除 `drawPreviewMarker()` 呼叫；ResizeObserver 處 comment 更新（播放期間不畫 marker、停止後重現）；version `'7f'`→`'7g'` |
| `tests/test_editor.mjs` | 修改 | U5 marker 測試改為「播放期間不顯示（running tick 不畫 marker、停止後重現）」：原斷言 running tick 疊加 marker，改斷言 tick 前後 `_marks` 不變＋`previewStop(true)` 後重畫 |
| `docs/agents/TODO.md` | 修改 | 7f 下新增 7g 已完成項 |
| `docs/agents/CALL_GRAPH.md` | 修改 | EDP 右欄＋TEX 節點補「播放期間不顯示 marker（7g）」 |

> 註：本報告檔案本身不列入上表。

## 測試與驗證

- `node --test tests/test_editor.mjs`：116 項通過
- `npm run test:unit`：pytest 159 項通過、node 合計 225 項通過
- `npx playwright test tests/e2e/editor.spec.js`：49 項通過（無 E2E 斷言播放中 marker，不需更動）

## Git Commit

- Commit：`961007a` — `feat(editor): 預覽播放期間不顯示生成點十字標記（7g）`
