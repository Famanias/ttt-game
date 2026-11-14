# TURN//TAKE backend execution plan

Spec: `D:/downloads/TURN_TAKE_BACKEND_IMPLEMENTATION_MASTER_PROMPT.md` (copy in docs/BACKEND_SPEC.md for portability).
Global constraints: preserve UI/assets/local games; Bun only; no fake remote success; no remote deployment without authorization. Existing root app/lib layout stays. Existing node:test suite runs through Bun; no second unit runner needed.

## Task 1: M0 audit and regression baseline
Record actual app and baseline. Add behavioral local regression tests for eight lines, bot behavior, streak bonus and independent placement/reset. Run `bun test`. Expected: all tests pass. Commit audit, plan, baseline tests. Interfaces produced: existing RoomState and game rules documented.

## Task 2: M1 auth, schema and private rooms
Write database tests first and observe missing functionality. Implement migrations, profile/create/join/snapshot transactions, auth helpers, validated routes, guest service and lobby integration. Test real SQL RLS, seats, expiry, duplicates, rate limits. Run `bun test`. Expected: all tests pass. Commit. Interfaces produced: room RPC snapshots, guest session, remote adapter.

## Task 3: M2 realtime and Classic
Write failing Classic/readiness/rematch/version tests. Implement transactional start/moves/finalization, private notification/presence, heartbeat/read reconciliation, waiting room controls and online arena. Run `bun test`. Expected: all tests pass. Commit. Interfaces consumed: Task 2 room snapshot/auth; produced: match snapshot and final result.

## Task 4: M3 Clash
Write failing deterministic scoring, round/claim/streak/deadline/reconnect tests. Add database score derivation and transitions; adapt existing minigame stages for online configs/events, retain local paths. Run `bun test`. Expected: all tests pass. Commit. Interfaces consumed: Task 3 match command; produced: committed rounds and claims.

## Task 5: M4 leaderboard and reliability
Write failing stats-once, opt-in, channel/authority, liveness and validation regressions. Implement real casual rankings, history, error states, deadline sweep and remaining defenses. Run `bun test`, typecheck/lint/build and browser smoke. Expected: tests/typecheck/lint pass; document any environmental build/browser limitations. Commit.

## Task 6: M5 handoff and review
Document schema, realtime protocol, setup, deployment, status, configuration and exact verification boundaries. Run complete tests, typecheck, lint, build and browser tests. Expected: all locally available checks pass; remote cases honestly pending if credentials absent. Commit. Independent whole-branch review; one tested fix pass for important findings. No push/merge/publish.

## Review Focus
Check authorization through direct RPC bypassing HTTP, client timestamps/hidden traces, security definer grants, revoked membership, lock order, replay scope/version, deadline races/empty submissions, immediate terminal claim with bonus, result immutability, stats applied exactly once, unconfigured/offline UI, hook cleanup and refresh during all phases. Local/bot must never write global stats.
