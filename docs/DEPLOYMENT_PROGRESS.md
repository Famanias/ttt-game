# Deployment Progress

Non-secret operational record for the TURN//TAKE Vercel + Supabase rollout following [the deployment execution plan](superpowers/plans/2026-11-15-vercel-supabase-deployment.md). Never store passwords, access tokens, database credentials, or Turnstile secrets in this file.

## Release baseline (Task 1)

- **Branch / worktree:** `Famanias/deployment` (`E:\orca\workspaces\ttt-game\deployment`)
- **Baseline Git SHA:** `f25b4f8f8189baf44032dfc6bf3608870f52e928` (`Merge pull request #1 from Famanias/Famanias/turn-take-backend`)
- **Working tree edits preserved at baseline:** `M docs/DEPLOYMENT.md`, `?? docs/superpowers/`
- **Toolchain verified:** Bun `1.4.4` (matches `packageManager: bun@1.4.4`), Node `v26.7.0` (matches `.nvmrc` `26` and `engines.node: 26.x`)
- **Local migration versions present (`supabase/migrations/`):**
  - `20261114134954_turn_take_backend.sql`
  - `20261114135737_classic_matches.sql`
  - `20261114140437_clash_rounds.sql`
  - `20261114141100_reliability_and_rankings.sql`
  - `20261114145119_review_reliability_fixes.sql`
- **Local verification on baseline SHA `f25b4f8`:**
  - `bun install --frozen-lockfile`: passed (`Checked 972 installs across 976 packages (no changes)`).
  - `bun test`: **39 passed, 0 failed** across 9 test files.
  - `bun run typecheck`: passed (`0` errors).
  - `bun run lint`: passed (`0` errors, `20` existing `@next/next/no-img-element` warnings across `ArenaScreen.tsx` (5), `ClashMinigameModal.tsx` (2), `GameBoard.tsx` (1), `LeaderboardModal.tsx` (1), `LobbyScreen.tsx` (7), `OutcomeModal.tsx` (1), `WaitingRoomScreen.tsx` (3)).
  - `bun run build`: passed (`Next.js 15.5.29` production build).
  - `bun audit --production --json`: `{}` (`0` production advisories).
  - `bun run test:e2e` (`RUN_HOSTED_E2E` unset): **20 passed, 2 skipped** (`desktop` and `mobile` local cases passed; `e2e/online.pw.ts` hosted cases explicitly skipped pending remote Supabase configuration).

## Environments and configuration status

| Target | Project / Account Ref | URL / Deployment ID | Migration / Cron Status | Auth / Realtime / CAPTCHA | Evidence Status |
|---|---|---|---|---|---|
| Staging | `turn-take-staging` (`ffsvimzxnxqbogzvuupi`, `Famanias's Org`) | `dpl_Ea9ueQArpQe1HKS4rFxJUwwv3Ska` (`https://ttt-game-3abshif3q-team-e2117dad.vercel.app`, alias `https://ttt-game-staging-team-e2117dad.vercel.app`) | All 7 local/remote migrations match 1:1 (`20261114134954`–`20261115120000`); `turn-take-deadlines` Cron running (`5s`) | Anonymous auth + `mailer_autoconfirm=true` + min password length `8` (no symbol rule); private Realtime; Turnstile off on staging for automated checks; `SUPABASE_SERVICE_ROLE_KEY` set in Vercel `Preview` | Verified (`bun run test:hosted`, Playwright `22 pass / 2 unconfigured-skip`, cloud Preview auth roundtrip, and Task 9 rollback drill) |
| Production | `turn-take-prod` (`yeehqcdayrygwdhyyzfc`, `Famanias's Org`) | `dpl_8b9d1ZsrdttEBpC9ujHAztxCz5zX` (`https://ttt-game-c599r2ki8-team-e2117dad.vercel.app`, live alias `https://ttt-game-sooty.vercel.app`) | All 7 local/remote migrations match 1:1 (`20261114134954`–`20261115120000`); `turn-take-deadlines` Cron running (`5s`); `0` advisor ERRORs | Anonymous auth + `mailer_autoconfirm=true` + min password length `8` (no symbol rule); private Realtime (`private_only: true`); Turnstile enforced (`0x4AAAAAAGBXl2sZfeZyquBe`); `SUPABASE_SERVICE_ROLE_KEY` set in Vercel `Production` | Live & verified (`HTTP 200` on `/`, `/api/auth/session`, `/api/leaderboard`, and `CAPTCHA_REQUIRED` on `/api/auth/register` without Turnstile token) |

