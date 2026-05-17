# Web 安全审计报告 — 2026-05-04

- 审计分支：`audit/security-web-20260504`
- 起点提交：`de70df87` (`origin/dev` HEAD at audit time)
- 范围：仅 [`backend/`](../../backend/) 与 [`frontend/`](../../frontend/)
- 排除：[`mobile/`](../../mobile/)、Cloudflare 部署/Worker 配置、性能、可访问性、纯代码风格
- 审计类型：仅安全（注入 / 鉴权与越权 / 凭据 / SSRF / 文件上传 / 日志敏感字段 / 依赖 CVE 等）
- 产出：本报告。**未对业务代码做任何修改。**

> 严重度定义：
> - **P0**：可被未授权或低权限用户直接利用，影响机密性/完整性/可用性，需立刻处置。
> - **P1**：明显漏洞但需要前置条件（环境配置、社工链、特权接触点），或会显著放大其它漏洞。
> - **P2**：纵深防御缺口、信息泄漏、可被滥用但影响有限。
> - **P3**：硬化建议、文档/默认值不一致、无即时风险。

---

## 1. 摘要

| 严重度 | 后端 | 前端 | 跨栈/基础设施 | 合计 |
| --- | --- | --- | --- | --- |
| P0 | 0 | 1 | 0 | **1** |
| P1 | 6 | 3 | 0 | **9** |
| P2 | 5 | 5 | 0 | **10** |
| P3 | 5 | 4 | 1 | **10** |

依赖 CVE：

| 生态 | 命令 | 结果 |
| --- | --- | --- |
| Composer (PHP) | `composer audit` | **0** advisories（仓库 prod + dev） |
| pnpm (frontend prod) | `pnpm audit --prod --json` | **0** vulnerabilities（334 production deps） |
| pnpm (frontend full) | `pnpm audit --json` | **0** vulnerabilities（593 deps，含 dev） |

依赖面目前没有已披露 CVE，本报告剩余条目都是源码 / 配置 / 默认值层面的问题。

---

## 2. P0 — 必须立即处置

### W-001 (Frontend) 登录 / 邮件验证后跳支持任意 URL 跳转，可被钓鱼利用

- **位置**：
  - [`frontend/src/lib/auth.js`](../../frontend/src/lib/auth.js) 第 428–430 行 `getReturnUrl()` 直接返回查询串 `return` 的原值，未做协议/同源限制。
  - [`frontend/src/components/auth/LoginForm.jsx`](../../frontend/src/components/auth/LoginForm.jsx) 第 77–78、129–130 行：密码与 Passkey 登录成功后调用 `navigate(returnUrl)`。
  - [`frontend/src/pages/VerifyEmailPage.jsx`](../../frontend/src/pages/VerifyEmailPage.jsx) 第 29–30、71–88 行：邮箱验证完成后用 `searchParams.get('return')` 拼接 `navigate(target)`。
- **类别**：OWASP A01:2021 — 失效的访问控制 / Open Redirect。
- **复现**：
  1. 攻击者构造 `https://app.carbontrackapp.com/auth/login?return=https://evil.example/`（或 `//evil.example`）。
  2. 受害者点击后正常完成登录。
  3. 登录成功 `navigate('https://evil.example/')` 直接跳转到外站，攻击者展示伪造页面继续骗取凭据/支付/code。
- **影响**：钓鱼放大；联动应用内任何 `Open in new tab`、注销、邮箱验证等凭据流。
- **修复建议**：抽出统一 helper，仅允许同源相对路径（必须以 `/` 开头且**不**以 `//` 开头），失败回落到默认页（如 `/dashboard`）。可参考：

  ```js
  function safeReturnPath(raw) {
    if (typeof raw !== 'string') return '/dashboard';
    if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
    return raw;
  }
  ```

- **紧急回滚 / 降级**：不需要数据回滚，单点前端发布即可消除。

---

## 3. P1 — 短期内必须修复

### B-101 (Backend) 登录路径未对接已实现的暴力破解锁定

- **位置**：[`backend/src/Controllers/AuthController.php`](../../backend/src/Controllers/AuthController.php) 第 288–333 行 `login()`。`AuthService` 已实现 [`recordLoginAttempt()`](../../backend/src/Services/AuthService.php) 与 [`isAccountLocked()`](../../backend/src/Services/AuthService.php)（约 455–527 行），但 `login()` 既不记录也不查询。
- **类别**：OWASP A07:2021 — 鉴别与会话管理失败。
- **复现**：使用脚本对单个账号进行密码字典攻击，每次先获取一次 Turnstile 通过即可（PoW 难度 16，单次约 65k 哈希，亚秒级），无服务端账号或 IP 锁定。
- **影响**：凭据填充 / 字典爆破；与 W-201（JWT 落 localStorage）联动后果加重。
- **修复建议**：
  - 在 `login()` 解析凭据前先调用 `isAccountLocked($identifier, $ip)`，命中则返回 429。
  - 验证密码失败时调用 `recordLoginAttempt(..., false)`；成功时调用 `recordLoginAttempt(..., true)` 并清理。
  - 同步在 `AuthMiddleware` 失败路径加上 `auth_failure` 计数，避免攻击者直接刷已签发但被吊销 token 的 401 来绕过。

### B-102 (Backend) `system_logs` 与 `error_logs` 会持久化敏感字段

