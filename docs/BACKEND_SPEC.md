# TURN//TAKE — Backend & Real-Time Multiplayer Implementation Master Prompt

**Agent compatibility:** Google Antigravity, OpenAI Codex, Claude Code — identical instructions and responsibilities.  
**Project:** Existing TURN//TAKE frontend exported from Google AI Studio.  
**Objective:** Replace demo-only networking with safe, persistent two-player online gameplay while preserving the existing polished UI and fully playable local modes.  
**Target stack:** Existing Next.js / React / TypeScript application, Vercel, Supabase Auth + PostgreSQL + Realtime, transactional server-side match commands.  
**Priority:** Correctness, security, and an end-to-end working deployment over extra features or cosmetic changes.

> **Instruction for the coding agent:** You are working inside the existing TURN//TAKE project repository. Implement the backend and integrate it with the real frontend **in this repository**. Do not answer with a theoretical architecture or recreate the UI from scratch. First inspect the code and record what is actually present. Then implement the verified milestones below in order, running tests after each. If credentials or a Supabase project are missing, implement the code, migrations, setup documentation and automated tests; mark remote integration as unverified and do not invent successful connections. Do not use a fake realtime server or sample data and label it production.

---

## 0. Source of truth and preflight

Read the actual repository before editing:

1. `package.json`, package manager lockfile, `tsconfig.json`, `next.config.*` / Vite config if any, app router, routes, `.env.example`, README and tests.
2. Existing local Classic and Clash gameplay modules, player settings, minigames, scoreboard, AI bot, room preview, leaderboard preview, asset maps and reusable components.
3. Any checked-in `docs/FRONTEND_HANDOFF.md`, `docs/GAME_RULES.md`, `docs/SCREEN_MAP.md`, `docs/ANIMATION_SPEC.md`, `docs/ASSET_MAP.md`, `AGENTS.md`, or original specifications.
4. Existing local-service interfaces/types: `Player`, `Room`, `Match`, `ClashRound`, `MinigameAttempt`, `MinigameResult`, `PendingClaim`, `LeaderboardEntry`, or equivalent. **Match the real code, not these hypothetical names.**
5. Verify actual framework. If the export is React/Vite rather than Next.js, determine a minimal, low-risk migration path to **Next.js + TypeScript** to meet the technical-test requirements; preserve game components, styling, paths, and asset URLs. Record the plan before changing framework files. If the repo is already Next.js, do not scaffold another app.
6. Run baseline install, lint, typecheck, tests, and build (where available). Record existing failures separately from new ones; inspect the app in browser if a browser tool is available.

Create `docs/BACKEND_AUDIT.md` with: current routes/components, service seams, game rules actually implemented, framework versions, tests, mock-only paths, and risks. **Continue into implementation after the audit; do not stop at an audit-only response.**

### Non-negotiable preservation requirements

- **Do not redesign the UI.** Keep the current TURN//TAKE brand, dark neo-arcade lobby, cyan/coral/yellow palette, fonts, animations, UI ornaments, thumbnails, backgrounds, selected avatars, and responsive layouts.
- **Local Classic must stay playable without any account, server, or network connection.** X/O turns, all eight winning lines, draw, and **New Game** are hard requirements.
- Preserve the existing **Vs. Bot** feature and its Casual / Tactical / Master difficulties, if implemented.
- Preserve existing **local two-player** Classic, **local Clash**, **Perfect Timing**, **Flash Memory**, **Target Rush**, rotating minigame selector, avatar/name selection, sound toggle, leaderboard screen, and game-result flow.
- Do not change the locked two-consecutive-Clash-wins → bonus-placement mechanic.
- Any network-specific UI must honestly reflect live state; sample leaderboard data must never masquerade as real persisted results.
- Do not replace minigames with animated mockups. Reuse functional UI and scoring logic, adapting it for simultaneous online play.
- All three agents (Antigravity / Codex / Claude Code) are **one interchangeable engineering role**. No agent-specific work assignments or proprietary dependency assumptions.

