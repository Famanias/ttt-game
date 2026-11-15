# TURN//TAKE Vercel and Supabase Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Continue the previously selected inline execution method; use one final independent review for any code changes.

**Goal:** Launch TURN//TAKE on Vercel with a verified Supabase backend, working two-player gameplay, and an explicit public-release gate.

**Architecture:** Supabase provides Auth, private PostgreSQL state, private Realtime and deadline reconciliation through Cron. Vercel serves the existing Next.js application and authenticated route handlers. Validate a restricted staging deployment before configuring production; public access additionally requires working anonymous-auth abuse protection.

**Tech Stack:** Existing Next.js 15 / React 19 / TypeScript app, Bun 1.4.4+, Node 26.x, Supabase CLI/Auth/PostgreSQL/Realtime/Cron, Vercel, existing Bun and Playwright tests. Cloudflare Turnstile is the planned public-auth protection provider.

**Spec:** [Backend master specification](../../BACKEND_SPEC.md), especially sections 8, 10–13; [setup reference](../../DEPLOYMENT.md); [implementation status and known limitations](../../IMPLEMENTATION_STATUS.md); the user's request for a Vercel/Supabase launch plan.

## Starting state and decisions

- Main is merged: planning baseline `f25b4f8` (`Merge pull request #1 ... turn-take-backend`). Recheck HEAD when executing.
- Five SQL migrations, guest clients, private-room APIs, Classic/Clash, statistics, Cron function, and test scripts already exist. Extend these files rather than scaffold another backend.
- Historical local evidence is 39 Bun tests, 20 passing browser cases and two hosted skips. This planning turn does not establish new passing test results or a live connection.
- No project/account/deployment credentials were supplied for this plan. All checkboxes below are pending.
- Default: isolated staging and production Supabase projects. Confirm account capacity and costs before creating resources. If only one project is available, use it as a restricted assessment environment; do not silently connect ongoing preview tests to a database containing real-player results.
- A restricted assessment launch may finish at Task 5. The requested public launch finishes Tasks 6–9 as well. A private room code does not restrict access to the application's anonymous-auth endpoint.
- Writing this plan performs no provisioning, remote migration, Git push, deployment or public promotion. During execution, use the supplied target/project and existing authorization; ask only for missing target details or actions outside the authorized scope.

## Global Constraints

- Preserve the existing UI/assets, independent local Classic, bots, local Clash and all three minigames.
- Keep the locked two-consecutive-Clash-wins bonus mechanic.
- Use Bun and `bun.lock`; keep Node `26.x` consistent with `package.json`.
- Browser keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Optional public-release key: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- Store database passwords, access tokens and the Turnstile secret in the appropriate local/account secret stores. The application requires no service-role key. Commit no `.env.local` or credentials.
- Keep application tables/RPC helpers in `private`; expose only the intended `public` functions through the Data API.
- Every remote database/deployment operation must use an identified environment and commit. Preserve deployed migration history and player data.
- Claim completion from recorded results. Missing hosted checks are blockers, not successful skips.

## Review Focus

1. Wrong project or public-key pair: every URL, migration command and build must resolve to its recorded staging/production environment (Tasks 2, 3, 7).
2. Private-channel failure hidden by polling: prove an authorized subscription succeeds and a third guest is denied, rather than accepting a merely synchronized screen (Tasks 4, 5).
3. No clients online: observe Cron finalize an expired phase without a client request (Tasks 3, 8).
4. CAPTCHA enabled before its client flow exists: new guests must complete verification; expired/missing tokens fail; existing guests and local games still work (Task 6).
5. Rollback after environment/schema changes: an older compatible build must target the intended database; a web rollback must never be mistaken for a database restore (Task 9).

## Files and execution record

