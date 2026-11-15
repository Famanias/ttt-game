# Supabase and Vercel setup

TURN//TAKE runs against hosted Supabase (`turn-take-staging` for Vercel Preview and `turn-take-prod` for Production) and Vercel (`team-e2117dad/ttt-game`, public URL [https://ttt-game-sooty.vercel.app](https://ttt-game-sooty.vercel.app)).

For the ordered launch record, Task 1–9 gates, and rollback runbook, see [the deployment execution plan](superpowers/plans/2026-11-15-vercel-supabase-deployment.md) and [deployment progress](DEPLOYMENT_PROGRESS.md).

## 1. Tooling and local database

Tested: Bun 1.4.4, Node 26.7.0, Next.js 15.5.29, React 19.3.1. `packageManager`, `engines`, `.nvmrc` and `bun.lock` record the tool/dependency boundary. Supabase CLI was available (2.119.0); Docker Desktop's Linux engine was not running, so native local Supabase/advisors were not executed.

Start Docker Desktop if using the native local stack, then:

```powershell
bun install --frozen-lockfile
supabase start
```

For a **new disposable local database**, apply migrations using `supabase db reset`. This deletes/recreates the local database: do not run it against data you need to preserve. Anonymous sign-in is enabled in the checked-in local `supabase/config.toml`. Otherwise use the hosted setup below.

## 2. Hosted project

1. Create/select a Supabase project. Under Authentication settings:
   - Enable **Anonymous Sign-Ins** with anonymous-user rate limits active.
   - Enable **Auto-confirm emails** (`mailer_autoconfirm: true`), set minimum password length to `8`, and leave password required character classes empty so simple passwords (`8-72` characters, no special character requirement) register immediately without email verification codes via the synthetic server-only email mapping `u_<hex>@users.turntake.example`.
   - SQL additionally limits per-guest room creation (`10/min`), joins including failures (`20/min`), submissions (`20/min`), other room commands (`240/min`), plus server-side auth registration (`8/10min` per IP) and login (`12/5min` per IP, `10/5min` per username).
2. Review migrations (`20261114134954` through `20261115120000`), then run `bunx supabase db push` against staging first and production after verification. Confirm `migration list` matches 1:1 and `bunx supabase db advisors --linked` has `0` ERROR findings.
3. Keep the Data API's exposed schemas at `public`/`graphql_public`. **Do not expose `private`** or grant clients direct table writes or execute access to server-only `public.auth_*` RPCs.
4. Configure Supabase Realtime to require private channels (`private_only: true`). Migrations install exact-topic policies on `realtime.messages`; client channels set `private:true`.
5. Enable Supabase Cron/`pg_cron` and execute `supabase/cron.sql` as the database owner so `private.sweep_deadlines()` runs every five seconds even when all browsers close.
6. Set Site URL and redirect allow-list URLs to the active Vercel host(s) (`https://ttt-game-sooty.vercel.app/**`). No third-party OAuth callback is required.

Public anonymous and account sign-in/sign-up CAPTCHA uses Cloudflare Turnstile via `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, loaded on demand in [TurnstileChallenge.tsx](../components/TurnstileChallenge.tsx) and [AuthModal.tsx](../components/AuthModal.tsx). Configure the matching Turnstile secret **only** in Supabase Auth (`security_captcha_enabled: true`, `security_captcha_provider: turnstile`), register only the target production domains, and keep Turnstile disabled on `turn-take-staging` so automated `bun run test:hosted` and staging E2E runs remain deterministic without solving challenges. Local 2P, Bot, and Clash modes never wait on CAPTCHA.

## 3. Environment

```powershell
Copy-Item .env.example .env.local
```

Edit locally:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SECRET_KEY
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

Only `NEXT_PUBLIC_*` values are exposed to browsers (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, optional `NEXT_PUBLIC_TURNSTILE_SITE_KEY`). Keep `SUPABASE_SERVICE_ROLE_KEY` server-only (used exclusively by `/api/auth/*` and SSR session lookup in `lib/supabase/admin.ts` without any trailing newline/CR characters); never commit `.env.local` or print secrets in logs or chat. Next.js `NEXT_PUBLIC_*` values are compiled at **build time**, so rebuild/redeploy after changing them.

## 4. Verify the configured test project

```powershell
bun test
bun run typecheck
bun run lint
bun run build
bun run test:hosted
bun x playwright install chromium
$env:RUN_HOSTED_E2E = '1'
bun run test:e2e
```

The hosted script creates three real anonymous guests, verifies `ACCOUNT_REQUIRED` blocks unregistered guest leaderboard opt-in, verifies guests are excluded from `game_leaderboard`, exercises two-seat admission and nonmember/channel denial, races Classic moves, rematches, verifies a fast reload restart, concurrently submits both guests across all three Clash challenge types, and (when `SUPABASE_SERVICE_ROLE_KEY` is configured) upgrades `Smoke0` via `auth_complete_registration` to verify stat carry-over onto `game_leaderboard`. The Playwright suite covers offline local modes plus multi-browser hosted invite/readiness/Classic/reload/rematch and username+password (`12345678`) registration, progress modal, leaderboard toggle, log out, log in, and SSR reload recovery against `turn-take-staging`. Remove test guests/results using your Supabase admin workflow afterward; the client exposes no deletion backdoor.

Two-device live verification, CAPTCHA gating, reload recovery, network drops, Cron deadlines, and rollback drills are recorded in [deployment progress](DEPLOYMENT_PROGRESS.md).

## 5. Vercel

The repository uses normal Next.js output; it does not require a persistent WebSocket process or module-level match map. Supabase owns state. No `vercel.json` is necessary for these App Router handlers.

- Vercel project: `team-e2117dad/ttt-game` (`prj_7IQX0AeswNkxcxiwy6ihZ3rRhKGy`), install `bun install --frozen-lockfile`, build `bun run build`, Next.js default output.
- Configure `Preview` env vars pointing at `turn-take-staging` (`ffsvimzxnxqbogzvuupi`) and `Production` env vars pointing at `turn-take-prod` (`yeehqcdayrygwdhyyzfc`, plus `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and production `SUPABASE_SERVICE_ROLE_KEY` stored as a Vercel Secret). Never share service keys between Preview and Production.
- Rollback procedure: web deployments can be restored quickly via `vercel rollback` / `vercel alias set` (rehearsed on staging between `ttt-game-k9wpo7utn-team-e2117dad.vercel.app` and `ttt-game-3abshif3q-team-e2117dad.vercel.app`), **provided the target schema remains compatible**; database fixes must use additive forward migrations or owner-approved backups—never `supabase db reset`.

## Operations and limits

Room expiry is two hours. Deadline sweep purges receipt records older than seven days and rate counters older than one day; it does not delete guest identities or immutable match history. Plan retention/deletion with the project owner and respect match/profile foreign keys. Monitor anonymous-user growth, room creation, SQL errors, Cron failures and Realtime connection errors. Inputs remain browser-controlled: these are casual rankings, not anti-cheat-verified competitive results.

Official references checked during implementation: [anonymous auth](https://supabase.com/docs/guides/auth/auth-anonymous), [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization), [database Broadcast](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes), [function security](https://supabase.com/docs/guides/database/functions), [Cron intervals](https://supabase.com/docs/guides/cron/quickstart).