---

## 1. Target feature set and explicit scope

**Must ship:**

1. Existing local Classic remains fully operational independently of online mode.
2. Online **Classic private rooms**: create, copy code/link, join, two members max, ready up, synchronized board, win/draw, result, rematch.
3. Online **Clash private rooms**: simultaneously play the three existing minigames on matched challenges, server-confirmed winner, authorized grid claim, two-win streak bonus, sudden death on ties, result, rematch.
4. Guest identity via Supabase anonymous sign-in; user-chosen public display name and one of six actual avatar assets.
5. Real online player presence, waiting, reconnect handling and explicit timeout/forfeit states.
6. Persistent match history and a **real, live-updating leaderboard** calculated only from finalized server-confirmed online matches.
7. Reproducible schema migrations, Row Level Security, test coverage, Vercel-ready configuration and setup instructions.

**Out of scope unless already implemented:** public matchmaking, spectators, chat, Elo/ranked competitive integrity claims, payment, an admin dashboard, notifications, social sign-in, additional minigames, 3D assets, a separate custom WebSocket server.

**Interpretation:** the goal is a strong entry-level technical-test demonstration, not a live-service-scale game. Finish a secure and understandable two-person private-room workflow before secondary features.

---

## 2. Architecture and trust boundaries

Use this separation (adapt folder names to current repository):

```text
Browser: existing React UI and minigame renderer
  ├── local classic/bot/local Clash engines (remain independent)
  ├── authenticated guest client + typed API adapter
  └── private Supabase Realtime subscription (notifications / presence)
                  ↓ HTTPS commands / snapshot reads
Next.js Route Handlers (or existing server boundary)
  ├── schema validation, auth verification, rate limits
  └── authenticated transactional PostgreSQL RPC/functions
                  ↓
Supabase PostgreSQL (canonical truth)
  ├── protected rooms, memberships, boards, rounds, claims, results
  ├── transactionally updated statistics
  └── versioned events → private Realtime Broadcast
                  ↓
Other player's browser fetches latest canonical snapshot
```

**Source of truth is the database, not client state, Realtime presence or broadcast packets.**

- Use Supabase Auth for guest identity. `signInAnonymously()` creates a real authenticated user; **it is not the public `anon` API key**. Preserve identity across page refresh by using the supported session integration. User sessions may be lost after sign-out/clearing browser data; explain this in UI/README.
- For cookie-based Next.js auth, use `@supabase/ssr` with its current supported client/server and session-refresh pattern. Check installed Next.js version to choose correct `proxy.ts` vs `middleware.ts`; do not rely on stale copy-paste auth code. Verify server auth using a validated token (`getClaims()` or `getUser()`, as appropriate), **not only the client-supplied user ID or unverified `getSession().user`**.
- Public browser env values: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (adapt if existing supported keys use a different documented name). Never expose service role, secret API keys, database passwords or auth refresh tokens to the client. Ideally perform user-scoped RPC under the validated guest JWT and avoid using a powerful service-role key in ordinary requests.
- Realtime: use a **private** channel scoped to authorized room or match members, with RLS for `realtime.messages`, and presence for online/offline indicators. Do not let clients broadcast trusted `move_accepted` / `round_won` / `stats_updated` messages. Use database-triggered Broadcasts of committed changes (or a justified simpler Postgres Changes MVP) to prompt snapshot reconciliation.
- Broadcast payloads should be minimal: resource ID, event/phase, committed `version`, and non-secret public state. Do not broadcast hidden answers, unsent private attempts, tokens or identifiers unnecessary for UI.
- The server clock and DB transaction order determine deadlines and winners. Clients display a smooth local countdown using server timestamps, but cannot invent a result or a placement right.
- Do **not** keep the canonical match map in a module-level global variable, memory cache, an in-process WebSocket server, or browser `localStorage`. The app must function across different server instances and after cold starts.

---

## 3. Database model: implement via versioned migrations

