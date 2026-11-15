# Implementation status

Branch: `Famanias/deployment` (deployed live at [https://ttt-game-sooty.vercel.app](https://ttt-game-sooty.vercel.app)).

## Delivered code versus verification

| Milestone / Phase | Delivered | Evidence / status |
|---|---|---|
| M0 | Actual repo audit, preserved baseline, expanded local rules/bots/streak checks, self-hosted fonts | Verified locally and deployed |
| M1 | SSR guest/account clients, validated profile/room API, SQL authority & RLS, private two-seat rooms, invite codes | PGlite SQL tests + hosted staging smoke + production live checks |
| M2 | Readiness toggle UI, heartbeat-backed countdown/ready start (`20261115103000`), Classic commands, private Broadcast/Presence, reconciliation, rematches | SQL, React DOM, hosted smoke, and two-browser Playwright pass |
| M3 | Shared challenge configs, three online renderer adaptations, raw-trace scoring, ties/sudden death, streak bonuses, claims/auto-place, bounded reload restarts | SQL integration + staging live Clash smoke |
| M4 | Atomic finalized stats, registered opt-in leaderboard + match history (`20261115120000`), optional username+password accounts with simple password support (`12345678`) and atomic guest carry-over | `tests/auth.test.ts`, `tests/auth-ui.test.tsx`, `scripts/verify-hosted.ts`, `e2e/online.pw.ts`, Preview & Production live checks |
| M5 / Rollout | Staging (`ffsvimzxnxqbogzvuupi`) & Production (`yeehqcdayrygwdhyyzfc`) Supabase + Vercel (`team-e2117dad/ttt-game`), on-demand Turnstile CAPTCHA on Prod, `5s` Cron, rollback drill | Staging Preview + Live Production verified (`HTTP 200`); operational caveats recorded below |

No in-memory networking fallback remains. Local 2P/Bot/Clash modes work without login; online rooms work as a guest without creating an account; optional registration unlocks saving progress/match history and opting onto public rankings while carrying over prior browser guest stats/history.

## Verification summary (current branch)

- `bun test`: **62 passed, 0 failed** across 14 test files (`auth-ui.test.tsx`, `auth.test.ts`, `captcha-ui.test.tsx`, `clash.test.ts`, `classic.test.ts`, `contracts.test.ts`, `guest-auth.test.ts`, `online-countdown.test.ts`, `online-ui.test.tsx`, `reliability.test.ts`, `review-regressions.test.ts`, `rooms.test.ts`, `target-input.test.ts`, `lib/game/rules.test.ts`).
- `bunx tsc --noEmit`: passed (`0` errors).
- `bunx eslint .`: **0 errors, 21 warnings** (existing `@next/next/no-img-element` warnings).
- `bunx next build`: passed (`Next.js 15.5.29` production build).
- `bun run test:hosted` (against `turn-take-staging`): passed both Classic and Clash, including guest leaderboard gating and `auth_complete_registration` carry-over verification.
- `RUN_HOSTED_E2E=1 bunx playwright test` (against `turn-take-staging`): **22 passed, 2 skipped** (unconfigured-error specs skip when hosted env is present); covers both `[desktop]` and `[mobile]` local games, online room invite/ready/Classic/rematch, and `12345678` registration, progress modal, leaderboard opt-in, logout, login, and reload persistence.
- `bunx supabase db advisors --linked` (`turn-take-prod`, `yeehqcdayrygwdhyyzfc`): `0` ERROR findings (`WARN` notices limited to intentional public read-only `public.game_leaderboard`, `realtime.messages` anonymous channel policy, `pg_cron` metadata tables, and `auth_leaked_password_protection` disabled on Free plan).

## Known operational caveats & deferred items

1. **Free-tier database backups:** Supabase Free plan for `turn-take-prod` (`yeehqcdayrygwdhyyzfc`) has PITR disabled (`backups: []`); schedule manual SQL exports before major schema edits.
2. **Streak statistic cap:** `longest_streak` tracks the two-win Clash bonus-counter peak (`<= 2`); tracking unbounded consecutive round wins remains a follow-up item.
3. **Casual rankings trust boundary:** Minigame inputs run in browsers and optional passwords intentionally allow simple 8-character values without email verification/recovery codes; rankings are casual rather than anti-cheat-hardened.
4. **Live Turnstile boundary:** Automated hosted smoke/Playwright runs target `turn-take-staging` (Turnstile off); Production enforces Turnstile (`0x4AAAAAAGBXl2sZfeZyquBe`), confirmed via live unchallenged `POST /api/auth/register` returning `400 CAPTCHA_REQUIRED`.