## Observed CLI accounts (initial baseline discovery)

- **GitHub (`gh`):** authenticated as `Famanias`; remote `origin` = `https://github.com/Famanias/ttt-game.git`.
- **Vercel CLI (`62.1.0`):** authenticated as `famanias` (team `team-e2117dad`); deployed project `ttt-game` (`prj_7IQX0AeswNkxcxiwy6ihZ3rRhKGy`).
- **Supabase CLI (`2.119.0`):** `Famanias's Org` (`mlzjigmootxtpmceruaa`) owns `turn-take-staging` (`ffsvimzxnxqbogzvuupi`) and `turn-take-prod` (`yeehqcdayrygwdhyyzfc`, linked in `supabase/.temp/project-ref`).

## Task checklist status

- **Task 1 (Merged release baseline):** Complete (`f25b4f8`).
- **Task 2 (Accounts & staging config):** Complete (`turn-take-staging` `ffsvimzxnxqbogzvuupi`, `team-e2117dad/ttt-game`).
- **Task 3 (Staging DB & security inspection):** Complete (migrations 1:1, 0 advisor ERRORs, private Realtime, `5s` Cron).
- **Task 4 (Staging multiplayer & hosted verification):** Complete (`verify-hosted.ts` + desktop/mobile Playwright).
- **Task 5 (Restricted Vercel staging deployment):** Complete (`dpl_FoBuLNemSixij8c3tJi6PE4ED1w6` initial + two-device/slow-network checks).
- **Task 6 (On-demand Turnstile CAPTCHA gate):** Complete (`04cd9bb`, `0f75678`, staging pass/fail probes).
- **Task 7 (Production provisioning & restricted build):** Complete (`turn-take-prod` `yeehqcdayrygwdhyyzfc`, Turnstile widget `0x4AAAAAAGBXl2sZfeZyquBe`, Cron active).
- **Task 8 (Public launch & post-launch improvements):** Partially automated / live (public URL `https://ttt-game-sooty.vercel.app` live, ready-button fix + `20261115103000_heartbeat_ready_start.sql`, simple optional username+password accounts + guest carry-over `20261115120000_user_accounts.sql`, `/api/auth/session` + `/api/leaderboard` `HTTP 200`, and Turnstile `CAPTCHA_REQUIRED` enforcement verified on Production; full two-browser human Turnstile play, `ROOM_FULL`/nonmember prod play, and unattended post-close Cron match termination were verified only on staging/CLI without interactive Turnstile solving).
- **Task 9 (Operations, rollback rehearsal & documentation closeout):** Complete (staging alias rollback drill passed, living docs synced, temporary secrets removed from `.env.local`).

## Rollback targets

- **Staging rollback target (verified compatible with schema `20261115120000`):** `dpl_Ea9ueQArpQe1HKS4rFxJUwwv3Ska` (`https://ttt-game-3abshif3q-team-e2117dad.vercel.app`), aliased at `https://ttt-game-staging-team-e2117dad.vercel.app`. Controlled failing candidate tested during drill: `https://ttt-game-k9wpo7utn-team-e2117dad.vercel.app`.
- **Production current & prior targets:** Active compatible production deployment `dpl_8b9d1ZsrdttEBpC9ujHAztxCz5zX` (`https://ttt-game-c599r2ki8-team-e2117dad.vercel.app` -> `https://ttt-game-sooty.vercel.app`). Prior pre-account production build `https://ttt-game-gbt3rmmk3-team-e2117dad.vercel.app` does **not** include `/api/auth/*` routes or `ACCOUNT_REQUIRED` guest UI handling, so production rollback should keep schema compatibility in mind or ship a clean forward fix.