Use Supabase CLI or project-standard SQL migrations checked into `supabase/migrations/`. Schema names below are conceptual; reuse any real equivalent. Add constraints and indexes; avoid unnecessary tables.

| Table | Minimum contents / invariants |
|---|---|
| `profiles` | `user_id` = authenticated user UUID, unique normalized display name per profile, allowlisted avatar ID, timestamps, optional public-leaderboard opt-in |
| `rooms` | UUID PK, unique **random** 6-character code, host user ID, `mode` (`classic`/`clash`), `status`, creation/expiry, current match ID, room `version` |
| `room_members` | room ID + user ID unique; slot X/O unique per room; ready flag; membership status and join timestamps; max two active participants enforced transactionally |
| `matches` | UUID PK, room ID, X/O player IDs, mode, version, phase, 9-cell board or equivalent canonical state, next turn / pending claim, streak state, started/finished times, outcome, result applied marker |
| `moves` | match ID, monotonically increasing move number, player ID, cell 0–8, normal/bonus/auto, timestamp; unique match+cell and match+sequence |
| `clash_rounds` | UUID, match ID + round index unique, type, deterministic seed and public configuration, start/end/submission deadline, status, winner, sudden-death parent/context |
| `clash_submissions` | round ID + player ID unique, schema-versioned bounded input/event trace, derived score, server receipt time, validation state |
| `rematch_votes` | previous match, participating user, decision and timestamp; no phantom third-party votes |
| `player_stats` | user ID unique; online Classic and Clash W/L/D, Clash rounds won/played, longest streak, timestamp; **server-controlled only** |
| `command_receipts` (optional) | operation scope + idempotency key + actor unique; original result to return on duplicate command |

Implementation details:

- Invite codes: cryptographically random, case-insensitive, human-friendly, avoid ambiguous characters; retry unique conflicts, enforce TTL, prevent brute-force guessing with rate limiting. Return only minimal room information to a nonmember before an authorized join.
- Room membership races: enforce two active users by transactional locks + explicit unique X/O constraints. Disallow adding the same user twice or assigning both slots to the same user. A third guest receives `ROOM_FULL`.
- Room codes are invitation pointers, **not authorization for arbitrary room mutations**. Every action verifies authenticated membership and expected phase.
- `rooms` and `matches` have monotonically increasing integer `version`. Use expected-version checks (optimistic concurrency) or row locks + idempotency. Version is incremented only by committed state changes.
- Finished match history is immutable. Rematch creates a **new match ID**, fresh board and streak/round state. Do not reuse or overwrite the last match.
- Prevent repeated stat increments with an atomic single-finalization guard and unique match-result ledger/marker. Every final result should be reflected exactly once in stats, even with retries and concurrent requests.
- Store timestamps as timezone-aware values; avoid local wall-clock winner logic. Index code lookup, active room memberships, current match and top leaderboard queries.
- Use RLS on all user/room/match tables and explicitly restrict direct writes to authoritative board, result, round scores, and statistics tables. Allow only precisely scoped reads. For sensitive RPC, default to `SECURITY INVOKER`; if `SECURITY DEFINER` is necessary, set explicit `search_path`, schema-qualify names, revoke public/anon execute, grant minimum required roles, and check `auth.uid()`/membership inside each function.

Required deliverables: schema migration(s), policies, secure transaction functions, and `docs/DATABASE_SCHEMA.md` documenting ownership, sensitive fields and RLS permissions. Do not use `using (true)` for private rooms or match writes.

---

## 4. Typed commands and snapshot API

Expose a coherent typed service layer to the existing React components. Prefer the smallest set of routes consistent with the current project's abstractions. Suggested HTTP interface (final paths can vary; document actual routes):