| File | Responsibility |
|---|---|
| `docs/DEPLOYMENT_PROGRESS.md` (create during execution) | Environment/commit/deployment evidence, task results, decisions and remaining blockers; no secrets. |
| `supabase/migrations/*.sql` (existing) | Apply the five ordered migrations unchanged; record matching remote migration history. |
| `supabase/cron.sql` (existing) | Owner-reviewed five-second deadline job. |
| `.env.local` (local, ignored) | Staging connection values for local verification. |
| `scripts/verify-hosted.ts` (existing) | Real staging guests, membership/channel checks, concurrent commands and Classic/Clash smoke. |
| `playwright.config.ts`, `e2e/online.pw.ts` (existing) | Local production-build browser tests with distinct guest contexts. They currently target `localhost:3101`, not an arbitrary Vercel URL. |
| `components/TurnstileChallenge.tsx` (Task 6) | Challenge rendering/token expiry/cleanup using the provider script. |
| `lib/services/online-game.ts`, `components/TurnTakeApp.tsx`, `components/LobbyScreen.tsx` (Task 6) | Carry a challenge token through new-guest sign-in while preserving local flows. |
| `tests/guest-auth.test.ts`, `tests/captcha-ui.test.tsx` (Task 6) | Authentication/token and UI regressions; external Auth/widget boundaries may be mocked explicitly. |
| `.env.example`, `docs/DEPLOYMENT.md`, `docs/IMPLEMENTATION_STATUS.md` | Update actual configuration, evidence, URLs and limits at handoff. |

Use `docs/DEPLOYMENT_PROGRESS.md` for the following non-secret records: staging/production project refs, Git SHA, migration versions, Vercel deployment IDs/URLs, relevant Auth/Realtime settings, Cron execution status, test results and rollback target. Mark unavailable evidence explicitly.

---

### Task 1: Establish the merged release baseline

**Files:** Read `package.json`, `bun.lock`, `.nvmrc`, deployment/status docs; create `docs/DEPLOYMENT_PROGRESS.md`.
**Interfaces:** Consumes merged main; produces the tested release SHA and local check results used by every later task.

- [ ] Record `git status --short` and `git rev-parse HEAD`. Preserve unrelated edits. Perform future product code changes on a feature branch/worktree, not directly on main.
- [ ] Verify Bun 1.4.4+ and Node 26.x; run `bun install --frozen-lockfile`.
  **Expected:** installation succeeds without changing `bun.lock`.
- [ ] Run `bun test`, `bun run typecheck`, `bun run lint`, `bun run build`, and `bun audit --production`.
  **Expected:** zero test/type/build errors and no production advisories. Classify the recorded 20 existing image warnings separately from new lint findings; do not assume counts stay unchanged.
- [ ] Run `bun x playwright install chromium` if needed, then `bun run test:e2e` with hosted cases disabled.
  **Expected:** local desktop/mobile cases pass; hosted cases are explicitly skipped here only.
- [ ] Record failures before further work; fixes require their own reproducing test and passing full suite. Checkpoint only the new deployment record and any authorized fixes.

**Exit:** the exact merged commit has a reproducible local baseline.

### Task 2: Identify accounts and create staging configuration

**Files:** Update `docs/DEPLOYMENT_PROGRESS.md`; create ignored `.env.local` from `.env.example` only if it does not already exist.
**Interfaces:** Consumes Task 1 SHA; produces staging project ref/URL/publishable key configured locally and the chosen Vercel account/repository.

- [ ] Owner supplies/selects Supabase organization/project, Vercel account, Git repository, desired release audience and optional domain. Account creation, sign-in and any billing choice stay with the owner unless expressly delegated.
- [ ] Create/select the staging Supabase project and record its ref/URL. Enable anonymous sign-in and retain Auth creation rate limits.
- [ ] Keep CAPTCHA unenforced in this isolated staging project until Task 6. Restrict the web deployment's audience; treat its anonymous-auth endpoint as rate-limited, not CAPTCHA-protected.
- [ ] Populate `.env.local` with this same project's URL and publishable key. Inspect `git check-ignore .env.local` without printing its contents.
  **Expected:** the file is ignored; URL/ref/key correspond to one staging project; no secret/server-role key is used.
- [ ] Record the selected production-project strategy. Resource limits/costs unresolved means production provisioning is pending, not permission to change the plan silently.

**Exit:** correct staging account/project and local public configuration are identified; no production data is touched.

### Task 3: Deploy and inspect the staging database

**Files:** Apply existing `supabase/migrations/*.sql` and `supabase/cron.sql`; update the deployment record.
**Interfaces:** Consumes staging configuration; produces applied RPC/schema/policies, private Realtime authorization and an observed Cron job.

