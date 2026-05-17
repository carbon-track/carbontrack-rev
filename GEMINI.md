---
trigger: always_on
---

# CarbonRack AI Agent Instructions

This document provides essential guidance for AI agents working on the CarbonRack codebase.

## Architecture Overview

The project is a monorepo with three main parts:
1.  **`backend/`**: A PHP-based REST API built with the Slim micro-framework.
2.  **`frontend/`**: A React single-page application (SPA) built with Vite.
3.  **`mobile/`**: An Expo / React Native mobile application.

Communication between the frontend, mobile app, and backend is via a RESTful API, which is documented in `backend/openapi.json`.

### Key Files
- `backend/openapi.json`: The OpenAPI specification that defines the contract between the frontend and backend. Keeping this up-to-date is crucial.
- `backend/src/routes.php`: Defines all API endpoints and maps them to controller actions.
- `backend/src/Services/CronSchedulerService.php`: Unified scheduler registry/executor for public cron entrypoints, admin manual runs, run history, and legacy wrapper dispatch.
- `frontend/src/router/`: Defines the client-side routes.
- `frontend/src/pages/admin/AiWorkspace.jsx`: Dedicated admin AI workspace. Keep its UX, starter prompts, and capability presentation aligned with the backend admin AI catalogue and routes.
- `frontend/src/pages/admin/Cron.jsx`: Admin cron console for task cadence, run history, and manual task execution.
- `mobile/`: Expo / React Native mobile client. Keep its API assumptions aligned with `backend/openapi.json`.
- `backend/database/localhost.sql`: Contains the primary database schema. All migration scripts in `backend/database/migrations/` have been executed, so this file, along with the migration scripts, represents the definitive schema.
- `backend/config/admin_ai_commands.json`: Source of truth for the admin AI assistant's single multi-turn command and tool catalogue. Whenever you add, rename, or remove admin functionality that the AI should understand, update this file (and keep the companion loader `admin_ai_commands.php` in sync) so the knowledge base matches the code.

## Backend (PHP / Slim)

The backend is a lean API service. Avoid adding redundant database structure checking logic that could impact performance.

### Core Concepts
- **Dependency Injection**: Services are managed by a PHP-DI container configured in `backend/src/dependencies.php`. When adding new services, register them here.
- **Routing**: Routes are defined in `backend/src/routes.php`. Each route is mapped to a method in a controller class located in `backend/src/Controllers/`.
- **ORM**: The project uses Laravel's Eloquent ORM. Models are defined in `backend/src/Models/`. Database interactions should use these models.
- **Middleware**: Cross-cutting concerns like authentication, logging, and CORS are handled by middleware found in `backend/src/Middleware/`. See `AuthMiddleware.php` for the JWT-based authentication flow.
- **Validation**: Input validation is handled using `respect/validation`.

### Developer Workflow
- **Setup**: Run `composer install` in the `backend` directory.
- **Run Server**: `composer start` (runs `php -S localhost:8080 -t public`).
- **Run Tests**: `composer test` (runs `phpunit`). Tests are located in `backend/tests/`.
- **Debugging API**: To bypass Cloudflare firewall protection when debugging backend APIs, add the `x-debug-token` header with value `9c0d4f1a-5a0b-4b2c-9c7e-a1e2f3d4b5c6` to your requests.
- **Logging & Audit Baseline (Mandatory)**: Any backend feature you add or modify must be wired into the project’s custom observability stack so operations can troubleshoot and auditors can trace behavior.
    - **System logs**: HTTP endpoints must remain covered by the global `RequestLoggingMiddleware` + `SystemLogService`. Non-HTTP execution paths (jobs, CLI flows, async tasks) must add an equivalent explicit system-event record or documented fallback.
    - **Audit logs**: Business actions, admin operations, user-triggered mutations, sensitive reads, exports, AI operations, and batch/system actions must record structured entries through `AuditLogService`.
    - **Error handling**: Expected and unexpected failures must use explicit error handling and persist exceptions/errors through `ErrorLogService`; do not rely only on plain `error_log()` or a generic PSR logger.
    - **DI requirement**: When a controller/service/job needs audit or error logging, register the required dependencies in `backend/src/dependencies.php`; do not leave logging as an optional afterthought.
    - **Review rule**: If you touch an endpoint or business flow and it still lacks the custom logging trio above, treat that as incomplete work and fix it before finishing.
- **Cron / Scheduler Maintenance (Mandatory)**: Scheduled work is centralized through `CronSchedulerService`, the public compatibility entrypoints, and the admin cron console.
    - New externally-triggered jobs should be registered in `CronSchedulerService`, persisted through `cron_tasks` / `cron_runs`, and exposed via `/api/v1/cron/run` rather than ad-hoc public endpoints.
    - Legacy wrapper endpoints such as `/api/v1/support/sla-sweep` or `/api/v1/leaderboard/trigger` must remain truthful about downstream scheduler failures; do not mask failed/skipped runs as success.
    - If you add or change scheduled tasks, update the migration/schema snapshot (`backend/database/migrations/`, `backend/database/localhost.sql`), env examples (`backend/.env.example`), OpenAPI, PHPUnit coverage, and the admin console at `/admin/cron` together.
