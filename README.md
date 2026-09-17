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
node --experimental-strip-types --test tests/project.test.mjs tests/agent.test.mjs tests/agent-runner.test.mjs
pnpm exec tsc --noEmit
pnpm build
```

## 第一版範圍與限制

- 初始資料是四位學生的示範專案，資料保存在後端 D1。
- 規則排程保留。AI 工作台已對接需求拆解、自然語言回報、分工建議、風險與貢獻分析；真實模型尚待設定與驗證，未配置時不產生假結果。
- 事件觸發：變更能力／可用時間、回報、驗收、新增任務後自動重新規劃。定時檢查目前由開啟中的頁面每分鐘觸發，關閉頁面不會背景監控。
- 通知保存在站內代理紀錄；尚未串接 LINE、Email 或 GitHub。
- 排程以每日可投入工時估算，假定每天皆可工作，未包含個別星期課表。交接計入半天緩衝，並保留原有貢獻。
- 貢獻基礎點數為原估工時乘難度；多人已驗收紀錄按工時分配上限，協作有獨立 25% 上限。分數供協調參考，非成績或個人能力評價。
- 當前是公開的共享示範工作空間；可選擇代表的組員進行操作。正式多人版還需要個人登入、身分綁定及權限控制。
- WebMCP 在支援瀏覽器中提供 get_project_status 與 replan_project；未支援環境不影響一般操作。

## AI 接入與 AMD 準備

詳見 [AI 接入架構與設定](docs/AI-INTEGRATION.md)。模型金鑰只留在後端，操作通行碼與模型金鑰分開。完成 .env.example 中的設定並套用遷移後，才啟用真實模型請求。