```text
POST   /api/rooms                   # create online Classic/Clash room
POST   /api/rooms/join              # enter 6-character code
GET    /api/rooms/[code]            # authorized current room snapshot
POST   /api/rooms/[code]/ready      # set ready true/false
POST   /api/rooms/[code]/leave      # leave or close waiting room
GET    /api/matches/[matchId]       # authorized canonical match snapshot
POST   /api/matches/[matchId]/move  # online Classic move / authorized Clash claim
POST   /api/matches/[matchId]/rounds/[roundId]/submit
POST   /api/matches/[matchId]/rematch # request/accept/decline
GET    /api/leaderboard             # persisted public/casual stats
GET/PUT /api/profile                # current user's display name / avatar
```

Request contracts:

- `Authorization` comes from a validated session, never an arbitrary `playerId` in a POST body.
- Validate with TypeScript-safe runtime schemas (Zod if already used, or a similarly appropriate library). Reject unknown invalid values and oversized payloads.
- Send **idempotency key** on mutating requests (`clientCommandId` UUID) and expected match/room version where appropriate.
- Use stable typed error codes: `INVALID_CODE`, `ROOM_FULL`, `ROOM_EXPIRED`, `NOT_MEMBER`, `NOT_READY`, `WRONG_PHASE`, `NOT_YOUR_TURN`, `CELL_OCCUPIED`, `STALE_VERSION`, `ROUND_CLOSED`, `ALREADY_SUBMITTED`, `RATE_LIMITED`, `RECONNECT_REQUIRED`.
- Return authoritative snapshots or response versions after accepted commands. Replays with the same idempotency key should return the original committed outcome (or an explicit harmless already-committed result), not apply changes again.
- Use a simple typed `GameService` / repository adapter so existing **local** services and **online** services can coexist without cloning the UI. Map backend DTOs into existing frontend domain types in one place.
- No phantom UI successes. Await server commitment for room creation, ready changes, move confirmation, minigame winner, stat updates and rematches.
- Avoid cache leaks: don't statically cache auth-specific response bodies, and configure personalized Next.js routes/server rendering accordingly.

---

## 5. Online room flow — exact experience

### 5.1 Create and join

- From existing lobby `Classic Room` and `Clash Room` buttons, user chooses a valid guest display name and one of six existing avatars, is signed in anonymously if needed, and creates a real room.
- Server generates six-character code and a shareable URL `/room/{CODE}`. Show copy-code and copy-link actions with tactile feedback.
- Join by code or deep link resolves on server. Normalize case/whitespace. Validate expiry and room status; enforce exactly two active seats (X and O).
- Show **real** room members, avatars, online indicators and ready state. Do not manufacture a second player in an online room.
- Host may leave before start; simplest first-release policy: close the waiting room and show a reason to the other player. Handle browser close / refresh gracefully instead of immediately deleting membership.

### 5.2 Ready / countdown

- Both members must become ready. Ready state is persistent server-owned data; presence alone is not readiness.
- Once both are ready and active, server atomically creates a match and chooses an identical future `startAt` for both players. Unready/disconnection before countdown cancels or postpones match start according to explicit rules.
- Classic: begin with X's turn. Clash: begin with a synchronized `CLASH_ANNOUNCE` and the first minigame, **no initial free move**.
- Refresh/reconnect returns guest to the correct room/match, not to a misleading fresh lobby state.

---

## 6. Online Classic rules (transactional)

- Board has nine positions indexed 0–8. X starts; X and O strictly alternate **only after a legal committed move**.
- Server checks: authenticated actor is assigned current slot, correct active phase, cell empty, version matches, result absent.
- Move transaction updates board and turn (or winner/draw), appends move, increments version, and emits a committed update notification.
- Evaluate all eight winning triples after every legal placement; prohibit all moves after a terminal result.
- `NEW GAME` on local Classic continues to reset immediately. In online Classic, display `REQUEST REMATCH` and require agreement from both members; do not silently clear the other person's board.
- Rematch commits a new match ID, fresh X-starting board, results and ready/intro state; optionally alternate player slots only if the established frontend experience supports it and the rule is explicitly documented.

---

## 7. Online Clash: synchronize the THREE existing 2D minigames

