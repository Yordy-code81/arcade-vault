# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault is a retro-themed platform for playing games online and competing for the highest score. UI copy, specs and the README are written in **Spanish**; code and comments in English.

Development follows **Spec Driven Design** with the `/spec` and `/spec-impl` skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills) (vendored in `.claude/skills/`, pinned in `skills-lock.json`). Write/update the spec first, then implement from it.

- Specs live in `specs/NN-slug.md` (template: `.claude/skills/spec/template.md`). `specs/.spec-config.yml` has `AutoCreateBranch: true`, so `/spec-impl` creates and switches to a `spec-NN-slug` branch automatically.
- Status of the specs:
  - **SPEC 01** — MVP visual: the five screens ported from `references/templates/` with mock data. Implemented.
  - **SPEC 02** — Supabase infra + auth (email/password + `profiles`). Implemented and merged.
  - **SPEC 03** — `games` catalog table in Supabase, read with `"use cache"`. Implemented on branch `spec-03-supabase-catalogo-games`.
  - **SPEC 04** (next) — real scores table, Detail leaderboard and Salón de la Fama from Supabase (replaces `localStorage["av_scores"]`).

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build (also type-checks)
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)
- `npm run format` / `npm run format:check` — Prettier (default config, `.prettierrc.json` is `{}`)

No test runner is configured yet.

## Claude Code setup