## Task 2: Staging Environment Provisioning
- **Supabase Organization:** `Famanias's Org` (`mlzjigmootxtpmceruaa`, Free plan)
- **Staging Supabase Project:** `turn-take-staging` (`ffsvimzxnxqbogzvuupi`, `us-east-1`, `ACTIVE_HEALTHY`)
- **Local Env:** Created `.env.local` with staging `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (verified gitignored via `.gitignore:6:.env*`)
- **Target Vercel Team:** `famanias` (`team-e2117dad`, Hobby plan)

## Task 3: Staging Database & Security Inspection
- **Migrations (`supabase db push` & `migration list --linked`):** Linked `ffsvimzxnxqbogzvuupi`; all 5 local and remote migrations (`20261114134954` through `20261114145119`) match 1:1.
- **Advisors & Isolation (`supabase db advisors --linked` & Data API check):** 0 `ERROR` findings. Expected `WARN`/`INFO` notices reviewed and accepted: `public.game_leaderboard` is intentionally public casual opt-in read-only RPC, `realtime.messages` allows anonymous Auth sessions only when `private.can_receive(realtime.topic())` confirms active membership, and all 11 `private.*` tables deny direct `anon`/`authenticated` access (`Accept-Profile: private` returns `406 PGRST106`; `private.sweep_deadlines` not executable by `anon`/`authenticated`).
- **Auth & Realtime Settings:** `GET /auth/v1/settings` verified `"anonymous_users": true`; owner configured localhost Auth URLs (`http://localhost:3101`) and disabled Realtime public channel access.
- **Cron (`pg_cron` `1.6.4` + `supabase/cron.sql`):** Single active job `turn-take-deadlines` (`jobid: 1`, schedule `5 seconds`) confirmed running with `status: succeeded` in `cron.job_run_details`.

## Task 4: Staging Multiplayer & Hosted Browser Verification
- **Hosted Smoke (`bun run test:hosted`):** Passed both `Classic` (`L9XHRS`) and `Clash` (`9H5J3M`) against `turn-take-staging` (`ffsvimzxnxqbogzvuupi`), covering isolated guest auth, two-seat enforcement, concurrent move/submit races, reload restart, rematch, and persisted stats (`Smoke0-wh011qc`: 1W/1L Classic, 1W Clash, streak 2; `Smoke1-wh011qc`: 1W/1L Classic, 1L Clash; denied nonmember `Smoke2-wh011qc`: 0/0). Realtime logs verified explicit nonmember channel authorization denial (`Unauthorized: You do not have permissions to read from this Channel topic: room:b2d54089-1dc2-47b7-b9bd-1a21de4ecfbc`).
- **Fixes Applied & Verified (`3ff4e7b2c5eeaa129e44d33d3f5e58ea179c595a`):**
  1. `hooks/use-online-room.ts`: Added targeted `countdownRefreshDelay` (`startAt` timer refresh) so clients transition promptly out of `countdown` instead of stalling up to 2.5s at `"Match starts in 0"`, and sent an immediate `heartbeat` during `boot()` so post-reload clients reset `last_seen_at` right away instead of waiting 5s for the first interval tick (preventing false `countdown_cancelled` on rematch).
  2. `e2e/local.pw.ts` & `e2e/online.pw.ts`: Skipped the unconfigured-error test cleanly when `.env.local` provides hosted Supabase config (`isOnlineConfigured()`), and widened the post-rematch board-reset assertion timeout (`10000ms`) for 3s countdown + cross-region RTT.
- **Full Post-Fix Verification (`3ff4e7b`):** `bun test` (43 pass, 0 fail across 10 files), `bun run typecheck` (exit 0), `bun run lint` (0 errors, 20 warnings), `bun run build` (exit 0), `bun run test:hosted` (PASS Classic + Clash), and `RUN_HOSTED_E2E=1 bun run test:e2e` (20 passed, 2 unconfigured-only skipped, 0 failed; both `[desktop]` and `[mobile]` `e2e/online.pw.ts` passed).

## Task 5: Restricted Vercel Staging Deployment

- **Date:** 2026-11-15
- **Branch / Commit:** `Famanias/deployment` (`origin` `https://github.com/Famanias/ttt-game.git`, code + `.vercel` ignore at `e088246`)
- **Vercel Project:** `ttt-game` (`prj_7IQX0AeswNkxcxiwy6ihZ3rRhKGy`) on `team-e2117dad` (`famanias`, Hobby)
  - Settings: Root `.`, Framework `Next.js`, Node.js `26.x` (CLI printed warning `Found invalid or discontinued Node.js Version: "26.x"` during deploy while `iad1` cloud build compiled Next.js `15.5.29` cleanly with `bun install --frozen-lockfile` + `bun run build`), Output `Next.js default`
  - Initial default deploy `dpl_3GXCZD47ERet1xRQL2uHFG1Efi9B` (`https://ttt-game-sooty.vercel.app`) auto-assigned `target: production` with **no** `Production` environment variables configured (returns local-only fallback HTTP `200`; `vercel project pause` requires interactive confirmation)