**Do not rewrite the minigame visuals/scoring arbitrarily.** Audit each existing minigame's actual implementation and formalize its `config`, `seed`, `startAt`, `endAt`, event/input trace and `finalResult` contracts. The live mode requires *simultaneous* challenges, unlike local pass-and-play.

### 7.1 Deterministic shared challenges

For every round server creates:

- unique round ID + match ID + minigame type
- deterministic public seed/configuration used by both players
- authoritative UTC `startAt`, `endAt`, submission deadline
- stable scoring version and tie-break rule
- allowed participants and round lifecycle phase

Clients must receive the same challenge definition, show an synchronized 3–2–1 countdown, render locally, and submit once. Account for clock offset and measured jitter in displayed countdowns. If a client joins late, use the existing canonical round and its remaining time — never generate a new random challenge for them.

**Minigame specifics:**

- **Perfect Timing:** 3 presses/stops on identical dial/target config; score by angular accuracy under a fixed rubric, tie-break by defined accuracy rules. Reject extra/invalid presses, impossible samples, late/replayed events.
- **Flash Memory:** same seeded pattern flashed to each player; store per-cell attempts and completion timing. Accuracy first; time only when accuracy ties. Do not reveal opponent inputs until both submissions are resolved.
- **Target Rush:** same seeded spawn schedule and positions; score accepted target hits and bounded misses; prevent duplicate scoring for one target and out-of-window hit events. Avoid fairness claims for highly different pointer/touch devices.

Browser input traces can be manipulated by a motivated attacker. The server should derive final scores from validated raw attempts and timestamps when feasible, reject obvious impossible submissions, cap event rates and duration, and **label the leaderboard casual**. Do **not** claim cheat-proof competitive ranking without trusted input or stronger server-validated gameplay.

### 7.2 Round lifecycle

```text
ANNOUNCE → COUNTDOWN → PLAYING → SUBMISSION_LOCKED
                                  ↓
                               RESOLVE
                        ┌─────────┴──────────┐
                        │                    │
                     TIE                  WINNER
                        │                    │
                  SUDDEN_DEATH        CLAIM_CELL
                                             ↓
                                  BOARD_WIN / BOARD_DRAW?
                                    ├─ YES → RESULTS
                                    └─ NO  → NEXT_CLASH
```

- An individual score submission **never** unilaterally awards a cell. Resolve after both accepted submissions or authoritative deadline.
- A tied resolved round triggers **sudden death** (shared shortened Perfect Timing); only a resolved winner earns a cell. Repeat on equal sudden death outcomes while respecting inactivity/forfeit rules.
- Never send a player's hidden memory selections or actionable opponent input trace before result lock. Show opponent state as `playing`/`submitted`, with scores shown only after resolution if needed.
- Rotate Timing / Memory / Skill without immediate repeats using the server's committed sequence. Preserve the existing `Rotate All` UI preference if it was implemented, but in online mode it must not override both players' canonical challenge sequence.
- Losing or missing connectivity does not directly grant an opponent a fabricated minigame score. Follow explicit reconnect/timeout rules.

### 7.3 Streak and bonus claim rules — LOCKED

- Each resolved, non-tied Clash winner earns **one normal claim**.
- If the same player wins a **second consecutive resolved Clash**, award **one additional claim immediately after their normal claim**; then reset their streak to zero.
- If the winner alternates, reset the previous player's streak and start the new winner's streak at one.
- Verify the 3×3 Tic-Tac-Toe winner/draw **after each individual placement**, not after the entire two-placement grant. If first claim wins, discard the pending bonus claim and finalize the match.
- Only the authorized, active claimant can click an empty board cell. Other player sees a read-only grid and live placement updates.
- Claim window approximately **15 seconds** based on server timestamp. On timeout server deterministically chooses an empty cell, records `AUTO_PLACED`, evaluates win/draw, and proceeds.
- Disallow duplicate claims, occupied cells, stale version updates, and claims after match end.
- The server should maintain canonical streak and claim counters; React animations consume the committed state, not construct authoritative state.