- **位置**：
  - [`backend/src/Middleware/RequestLoggingMiddleware.php`](../../backend/src/Middleware/RequestLoggingMiddleware.php) 第 92–105 行：把整个 `parsedBody`、`response_body` 写入 `system_logs`。
  - [`backend/src/Services/SystemLogService.php`](../../backend/src/Services/SystemLogService.php) 第 87–98 行：`sanitizeBody()` 仅对**顶层**键 `password,pass,token,authorization,auth,secret` 脱敏。
  - [`backend/src/Services/ErrorLogService.php`](../../backend/src/Services/ErrorLogService.php) 第 27–47、176–184、218–232 行：`client_post` 走 `normalizeBody` 不脱敏；`filterServer` 仅清掉 `PHP_AUTH_PW`，`HTTP_AUTHORIZATION` 仍可能落库。
- **类别**：OWASP A02:2021 — 加密失败 / 敏感数据暴露；A09:2021 — 安全日志与监控失败。
- **复现**：
  1. 用户调用 `/api/v1/auth/login`，`request_body` 含 `password`（顶层会脱敏）。
  2. 但 `/api/v1/auth/verify-email`（含 `code`、`token`）、`/api/v1/auth/reset-password`（`token`、`password`、`confirm_password`）、`/api/v1/auth/change-password`（`current_password`、`new_password`、`confirm_password`）多数字段名不在脱敏白名单内。
  3. `response_body` 含登录返回的 JWT 文本会原文落库（`AuthController::login` 返回 `data.token`）。
- **影响**：任何能读取 `system_logs` / `error_logs` / 数据库备份的人（含管理员、DBA、备份外泄）拿到明文重置 token、邮箱验证码、JWT。
- **修复建议**：
  - `SystemLogService::sanitizeBody` 改为递归脱敏，扩展键集到 `password, pass, current_password, new_password, confirm_password, token, authorization, auth, secret, api_key, access_token, refresh_token, code, otp, verification_code, verification_token, reset_token, cf_turnstile_response, pow_nonce, pow_challenge`。
  - `RequestLoggingMiddleware` 在写入前白名单字段截断 / hash，对登录、验证码、密码相关路径直接不写 `request_body` / `response_body`，或只保留长度与字段名清单。
  - `ErrorLogService::filterServer` 也应把 `HTTP_AUTHORIZATION`、`HTTP_X_TURNSTILE_TOKEN`、`HTTP_X_CRON_KEY`、`HTTP_X_SLA_SWEEP_KEY` 全部 redact。
  - `AuditLogService::$sensitiveFields`（[`AuditLogService.php`](../../backend/src/Services/AuditLogService.php) 第 28–31 行）补齐 `verification_code, code, otp, reset_token, cf_turnstile_response`。

### B-103 (Backend) `APP_ENV=testing` 时 `AuthMiddleware` / `AdminMiddleware` 直接放行为管理员

- **位置**：
  - [`backend/src/Middleware/AuthMiddleware.php`](../../backend/src/Middleware/AuthMiddleware.php) 第 28、79–103 行：当 `APP_ENV=testing` 且 token 解析失败，注入 `role=admin, is_admin=true, is_support=true` 的伪造用户继续放行。
  - [`backend/src/Middleware/AdminMiddleware.php`](../../backend/src/Middleware/AdminMiddleware.php) 第 27、49–66 行：`testing` 模式下未登录会被赋 `is_admin=true`，且 `isAdminUser` 检查命中也不返回 403。
  - [`backend/public/index.php`](../../backend/public/index.php) 第 38–42 行：`APP_ENV` 缺省值是 `development`，不是 `production`。
- **类别**：OWASP A05:2021 — 安全配置错误；A01 — 失效的访问控制。
- **复现**：在生产部署中误配 `APP_ENV=testing`（CI 模板复制、容器环境变量被覆盖、错误的 K8s ConfigMap 等），任何请求都会以管理员身份执行；攻击者如能影响 env（如供应链 / 同机其他服务），可一击穿透整个鉴权层。
- **影响**：完整鉴权绕过 + 管理员越权。
- **修复建议**：
  - 以白名单标志取代 `APP_ENV=testing` 的隐式行为：新增显式 `ALLOW_TEST_AUTH_FALLBACK=true` 并要求与 `APP_ENV=testing` 同时为真，否则永远返回 401/403。
  - 部署侧增加启动期断言：若 `APP_ENV=production` 同时存在该 fallback 路径触发条件则 fail-fast。
  - 把 `index.php` 的 `APP_ENV` 默认值改为 `production`，让"未配置"的部署最稳态而非最宽松。

### B-104 (Backend) Turnstile 校验在 `APP_ENV=testing` 或 `TURNSTILE_BYPASS` 下整体跳过

- **位置**：[`backend/src/Services/TurnstileService.php`](../../backend/src/Services/TurnstileService.php) 第 46–49 行（条件分支强制 `success=true`），[`backend/src/Middleware/TurnstileMiddleware.php`](../../backend/src/Middleware/TurnstileMiddleware.php) 第 43–45 行（同样在 `testing` 环境直通）。
- **类别**：OWASP A05:2021 — 安全配置错误。
- **复现**：与 B-103 同理：env 误配后注册 / 登录 / 验证码 / 密码重置 / 兑换 / 提交碳记录全部失去机器人保护，可大规模刷量。
- **影响**：失去机器流量防护，会同时放大 B-101（无锁定的密码爆破）、邮件配额、虚假兑换等。
- **修复建议**：
  - 同样改为显式 `ALLOW_TURNSTILE_BYPASS=true` 才生效；当 `APP_ENV=production` 时无论如何都不允许跳过。
  - 部署 healthcheck 启动时校验：若 `TURNSTILE_SECRET_KEY` 为占位值（`.env.example` 仍是 `your-turnstile-secret-key`）则拒绝启动。

