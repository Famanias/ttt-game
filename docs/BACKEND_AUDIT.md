# Backend audit — 2026-11-14

Baseline: `d8b812c`, preserved on main; implementation branch `Famanias/turn-take-backend` in an Orca linked worktree. User changes to main's bun.lock are untouched. Bun is the authoritative package manager (installed 1.4.4).

## Existing application

Next.js 15 App Router, React 19, TypeScript strict, Tailwind 4, Motion and GSAP. Root-level `app/`, `components/`, and `lib/` are intentional; no framework migration required. Route `/` passes optional `?room=` to `TurnTakeApp`. API `/api/rooms`, `/api/rooms/[code]`, `/api/leaderboard` use `lib/server/store.ts`.

`TurnTakeApp` owns local state; `LobbyScreen`, `WaitingRoomScreen`, `ArenaScreen`, `GameBoard`, `ClashMinigameModal`, `OutcomeModal`, `LeaderboardModal` render the existing UI. Assets in `lib/game/assets.ts` map six avatars and all generated images. No README, handoff docs, AGENTS.md, or Supabase configuration was present.

## Rules and seams

`lib/game/rules.ts`: eight winning lines, draw, minimax Master bot, probabilistic Casual/Tactical bots, fixed rotation Timing → Memory → Target Rush, two consecutive Clash wins award two placements and reset streak. Local resets alternate starting mark (preserve this existing behavior). `TurnTakeApp` handles local placement, result and pass-and-play; keep these independent of network state.

Existing Timing uses one stop on a 22-degree half-width arc, speed 230 + min(round*14,110), target (round*73+45)%360. Online requires three stops; preserve the dial, use three attempts online only. Memory flashes 3/4/5 unique cells for 1550ms, scores accuracy and speed. Target Rush lasts 5500ms with four targets, normal 90/bonus 140 points; online needs deterministic targets and bounded events. Local renderers remain usable.

## Unsafe demo paths

Server module global map is lost on restart and differs across instances; room code substitutes for authorization; mark and raw score trusted from body; joining starts immediately; no real auth/readiness/presence/RLS/deadlines. Rematch overwrites history. Public leaderboard POST accepts fabricated outcomes including local games. Replace these routes/store, remove local leaderboard submissions, and use one remote DTO adapter into the existing RoomState.

## Baseline verification

- `bun install --ignore-scripts`: 875 packages installed; three lifecycle scripts blocked. No npm lockfile introduced.
- `bun test`: 7 passed, 0 failed (existing node:test tests).
- `bun x tsc --noEmit`: passed.
- `bun run lint`: 0 errors, 20 warnings (existing img-element warnings).
- `bun run build`: failed while fetching Google fonts over this environment's connection; unrelated to backend changes. Preserve font family/weights; provide self-hosted assets if needed.
- Docker binary exists but Docker Linux engine is not running. No Supabase project env file or connected Supabase tool exists. Real Auth/Realtime/browser multiplayer requires configuration; test SQL with embedded PostgreSQL/PGlite and label it accurately.

## Implementation boundaries

Database owns all online state. Validated guest JWT → user-scoped RPC; no service role. Room lock serializes seat selection and commands; idempotency and expected versions protect retries. Private broadcasts only signal refetch. Heartbeat and database reconciliation own liveness; optional Cron sweep resolves abandoned deadlines. Guest inputs remain untrusted, so rankings are casual. Never silently fall back to demo rooms.