- **After Backend Changes (Required)**: Whenever you modify controllers, routes, models, requests, or responses:
    - Update `backend/openapi.json` to reflect the new or changed endpoints, request/response schemas, status codes, and auth requirements.
    - Add or update PHPUnit tests covering the changed behavior in `backend/tests/` (Unit and/or Integration). Focus on happy paths, validation errors, edge cases, and auth. Run it in the Powershell terminal to see output.
    - Ensure all tests pass before committing.
    - Use `backend/database/localhost.sql` as the authoritative schema reference when adjusting models and API contracts.
    - Keep the AI knowledge base current: if the change affects admin automation, navigation, agent tools, confirmation flows, conversation fields, audit action names, or AI-assisted admin routes, update `backend/config/admin_ai_commands.json` (and any related metadata files) so the admin AI stays accurate.
    - For admin AI changes, treat the following as a single maintenance set: `backend/config/admin_ai_commands.json`, `backend/openapi.json`, backend tests, frontend admin AI entry text/behavior, and conversation audit responses.
    - Optionally run the OpenAPI compliance checks in `backend/check_openapi_compliance.php` or `backend/enhanced_openapi_check.php` to verify consistency.

## Frontend (React / Vite)

The frontend is a modern SPA.

### Core Concepts
- **UI Components**: The UI is built with **shadcn/ui** on top of Radix UI and Tailwind CSS. Find components in `frontend/src/components/`.
- **State Management**:
    - **Server State**: Use **TanStack Query (React Query)** for all interactions with the backend API. This handles caching, refetching, and loading/error states.
    - **Client State**: Use **Zustand** for global client-side state that isn't fetched from the server.
- **Routing**: `react-router-dom` is used for client-side routing. Page components are in `frontend/src/pages/`.
- **Data Fetching**: Use the pre-configured `axios` instance for API requests, integrated with TanStack Query.
- **Forms**: Use **React Hook Form** with **Zod** for schema-based validation.
- **I18n**: The frontend uses **i18next** with namespace-based locale files. Treat `frontend/public/locales/<lng>/<namespace>.json` as the runtime translation source, keep translation keys namespaced (for example `home.hero.title`), and use page/component-specific `useTranslation([...])` calls instead of relying on a single global namespace. The previous monolithic locale layout is no longer the maintenance target.
- **Bundled Critical Language Namespaces**: The homepage-critical namespaces (`home`, `nav`) are mirrored under `frontend/src/locales-generated/<lng>/` for supported languages and may be preloaded during i18n bootstrap for the detected current language and, when it differs, the default/fallback language. Keep those generated mirrors aligned with `frontend/public/locales/<lng>/`.

### Developer Workflow
- **Setup**: Run `pnpm install` in the `frontend` directory.
- **Build**: `pnpm build`.
- **Lint**: `pnpm lint`.
- **After Frontend Changes (Required)**: After modifying components, hooks, routes, state, or build config:
    - Run `pnpm lint` and ensure it passes before committing. Treat passing ESLint as a required quality gate alongside backend `composer test`.
    - Run `pnpm build` to validate syntax, type-checking, and bundling issues before committing.
    - Do NOT execute `pnpm dev` within this AI session if terminal output cannot be captured; rely on local/CI builds instead, and keep code lint/type-clean.
    - If you add or change UI copy, translation keys, or namespaces, update the relevant locale namespace files for both `frontend/public/locales/zh/` and `frontend/public/locales/en/`. Do not reintroduce new strings into a catch-all `common.json` pattern when a more specific namespace exists.
    - If the copy change touches bundled homepage namespaces (`home`, `nav`), also update the mirrored files in `frontend/src/locales-generated/<lng>/` for each supported language you changed.
- If new admin UI flows, functions, labels, or session-audit displays are introduced, update any corresponding AI knowledge base entries (e.g., adjust keywords, routes, tools, and confirmation metadata in `backend/config/admin_ai_commands.json`) so the admin AI surfaces them correctly.
- If you add or change the cron console, scheduler labels, or admin-facing task controls, keep `frontend/src/pages/admin/Cron.jsx`, the admin navigation, and the `admin` locale namespace in sync; do not fall back to `common.json` for cron-specific copy.

## Mobile (Expo / React Native)

The mobile app is a React Native client built with Expo and lives under `mobile/`.