### B-105 (Backend) "移动端 PoW" 通道可被任意 HTTP 客户端冒充以跳过 Turnstile

- **位置**：[`backend/src/Controllers/AuthController.php`](../../backend/src/Controllers/AuthController.php) 第 1361–1405 行 `verifyClientChallenge` 与 `shouldUseMobileProofOfWork`。
- **类别**：OWASP A07 — 鉴别失败。
- **复现**：客户端发送 `body.client_type=mobile`、Header `X-Client-Platform: mobile`，并省略 `Origin` 与 `Sec-Fetch-Site`（curl/Go/Postman 都默认不带），即可改走 PoW；难度 16 的 SHA-256 PoW 单次平均 ~65k 次哈希，普通服务器毫秒级完成，攻击者可批量解题。
- **影响**：在网页端注册 / 登录 / 验证码 / 找回密码场景绕过 Turnstile，与 B-101、B-102、邮件滥用叠加。
- **修复建议**：
  - 收紧"必须是移动端"判定：除头部/字段之外要求带签名的客户端证明（如签名时间戳 + 公钥固定），或仅信任来自移动端反向代理的指定网络段。
  - 把 PoW 难度做成动态：当某 IP/账号近期失败次数高时升级到难度 22+（计算量 64MB hashes）。
  - PoW 通道也应有 IP 频次封禁。

### B-106 (Backend) `IdempotencyMiddleware` 仅以 `X-Request-ID` 为键，可跨用户重放

- **位置**：[`backend/src/Middleware/IdempotencyMiddleware.php`](../../backend/src/Middleware/IdempotencyMiddleware.php) 第 36–91、108–135 行：`IdempotencyRecord::where('idempotency_key', $key)` 只按 key 查找，未与 `user_id`、URI、body hash 绑定即返回缓存的响应体。
- **类别**：OWASP A01 — 失效的访问控制；A04 — 不安全设计。
- **复现**：
  1. 攻击者偶然或社工得知某用户曾用过的 UUID（如来自前端日志、HAR 文件、客户端崩溃报告、CI 服务器历史），24 小时内向 `/api/v1/messages/broadcast` 等敏感路径回放该 UUID。
  2. 拿到上一次缓存的 JSON 响应体（可能包含他人广播草稿、全量收件人统计、已发消息内容）。
- **影响**：泄漏其它管理员或用户上一次写操作的完整响应（含潜在敏感数据 / 被广播的草稿内容）。
- **修复建议**：将 `idempotency_key` 在表上和查找时都和 `user_id`（鉴权后）+ `request_method` + `request_uri` + `sha256(request_body)` 联合索引；不同用户复用相同 key 视为新请求；缓存返回前再次校验当前用户 = 原 user_id。

### W-201 (Frontend) JWT 长存 localStorage，与 XSS 联动放大风险

- **位置**：
  - [`frontend/src/lib/auth.js`](../../frontend/src/lib/auth.js) 第 106–116、141–180 行：`auth_token` / `user_info` 直接 `localStorage`。
  - [`frontend/src/lib/api.js`](../../frontend/src/lib/api.js) 第 32–37、82–93、475–484 行：axios 拦截器从 `localStorage` 读取并写入 token。
- **类别**：OWASP A02:2021 — 加密失败；与 XSS 类问题联动。
- **复现**：任意 XSS（含 W-202 指出的链接策略漏洞、第三方依赖未来 CVE、扩展程序）即可读出 JWT，攻击者随后冒用直至 `exp`。后端目前没有版本号 / 撤销表机制，无法服务端吊销。
- **影响**：长期会话劫持。
- **修复建议**：
  - 优先方案：迁移至 HttpOnly + Secure + SameSite=strict 的 cookie 会话，配合 CSRF token 或仅同源使用的 Bearer cookie 模式。
  - 过渡方案：缩短 JWT TTL（目前 86400s）、配合后端版本号字段做"密码改完即失效"（见 B-201）、引入设备指纹绑定。

### W-202 (Frontend) Diagnostics 页面可向任意 URL 发请求且默认带管理员 Bearer

- **位置**：[`frontend/src/pages/admin/Diagnostics.jsx`](../../frontend/src/pages/admin/Diagnostics.jsx) 第 894–927 行（特别是 903–907 行 `Authorization: Bearer <localStorage>`）。
- **类别**：OWASP A05 — 安全配置错误；潜在凭据外泄。
- **复现**：管理员被诱导粘贴恶意 URL（如 webhook.site）到 Diagnostics 工具栏，前端会带上 `auth_token` 进行 fetch，攻击者拿到管理员 JWT。
- **影响**：管理员令牌被外泄，等同账户接管。
- **修复建议**：
  - 将允许的目标域硬编码为 `API_BASE_URL` 的 origin（或一组明确的内部地址）。
  - 任何非内部目标自动剥离 Authorization 头并显著告警。
  - 增加二次确认与文案"该工具可能将凭据发送给目标主机"。

### W-203 (Frontend) `VITE_DEV_AUTH_TOKEN` 误带入生产构建即注入管理员凭据

