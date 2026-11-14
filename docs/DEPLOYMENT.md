# Supabase and Vercel setup

No remote project or deployment was configured during implementation. The checked-in code/build/tests are local evidence. Complete these steps in a **test project** before publishing or claiming live multiplayer.

## 1. Tooling and local database

Tested: Bun 1.4.4, Node 26.7.0, Next.js 15.5.29, React 19.3.1. `packageManager`, `engines`, `.nvmrc` and `bun.lock` record the tool/dependency boundary. Supabase CLI was available (2.119.0); Docker Desktop's Linux engine was not running, so native local Supabase/advisors were not executed.

Start Docker Desktop if using the native local stack, then:

```powershell
bun install --frozen-lockfile
supabase start
```

For a **new disposable local database**, apply migrations using `supabase db reset`. This deletes/recreates the local database: do not run it against data you need to preserve. Anonymous sign-in is enabled in the checked-in local `supabase/config.toml`. Otherwise use the hosted setup below.

## 2. Hosted project

1. Create/select a Supabase **test** project. Enable Anonymous Sign-Ins under Authentication settings. Keep anonymous-user creation rate limits enabled. Auth rate limiting is provided by Supabase; SQL additionally limits per-guest room creation (10/min), joins including failures (20/min), submissions (20/min) and other requests (240/min).
2. Review migrations, then run `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, and `supabase db push`. These commands write to the selected remote database; verify the project first. The agent has not run them. Check migration history and run `supabase db advisors` after the connection is configured, addressing any findings before release.
3. Keep the Data API's exposed schemas at the standard `public`/`graphql_public`. **Do not expose private** or grant guests direct authoritative table writes.
4. Configure Supabase Realtime to require private channels (disable public channel access for this app). The migration installs exact-topic policies on `realtime.messages`; client channels set `private:true`. This uses DB-triggered Broadcast, not Postgres Changes, so no application-table publication setup is needed.
5. Enable Supabase Cron/pg_cron and run the reviewed `supabase/cron.sql` as the database owner. It schedules owner-only `private.sweep_deadlines()` every five seconds. Check job history and verify it runs successfully with all browsers closed. **Without this job**, deadlines reconcile on reads/commands only; unattended games remain pending until the next request.
6. Set the project's Site URL and allowed development/production URLs. No social OAuth callback is required for anonymous auth. Use HTTPS in production.

Anonymous-auth CAPTCHA/Turnstile integration is a deployment-exposure decision. The current lobby does not collect a CAPTCHA token. If you enable CAPTCHA in Auth, add/test the supported token UI before expecting new guests to sign in; errors are shown honestly. Do not disable rate limits to work around sign-in errors. Use private assessment access until public abuse controls are validated.

## 3. Environment

```powershell
Copy-Item .env.example .env.local
```

Edit locally:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Both values are intentionally browser-safe project configuration. No service-role key, secret key, database password or token belongs in these variables, source, chat or logs. The application uses each guest's validated JWT for RPC. Next.js public env values are bundled at **build time**; rebuild/redeploy after changes.

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

The hosted script creates three real anonymous guests and Smoke-prefixed opted-in profiles, exercises two-seat admission and nonmember/channel denial, races Classic moves, rematches, verifies a fast reload restart, and concurrently submits both guests across all three Clash challenge types with raw test traces and bonus claims. These are real database writes. The browser case uses distinct cookie jars for invite/readiness/Classic/reload/rematch. Neither was run without credentials. Remove test guests/results using your project's authorized admin workflow afterward; the client has no deletion backdoor.

Manually verify with two devices: copy invite, join/third-user rejection, ready/unready during countdown, Classic win/draw/rematch, all three online minigame renderers, hidden submissions, tied sudden death, normal/bonus/auto claims, reload in every phase, duplicate tabs, network drop within grace vs timeout, deliberate leave, and public rankings opt-in/out. Check mobile touch and a throttled connection. Observe Cron finalization after closing both browsers. This checklist is pending, not claimed evidence.

## 5. Vercel

The repository uses normal Next.js output; it does not require a persistent WebSocket process or module-level match map. Supabase owns state. No `vercel.json` is necessary for these App Router handlers.

- Import the reviewed Git branch/repository into Vercel, using Next.js detection and Node **26.x**. Vercel's Node 26 support is documented in its [release note](https://vercel.com/changelog/node-js-26-lts-is-now-generally-available-on-vercel).
- Install command: `bun install --frozen-lockfile`; build command: `bun run build`; output directory: Next.js default.
- Configure the two public Supabase values for Preview/Production. Use a test Supabase project for previews. Never supply a service role to the browser.
- Check Auth URL settings, private Realtime settings and Cron against that same project before running the hosted smoke. Validate logs without logging tokens or traces.
- Deploy only after the owner authorizes publishing. There is currently **no deployment URL**. Repeat the two-device flow against the actual URL before calling the app production-ready.

## Operations and limits

Room expiry is two hours. Deadline sweep purges receipt records older than seven days and rate counters older than one day; it does not delete guest identities or immutable match history. Plan retention/deletion with the project owner and respect match/profile foreign keys. Monitor anonymous-user growth, room creation, SQL errors, Cron failures and Realtime connection errors. Inputs remain browser-controlled: these are casual rankings, not anti-cheat-verified competitive results.

Official references checked during implementation: [anonymous auth](https://supabase.com/docs/guides/auth/auth-anonymous), [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization), [database Broadcast](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes), [function security](https://supabase.com/docs/guides/database/functions), [Cron intervals](https://supabase.com/docs/guides/cron/quickstart).
