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

- 使用 ChatGPT 登入後建立空白專案；邀請碼讓組員加入同一團隊。既有示範資料保留在原資料列，但不作為新專案起點。
- 規則排程保留。AI 工作台已對接需求拆解、自然語言回報、分工建議、風險與貢獻分析；已使用 Groq 完成真實模型測試；未配置時不產生假結果。
- 事件觸發：變更能力／可用時間、回報、驗收、新增任務後自動重新規劃。定時檢查目前由開啟中的頁面每分鐘觸發，關閉頁面不會背景監控。
- 通知保存在站內代理紀錄；尚未串接 LINE、Email 或 GitHub。
- 排程以每日可投入工時估算，假定每天皆可工作，未包含個別星期課表。交接計入半天緩衝，並保留原有貢獻。
- 貢獻基礎點數為原估工時乘難度；多人已驗收紀錄按工時分配上限，協作有獨立 25% 上限。分數供協調參考，非成績或個人能力評價。
- 公開登入入口，專案、檔案與 AI 紀錄由後端檢查成員資格。成果提交及驗收綁定目前登入者；建立者管理專案、邀請碼與 AI 操作。
- 檔案內容保存在 R2、中繼資料保存在 D1。支援 PDF、DOCX、PPTX、XLSX、TXT、MD、CSV、PNG、JPG、ZIP，單檔 10 MB、每專案最多 200 個。附件以下載方式提供，不直接執行或內嵌預覽。
- 專案資料與任務交付分區，附件可送交叉驗收並計入貢獻。上傳檔案不代表完成驗收；AI 目前不自動讀取附件文字。
- WebMCP 在支援瀏覽器中提供 get_project_status 與 replan_project；未支援環境不影響一般操作。

## AI 接入與 AMD 準備

詳見 [AI 接入架構與設定](docs/AI-INTEGRATION.md)。模型金鑰只留在後端，操作通行碼與模型金鑰分開。完成 .env.example 中的設定並套用遷移後，才啟用真實模型請求。

## 本機權限與檔案整合測試

開發伺服器的登入入口提供本機測試帳號；正式登入由 Sites 平台處理。要模擬多個使用者，建置後啟動 `pnpm exec wrangler dev --config dist/server/wrangler.json --port 8787 --persist-to .wrangler/state`，再執行 `node --test --test-concurrency=1 tests/workspace-api.test.mjs`。測試只允許 localhost，直接模擬平台轉送的身分標頭，勿用於公開網站。
