# 心之深淵：選擇之劍（Seven Habits Quest）

七個習慣 × 文字冒險網頁遊戲。為國中八年級「自我領導力」課程設計：主角持「選擇之劍」墜入心之深淵，連闖七層、斬七尊「壞習慣古神」——每尊古神是一個習慣的反面化身，打贏的條件不是輸出傷害，而是**做出那個習慣的行為**。

## 遊戲規格

- **7 個習慣 × 15 關 = 105 關**，循序解鎖（每關 ≥★★ 過關，一層全過才能進下一層）
- 每層結構：踩雷關（體驗反面）→ 校園/家庭/同儕情境關 → 工具關（影響圈、四象限、情感帳戶、聽的五層次、第三選擇、四泉儀表板⋯⋯）→ 綜合劇情關 → 古神 Boss 戰
- 登入：班級＋座號＋姓名＋性別（無密碼，班級座號為唯一識別，姓名不符時跳確認防冒用）
- 成績記錄：每關星數／嘗試次數／時間戳，可重玩複習（取最佳成績）
- 教師後台 `/teacher`（密碼保護）：完成度矩陣、卡關率 Top 10、CSV 匯出

## 技術架構

| 項目 | 選擇 |
|---|---|
| 前端 | Next.js（App Router, React 19） |
| 資料儲存 | Vercel Blob（每位學生一個 JSON blob） |
| 部署 | Vercel |
| 關卡內容 | `content/habit1-7.json`，改劇情不用動程式 |

## 本機開發

```bash
npm install
vercel env pull .env.local   # 取得 BLOB_READ_WRITE_TOKEN
npm run dev
```

環境變數：

- `BLOB_READ_WRITE_TOKEN` — Vercel Blob 存取權杖（`vercel blob create-store` 後自動注入）
- `TEACHER_PASSWORD` — 教師後台密碼

## 設定

- 班級清單／座號上限／星等門檻：`lib/config.js`
- 關卡內容：`content/habitN.json`（schema：`levels[] → scenes[] → choices[]`，`q` 為 0/1/2 分）

## 個資注意

資料庫僅存班級、座號、姓名、性別與遊戲紀錄，不含任何聯絡方式；學生資料只存在 Vercel Blob，不進 git。學期末可由教師後台匯出 CSV 後清空。