- [ ] Discover the installed CLI's `link`, `db push`, `migration list` and `db advisors` help before running remote commands. Authenticate locally with `supabase login`.
- [ ] Link the explicitly recorded staging project and preview pending migrations:
  ```powershell
  supabase link --project-ref YOUR_STAGING_PROJECT_REF
  supabase db push --dry-run
  ```
  **Expected:** correct project and five known migration versions. Stop if migration history diverges or an unexpected project is selected.
- [ ] Apply with `supabase db push`, then run `supabase migration list --linked` and `supabase db advisors --linked`.
  **Expected:** local/remote histories agree; actionable security/advisor findings are resolved or individually justified. RLS and private-table grants remain restrictive. This hosted workflow does not require local Docker.
- [ ] In Realtime settings keep Realtime enabled and disable **Allow public access to channels**. Keep `private` outside Data API exposed schemas. Application-table publication toggles are not needed for the implemented database Broadcast protocol.
- [ ] Enable Supabase Cron/pg_cron, then execute the reviewed contents of `supabase/cron.sql` as database owner.
  **Expected:** one named `turn-take-deadlines` job, five-second schedule, successful run history; no duplicate job accidentally added.
- [ ] Set development Auth URLs for the actual localhost origin. Record settings and results; do not store passwords or tokens in screenshots/logs.

**Exit:** staging schema, private authorization and the scheduled deadline function are installed and inspected.

### Task 4: Prove real staging multiplayer through the merged app

**Files:** Execute `scripts/verify-hosted.ts`, `e2e/online.pw.ts`; update the deployment record.
**Interfaces:** Consumes live staging services; produces real Auth/RPC/channel/race and browser-flow evidence.

- [ ] Run `bun run test:hosted` against staging.
  **Expected:** successful real-guest Classic and all-three-minigame Clash smoke, allowed member channel, denied third guest, two-seat enforcement, concurrent commands, reload restart, rematch and persisted result. A connection timeout is not proof of membership denial: if the script's nonmember assertion accepts a timeout, confirm an explicit authorization denial through Realtime status/logs as well.
- [ ] Record the Smoke-prefixed guest/results created. Preserve their history until evidence is captured; any cleanup uses owner tooling and respects foreign keys.
- [ ] Run the actual hosted browser cases:
  ```powershell
  bun run build
  $env:RUN_HOSTED_E2E = '1'
  bun run test:e2e
  Remove-Item Env:RUN_HOSTED_E2E
  ```
  **Expected:** configured hosted cases execute and pass in both projects; no hosted skip is counted as launch evidence. These tests run the local build against remote Supabase.
- [ ] If a defect appears, reproduce it before a minimal fix, run targeted/full checks, and record the tested replacement SHA. Repeat only the affected external flow and required checks.

**Exit:** hosted services and local app integration are proven, not inferred from PGlite or polling.

### Task 5: Deploy and validate a restricted Vercel environment

**Files:** Configure Vercel account/project; update the deployment record and setup docs if settings differ.
**Interfaces:** Consumes verified staging project and release SHA; produces an access-restricted HTTPS URL with two-device evidence.

- [ ] Ensure the intended SHA is pushed to the selected repository. Import/configure Next.js in Vercel with root `.`, Node `26.x`, install `bun install --frozen-lockfile`, build `bun run build`, default output.
- [ ] Connect this deployment environment only to staging using the two `NEXT_PUBLIC_SUPABASE_*` values. Enable deployment protection supported by the owner's account; verify an uninvited browser cannot access the restricted URL. If protection is unavailable, keep this gate incomplete rather than claim it is restricted.
- [ ] Build/deploy the exact release SHA and record URL/deployment ID. Set the staging Auth Site URL/allowed URLs for the actual HTTPS origin. New public environment values require rebuilding.
- [ ] Use two invited devices or distinct cookie jars with different display names. Verify create/copy/join, both-ready countdown, Classic win/draw/rematch, all three online Clash renderers, sudden death, bonus/auto placement, fast reload, disconnect grace and opted-in rankings.
  **Expected:** both guests receive the canonical state, real private subscriptions work and local play remains reachable offline. A synchronized board via polling alone does not establish Realtime success.
- [ ] Record a slow/background-tab run and a full browser refresh near round end; document the three-per-guest reload restart limit. Confirm the known longest-streak statistic limitation is disclosed.

**Exit:** a restricted live assessment/demo is usable. Public release remains gated by Tasks 6–9.

