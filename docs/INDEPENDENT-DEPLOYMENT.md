# GroupPilot 獨立部署與多管道登入

此分支 `codex/independent-login` 不依賴 Sites 或 ChatGPT 登入。網站使用 Better Auth 管理登入工作階段，資料與檔案仍使用 Cloudflare D1 / R2。Google、GitHub 按鈕只有在對應憑證設定完整時才可使用。

## 目前完成與待辦

- 完成 Google / GitHub OAuth 接口、Cookie 工作階段、登出、來源檢查及原專案權限串接。
- 不再接受 `oai-authenticated-user-*` 標頭作為登入依據。
- 移除 Sites 開發套件、登入助手與 hosting.json。舊站仍在 main 分支與既有部署上。
- 真正的 OAuth 登入仍需你帳號下的 Google / GitHub Client ID 和 Client Secret。
- 新站尚未部署；wrangler.jsonc 的 D1 ID 是本機用占位值，部署檢查會拒絕它。
- 不自動合併不同提供者的同信箱帳號。請先固定使用同一種登入方式；跨提供者綁定需另做登入後的驗證流程。

## 一、準備自己的 Cloudflare

1. 登入你自己的 Cloudflare 帳號，開啟 Workers 與 D1 / R2。
2. 在這個分支執行 `pnpm exec wrangler login`。
3. 執行 `pnpm exec wrangler d1 create grouppilot`，將回傳的 database_id 填進 wrangler.jsonc。
4. 執行 `pnpm exec wrangler r2 bucket create grouppilot-files`。
5. 選定 Workers 子網域；可先用 Cloudflare 提供的 workers.dev 網址，之後改自己的網域。實際網址由 Cloudflare 帳號決定，不要直接照抄範例網址。

## 二、Google / GitHub OAuth

Google：在 Google Cloud Console 建立 Web application OAuth client。設定品牌與同意畫面；若保持測試模式，將要試用的帳號加入測試使用者。

- 本機回呼：`http://localhost:3000/api/auth/callback/google`
- 正式回呼：`https://你的正式網址/api/auth/callback/google`
- [Google 設定說明](https://better-auth.com/docs/authentication/google)

GitHub：在 Developer settings 建立 OAuth App。本機與正式環境建議分別建立。

- 本機回呼：`http://localhost:3000/api/auth/callback/github`
- 正式回呼：`https://你的正式網址/api/auth/callback/github`
- [GitHub 設定說明](https://better-auth.com/docs/authentication/github)

Client Secret 請填入本機環境檔或 Cloudflare Secrets，不要貼到聊天或提交 Git。

## 三、本機驗證

`.env` 已預留：

```dotenv
AUTH_URL=http://localhost:3000
AUTH_SECRET=至少32字元的隨機值
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

```sh
pnpm install
pnpm exec wrangler d1 migrations apply DB --local --config wrangler.jsonc
pnpm dev
```

套件不提供假登入。未設定提供者時按鈕停用；測試工具只在本機建立虛構工作階段，不會註冊假 Google 帳號。

## 四、正式設定與部署

建立忽略 Git 的 `.env.production.local`，填入正式 HTTPS AUTH_URL、另一組 AUTH_SECRET 及兩組 OAuth 憑證。正式與本機建議使用不同秘密。

執行 `pnpm deploy:check` 檢查本機設定；這不代表 Cloudflare 帳號已登入，也不代表遠端 Secrets 已設定。

以 Cloudflare 後台或 `wrangler secret put KEY --config wrangler.jsonc` 設定：

- AUTH_URL、AUTH_SECRET
- GOOGLE_CLIENT_ID、GOOGLE_CLIENT_SECRET
- GITHUB_CLIENT_ID、GITHUB_CLIENT_SECRET
- 原 AI_ENABLED、AI_PROTOCOL、AI_BASE_URL、AI_MODEL、AI_API_KEY、AI_OUTPUT_FORMAT、AI_OPERATOR_TOKEN、AI_DAILY_LIMIT

**不把 .env.production.local 提交或整份發布成靜態檔案。** Runtime 不會自動讀取這個檔案；必須另外設定 Cloudflare Secrets。

執行 `pnpm run deploy` 會依序檢查、建置、套用你自己 D1 的正式遷移，最後發布 Worker。若是新 Worker，Cloudflare 的 secret put 流程可能先要求建立 Worker；可先在後台建立同名 Worker 再配置 Secrets。

完成後用你自己的 Google / GitHub 帳號驗證登入與登出、建立專案、邀請組員、檔案上傳下載及 AI。切換網域時同步更新 AUTH_URL 與 OAuth 回呼網址。

## 五、現有資料搬遷

舊站的 D1 / R2 屬於 Sites 管理的資源，不會因為新建同名資源而出現在你的 Cloudflare 帳號。

目前沒有自動資料搬遷工具。切換前先確認舊站是否已有正式團隊資料；如有，需從舊站匯出專案資料及附件，在新站讓組員登入建立新身分，再逐一確認舊組員 ID 與新帳號的對應後匯入。不能僅依填寫的名稱或未驗證信箱認領他人的貢獻。既有驗收紀錄與檔案歸屬也必須一起保留。

舊站保持運作，等新站與資料核對完成後才通知團隊切換。