---

## 8. Realtime delivery, reconnect and liveness

- Subscribe only after identity and membership are verified. Use a private room/match channel with Realtime RLS policies allowing only valid room members to join and receive private messages.
- Prefer DB-triggered private Broadcasts containing `room_updated`/`match_updated` and `version`, with a fresh authorized canonical snapshot read to reconcile. Database changes are the source, broadcast is a **notification**.
- Handle out-of-order, duplicated, dropped and delayed broadcast events by version checks and refetch. On reconnect: reauthenticate → fetch snapshot → subscribe → reconcile any missed versions (e.g. refetch after subscribe succeeds) → resume correct phase.
- Presence signals `online` / `temporarily disconnected` and heartbeats, but do not use presence alone to decide victory, ownership or a forfeit. Do not send high-frequency minigame mouse positions through Presence.
- Define ~**30-second reconnect grace**. If disconnected mid-match, transition to `PAUSED_FOR_RECONNECT` where needed, preserve database match state, give both players a clear countdown, and resume from a single canonical phase after successful reconnect. On expiration, declare a forfeit atomically. No instant forfeits on temporary socket drops.
- Differentiate tab refresh, duplicate tabs, duplicate command submission, deliberate leave, and permanent disconnect. A second tab for the same guest must not create an extra player slot.
- Never rely on a client to be online to resolve an expired round or claim. Implement a safe server-side deadline reconciliation (`advance_match` under DB lock) triggered on relevant reads/commands, plus a lightweight Supabase Cron job to sweep expired phases if feasible. If cron isn't configured yet, document the limitation explicitly; do not call client timers authoritative. Guard all transitions with version/phase and idempotency so both paths can run safely.
- Resume flow should work after a server cold start, Realtime reconnection, or page refresh.
- Store and display minimal useful operational timestamps (`startAt`, `deadlineAt`, `lastSeenAt`) rather than fabricated latency values.

---

## 9. Statistics and live leaderboard

- Distinguish **online Classic** and **online Clash** in persisted stats. Local bot and local pass-and-play must not alter global rankings.
- Finalizing a match must atomically write its outcome and update the two players' stats **once**, with a unique result marker/ledger. Duplicate finalization cannot credit a second win.
- Default leaderboard: sort by committed online Clash wins (tie-break with documented wins/win-rate rule), show W/L/D, matches played and visible avatar; optionally provide a separate online Classic tab.
- Leaderboard updates should re-fetch on committed `match_finished`/`leaderboard_changed` notification. A reasonable poll or on-focus refresh fallback is fine; do not animate fictitious live changes.
- Replace existing sample/demo leaderboard data only when production data is available. While unauthenticated or during setup failure, render explicit `Demo leaderboard` or clear loading/error/empty states—not invented production statistics.
- Allow a guest player to choose whether to have their display name/avatar on a public leaderboard; public fields must be minimized and sanitized. Document guest identity persistence limitations. Because online minigames use untrusted browser input, clearly label this as **casual rankings**, not verified anti-cheat competitive ratings.

---

## 10. Security, abuse and defensive implementation

1. Treat every request body, client timestamp, button click, score and Realtime message as **untrusted**.
2. Enforce membership, phase, slot, version, rate limit and payload bounds **server-side** for every mutation.
3. Keep RLS enabled and least-privilege. Test nonmember reads, direct write attempts, channel subscription denial and revoked-member behavior. Keep private channels genuinely private (including Supabase Realtime settings).
4. Limit room create/join attempts, auth creation and round submissions; handle `RATE_LIMITED` with usable UI. Consider CAPTCHA/Turnstile for anonymous auth depending on deployment exposure.
5. Server-authoritative transaction/RPC for double-submit races, simultaneous joins, placements, rematch vote conflicts and final stat updates. Unique constraints are necessary in addition to application checks.
6. Do not leak guest tokens, service keys, email, IP address, event traces, hidden patterns, or private match resources in public API responses or console logs.
7. Sanitize and bound display name; use a hardcoded allowlist for avatars. Render strings as text, not HTML.
8. Never trust a client-submitted `winner`, `board`, `streak`, `scoreTotal`, `isHost`, `roomMembers`, or `currentVersion` except as conditional input checked against persisted truth.
9. Use parameterized database operations and checked migrations. Never embed production credentials in source, example files, or logs.
10. No assertions of cheat-proof play. Explain limitations clearly in docs and UI where appropriate.