- **Restricted Staging Preview:**
  - Deployment ID: `dpl_FoBuLNemSixij8c3tJi6PE4ED1w6`
  - URL: `https://ttt-game-niz1r9i3m-team-e2117dad.vercel.app`
  - `Preview` env vars set: `NEXT_PUBLIC_SUPABASE_URL` (`https://ffsvimzxnxqbogzvuupi.supabase.co`), `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only (zero secrets)
  - Deployment Protection: `["vercel_authentication"]` (`ssoProtection.deploymentType = "all_except_custom_domains"`; unauthenticated HTTP returns `302` to `vercel.com/sso-api`, uninvited browser redirects to `vercel.com/login`)
- **Staging Supabase Auth (`ffsvimzxnxqbogzvuupi`):**
  - `site_url`: `https://ttt-game-niz1r9i3m-team-e2117dad.vercel.app`
  - `uri_allow_list`: `https://ttt-game-niz1r9i3m-team-e2117dad.vercel.app/**,http://localhost:3101/**,http://localhost:3000/**`
- **Live Two-Device Staging Verification (Desktop Chromium + Mobile `Pixel 7` Chromium):**
  - `verify-staging-live.ts` (exit `0`): SSO gate verified (`blocked=true`), Classic room create/join/win/rematch/draw (`Moves 9`)/rematch, disconnect (`o.close()`) -> `"Paused for reconnect"` -> reconnect resume, opt-in Leaderboard (`StageA-h1wqpo` visible), offline local 2P win (`ctxMobile.setOffline(true)`), Clash R1 `Perfect Timing` + 3x fast reload restart (`activeRoundIndex=4`), R2 `Flash Memory` -> 2-Win Streak Bonus -> 15s claim deadline auto-place (`xCount=3`), R3 `Target Rush` + 0-0 tie -> Sudden Death `Perfect Timing` (`Clash Round 7: Perfect Timing`), and 4th reload rejected (`status=400`, `{"error":{"code":"RESUME_LIMIT"}}`, UI `[role="status"]` `"This match has reached its reload restart limit. Return to local games if you cannot finish the current attempt."`).
  - `verify-staging-slow-bg.ts` (exit `0`): `TU5JWY` passed under emulated `600ms` latency / `50KB/s` network + background-tab throttling, capturing `REALTIME_WS_TOTAL_X=15` and `BROADCAST_COUNT=10` decoded binary Phoenix v2 WebSocket frames (`realtime:room:... room_updated` + `presence_state`/`presence_diff`).
- **Known Product Behavior Confirmed:** `longest_streak` tracks the two-win Clash bonus-counter peak (`<= 2`), matching `docs/IMPLEMENTATION_STATUS.md`.

## Task 6: On-Demand Turnstile CAPTCHA Gate

- **Date:** 2026-11-15
- **Commits:** `04cd9bb` (feature + tests + docs), `0f75678` (unmount Turnstile when post-auth API error rejects already signed-in guest)
- **Implementation:**
  - Created `components/TurnstileChallenge.tsx` (`TurnstileChallenge({siteKey, onToken})`) lazy-loading `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` only on mount, clearing expired/failed tokens (`onToken(null)`), rendering retryable `role="alert"` feedback, and removing widgets cleanly on unmount.
  - Updated `lib/services/online-game.ts` (`ensureGuest(captchaToken?: string)`, `onlineGame.profile(profile, captchaToken?)`, `GameError('CAPTCHA_REQUIRED')`), `components/LobbyScreen.tsx`, `components/TurnTakeApp.tsx`, `.env.example`, `docs/DEPLOYMENT.md`, and `docs/IMPLEMENTATION_STATUS.md`.
- **Unit & Browser UI Verification:**
  - `tests/guest-auth.test.ts` + `tests/captcha-ui.test.tsx`: 9 tests covering `existing_guest_skips_captcha`, `new_guest_requires_challenge`, `new_guest_passes_token_to_auth`, unconfigured fallback, `failed_challenge_creates_no_room`, `expired_challenge_clears_token`, `challenge_unmount_removes_widget`, `captcha_does_not_block_local_play`, and post-auth `NAME_TAKEN` unmount.
