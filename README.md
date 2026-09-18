# GroupPilot

學生團隊專案協作：任務分工、AI 代理、資料檔案、交付驗收與貢獻分析。

此分支為獨立 Cloudflare 版本，使用 Google / GitHub 登入；不依賴 ChatGPT 帳號或 chatgpt.site。原 Sites 網站版本保留在 main。

詳見 [獨立部署設定](docs/INDEPENDENT-DEPLOYMENT.md)。Google / GitHub 真正登入及新網址部署仍需使用者的 OAuth 憑證、Cloudflare 帳號與資源設定。

## 本機啟動

```sh
pnpm install
pnpm exec wrangler d1 migrations apply DB --local --config wrangler.jsonc
pnpm dev
```

在 `.env` 設定 OAuth 與 AI 金鑰；檔案已忽略 Git。登入未設定時按鈕保持停用。上傳附件可保存及驗收，但目前不自動解析 PDF / Word 的文字。背景追蹤仍由開啟中的頁面觸發。

## 驗證

```sh
node --experimental-strip-types --test tests/project.test.mjs tests/agent.test.mjs tests/agent-runner.test.mjs tests/auth-config.test.mjs
pnpm exec tsc --noEmit
pnpm build
```

先啟動本機網站，再驗證工作階段與檔案權限：

```sh
node --experimental-strip-types --test --test-concurrency=1 tests/api.test.mjs tests/workspace-api.test.mjs tests/independent-auth-api.test.mjs
```

整合測試會在本機 D1 建立完全虛構的帳號、工作階段與專案，不呼叫 Google / GitHub OAuth，也不代表正式第三方登入已驗證。`tests/local-session.mjs` 只供本機測試，沒有匯入網站執行碼。

## 正式部署

先設定自己的 D1 / R2、正式環境 Secrets 及 OAuth 回呼。`pnpm deploy:check` 通過後才執行 `pnpm run deploy`。這個流程不會更動舊 Sites 網站，也不會自動搬移舊專案資料。
