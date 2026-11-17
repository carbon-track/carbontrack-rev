# CarbonTrack 项目全栈开发环境配置指南

本指南为新成员提供完整的全栈（前端 React + 后端 PHP + 移动端 + 微信小程序）开发环境配置说明。

## 目录

- [环境要求](#环境要求)
- [项目获取](#项目获取)
- [后端配置 (PHP/Slim)](#后端配置-phpslim)
- [前端配置 (React/Vite)](#前端配置-reactvite)
- [微信小程序配置](#微信小程序配置)
- [启动运行](#启动运行)
- [技术栈概览](#技术栈概览)
- [常见问题](#常见问题)

---

## 环境要求

### 1. 基础工具
- **Git**: 版本控制
- **Visual Studio Code**: 推荐 IDE
  - 推荐插件：ESLint, Tailwind CSS, PHP Intelephense, Thunder Client (接口测试)

### 2. 后端要求 (PHP)
- **PHP**: v8.2+
- **Composer**: PHP 包管理器
- **MySQL**: 数据库（推荐 v5.7+ 或 v8.0+）

### 3. 前端要求 (Node.js)
- **Node.js**: v20.9+（推荐使用 Node 20 LTS，并与 CI 保持一致）
- **pnpm**: 使用 Corepack 并遵循各目录 `packageManager` 声明（必需，请勿使用 npm 或 yarn）
  - 启用：`corepack enable`

### 4. 微信小程序要求
- **微信开发者工具**: 用于打开 `miniprogram/` 并进行预览、真机调试和上传。

---

## 项目获取

```bash
# 克隆仓库
git clone <repository-url>
cd carbontrack_rev
```

---

### 安装 Git Hooks（推荐）

仓库内已提供可追踪的 `.githooks/`，用于在提交前后执行 `code-review-graph` 检测与增量更新。

- Windows / PowerShell：
  ```powershell
  ./scripts/install-git-hooks.ps1
  ```
- macOS / Linux / Git Bash：
  ```bash
  ./scripts/install-git-hooks.sh
  ```

---
## 后端配置 (PHP/Slim)

### 1. 安装依赖
进入 `backend` 目录并安装 PHP 扩展包：
```bash
cd backend
composer install
```

### 2. 环境变量配置
在 `backend` 根目录下创建 `.env` 文件（可参考 `.env.example`）：
```env
APP_ENV=development
APP_DEBUG=true

# 数据库配置
# DB_CONNECTION 是唯一决定驱动的变量：mysql 或 sqlite（DB_DRIVER / DB_CHARSET / DB_COLLATION 不会被代码读取）
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=carbontrack
DB_USERNAME=root
DB_PASSWORD=your_password

# JWT 配置
JWT_SECRET=your_super_secret_key
JWT_ALGORITHM=HS256

# AI 配置（可选，用于 AI 功能；走 OpenAI 兼容接口，见 backend/.env.example 的 LLM_API_*）
LLM_API_KEY=your_llm_api_key
LLM_API_BASE_URL=https://api.openai.com/v1
LLM_API_MODEL=gpt-4o-mini

# 邮件与应用标识
APP_NAME="CarbonTrack"
MAIL_FROM_ADDRESS=noreply@carbontrack.com
MAIL_FROM_NAME="CarbonTrack Support"
FRONTEND_URL=http://localhost:5173
```

### 3. 数据库初始化
1. **创建数据库**：在 MySQL 中创建名为 `carbontrack` 的数据库。
2. **导入基础结构**：执行 `database/localhost.sql` 以建立初始表结构和基础数据。

    > 注意：表结构以 `localhost.sql` 为准，不是模板里的字符集配置。连接字符集由代码写死为 utf8mb4（见 `backend/src/dependencies.php`），但表级存储字符集由建表语句决定：45 张表使用 InnoDB，其中 44 张的默认字符集为 utf8mb4，error_logs 的默认字符集为 utf8。另有 6 张表使用 MyISAM，其中 `users`、`products`、`transactions`、`points_transactions`、`spec_points_transactions` 这 5 张核心表是 MyISAM + utf8（`schools` 是 MyISAM + utf8mb4）。两层后果：4 字节字符（如 emoji）存不进这 5 张表；MyISAM 不支持事务，积分兑换“先扣积分再扣库存”这两步无法原子回滚。改表引擎/字符集属于数据迁移，不在本文档范围内，动之前先评估。

### 4. 运行后端预览
```bash
composer start
```
此时后端 API 将在 `http://localhost:8080` 运行。您可以访问 `http://localhost:8080/`（健康检查在根路径，返回 `version: 1.0.0`）确认；注意不存在 `/api/v1/health` 这个端点。

---

## 前端配置 (React/Vite)

### 1. 安装依赖
进入 `frontend` 目录并安装 Node 依赖：
```bash
cd ../frontend
pnpm install
```

如果你使用 `nvm` / `fnm` / `asdf` 一类版本管理工具，建议先根据 `frontend/.nvmrc` 切换到 Node 20 再安装依赖。

### 2. 环境变量配置（可忽略，已提供默认值）
在 `frontend` 根目录下创建 `.env` 文件：
```env
# API 基础地址（必需，指向本地后端）
VITE_API_URL=http://localhost:8080/api/v1

# Cloudflare Turnstile 站点密钥（可选，开发环境可留空）
VITE_TURNSTILE_SITE_KEY=your_site_key
```

---

## 微信小程序配置

### 1. 安装校验依赖
进入 `miniprogram` 目录并安装 Node 依赖：
```bash
cd ../miniprogram
pnpm install
```

### 2. 本地打开
使用微信开发者工具打开 `miniprogram/` 目录。个人 IDE 设置请写入 `project.private.config.json`，不要提交到仓库。

### 3. 校验项目结构
```bash
pnpm validate
```

---

## 启动运行

1. **启动后端**（端口 8080）：
   ```bash
   cd backend
   composer start
   ```

2. **启动前端**（端口 5173）：
   ```bash
   cd frontend
   pnpm dev
   ```

3. **打开微信小程序**：
   使用微信开发者工具打开 `miniprogram/`。

---

## 技术栈概览

### 后端 (Backend)
- **Framework**: Slim 4 (Micro-framework)
- **数据访问**：主要使用原生 PDO，商品、认证和积分等链路直接执行 SQL。部分控制器和服务使用 Eloquent，例如学校、工单自动化和定时任务。新增数据访问时沿用所在模块的方式。
- **Container**: PHP-DI
- **Auth**: JWT (Firebase JWT)
- **Validation**: Respect Validation
- **Logging**: Monolog + 自定义 AuditLog/ErrorLog 体系

### 前端 (Frontend)
- **Framework**: React 19 + Vite
- **UI**: Tailwind CSS 4 + shadcn/ui
- **State**: TanStack Query (React Query) + Zustand
- **Form**: React Hook Form + Zod
- **I18n**: i18next

### 微信小程序 (Miniprogram)
- **Runtime**: WeChat Mini Program
- **Validation**: Node.js project structure checks
- **API Contract**: 与 `backend/openapi.json` 保持一致

---

## 常见问题

### 1. API 404 错误
- 确保 `VITE_API_URL` 包含 `/api/v1` 前缀。
- 检查后端服务器是否已启动。

### 2. 跨域 (CORS) 错误
- 后端开发模式下（`APP_ENV != production`）已自动放行 `localhost:5173`。
- 如果报错，请检查后端 `.env` 的 `APP_ENV` 设置。

### 3. 数据库连接失败
- 确保 MySQL 服务已运行，并检查 `backend/.env` 中的用户名和密码。

### 4. 样式不生效
- 检查是否运行了 `pnpm dev`。Tailwind 4 需要开发服务器处理样式。

---

**遇到问题？** 
请查阅各目录下的 `README.md` 或咨询团队成员。