### Task 6: Implement and verify CAPTCHA before public access

**Files:** Create `components/TurnstileChallenge.tsx`, `tests/guest-auth.test.ts`, `tests/captcha-ui.test.tsx`; modify the service/app/lobby seams, `.env.example`, and setup docs listed above.
**Interfaces:** Consumes working staging guest flow; produces `ensureGuest(captchaToken?: string): Promise<string>` and `onlineGame.profile(profile: PublicProfile, captchaToken?: string)` without breaking existing callers. Widget contract: `TurnstileChallenge({siteKey, onToken}: {siteKey: string; onToken: (token: string | null) => void})`.

Required regression contracts:

| Test name | Assertion |
|---|---|
| `existing_guest_skips_captcha` | `ensureGuest()` returns the validated guest UUID with no new anonymous sign-in. |
| `new_guest_requires_challenge` | Configured site key + no guest/token rejects with `GameError.code === 'CAPTCHA_REQUIRED'`; no room is created. |
| `new_guest_passes_token_to_auth` | The new sign-in request carries `options.captchaToken === 'test-token'`; successful Auth returns its user UUID. |
| `failed_challenge_creates_no_room` | Provider/Auth rejection leaves the online room request unsent and displays a retryable error. |
| `expired_challenge_clears_token` | Expiry calls `onToken(null)`; the expired value cannot be reused for a pending create/join intent. |
| `challenge_unmount_removes_widget` | Unmount removes the provider widget and subsequent callbacks cannot resume an old intent. |
| `captcha_does_not_block_local_play` | With unavailable/failed challenge script, local Classic/bot/Clash remain operable and require no guest creation. |

