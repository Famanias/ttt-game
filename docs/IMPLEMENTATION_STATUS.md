# Implementation status

Implementation branch: `Famanias/turn-take-backend`, isolated Orca worktree `E:/orca/workspaces/ttt-game/turn-take-backend`. Original main checkout and user lockfile edits are preserved. No merge, push, remote migration or deployment has been performed.

## Delivered code versus verification

| Milestone | Delivered | Evidence / outstanding |
|---|---|---|
| M0 | Actual repo audit, preserved baseline/branch, local regression coverage | Baseline 7 tests; expanded local rules, bots, wins/draw and streak checks. Original font build problem recorded and subsequently fixed. |
| M1 | SSR guest clients, validated profile/room API, migrations/RLS, secure private seats, links | PostgreSQL/PGlite tests pass for private reads, direct writes, two seats, replay, expiry and failed-guess limits. Hosted Auth/join remains unverified. |
| M2 | Readiness/countdown, Classic commands, private notifications/presence, reconciliation, fresh-match rematches | SQL rules/versions/terminal locks/rematches tested. Hosted Realtime and two-cookie-jar online browser test pending configuration. |
| M3 | Shared challenge configs, three online renderer adaptations, raw-trace scoring, ties, streaks, claims, auto-placement, pause/restart | SQL integration verifies configs/hidden attempts/scoring/bonus/terminal/deadline cases. Both-device live minigame play pending. |
| M4 | Atomic finalized-only stats, opted-in public mode rankings, history, liveness/revocation fixes, owner sweep | SQL and local browser verification below. Cron function tested; scheduler/hosted races not run. |
| M5 | Supabase config and migration/Realtime/Cron/Vercel handoff | Deployment instructions and actual limitations documented. No remote project, secrets or authorization to publish; no public URL. |

No in-memory networking fallback remains. No local/bot leaderboard POST remains. Unconfigured online rooms and leaderboard show explicit unavailable/error states. Online code is implemented, but it is **not claimed to be a verified hosted deployment**.

## Local verification

- `bun install --frozen-lockfile --ignore-scripts`: passed; lockfile stable.
- `bun test`: **39 passed, 0 failed** across nine files. Actual SQL runs in PGlite; Auth/transport edges are stand-ins as documented.
- `bun run typecheck`: passed.
- `bun run lint`: **0 errors, 20 warnings**, all existing image-element warnings. No new hook warnings remain.
- `bun run build`: passed with self-hosted original font families and standard Next.js output.
- `bun run test:e2e`: **20 passed, 2 skipped**. Desktop/mobile cases cover offline local Classic win/reset/draw, all bot difficulties, all three local minigames, profile/avatar/sound and honest unconfigured online/rankings errors. Two hosted Classic cases were explicitly skipped because Supabase is absent.
- `bun audit --production --json`: `{}` (no production advisories). All-dependency audit: five moderate development-only advisory groups (`@opentelemetry/core`, `glob`, `minimatch`, `postcss-selector-parser`, `uuid`); no high/critical findings. No forced major upgrades/downgrades were applied. The compatible PostCSS override addresses the original transitive high findings.
- Orca browser loaded the real production lobby: DM Sans active, zero failed images, no horizontal overflow at inspected desktop size. Mobile geometry is covered by Playwright. Original `public/assets/` images are unchanged.

## Independent final review

A fresh gpt-6-astra reviewer inspected the whole branch. Five Important findings were reproduced and fixed in one regression-tested pass: same-version submissions, ordinary Target Rush late/edge taps, reusable countdown cancellation, fast reload recovery, and offline/hanging local return. The pass also covers a submission committing during reload without losing live subscription. New SQL and real React DOM/hook tests bring the suite to 39; network boundaries in React tests are mocked explicitly, while PostgreSQL transition tests execute the actual migrations.

Deferred minor: `longest_streak` currently measures the two-win bonus-counter peak, so it cannot exceed two. Tracking the uninterrupted win run separately is follow-up work; the locked bonus mechanic is unchanged. Hosted validation and public deployment remain external blockers below.

## Remaining external blockers

1. Create/select Supabase project, configure the public URL/key locally and in Vercel, and enable/rate-limit anonymous auth.
2. Apply reviewed migrations and run Supabase advisors; require private Realtime, then verify allowed/denied subscriptions on the actual service.
3. Enable/observe Cron. Without it, reconciliation waits for the next read/command when all clients disappear.
4. Run `bun run test:hosted`, opt-in hosted Playwright, two-device Clash, reload/background throttling and disconnect/slow-network smoke. PGlite does not prove true multi-connection scheduling or hosted service behavior.
5. Public anonymous-auth CAPTCHA uses on-demand Cloudflare Turnstile (`components/TurnstileChallenge.tsx` paired with `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) during new guest sign-in (`ensureGuest`); existing guests and local 2P/Bot/Clash modes skip CAPTCHA. Configure the matching Turnstile secret only in Supabase Auth after deploying the client token flow, and review guest/history retention with the project owner.
6. Authorize and perform Vercel deployment, then verify the real public URL. No deployment has been attempted.