- **位置**：[`frontend/src/lib/auth.js`](../../frontend/src/lib/auth.js) 第 197–218 行 `bootstrapDevAuthFromEnv()`。当 `VITE_ENABLE_DEV_AUTH_FROM_ENV=true` 且 `VITE_DEV_AUTH_TOKEN` 非空时，启动期把假 token / 假管理员资料注入 `localStorage`。
- **类别**：OWASP A05 — 安全配置错误。
- **复现**：CI 中误把开发用 `.env` 带入生产构建（同时设置上述两个变量），所有访客的浏览器自动获得该 token，相当于"任意用户成为指定身份"。
- **影响**：账号接管 / 管理员伪冒，取决于注入身份。
- **修复建议**：
  - 在 `bootstrapDevAuthFromEnv` 顶部加 `if (import.meta.env.PROD) return;`。
  - CI 构建脚本对生产 build 命令做断言：`grep -L 'VITE_DEV_AUTH_TOKEN' .env.production`。
  - Vite `define` 中显式将这些 key 设为 `JSON.stringify(undefined)`（生产）。

---

## 4. P2 — 中期改进

### B-201 (Backend) 修改密码后旧 JWT 仍然有效

- **位置**：[`backend/src/Controllers/AuthController.php`](../../backend/src/Controllers/AuthController.php) 第 899–966 行 `changePassword`；[`backend/src/Services/AuthService.php`](../../backend/src/Services/AuthService.php) 第 82–137 行 `verifyToken`/`validateToken`，无任何 token 版本 / 黑名单字段。
- **类别**：OWASP A07 — 鉴别与会话失败。
- **影响**：旧设备 / 已被盗的 token 在 `exp` 之前仍可继续访问。
- **修复建议**：在 `users` 表加 `token_version` int，`generateToken()` 写入 payload，`verifyToken()` 必须比对当前 DB 值；改密 / 注销全部 / 撤销 passkey 时递增。

### B-202 (Backend) 直传 / 多分片 confirm 阶段未做内容嗅探

- **位置**：[`backend/src/Controllers/FileUploadController.php`](../../backend/src/Controllers/FileUploadController.php) 第 54–164 行 `getDirectUploadPresign`、第 170–268 行 `confirmDirectUpload`、第 826–918 行 `completeMultipartUpload`；与表单上传路径 [`backend/src/Services/CloudflareR2Service.php`](../../backend/src/Services/CloudflareR2Service.php) 的 `validateFile` (700+ 行 `isValidImageContent`) 不同，直传链路只检查客户端声明的 MIME / 扩展名。
- **类别**：OWASP A05 — 安全配置错误；存储型 XSS / 内容混淆。
- **影响**：可上传 SVG / HTML / polyglot 文件到 `avatars`、`products`、`activities`、`badges` 等公网可读目录；若 R2 公开域与登录态共用 cookie/origin，将形成存储型 XSS。
- **修复建议**：
  - `confirm` 阶段对实际对象做 HEAD + 头部字节嗅探（finfo 或专用魔数表），对图像类要求 magic 与声明一致；视频/文档同理。
  - R2 / CDN 端强制 `Content-Disposition: attachment`，或对非图片资源加 `X-Content-Type-Options: nosniff`、`Content-Security-Policy: sandbox` 等响应头。
  - 头像 / 产品图等"必须当作图片渲染"的目录仅允许 `image/jpeg|image/png|image/webp` 实际魔数。

### B-203 (Backend) `r2Diagnostics` 对任意已登录用户开放，泄漏存储配置

- **位置**：[`backend/src/routes.php`](../../backend/src/routes.php) 第 375 行（`/files/r2/diagnostics` 仅挂 `AuthMiddleware`），[`backend/src/Controllers/FileUploadController.php`](../../backend/src/Controllers/FileUploadController.php) 第 1292–1304 行 `r2Diagnostics`，落地到 [`backend/src/Services/CloudflareR2Service.php`](../../backend/src/Services/CloudflareR2Service.php) `diagnostics()`（约 1062–1114 行）。
- **类别**：OWASP A01 — 失效的访问控制。
- **影响**：任意普通用户可获取 bucket 名、endpoint、TLS 校验开关、签名探测信息，便于后续针对性攻击或社工。
- **修复建议**：路由叠加 `AdminMiddleware`，或返回脱敏摘要（true/false + 错误码），不暴露具体字符串。

### B-204 (Backend) `LeaderboardController` 触发 key 通过 query 串传递

- **位置**：[`backend/src/Controllers/LeaderboardController.php`](../../backend/src/Controllers/LeaderboardController.php) 第 25–52 行：`$query['key']`/`trigger_key`。
- **类别**：A09 — 安全日志与监控失败（敏感数据进入访问日志）。
- **影响**：`LEADERBOARD_TRIGGER_KEY` 常会落入 nginx access log、CDN 日志、`system_logs` URL 字段，比 header 暴露面更广。
- **修复建议**：改成必须以 `X-Leaderboard-Trigger-Key` header 传入；保留 query 兼容时禁用其在日志中的写入。

### B-205 (Backend) Audit 与系统日志的脱敏字典缺漏（A02 复加项）

- **位置**：[`backend/src/Services/AuditLogService.php`](../../backend/src/Services/AuditLogService.php) 第 28–31 行 `$sensitiveFields`；与 B-102 配对，单独列出以便 patch 跟踪。
- **影响**：审计日志中可能写入 `verification_code`、`code`、`otp`、`reset_token`、`cf_turnstile_response`、`pow_nonce` 等明文。
- **修复建议**：与 B-102 一并扩展集合，并改为递归扫描嵌套数组。

### W-204 (Frontend) `sanitizeMessageHtml` / `announcementHtml` 允许 `//` 协议相对链接

