# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UnieAI Chatroom — a Next.js 15 (App Router) AI chat platform with multi-provider LLM support, OpenCode agent integration, and multi-tenant group management. Uses React 18, TypeScript 5, and PostgreSQL.

## Commands

```bash
cp .env.exmaple .env        # Note: filename typo is intentional
npm install
npm run dev                  # Dev server on port 3000
npm run build                # Production build (ESLint/TS errors ignored)
npm run lint                 # ESLint (next core-web-vitals)

# Database (Drizzle ORM + PostgreSQL)
npm run db:generate          # Generate SQL from schema
npm run db:migrate           # Apply migrations
npm run db:push              # Push schema directly
npm run db:studio            # Open Drizzle Studio UI
```

No test suite is wired yet — validate with `npm run lint` and manual QA.

## Architecture

### Routing & Layouts

- `app/[locale]/` — all pages are locale-parameterized (`en`, `es`, `fr`, `ja`, `zh-tw`, `zh-cn`)
- `(home)` — public landing page
- `(auth)` — login flow
- `(main)` — authenticated area with sidebar layout; contains `chat/`, `c/[id]/`, `p/[id]/`, `settings/`, `admin/`, `agent/`
- Middleware (`middleware.ts`) chains next-intl locale routing → NextAuth JWT check → role-based redirects

### Provider Stack (inside-out in locale layout)

`NextIntlClientProvider` → `SessionProvider (NextAuth)` → `ThemeProvider (next-themes)` → `AgentGlowProvider` → `Toaster (sonner)`

### Auth (`auth.ts`)

- JWT strategy with Google OAuth + Azure AD providers
- Drizzle adapter; first user gets `super` role, subsequent users get `defaultUserRole` from admin_settings
- Roles: `pending` → `user` → `admin` → `super`

### Database (`lib/db/schema.ts`)

Drizzle ORM with PostgreSQL. Key tables: `user`, `admin_settings`, `user_providers`, `groups`, `group_providers`, `user_groups`, `chat_sessions`, `chat_messages`, `chat_files`, `mcp_tools`, token usage/quota tables. Config in `drizzle.config.ts`.

### Multi-Provider Model System

Models identified as `{4-char-prefix}-{modelId}` (e.g., `OAI1-gpt-4o`). Two scopes:
- **Personal providers** (`user_providers`): per-user API key + URL
- **Group providers** (`group_providers`): admin-managed with `selectedModels` whitelist and token quotas

### Chat Streaming (`app/api/chat/stream/route.ts`)

SSE via `ReadableStream`. Events: `session_id`, `status`, `chunk`, `done`, `title_updated`, `error`. Resolves provider by 4-char prefix, processes attachments (PDF→images via MuPDF, documents via mammoth), dispatches MCP tools (fetch OpenAPI spec → LLM selects → call).

### Agent Mode (OpenCode Integration)

Proxies to OpenCode server at `OPENCODE_BASE_URL` (default `http://127.0.0.1:4096`). API routes under `app/api/agent/`. Session sync (`lib/agent/session-sync.ts`) normalizes OpenCode messages into local DB. SSE event proxy at `/api/agent/events`.

### Stream Store (`lib/stream-store.ts`)

Module-level SSE stream registry surviving React unmounts. Manages active streams with subscriber pattern and abort-all-except for navigation cleanup.

### MCP Tools (`lib/mcp/`)

3-step dispatch: fetch OpenAPI spec → LLM selects tools → call tools. Configs stored in `mcp_tools` table.

## Coding Conventions

- TypeScript strict mode; functional React components with hooks; 2-space indent
- TailwindCSS for styling with shadcn/ui primitives (`components/ui/`, configured in `components.json`)
- Path alias: `@/*` maps to project root
- Components PascalCase, hooks `useX`, route folders kebab-case
- i18n via next-intl; translations in `messages/{locale}.json`
- Commit style: short imperative subjects (e.g., `Add admin dashboard cards`)

## Submodules

- `suna/` — Kortix Suna agent backend (Python + pnpm, separate workspace)
- `submodules/opencode/` — OpenCode CLI/server (agentic coding engine)
- `submodules/nextjs-opencode-frontend/` — UnieAI's Next.js OpenCode frontend reference
