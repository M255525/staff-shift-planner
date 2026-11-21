# staff-shift-planner — 員工排班表

小店排一週班表：設定班別、人員與每班需要幾個人，自動排班並檢查勞基法工時規定（每日 12 小時、11 小時輪班間隔、例假、連續上班），算出人力成本與加班費，可列印貼牆或傳 LINE。（2026-11-21 由 tool-scaffold 建立骨架）

- 純靜態：`index.html`（CSS）＋`data.js`（計算引擎 `window.SSP`，node 可 require）＋`app.js`（畫面）＋`watermark.js`（`TOOL_WATERMARK` 馬克老師浮水印，列印用）＋`manual.html`＋PWA。
- 本機預覽 port **8906**（`.claude/launch.json` 的 `staff-shift-planner`）。visitor-badge `m255525.staffshiftplanner`（手冊 `.manual`）。
- 尚未上線。上線後在這裡記網址與日期；改版要升 `service-worker.js` 的 `CACHE_NAME` 再 push。

## 規則
- （待補）計算規則、資料來源與查證日期、自訂門檻。改了 `data.js` 跑 `node tools/test_engine.mjs`。

## 架構
- localStorage 前綴 `ssp.`：`state`、`tab`、`fold`、`fsize`、`warnSeen`、`marquee`。
- 輸入只呼叫 `refresh()`，不重繪表單（焦點才不會跑掉）；欄位 change 時**只有數值真的被修正才重繪**，否則會吃掉使用者的下一次點擊。
- 備份 JSON `app:'staff-shift-planner'`。測試掛鉤 `window._tool`。
- 畫風：（待設計）範本配色 `slate` 只是起點；姊妹作的畫面要明顯不同。圖示由 `tools/make_icons.py` 產生。

## 標準配備
跑馬燈（工作區公告 GAS，滑鼠移入暫停，不可關）、⚙ 常用設定（收合式：資料／顯示／關於本工具）、首訪警語＋頁面入口、`manual.html#creator` 完整版（改 `tools/manual_body.html` 後跑 `python tools/build_manual.py`，創作者區塊從賞鳥地圖範本複製）、PWA、訪客計數器、列印浮水印。

## 測試
- `node tools/test_engine.mjs`：（待補手算案例）＋亂數。
- `python tools/e2e_ssp.py [截圖資料夾]`（Playwright，自己在 port 8916 起伺服器）：標準配備（警語、跑馬燈、收合設定、關於本工具、大字、備份還原、SW、manifest、手冊創作者、列印浮水印、390px）＋主功能。
