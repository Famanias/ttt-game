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
| Staging | Not yet selected/created (pending owner selection in Task 2) | Unavailable | Not applied | Not configured | Pending Task 2–5 |
| Production | Not yet selected/created (pending owner confirmation in Task 2 / Task 7) | Unavailable | Not applied | Not configured | Pending Task 7–9 |

## Observed CLI accounts (read-only discovery)

- **GitHub (`gh`):** authenticated as `Famanias`; remote `origin` = `https://github.com/Famanias/ttt-game.git`.
- **Vercel CLI (`62.1.0`):** authenticated as `famanias` (team `team-e2117dad`); no `ttt-game` project exists yet.
- **Supabase CLI (`2.119.0`):** authenticated in org `Highway TMS` (`tgodtfapcbwxggyeajir`), which currently lists two unrelated active projects (`zutshxvbiomqjxkytpyl` and `iiseakiisdhosjoygnfo`). No TURN//TAKE project is linked and `.env.local` does not yet exist.

## Task checklist status

- **Task 1 (Merged release baseline):** Complete on `f25b4f8`.
- **Task 2 (Accounts & staging config):** Blocked on owner decisions/authorization (Supabase project capacity/creation or selection, Vercel project target, desired release audience/domain).
- **Tasks 3–9:** Pending upstream target configuration (note: Task 6 client CAPTCHA implementation + unit/local UI tests can proceed locally once confirmed or in parallel, while hosted validation still requires staging/production targets).

## Rollback target

- **Staging rollback target:** Unavailable (no staging deployment created yet).
- **Production rollback target:** Unavailable (no production deployment created yet).