- **位置**：
  - [`frontend/src/lib/sanitizeMessageHtml.js`](../../frontend/src/lib/sanitizeMessageHtml.js) 第 3、44–71 行 `SAFE_URI_PATTERN`。
  - [`frontend/src/lib/announcementHtml.js`](../../frontend/src/lib/announcementHtml.js) 第 6–8、83–92、164–173 行。
  - 渲染面：[`frontend/src/components/messages/MessageDetailModal.jsx`](../../frontend/src/components/messages/MessageDetailModal.jsx)、[`frontend/src/components/content/AnnouncementContent.jsx`](../../frontend/src/components/content/AnnouncementContent.jsx)。
- **类别**：OWASP A03 — 注入（变体：开放重定向通过站内消息链接）。
- **复现**：管理员或 AI 生成的消息中包含 `<a href="//evil.example/">点我</a>`，DOMPurify 路径会保留 `//`，浏览器解析为绝对协议跳转。
- **影响**：站内信 / 公告中发起跨站跳转，钓鱼放大。
- **修复建议**：改为后处理，把 `//` 起始的链接 reject 或 prefix `https:`；正则收紧到 `^(https?:|mailto:|tel:|#|\/(?!\/))`。

### W-205 (Frontend) 工单详情页直接以 API 返回的 URL 渲染附件链接

- **位置**：[`frontend/src/pages/support/TicketDetailPage.jsx`](../../frontend/src/pages/support/TicketDetailPage.jsx) 第 75–79、85–87、105–107 行。
- **类别**：A03 — 注入（链接型 XSS / 钓鱼）。
- **影响**：若后端返回的 `download_url` / `public_url` 不可信（被另一管理员篡改、上游 R2 域被错误指向），点击会触发 `javascript:` / `data:` 等 scheme。
- **修复建议**：渲染前统一过 `safeExternalHref(url)` 校验：仅允许 `https:` 与项目 CDN 域；其它一律剥离或转纯文本。

### W-206 (Frontend) `initAuth` 已定义但未在入口挂载

- **位置**：[`frontend/src/lib/auth.js`](../../frontend/src/lib/auth.js) 第 536–565 行 `initAuth`，但 grep 显示无任何 import 调用。
- **类别**：A05 — 安全配置错误。
- **影响**：原本期望主动 silent refresh + 401 全局处理的逻辑实际未生效，与 W-201 联动可能让旧 token 一直被使用直到完全过期，难以及时让"密码已改"的服务端策略生效。
- **修复建议**：在 `App` 启动处 `import { initAuth } from '@/lib/auth'; initAuth();`，或删除未使用代码避免误导。

### W-207 (Frontend) `api.js` 默认 baseURL 指向 dev 环境

- **位置**：[`frontend/src/lib/api.js`](../../frontend/src/lib/api.js) 第 4–14 行：`DEFAULT_API_BASE_URL = 'https://dev-api.carbontrackapp.com/api/v1'`。
- **类别**：A05 — 安全配置错误。
- **影响**：生产构建若未注入 `VITE_API_URL`，用户请求会发到 dev API；若 dev 与 prod 数据库不同步，导致登录到错误环境，凭据可能被夹在中间。
- **修复建议**：未注入时直接 `throw new Error('VITE_API_URL must be set')`；CI 构建里强制配置该变量。

### W-208 (Frontend) `AnnouncementEmailPreview` iframe 使用 `allow-same-origin` 沙箱

- **位置**：[`frontend/src/components/content/AnnouncementEmailPreview.jsx`](../../frontend/src/components/content/AnnouncementEmailPreview.jsx) 第 14–25 行。
- **类别**：A05 — 安全配置错误。
- **影响**：DOMPurify 已剥离 `<script>`，但 `allow-same-origin` 让 srcDoc 内任何 URL 都可读取父窗 cookie / DOM。一旦未来某个 sanitizer 漏洞放过 `<iframe>`、`<object>` 等会触发外部加载，损害可被放大。
- **修复建议**：移除 `allow-same-origin`；如确需读取链接信息，改在父窗口内做并通过 `srcdoc` + 严格 `sandbox=""` 渲染。

---

## 5. P3 — 硬化建议

### B-301 (Backend) `/api/v1/products` POST/PUT/DELETE 缺路由级 `AuthMiddleware`

- **位置**：[`backend/src/routes.php`](../../backend/src/routes.php) 第 184–193 行 vs 控制器 [`backend/src/Controllers/ProductController.php`](../../backend/src/Controllers/ProductController.php) 第 1029–1035、1116–1122、2069–2075 行的 `isAdminUser` 自检。
- **影响**：当前依赖控制器内显式调用 `getCurrentUser`，未中央化审计 / 失败响应。一次重构忘记 `getCurrentUser` 即可造成匿名管理员写入。
- **修复建议**：与 `/admin/products` 子组合并，或直接对 `/products` 写方法叠加 `AuthMiddleware`+`AdminMiddleware`。

### B-302 (Backend) `JWT_LEEWAY` 未设上限

- **位置**：[`backend/src/Services/AuthService.php`](../../backend/src/Services/AuthService.php) 第 85–90 行：`(int)$_ENV['JWT_LEEWAY']`，默认 60。
- **影响**：env 配置失误时可填非常大的整数，使过期 token 仍被接受。
- **修复建议**：`max(0, min((int)$_ENV['JWT_LEEWAY'], 300))`。

### B-303 (Backend) `AuthService::generateUUID` 用 `mt_rand`

