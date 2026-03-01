# Repository Guidelines

## Project Structure & Module Organization
- `app/` holds the Next.js App Router with locale segments (`app/[locale]/(home|main|auth|admin)`) and API routes under `app/api/*` for chat, auth, and setup checks.
- `components/`, `hooks/`, `utils/`, and `lib/` host shared UI, reusable hooks, helpers, and backend adapters (auth, DB, Drizzle config). `i18n/` plus `messages/` store locale data.
- `styles/` contains Tailwind globals; `public/` stores static assets; `middleware.ts` wires auth/localization.
- `suna/` is a separate backend/infra workspace (Python + pnpm); follow its own README/CONTRIBUTING when modifying it.

## Setup, Build & Development Commands
- `cp .env.exmaple .env` then `npm install` to prepare the app.
- `npm run dev` starts the Next.js dev server on port 3000. `npm run build` creates a production bundle; `npm start` serves it.
- `npm run lint` runs ESLint (Next core-web-vitals).
- Database via Drizzle: `npm run db:generate` (SQL from schema), `npm run db:migrate` (apply migrations), `npm run db:push`/`db:pull` (sync), `npm run db:studio` (UI). `docker-compose.yml` or `example-docker/` help spin up Postgres/Redis.
- Suna backend: common flow is `cd suna && pytest` for Python tests or `pnpm dev:frontend` for its app when needed—defer to its docs.

## Coding Style & Naming Conventions
- TypeScript/React functional components with App Router patterns; prefer hooks for shared logic. Indent 2 spaces; keep strict typing and avoid `any`.
- TailwindCSS for styling; keep class lists readable and extract variants into `components`/`styles` when verbose.
- Components PascalCase, hooks `useX`, route folders kebab-case, env vars ALL_CAPS. Keep imports ordered and remove unused code; run ESLint before pushes.

## Testing Guidelines
- No JS/TS unit suite is wired yet; validate changes with `npm run lint` and manual QA at `http://localhost:3000`.
- If adding front-end tests, colocate `*.test.tsx` near components or in `__tests__/`, covering data branches and accessibility states.
- Backend tests in `suna/backend` use pytest; fixtures live in `suna/backend/tests/conftest.py`. Name tests `test_*.py` and avoid real external calls.

## Commit & Pull Request Guidelines
- Use short, imperative commit subjects (e.g., `Add admin dashboard cards`); batch related changes and mention migrations/config updates in the body when relevant.
- PRs should describe intent, list key changes, note env or DB steps, and include `npm run lint`/migration results. Add screenshots or curl examples for UI/API work and link issues when available.