### Developer Workflow
- **Setup**: Run `pnpm install` in the `mobile` directory.
- **Validate**: Run `pnpm exec expo config --type public` to verify Expo metadata and config parsing.
- **Run Locally**: Use `pnpm start`, `pnpm android`, `pnpm ios`, or `pnpm web` from `mobile/` as appropriate.
- **Keyboard-safe forms**: Any mobile screen, modal, or bottom sheet that contains `TextInput` must use an explicit keyboard-avoidance strategy (`KeyboardAvoidingView` with platform-specific behavior or an equivalent tested approach). Check exchange/confirmation modals as well as full-page forms so lower inputs remain visible when the keyboard is open.
- **After Mobile Changes (Required)**: After modifying mobile components, navigation, API clients, state, or Expo config:
    - Run `pnpm install --frozen-lockfile` and `pnpm exec expo config --type public`.
    - Keep `mobile/pnpm-lock.yaml` committed and do not add `mobile/package-lock.json`.
    - If mobile behavior depends on backend endpoints, verify the contract against `backend/openapi.json`.

## Admin AI Maintenance

- The admin AI is a single multi-turn assistant entry. Do not introduce or document a separate long-lived `intent` product flow as the primary path.
- The primary admin AI UX lives in the dedicated `/admin/ai` workspace. If you change workspace navigation, starter prompts, quick actions, or bootstrap payloads, update the backend catalogue, OpenAPI contract, and frontend workspace together.
- The admin AI chat surface supports both the legacy JSON endpoint and `/api/v1/admin/ai/chat/stream` SSE. Keep stream event names, OpenAPI, frontend fetch parsing, and conversation timeline persistence aligned when changing agent run behavior.
- Agent runs are persisted as run/step timelines and must render inline in the main `/admin/ai` conversation, not only in the inspector panel. Write actions must carry policy metadata (`approval_policy`, `autonomy_min_mode`, `rollback_strategy`, `side_effects`, `rollback_window_minutes`) in `backend/config/admin_ai_commands.json`, and rollback must create an inline confirmation proposal before executing a compensating action.
- Text-mode tool result replay in `backend/config/admin_ai_commands.json` is explicitly configured with `tool_result_replay_max_bytes: 0` to preserve full tool payloads; LLM context capacity and audit log capture limits are separate concerns.
- Cron management is part of the admin AI surface. If you add or rename cron read/write actions, sync `backend/config/admin_ai_commands.json`, `AdminAiReadModelService`, `AdminAiWriteActionService`, `/admin/cron`, and the documented admin cron APIs in one change.
- Keep task-template prompts and action labels in `/admin/ai` operational and locale-aware. Prefer direct admin phrasing that reliably maps to backend `managementActions`, especially for Chinese prompts used by administrators in production.
- Conversation history is reconstructed from logs. If you change admin AI message/audit semantics, keep `llm_logs`, `audit_logs`, and any conversation aggregation responses compatible.
- If the agent adds or changes keyword fallback routing, synonym matching, or “continue from result” affordances, update `backend/config/admin_ai_commands.json` keywords alongside the workspace UI so natural-language prompts and one-click follow-up actions stay aligned.
- Any change to admin AI tools, keywords, navigation targets, confirmation behavior, session audit structure, or route contracts must update both root agent docs (`AGENTS.md`, `GEMINI.md`).

## Pull Request Review Gate

- After creating a PR, and after pushing any additional commit to an existing PR, wait for coding-agent review feedback before treating the PR as ready or mergeable. This includes Copilot code review or any equivalent automated Codex/code-review agent configured for the repository.
- If the automated review does not trigger on its own, manually request a Copilot/code-agent review through the available GitHub tools or UI, then wait for the result.
- Address actionable review comments with follow-up commits, resolve the corresponding review threads, and repeat the review wait/request cycle after each new commit pushed to the PR.
- Treat the tracked instruction Markdown files in this repository as the source of truth. Generated or untracked copies such as `custom-instructions/repo/.github/copilot-instructions.md` are out of scope unless they are present and tracked by git.

## Git Commit Guidelines

- **Language Style**: All git commit messages MUST be written in **Classical Chinese (Simplified forms)** (简体中文文言文).
    - Ensure the tone is concise and adheres to classical grammatical structures where appropriate, but remains understandable. You can refer to previous Chinese commits.
    - **Examples**:
        - Feature: `初创此项，以此为基` (Initial commit / Add feature)
        - Defect: `修复漏洞，不仅其微` (Fix bug)
        - Refactor: `重构代码，去芜存菁` (Refactor code)
        - Docs: `修订文档，文以载道` (Update documentation)
    - **Format**: Use the conventional `<type>(<scope>): <文言文主题>` pattern as in `fix(admin): 修复管理布局引用，兼修规约`; keep scope concise (e.g., `frontend`, `backend`, `ci`, `i18n`, `admin`, etc.).

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