- **位置**：[`backend/src/Services/AuthService.php`](../../backend/src/Services/AuthService.php) 第 329–339 行。
- **影响**：当前调用方仅作业务 ID（如 `users.uuid` 自动绑定），但任何后续把它当成秘密 token（重置、邀请码等）都会立即破口。
- **修复建议**：换成 [`backend/src/Support/Uuid.php`](../../backend/src/Support/Uuid.php) `Uuid::generateV4()`（其实现使用 `random_bytes`，已被 `AuthController::register` 等处使用）。

### B-304 (Backend) `index.php` 中 `APP_ENV` 默认 `development`

- **位置**：[`backend/public/index.php`](../../backend/public/index.php) 第 38–42 行。
- **影响**：未配置环境变量时跑出"开发模式"，错误堆栈/调试信息可能更详尽，CORS 自动加 localhost 等。
- **修复建议**：默认 `production`，让"未配置"为最严格。

### B-305 (Backend) `TurnstileMiddleware` 类存在但未在 `routes.php` 全局注册

- **位置**：[`backend/src/Middleware/TurnstileMiddleware.php`](../../backend/src/Middleware/TurnstileMiddleware.php) 与 [`backend/src/routes.php`](../../backend/src/routes.php)（仅注册 `RequestLoggingMiddleware`）。
- **影响**：Turnstile 校验完全靠 `AuthController::verifyClientChallenge` 内联，遗漏一个分支即丢失保护。
- **修复建议**：在 `routes.php` 全局 `add(TurnstileMiddleware::class)`，控制器内移除重复校验，或反过来全部内联且单元测试覆盖每个入口。

### IS-301 (Cross) `CLAUDE.md` 文档化的 `x-debug-token=9c0d4f1a-...` 在仓库内已无实现

- **位置**：[`CLAUDE.md`](../../CLAUDE.md)、[`AGENTS.md`](../../AGENTS.md) 等多处文档；后端 `grep` 无任何代码对该 header 做特判。
- **影响**：当前不是漏洞，但"文档让人以为有调试旁路"是危险心智模型，未来开发者可能照着实现，产生真实的鉴权旁路。
- **修复建议**：从所有 agent 文档中删除该说明，或在文档中标明"该机制未启用"。

### W-301 (Frontend) `ProtectedRoute` 仅按 `localStorage.user_info.is_admin` 判定管理路由

- **位置**：[`frontend/src/components/auth/ProtectedRoute.jsx`](../../frontend/src/components/auth/ProtectedRoute.jsx) 第 99–107、136–140 行。
- **影响**：仅 UI 层，**不**等于鉴权漏洞；纵深防御缺失。任何能写 localStorage 的攻击者都能渲染管理页面。
- **修复建议**：管理路由进入时再调用 `/api/v1/users/me` 或 `/api/v1/admin/stats` 等管理探测接口验证后端态。

### W-302 (Frontend) 无 CSP / 缺乏严格内容策略

- **位置**：根 [`frontend/index.html`](../../frontend/index.html) 没有 `Content-Security-Policy`；前端打包后由静态托管下发。
- **影响**：W-201 / W-204 等 XSS 类问题损失上限拉到最高；难以缓解第三方 supply chain。
- **修复建议**：托管层（Cloudflare Pages / Workers / Nginx）下发严格 CSP，最少包含 `default-src 'self'; img-src 'self' https://<r2-cdn> data:; connect-src 'self' <api-origin>; script-src 'self'; object-src 'none'; frame-ancestors 'none';`。

### W-303 (Frontend) `i18next` `escapeValue: false` 与 `dangerouslySetInnerHTML` 共存的潜在路径

- **位置**：[`frontend/src/lib/i18n.js`](../../frontend/src/lib/i18n.js) 第 269–272 行。React 会自动转义文本节点，所以默认用法安全；风险出现在未来用 `<Trans components>` 或将翻译 token 喂给 `dangerouslySetInnerHTML`。
- **修复建议**：约束 lint 规则禁止把 `t(...)` 直接交给 `dangerouslySetInnerHTML`；可重新打开 escape 并改用组件插值。

### W-304 (Frontend) `sessionStorage` 残留于登出流程

- **位置**：[`frontend/src/components/layout/Navbar.jsx`](../../frontend/src/components/layout/Navbar.jsx) 第 177–187 行 `handleLogout` 仅清 `auth_token` / `user_info`。
- **影响**：`pending_verification_email`、`verification_return_path` 等状态会被下一登录用户继承，可能产生 UI 误导（非凭据泄漏）。
- **修复建议**：登出时同步 `sessionStorage.clear()` 或清掉已知的项目 prefix。

---

## 6. 审计方法与覆盖范围

- 静态扫描：`Grep` + `code-review-graph` MCP / 文件读取。重点扫了 `whereRaw`、`selectRaw`、`DB::raw`、`prepare("…{$var}…")`、`shell_exec/exec/proc_open/popen/system/passthru`、`unserialize/eval/assert`、`simplexml_load_*`、`include $var`、`preg_replace /e`、`dangerouslySetInnerHTML`、`window.location`、`localStorage`、`sessionStorage`、`postMessage`、`innerHTML`、`new Function`、`eval(`。
- 路由 vs 鉴权交叉：手动比对 [`backend/src/routes.php`](../../backend/src/routes.php) 与 `Auth/Admin/Support` 中间件附挂；同时抽样验证敏感控制器（`FileUpload`、`Product`、`Message`、`SupportTicket`、`Avatar`、`AdminCron`、`Cron`、`Leaderboard`）。
- 配置审查：[`backend/.env.example`](../../backend/.env.example)、[`backend/public/index.php`](../../backend/public/index.php)。
- 依赖：`composer audit` (`backend/`)、`pnpm audit --prod` 与 `pnpm audit` (`frontend/`)。