---

## 11. Test plan: must implement and run

Use the existing test framework when available; otherwise add lightweight Vitest unit/integration tests and Playwright browser tests as appropriate. Run actual commands and report results; no invented green checks.

### Baseline/local regressions

- Classic X begins, strict alternation, occupied cells rejected, all 8 wins, draws, terminal lock, New Game reset, no server dependence.
- Bot difficulties and local Clash/minigames still function; no changed timing or styling without necessity.
- Lobby, avatars, ornaments, buttons, responsive layout and sound settings still behave correctly.

### Database/API integration

- Anonymous guest can create room, second guest joins via code, third rejected; duplicate join does not create an extra member.
- Invalid/expired/closed code behaves correctly; brute-force attempts rate limited.
- A nonmember cannot read private match data, mutate room/match, or subscribe to private room channels.
- Both players ready up; only then synchronized match starts.
- Online Classic simultaneous conflicting moves: exactly one valid turn commits; stale/duplicate requests harmless.
- Online Clash both guests receive identical minigame configuration, synchronized start time and one server-resolved result.
- A client cannot arbitrarily credit a score, place marks for opponent, steal a bonus, or force a match result.
- Consecutive Clash wins award correct two placements; streak resets after bonus; changing winners breaks streak.
- Check board win/draw immediately after first/second claim; ignore remaining bonus after terminal result.
- Claim timeout auto-places once; duplicate timeout calls cannot create multiple moves.
- Sudden death tie triggers; no arbitrary winner on unresolved tie.
- Refresh and reconnect recover canonical state; 30s grace vs actual timeout; duplicate tabs cannot fake extra players.
- Rematch requires both consent and creates new match ID; finished old match remains immutable.
- Match result increments leaderboard once even after replay/retry/restart; local/bot games don't affect it.
- User session isolation: guest A never renders guest B's private snapshot on cached responses.

### Browser / production smoke tests

Use two independent browser contexts (distinct cookie jars) or two devices to test invite → ready → Classic match → results → rematch, then Clash → 3 minigames → claim → bonus → result. Verify server reconciliation with background tab throttling, mobile touch, a slow connection, reload during Clash, and intentional disconnect. Verify typecheck/build/lint as available and **deploy to Vercel only when configuration is supplied/authorized**.

---

## 12. Implementation milestones (work in order, no agent role splitting)

The same agent running this master prompt owns the **whole** engineering process. Commit/checkpoint each working milestone in the project's existing Git repository; avoid breaking previously functioning slices.

### M0 — Audit and safety baseline

- Inspect app and running behavior, document `docs/BACKEND_AUDIT.md`, run baseline checks.
- Preserve current UI in a Git branch/commit before modifying; no overwrite of unrelated work.
- Confirm Next.js compatibility and identify existing local mock service seams.

**Exit:** architecture map and regression baseline recorded.

### M1 — Auth, schema and restricted private rooms

- Supabase project variables and `@supabase/ssr` (appropriate for actual Next.js version).
- SQL migrations and RLS, anonymous guest profiles, real room create/join, unique seat selection, invite link.
- Replace the lobby's demo room creation/join with actual API calls while preserving markup and animations.

**Exit:** two separate browser profiles join the same real room; third cannot, and nonmember cannot access it.

### M2 — Real-time waiting room and Online Classic