- **Hosted Staging Verification (Cloudflare Official Test Keys on Restricted Preview `dpl_4Y3AVeFRB5ownNXVuL9WnCzqBnLw`):**
  - Enabled staging Auth `security_captcha_provider=turnstile` temporarily after deploying `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` to Vercel `Preview`.
  - Direct signup bypass check (`POST /auth/v1/signup` without token): HTTP `400` (`captcha protection: request disallowed (no captcha_token found)`). Note: GoTrue takes several seconds to reload after Management API `PATCH /config/auth`; always confirm enforcement after patching.
  - Pass mode: lazy pre-click counts (`turnstile=0 signup=0`), new guest solved Turnstile -> `signup=200` -> Classic room `XPWK94` (`room=200`), and existing guest reload skipped Turnstile completely (`turnstileReqs=0 signupReqs=0`, Clash room `EJZWUA`).
  - Fail mode (server test secret failing dummy tokens): `POST /auth/v1/signup` HTTP `400` (`invalid-input-response`), `0` `/api/rooms` calls, visible `role="alert"` error, and Local Classic remained playable.
  - Restored `turn-take-staging` back to no-CAPTCHA staging baseline (`security_captcha_enabled=False`, removed `NEXT_PUBLIC_TURNSTILE_SITE_KEY` from Vercel `Preview`, deployed `dpl_Bb6Kj33t1tSZBUCXzNFhngyyjJCM` at `https://ttt-game-6ltwkbj7r-team-e2117dad.vercel.app`) and re-verified `bun run test:hosted` (`PASS hosted Classic` + `PASS hosted Clash`).

## Task 7: Production Provisioning & Restricted Build

- **Date:** 2026-11-15
- **Commit Built:** `c6cdba1` (`Famanias/deployment`)
- **Supabase Production (`turn-take-prod` / `yeehqcdayrygwdhyyzfc`, `us-east-1`):**
  - Free-tier backup state audited (`walg_enabled: true`, `pitr_enabled: false`, `backups: []`; no automated backups or PITR on Free plan).
  - Linked CLI to `yeehqcdayrygwdhyyzfc`, ran `supabase db push --dry-run` and `supabase db push --yes`, and verified `supabase migration list --linked` matches 1:1 (`20261114134954` through `20261114145119`).
  - Enabled `pg_cron` and scheduled `supabase/cron.sql` (`jobid: 1`, `turn-take-deadlines`, `5 seconds` cadence, verified `status: succeeded` in `cron.job_run_details`).
  - Verified `supabase db advisors --linked` + MCP advisors (`0` ERRORs), `Accept-Profile: private` returns `406 PGRST106`, `anon`/`authenticated` denied `private.sweep_deadlines()`, `private_only: true` on Realtime with exact-topic `realtime.messages` policies, and `public.game_leaderboard('classic')` returns empty initial entries.
  - Enabled anonymous auth (`external_anonymous_users_enabled: true`, `rate_limit_anonymous_users: 30`) and configured `site_url` (`https://ttt-game-sooty.vercel.app`), `uri_allow_list` (`https://ttt-game-sooty.vercel.app/**,https://ttt-game-team-e2117dad.vercel.app/**`), and Turnstile CAPTCHA (`security_captcha_enabled: true`, `security_captcha_provider: turnstile`); probed `POST /auth/v1/signup` without token and confirmed HTTP `400 captcha_failed` after GoTrue config reload.
- **Cloudflare Turnstile Production Widget:**
  - Created widget `"TURN//TAKE Production"` (account `62381eb928b16fdc8781f8f4fc45ab0e`, sitekey `0x4AAAAAAGBXl2sZfeZyquBe`, mode `managed`, domains `ttt-game-sooty.vercel.app` and `ttt-game-team-e2117dad.vercel.app`); secret stored exclusively in Supabase Auth.