未覆盖（建议后续单独跟进）：
- 完整遍历每个 controller 的 `ORDER BY` / `WHERE` 动态拼接（本次抽样；高风险候选已列）。
- `AdminAi*` LLM 工具调用链路的提示注入 / 输出注入（与 admin AI 业务面紧耦合，建议单独审计）。
- Cloudflare Workers / R2 部署侧实际响应头（CSP、Content-Disposition）— 当前判断基于源码默认值。
- Mobile 客户端（按指令排除）。
- 动态测试 / fuzz / 真实凭据下的越权验证（本次仅静态分析）。

---

## 7. 依赖审计原始输出快照

### 7.1 `composer audit`（backend）

```
No security vulnerability advisories found
```

### 7.2 `pnpm audit --prod --json`（frontend）

```json
{
  "actions": [],
  "advisories": {},
  "muted": [],
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 0,
      "moderate": 0,
      "high": 0,
      "critical": 0
    },
    "dependencies": 334,
    "devDependencies": 0,
    "optionalDependencies": 0,
    "totalDependencies": 334
  }
}
```

### 7.3 `pnpm audit --json`（frontend，含 dev 依赖）

```json
{
  "vulnerabilities": {
    "info": 0,
    "low": 0,
    "moderate": 0,
    "high": 0,
    "critical": 0
  },
  "dependencies": 593
}
```

---

## 8. 处置建议（修复优先级）

1. 立即（同周内）：W-001（Open Redirect）；与之关联的 W-302（CSP）一并发布会显著降低相关风险。
2. 一周内：B-101（登录锁定）、B-102 / B-205（日志脱敏）、B-103 / B-104（生产 env 防误配）、W-201（重新评估 token 存储与 TTL）、W-202 / W-203（管理员凭据 / 开发凭据外泄路径）。
3. 两周内：B-105、B-106、B-201、B-202、B-203、B-204、W-204、W-205、W-206、W-207、W-208。
4. 持续硬化（季度）：P3 全部，配合架构决策（HttpOnly 会话、CSP、token 版本机制、文件管道单一化）。

> 本报告由 `audit/security-web-20260504` 分支基于 `origin/dev@de70df87` 静态扫描产出，未对生产数据库或正在运行的服务做任何主动测试，亦未修改任何业务代码。

---

## 9. 修复追踪 (Remediation Log)

> 此节记录本审计 P0/P1 条目在分支 `audit/security-web-20260504` 上的处置情况。每条仅追加，不修改原条目正文。验证基线：`composer test`（725 用例，8 跳过，0 失败）、`pnpm lint`、`pnpm build` 均通过。