- Private room channels, committed-event notifications, presence, ready states, countdown.
- Server-authoritative Classic board with conditional moves, win/draw, version/refetch, rematch.
- Add reconnect and error states without losing UI styling.

**Exit:** complete online Classic game across two independent browsers, including refresh, new match and no duplicate moves.

### M3 — Online Clash orchestration

- Adapt existing Perfect Timing, Flash Memory and Target Rush components for online deterministic configs, synchronized timer, round submissions and server-side score derivation/validation.
- Implement tie/sudden death, streak transitions, normal/bonus claims, deadline auto-claim and results.
- Implement reconnect semantics through an authoritative phase state machine.

**Exit:** two browsers complete online Clash with no client-controlled winner or placement bypass.

### M4 — Live leaderboard and final reliability

- Transactional match completion and player statistics; real leaderboard, empty/loading/error states.
- Abuse protections, timeout sweep, RLS regression checks, UI integration, observability and mobile/desktop smoke tests.

**Exit:** online results are persisted once, live rankings reflect committed results, tests pass.

### M5 — Vercel handoff / deployment

- Document required Supabase project settings, migration commands, realtime policies, env vars and Vercel configuration.
- Deploy if the repository and credentials are connected and the user authorized deployment; otherwise provide precise instructions and clearly report unverified steps.
- Confirm public URL with two devices **only if a real URL/deployment exists**.

**Exit:** demonstrable hiring-assessment app with local Classic guaranteed and secure online modes when configured.

---

## 13. Required files and final reporting

At the end, maintain these or equivalent paths:

```text
README.md                                # local setup, features, actual limitations, deployment
.env.example                             # variable NAMES and placeholders only
supabase/migrations/*.sql                # reproducible schema + policies + RPC
src/lib/supabase/*                       # browser/server auth client helpers
src/lib/game/*                           # shared, tested pure rules/adapters
src/lib/services/*                       # typed local + remote game service adapters
src/app/api/...                          # authenticated HTTP commands where appropriate
src/app/room/[code]/...                  # existing/adapted online room route
src/app/match/[matchId]/...              # existing/adapted online match route
src/app/leaderboard/...                  # real public/casual results
src/...                                  # existing UI/assets stay in place
tests/...                                # unit, RLS/API integration, E2E as available
docs/BACKEND_AUDIT.md                    # actual preflight findings
docs/DATABASE_SCHEMA.md                 # tables, constraints, RLS and transaction notes
docs/REALTIME_PROTOCOL.md               # event topics, versioning, snapshots, phases
docs/DEPLOYMENT.md                       # Supabase + Vercel steps and constraints
docs/IMPLEMENTATION_STATUS.md            # real vs stub vs unverified status
```

**Final response format from coding agent:**

1. **Implemented:** precise list of real working features and modified files.
2. **Verification:** commands run, test counts/outcomes, and two-browser evidence if available.
3. **Security:** RLS/membership/transaction constraints proven in tests, plus known limitations.
4. **Configuration needed:** external actions/secrets the user must provide (never ask to paste secrets into chat or commit them).
5. **Remaining blockers:** exact, actionable issues; never label anything done if it's only mocked or not tested.
6. **Deployment:** actual public URL if truly deployed, otherwise exact next steps.

---

## 14. Relevant current documentation (check when implementing)

- Supabase anonymous sign-in: https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase SSR clients for Next.js: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase auth package selection: https://supabase.com/docs/guides/auth/choosing-a-server-package
- Supabase Realtime authorization: https://supabase.com/docs/guides/realtime/authorization
- Supabase Broadcast database events: https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
- Supabase Postgres functions security: https://supabase.com/docs/guides/database/functions
- Supabase Cron: https://supabase.com/docs/guides/cron

**FINAL AGENT INSTRUCTION:** Start by auditing the **existing** repository. Then implement M0–M5 progressively; preserve all UI, real local gameplay and generated assets. Favor tested atomic state transitions and accurate user-facing statuses. You are not permitted to substitute visual mocks for a functioning backend or claim production readiness without verification.
