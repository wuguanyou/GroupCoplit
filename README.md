# GroupPilot

學生專案的代理組長工作空間：任務依賴、依技能和可用時間重新分工、站內協調紀錄、成果提交與交叉驗收、可追溯貢獻分析。

## 在 VS Code 開發

Node.js 22.13 以上及 pnpm。安裝後執行：

```sh
pnpm install
pnpm exec wrangler d1 migrations apply DB --local --config wrangler.local.jsonc
pnpm dev
```

開啟終端機顯示的 Local URL。程式使用 React、Vinext、Cloudflare Workers 與 D1。雲端版由 Sites 管理 D1 資源與遷移；本機資料與雲端資料分開。

## 驗證

```sh
node --experimental-strip-types --test tests/project.test.mjs
pnpm exec tsc --noEmit
pnpm build
```

## 第一版範圍與限制

- 初始資料是四位學生的示範專案，資料保存在後端 D1。
- 分工使用可解釋的規則排程，尚未連接語言模型。自由文字回報會保存，但工時與日期由表單明確輸入；作業要求不會自動語意拆解。
- 事件觸發：變更能力／可用時間、回報、驗收、新增任務後自動重新規劃。定時檢查目前由開啟中的頁面每分鐘觸發，關閉頁面不會背景監控。
- 通知保存在站內代理紀錄；尚未串接 LINE、Email 或 GitHub。
- 排程以每日可投入工時估算，假定每天皆可工作，未包含個別星期課表。交接計入半天緩衝，並保留原有貢獻。
- 貢獻基礎點數為原估工時乘難度；多人已驗收紀錄按工時分配上限，協作有獨立 25% 上限。分數供協調參考，非成績或個人能力評價。
- 當前是擁有者私有示範工作空間；可選擇代表的組員進行操作。正式多人版還需要個人登入、身分綁定及權限控制。
- WebMCP 在支援瀏覽器中提供 get_project_status 與 replan_project；未支援環境不影響一般操作。

## 建議的 AI 接入位置

API 路由位於 app/api/project/route.ts；純規則與貢獻計算位於 lib/project.ts。app/api/analysis/route.ts 已提供 OpenAI Responses API 結構化風險、協調與貢獻分析，設定後端 OPENAI_API_KEY 和 OPENAI_MODEL 後可啟用（本機使用 .env；雲端使用 Sites secrets）。沒有金鑰時不會呼叫模型。此連線尚未用真實金鑰端到端驗證。後續可加入需求與訊息轉成結構化任務或事件，再由規則引擎驗證與排程。金鑰必須留在後端，不得放進前端或版控。