- **Hook:** `.claude/settings.json` runs `.claude/hooks/format-and-lint.mjs` after every Write/Edit: Prettier formats the file and ESLint lints JS/TS. Unfixable ESLint errors are sent back (exit 2) — fix them instead of ignoring them.
- **MCP servers:** `.mcp.json` configures the **Supabase** MCP (bound to this project's ref) — use it for migrations (`apply_migration`), SQL, advisors, logs and `generate_typescript_types`. **Playwright** MCP is used to verify UI in the browser; its artifacts go to `.playwright-mcp/` (git-ignored).
- **Subagent:** `game-planner` (`.claude/agents/game-planner.md`) — plans and decides which games fit the catalog. It has `memory: project`, so its memory of past suggestions lives in `.claude/agent-memory/game-planner/` (commit it).
- **Subagent:** `game-jam` (`.claude/agents/game-jam.md`) — given a theme, writes the specs (design + implementation, at least two files) of one original game in `specs/game-jam/[game-id]/`. They are drafts to review; `/spec-impl` does not pick them up until promoted to `specs/NN-slug.md`.
- **Subagent:** `skin-designer` (`.claude/agents/skin-designer.md`) — checks that every game has at least three skins (`clasico` default, `neon`, `retro`) and that each one meets the dark-mode contrast rules. It only writes specs in `specs/skins/` (shared contract `00-contrato-skins.md`, one `[game-id].md` per game, and the compliance matrix `README.md`). They are drafts; the skin system itself is not implemented in code yet.
- **Subagent:** `mobile-porter` (`.claude/agents/mobile-porter.md`) — audits and fixes mobile (responsive layout, touch targets, safe-areas, and the PWA layer: manifest / viewport / icons). Unlike the other subagents it edits UI code (`app/globals.css`, `components/`, `app/layout.tsx`, `app/manifest.ts`), but never Supabase, auth or game rules. It has no browser: findings are verified by reading code only. Its compliance matrix and pending proposals live in `specs/mobile/README.md`.
- **UI design:** always use the `/frontend-design` skill when designing user interfaces (Usa siempre /frontend-design para diseñar las interfaces de usuario).

## Stack and non-default configuration

- **Next.js 16.4 (App Router) + React 19.3 + TypeScript (strict)**. APIs differ from older Next.js versions — consult `node_modules/next/dist/docs/` (`01-app/` for App Router) before writing framework code, as AGENTS.md requires.
- `next.config.ts` enables:
  - `cacheComponents: true` — data fetching is dynamic by default; opt into caching with the `"use cache"` directive plus `cacheLife` / `cacheTag`. Route segment `runtime` exports are not supported (Node.js runtime only). Uncached dynamic data must be wrapped in `<Suspense>` so the static shell can prerender.
  - `partialPrefetching: true` — links prefetch only the static shell by default; requires `cacheComponents`.
  - `experimental.agentFeedback: true` — `next dev` rewrites the managed block in `AGENTS.md`; don't hand-edit that block.
- **Tailwind CSS v4** loaded through the `@tailwindcss/turbopack` loader (configured in `next.config.ts` turbopack rules, no PostCSS config). Theme tokens are defined CSS-first in `app/globals.css` via `@theme inline` — there is no `tailwind.config.js`.
- Typed route helpers like `LayoutProps<"/">` / `PageProps` are globals generated by Next (see `next-env.d.ts` and `.next/types`).
- Path alias `@/*` maps to the repo root.
- **Supabase** via `@supabase/ssr` + `@supabase/supabase-js`. Env vars (`.env.local`, see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Architecture

### Routes (`app/`)

| Route                | Screen                                                                              |
| -------------------- | ----------------------------------------------------------------------------------- |
| `/`                  | Biblioteca — hero, search, category chips, game grid                                |
| `/juegos/[id]`       | Detalle — cover, stats, actions, 10-row leaderboard                                 |
| `/juegos/[id]/jugar` | Reproductor — simulated player (HUD, CRT arena, auto-rising score, game-over modal) |
| `/login`             | Acceso — INICIAR SESIÓN / CREAR CUENTA tabs, guest mode                             |
| `/salon-de-la-fama`  | Salón de la Fama — per-game tabs, podium, ranking table                             |

Shared layout (`app/layout.tsx`): `av-bg` / `av-noise` backdrop, `Nav`, `Footer`. Screen logic lives in `components/` (`library`, `game-card`, `leaderboard`, `game-player`, `auth-form`, `hall-of-fame`, `nav`, `footer`).

### Theme

`app/globals.css` is a port of `references/templates/styles.css` (keep them visually in sync). Neon-on-dark palette (`--cyan`, `--magenta`, `--yellow`, `--green`, `--gold/silver/bronze`…) exposed to Tailwind as `bg-bg-2`, `text-cyan`, `border-line`, `font-pixel`, `font-mono`, plus `av-*` component classes. Fonts (Press Start 2P, JetBrains Mono, Courier Prime) load via `next/font` in `app/layout.tsx`, but CSS references them by family name on purpose (see the comment in `globals.css`).

### Data

- `public.games` — the catalog (8 games, ordered by `sort_order`). Read-only for clients (RLS public read, no write policies); change it only through migrations. `best` / `plays` are mock values until SPEC 04. Current list: `references/implemented-games.md`.
- `lib/games.ts` — server-only `getGames()` / `getGame(id)` with `"use cache"` + `cacheLife("days")` + `cacheTag("games")`. Server pages read the catalog and pass it as props to client components (`Library`, `HallOfFame`); client components never query Supabase for it.
- `lib/data.ts` — shared types (`Game`, `Category`, `NeonColor`, `ScoreRow`), `CATEGORIES` and the deterministic mock score generator `seededScores`. No browser APIs.
- `lib/scores.ts` — client-only mock score persistence in `localStorage["av_scores"]` (write-only until SPEC 04).

### Supabase and auth

- `lib/supabase/client.ts` — browser client (`createBrowserClient<Database>`).
- `lib/supabase/server.ts` — server client (`server-only`); create one per request, never share.
- `lib/supabase/public.ts` — cookie-less, session-less server client for public data. Use it inside `"use cache"` scopes, where `cookies()` is not allowed.
- `lib/supabase/proxy.ts` + root `proxy.ts` — Next 16 renamed `middleware` to `proxy`. Refreshes the auth token on every matched request and redirects logged-in users away from `/login`.
- `lib/supabase/database.types.ts` — generated types; regenerate with the Supabase MCP after every migration.
- `supabase/migrations/` — SQL migrations, applied with the MCP's `apply_migration`. Rename the local file to the version Supabase assigns (check `list_migrations`). `public.profiles` (`id` → `auth.users`, unique `username` matching `^[A-Z0-9_]{3,10}$`) has RLS with public read and **no write policies**: only the `on_auth_user_created` trigger (`handle_new_user`, reads `raw_user_meta_data.username`) inserts rows.
- `app/login/actions.ts` — Server Actions `signInAction`, `signUpAction`, `signOutAction`. They only set cookies and return `{ error, ok }`; error messages are uppercase Spanish strings.
- `lib/session.ts` — client-only `useSession()` (via `useSyncExternalStore`) returning `{ id, name } | null` from Supabase Auth + `profiles`. The browser client doesn't see cookies written by Server Actions, so **call `await syncSession()` after every auth action** (see `components/auth-form.tsx`).
- Guest mode ("JUGAR COMO INVITADO") just navigates to `/` without a session. "Confirm email" is disabled in the Supabase project, so sign-up returns a session immediately.

## Known dev-only warning

In `next dev`, `/juegos/[id]` and `/juegos/[id]/jugar` log a `partialPrefetching` instant-navigation insight ("`params` accessed outside of `<Suspense>`"). It never blocks the build; moving those routes behind `<Suspense>` is pending for a future spec.

## References

- `references/templates/` — original React-UMD prototype of the UI (source of truth for the look).
- `references/started-games/` — standalone vanilla-JS games (Asteroids, Tetris, Arkanoid) to be integrated as playable games in future specs.