- **Vercel Restricted Production Candidate:**
  - Deployment ID: `dpl_fMhoWr6hFmH4BYW2dY5ZVTGx7wDH`
  - Immutable URL: `https://ttt-game-53svbvcj5-team-e2117dad.vercel.app`
  - Production Aliases: `https://ttt-game-sooty.vercel.app`, `https://ttt-game-team-e2117dad.vercel.app`
  - `Production` env vars set before build: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (`Preview` env vars confirmed unchanged pointing at `ffsvimzxnxqbogzvuupi`).
  - Restricted gate verified prior to Task 8 acceptance: unauthenticated requests to all three production URLs return HTTP `302` (`vercel.com/sso-api`, `ssoProtection.deploymentType = "all"`); protection-bypass inspection verified all 12 static chunks carry production Supabase URL, publishable key, and Turnstile sitekey (`foundStagingUrl: false`), and `/api/leaderboard` returned `{"mode":"clash","casual":true,"entries":[]}`.

## Task 8 & Post-Launch Updates: Live Public Release + Simple Accounts

- **Public Access & UI Enhancements:** Opened live Production at `https://ttt-game-sooty.vercel.app`, added clear waiting-room Ready/Not Ready indicator states, and applied `20261115103000_heartbeat_ready_start.sql`.
- **Optional Accounts & Guest Carry-Over (Scope Evolution):** Extending the original no-service-role guest design per owner request, added `SUPABASE_SERVICE_ROLE_KEY`, `lib/supabase/admin.ts`, and `service_role`-only `public.auth_*` RPCs (`20261115120000_user_accounts.sql`) applied to `turn-take-staging` (`ffsvimzxnxqbogzvuupi`) first, then `turn-take-prod` (`yeehqcdayrygwdhyyzfc`). Enabled `mailer_autoconfirm: true`, `password_min_length: 8`, and empty character-class rules (accepting simple passwords such as `12345678`) on both projects, keeping Turnstile active on Production (`0x4AAAAAAGBXl2sZfeZyquBe`). Unregistered guests can view public rankings (`LeaderboardModal`), cannot join rankings (`ACCOUNT_REQUIRED`) or read `/api/history`/`ProgressModal`, and carry over stats/history upon registering.
- **Vercel Secrets & Builds:** Stored environment-specific `SUPABASE_SERVICE_ROLE_KEY` Secrets in Vercel `Preview` (staging) and `Production` (production). Verified Staging Preview `dpl_Ea9ueQArpQe1HKS4rFxJUwwv3Ska` (`https://ttt-game-3abshif3q-team-e2117dad.vercel.app`) end-to-end (`register` -> `session` -> `logout` -> `login`), `bun run test:hosted`, and `RUN_HOSTED_E2E=1 bunx playwright test` (22 passed, 2 skipped), then deployed Production `dpl_8b9d1ZsrdttEBpC9ujHAztxCz5zX` (`https://ttt-game-sooty.vercel.app`, `HTTP 200`, `CAPTCHA_REQUIRED` enforced cleanly on unchallenged `POST /api/auth/register`). Note: automated two-browser Turnstile solving and unattended post-close Cron match termination were not executed against Production directly because automated bots cannot bypass Turnstile.

## Task 9: Operations, Rollback Rehearsal & Cleanup

- **Staging Rollback Drill:** Pointed staging alias `https://ttt-game-staging-team-e2117dad.vercel.app` temporarily to controlled failing candidate `ttt-game-k9wpo7utn-team-e2117dad.vercel.app` (confirming `/api/auth/register` failure), restored `ttt-game-3abshif3q-team-e2117dad.vercel.app`, and verified `/` (`HTTP 200`), `/api/auth/register` (`registered: true`), and persisted staging leaderboard integrity (`Smoke0-wh77uug` intact).
- **Advisor Audit (`turn-take-prod`):** Verified `supabase db advisors --linked` reports `0` ERROR findings after all 7 migrations; `public.auth_*` RPCs remain restricted to `service_role`.
- **Operations & Monitoring:** Monitor Supabase Auth quota/growth (`anonymous_users`, failed logins/registrations in `private.auth_rate_limits`), `cron.job_run_details` for `turn-take-deadlines`, and Vercel Function logs for `ttt-game`. `private.sweep_deadlines()` purges stale `command_receipts` (`> 7 days`) and `rate_limits` (`> 1 day`), while `private.auth_rate_limits` keeps one upserted row per hashed rate-limit key; user deletion respects match/profile FKs via Supabase admin workflows.
- **Secret Hygiene:** Removed temporary management/DB secrets (`ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROD_DB_PASSWORD`, staging `SUPABASE_SERVICE_ROLE_KEY`) from `.env.local` and deleted temporary `.superpowers/sdd/` scratch files.