- [ ] First write tests proving: a valid existing guest needs no challenge; new guest + configured site key + no token requests verification; a supplied token reaches `signInAnonymously({options:{captchaToken}})`; provider failure creates no room; expiry clears token; widget unmount removes the widget; local Classic/bot/Clash never waits for CAPTCHA. Observe intended failures before implementation.
- [ ] Implement the smallest token flow through the existing online-create/join intent. Load the provider widget only for an online sign-in that needs it, clear expired/failed tokens, prevent duplicate intent execution and retain existing pending/error styles.
- [ ] Add only `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to public configuration. The matching provider **secret** is configured in Supabase Auth, not in application source or a `NEXT_PUBLIC_*` variable. Register only intended domains; keep staging/test and production provider keys distinct.
- [ ] Run targeted tests, `bun test`, typecheck/lint/build and local Playwright; commit the working change on its feature branch and independently review it before merging for release.
- [ ] Validate with provider test configuration on staging, then real human browsers using production-bound provider configuration. Enable Supabase CAPTCHA only after the client token path is deployed to that environment.
  **Expected:** valid human challenge permits new anonymous sign-in; missing/invalid/expired token yields an Auth error without creating a guest/room; existing sessions and local modes remain playable.
- [ ] Keep `bun run test:hosted` on the isolated no-CAPTCHA staging project. Its direct guest creation currently supplies no token and should fail against CAPTCHA-enforced production. Do not bypass production CAPTCHA or call that expected failure a multiplayer regression. Public CAPTCHA flow requires real browser evidence; widget/network mocks establish unit behavior only.

**Exit:** the new public guest-auth flow works end to end and cannot be bypassed by simply omitting the token at Supabase Auth.

### Task 7: Prepare and release production configuration

**Files:** Apply the existing migration/Cron files to production; configure production Vercel/Supabase/provider settings; update the deployment record.
**Interfaces:** Consumes accepted staging/code/CAPTCHA evidence; produces a production deployment and database pair identified by ref, SHA and URL.

- [ ] Confirm the owner's production project, domain/URL and authority to migrate/publish. Keep previews pointed at staging. Check backup/restore availability for the chosen Supabase plan without assuming paid/PITR features exist.
- [ ] Repeat Task 3 for the production project, including explicit CLI relink and dry run. Verify schema history/advisors, private Realtime and Cron independently; staging success is not production evidence.
- [ ] Configure production URL/publishable key and production Turnstile site key **before** the Vercel build. Configure the matching secret in Supabase. Keep access restricted until provider, Auth and actual deployment domains agree.
- [ ] Build/deploy the accepted SHA using Production environment values and record the deployment ID. Do not assume a Preview build retains the correct public values after promotion: rebuild and verify the resulting project/URL pair.
- [ ] Set the final Supabase Auth Site URL and provider domain allowlist to the chosen HTTPS origin. Public access is released only after owner authorization and Task 8's gate; until then retain available protection.

**Exit:** an identified production candidate exists with its own validated configuration and no staging database crossover.

### Task 8: Execute final live acceptance and open access

**Files:** Update `docs/DEPLOYMENT_PROGRESS.md` and `docs/IMPLEMENTATION_STATUS.md` with actual results and URL.
**Interfaces:** Consumes production candidate; produces a public launch verdict supported by live checks.

- [ ] In two fresh real browser sessions, complete CAPTCHA, choose distinct names, create/join/ready, play Classic/rematch and Clash, and confirm optional public rankings. Add a third independent guest to prove `ROOM_FULL` and nonmember authorization denial.
- [ ] Reload before/after a submission, exercise the bounded restart behavior, and reconnect within grace versus after expiry. Confirm errors cannot trap a user away from local games.
- [ ] Start an active match, close all client connections, and inspect Cron execution plus the match's database state **before** issuing another app snapshot read.
  **Expected:** owner-side observation shows the terminal transition caused by Cron, not accidentally caused by reconnect/polling.
- [ ] Verify missing/invalid challenge tokens fail at the actual Auth endpoint while legitimate browser sign-ins succeed. Do not run bulk automated guest creation against production to establish this.
- [ ] Check Vercel/Supabase errors, private channel failures, migrations, Cron history and ranking finalization. Record known minor streak-stat limits and any accepted operational caveats.
- [ ] With the owner's public-release authorization, open the intended domain/access and immediately repeat a fresh guest join/move check. Record the final public URL and release SHA.

**Exit:** live acceptance passes and the exact public URL is verified; otherwise retain restricted access and list the failing gate.

### Task 9: Record operations and rehearse rollback

**Files:** Update `docs/DEPLOYMENT.md`, `docs/DEPLOYMENT_PROGRESS.md`, `docs/IMPLEMENTATION_STATUS.md`.
**Interfaces:** Consumes released/candidate IDs and schema versions; produces a recoverable handoff.

- [ ] Record the owner, project refs, deployment URL/SHA, migration versions, observed Cron schedule, key locations (not values), Auth quotas and monitoring locations. Define who handles anonymous-user growth, Smoke data and history retention.
- [ ] Rehearse on staging: deploy a controlled failing candidate, restore the previously verified compatible deployment through Vercel, and verify its built-in public values still target staging; test local availability and a guest round afterward.
  **Expected:** a recorded working rollback target and preserved database data. Web rollback does not restore database contents or replace a schema-compatibility check.
- [ ] For a first deployment without an eligible prior good build, the fallback is restricted/unassigned public access while repairing the candidate. Verify that procedure before opening access.
- [ ] For database faults, preserve evidence and data; use a reviewed additive forward migration or an owner-approved restore. Do not use `supabase db reset`, delete match history or edit already-applied migrations as a production rollback.
- [ ] Finish with a concise launch record: real URLs, executed checks, remaining limitations, monitoring owner and rollback instructions. Mark each earlier task complete only where its evidence exists.

**Exit:** the owner can identify the running release, detect failed liveness/auth, and recover without improvising destructive database actions.

## Completion checklist

- [ ] Restricted live environment verified (Tasks 1–5).
- [ ] Public CAPTCHA path and production configuration verified (Tasks 6–7).
- [ ] Two-device production gameplay, private authorization and unattended Cron verified (Task 8).
- [ ] Public access authorized; URL and running SHA recorded.
- [ ] Operations/rollback handoff complete; limitations disclosed (Task 9).

## References checked when writing

Use current provider docs/CLI help again at execution time: [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations), [anonymous Auth](https://supabase.com/docs/guides/auth/auth-anonymous), [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha), [private Realtime](https://supabase.com/docs/guides/realtime/settings), [Cron](https://supabase.com/docs/guides/cron/quickstart), [Vercel deployment protection](https://vercel.com/docs/deployment-protection), [environment variables](https://vercel.com/docs/environment-variables), [instant rollback](https://vercel.com/docs/instant-rollback).
