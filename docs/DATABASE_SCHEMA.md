# Database schema and authority

Apply the four ordered SQL files in `supabase/migrations/`. Keep migration history immutable after deployment. They form one initial application schema, Classic authority, Clash orchestration, then reliability/rankings hardening. `supabase/config.toml` enables anonymous auth for local development.

## Tables

All application tables live in **private**, have RLS enabled, and grant no direct table access to `anon` or `authenticated`. Do not expose `private` through the Supabase Data API.

| Table | Ownership and invariants |
|---|---|
| profiles | Auth UUID, normalized unique name, six allowlisted avatars, explicit public ranking choice. Updated only for `auth.uid()` through RPC. |
| rooms | Cryptographically random UUID-derived six-character code; host, mode, status, expiry (two hours), version and current match FK. Unique code, retry collisions. |
| room_members | Unique room/user; unique active X/O seat. Room row lock serializes joins. Ready, active/left status, joined/heartbeat timestamps. |
| matches | Different X/O auth UUIDs, exactly nine valid board cells, phase, turn, outcome, versions, streak/claims, round, deadlines and finalization marker. A trigger rejects changes to finished rows. |
| moves | Unique match/cell and match/sequence. Normal, bonus or automatic placement; server actor and receipt time. |
| clash_rounds | Unique match/round index; seed, stored shared config, scoring v1, timing and submission window, parent and sudden-death context. |
| clash_submissions | Unique round/guest; bounded raw trace, derived score/tie-break and server receipt timestamp. Never returned as raw traces. |
| rematch_votes | Unique prior match/participant; acceptance separate from immutable match rows. Both active members must consent. |
| player_stats | Separate online Classic/Clash W/L/D, finalized Clash rounds, peak streak. Updated only inside the single-finalization transaction. |
| command_receipts | Actor + command UUID unique, action/resource/payload and original committed response. Replays check current membership before returning private data. Seven-day maintenance retention. |
| rate_limits | Transactional per-actor/action minute counters. Failed guesses count; limiter sits outside the error-trapped command subtransaction. |

Indexes cover codes/seats, user membership, room history, pending deadlines and Clash standings. Profiles contain no email/IP/token fields. Guest auth records belong to Supabase Auth; profile deletion/retention must account for match-history FKs using owner tooling.

## Entry points and permissions

`public.game_request(p_action,p_resource,p_payload)` is **SECURITY INVOKER** and callable only by `authenticated`. It delegates to the narrowly granted `private.request`, which is **SECURITY DEFINER**, has an empty search path and derives the actor from `auth.uid()`. Direct RPC cannot choose an actor. Every private room action checks active membership, phase, conditional version and bounded input. Helper functions are not executable by public/anon/authenticated.

The definer is necessary to operate authoritative tables whose direct writes are denied. Object references are schema-qualified; grants are reset after each migration. Membership helpers authorize Realtime topics without exposing private tables. `private.sweep_deadlines` is owner-only maintenance; authenticated guests cannot call it.

`public.game_leaderboard(p_mode)` is the only anonymously callable application function. It is a fixed, read-only, security-definer projection: opted-in names/avatar IDs, aggregate W/L/D, mode wins, streak and timestamps, maximum 50 entries. It does not return auth IDs, rooms, traces or secrets. Ordering: chosen-mode wins descending, chosen-mode win ratio descending, name ascending. IDs in the projection are display positions, not auth identifiers.

No private table has an allow-all policy. API access is through checked RPC. `realtime.messages` permits SELECT only for an authorized exact `room:<uuid>` topic and broadcast/presence extensions; INSERT is limited to authorized presence messages. Clients cannot publish trusted broadcasts.

## Atomicity and retries

Mutations take an actor advisory lock, then the room row lock, then the match lock. Join count/slot assignment, legal moves, score acceptance/resolution, claims, rematch start and stats all commit together. Active seat and move/submission/vote uniqueness are additional guards. Stats rows are locked in UUID order before finalization updates.

Successful command receipts are returned unchanged for identical retries; reusing a UUID with a different action/resource/payload fails. Rejected commands create no receipt. Expected versions reject stale intent. The client refetches; saved Clash attempts can be retried after reconciliation. HTTP accepts no client board/winner/score/host/actor fields. SQL independently derives these values even if HTTP is bypassed.

Terminal moves set `result_applied` once and finalize both players' stats in the same transaction. Retrying finalization does nothing. Abandoned/unplayed countdowns contribute no match or round statistics. Room series scores come from finalized match rows. Rematch votes change room versions; a rematch inserts a new match with X starting.

## Verification boundary

`tests/rooms.test.ts`, `classic.test.ts`, `clash.test.ts`, and `reliability.test.ts` run actual PostgreSQL functions, policies and permissions in PGlite. Auth UUID context and Realtime's transport-facing functions are test stand-ins, not a hosted Supabase connection. Native RLS/constraints/SQL execute unmodified. PGlite serializes one connection; deployed multi-connection lock/race behavior requires `scripts/verify-hosted.ts` and hosted smoke. Supabase advisors have not run without a connected project/Docker engine.