| ID | 状态 | 修复提交 | 备注 |
| --- | --- | --- | --- |
| W-001 | 已修复 | `e02461c1 fix(frontend): 同源以归，斥外跳之患` | 抽出 `frontend/src/lib/safeReturn.js`，`getReturnUrl` / `LoginForm` / `VerifyEmailPage` 三处 navigate 站点全部经此筛；`//`、`/\\`、`://`、控制符、超长（>1024）皆退回默认。受测试基础设施缺位限制，前端测试以后端 PHPUnit 同步验证（W-001 不直接落后端，残留风险已经强校验消除）。 |
| B-101 | 已修复 | `c48039c0 fix(backend): 缚账于锁，以拒爆破` | `AuthController::login` 在密码核验前调用 `AuthService::isAccountLocked`；锁定返 429 `ACCOUNT_LOCKED` 并写 `auth_login_locked` 审计；密码错与成功均调用 `recordLoginAttempt`。OpenAPI 添 429 响应。 |
| B-102 / B-205 | 已修复 | `fb8cf699 chore(backend): 添置 token_version 列，渐进强化凭据生命` + `d9c5d94b fix(backend): 涤日志机敏，递归而无遗` | 新立 `backend/src/Support/SensitiveDataRedactor.php` 共用脱敏字典（密码 / 令牌 / OTP / 验证码 / 重置 / Turnstile / PoW / mobile client token / Cron / SLA / `HTTP_X_DEBUG_*`）；`SystemLogService` / `AuditLogService` / `ErrorLogService` 全部递归走查，并加深度/循环防护。`RequestLoggingMiddleware` 对 `/api/v1/auth/(login|register|refresh|change-password|reset-password|verify-email|send-verification-code|forgot-password)` 之 `request_body` / `response_body` 直接写 `[REDACTED]`，仅留 status 与 duration。 |
| B-103 / B-304 | 已修复 | `698adacc fix(backend): 测纵之径需显，恕不再默放` + `3ea2c64a test(backend): 测纵之配显出，免新关闭旧测` | `AuthMiddleware` / `AdminMiddleware` 之 testing fallback 改为必须并配 `ALLOW_TEST_AUTH_FALLBACK=true` 方启；`backend/public/index.php` 默认 `APP_ENV` 由 `development` 改 `production`；`phpunit.xml` 与 `tests/bootstrap.php` 显式置 `ALLOW_TEST_AUTH_FALLBACK=true` 以续旧测。 |
| B-104 | 已修复 | `698adacc fix(backend): 测纵之径需显，恕不再默放` | `TurnstileService::verify` 与 `TurnstileMiddleware::process` 改为依 `ALLOW_TURNSTILE_BYPASS`（兼容旧 `TURNSTILE_BYPASS`）显式开关，且 `APP_ENV=production` 永不放过；生产模式下若 `TURNSTILE_SECRET_KEY` 为空或 `your-turnstile-secret-key` 占位值，径返 `secret_unconfigured` 并写 audit + error 日志。 |
| B-105 | 已修复 | `b63d1cc8 fix(backend): 移端 PoW 验，必持令以行` | `shouldUseMobileProofOfWork` 加 `MOBILE_CLIENT_TOKEN` + `X-Mobile-Client-Token`（`hash_equals`）核验，env 未配则全关；该 token 只作移动 PoW 路径分流门槛，不作强客户端证明。`ProofOfWorkService::createChallenge` 增 IP 频次限流（默认 10/分钟），逾限抛 `RuntimeException`，控制器以 429 `POW_RATE_LIMITED` 响应；`pow_attempts` 表已建并按保留窗口清理。`POW_DIFFICULTY` 推荐默认升至 22（`.env.example`）。 |
| B-106 | 已修复 | `44174bbf fix(backend): 幂等之钥绑用户，禁跨户重放` + `fb8cf699` | 新增 `idempotency_records.composite_key` 列与 `(composite_key, user_id)` 唯一键，并去除旧 `idempotency_key` 单列唯一锁；中间件以 `sha256(user_id\|method\|path\|sha256(body)\|sha256(uploaded_files))` 为复合指纹，跨户复用 UUID 或同户不同 endpoint/body/file 均视为新请求；写入与回放均按 `user_id + composite_key` 精确命中。 |
| W-201 | 已修复（过渡路径） | `fb8cf699 chore(backend): 添置 token_version 列` + `31de5306 fix(backend): 凭据有版以衡，岁月易凿之` + `d4052d57 fix(frontend): 凭据生命短而分明，开发钥不入正版` | 后端：`users.token_version` 列已建；`AuthService::generateToken` 写入 `tv` 声明，`validateToken` 校验失配抛 `Token version mismatch`，`AuthMiddleware` 翻译为 401 + `TOKEN_VERSION_MISMATCH`；`changePassword` 与 `resetPassword` 即时调 `AuthService::incrementTokenVersion`；`JWT_LEEWAY` 加 300 上限（同收 B-302）；`.env.example` 默认 `JWT_EXPIRATION` 由 86400 缩为 7200。前端：`initAuth` 在 `main.jsx` 启动期挂载（同时关合 W-206），401 拦截识别 `TOKEN_VERSION_MISMATCH` 并强制重登；refresh 与 `getCurrentUser` 错日志改摘要式，不再印 `error` 全对象。**残留风险**：本批未做完整 HttpOnly cookie 迁移；XSS 仍可读 `auth_token`，但 token TTL 缩短 + 服务端版本吊销 + 显式撤销机制，已显著缩短被劫持窗口；HttpOnly + CSRF 改造留作后续架构决策。 |
| W-202 | 已修复 | `9cf7f7ff fix(frontend): 诊断之具，外域不送凭` | `Diagnostics.jsx` `RequestTester`：以 `new URL(API_BASE_URL).origin` 为白名单，目标非此 origin 时强制 `confirm` 对话；纵勾选自动鉴权或手填 `Authorization` 头，外域请求一律剥离并以 banner 告知；zh / en `admin` 命名空间补两键。 |
| W-203 | 已修复 | `d4052d57 fix(frontend): 凭据生命短而分明，开发钥不入正版` | `bootstrapDevAuthFromEnv` 顶部加 `import.meta.env.PROD` 早返；`vite.config.js` 在 `mode === 'production'` 下以 `define: 'undefined'` 清除 `VITE_DEV_AUTH_TOKEN` / `VITE_DEV_AUTH_USER_INFO_JSON|BASE64` / `VITE_DEV_AUTH_FORCE_SYNC` / `VITE_ENABLE_DEV_AUTH_FROM_ENV` 五键。 |

后续 review 修订：删除误提交的 `.cursor/hooks/state/continual-learning.json`，并将各 agent 指令中未实现的 `x-debug-token` 旁路说明改为“仓库内无该后端绕过机制”。

提交序列（自旧而新）：

```
f6c37ba8 docs(audit): 巡web安危，列疑漏以待修              # 审计基线（修复前）
e02461c1 fix(frontend): 同源以归，斥外跳之患              # W-001
fb8cf699 chore(backend): 添置 token_version 列，渐进强化凭据生命  # 迁移与 .env.example
c48039c0 fix(backend): 缚账于锁，以拒爆破                # B-101
d9c5d94b fix(backend): 涤日志机敏，递归而无遗            # B-102 / B-205
698adacc fix(backend): 测纵之径需显，恕不再默放          # B-103 / B-104 / B-304
b63d1cc8 fix(backend): 移端 PoW 验，必持令以行          # B-105
44174bbf fix(backend): 幂等之钥绑用户，禁跨户重放        # B-106
31de5306 fix(backend): 凭据有版以衡，岁月易凿之          # W-201 backend / B-302
9cf7f7ff fix(frontend): 诊断之具，外域不送凭            # W-202
d4052d57 fix(frontend): 凭据生命短而分明，开发钥不入正版  # W-201 frontend + W-203
3ea2c64a test(backend): 测纵之配显出，免新关闭旧测      # phpunit.xml / bootstrap 显式 opt-in
f2db366d style(frontend): 修订安全返回助手以过 lint 之关  # ESLint no-control-regex
```
