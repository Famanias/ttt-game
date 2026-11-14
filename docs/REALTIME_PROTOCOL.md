# Realtime and command protocol

## HTTP routes

| Route | Contract |
|---|---|
| POST /api/rooms | `{clientCommandId, mode}` creates an authenticated private room. |
| GET /api/rooms/[code] | Authorized canonical room/match snapshot; reconciles deadlines under a DB lock. |
| POST /api/rooms/[code] | `{action, clientCommandId, ...}`: join, ready, leave, heartbeat, move, submit, rematch. This compact command route replaces the unsafe demo action endpoint. |
| GET /api/matches/[matchId] | Authorized snapshot containing that match, including finished history when still a member. |
| GET /api/profile | Current authenticated profile. |
| PUT /api/profile | Name/avatar/public ranking preference + command UUID. |
| GET /api/history | Up to 50 finalized non-abandoned matches belonging to the guest; retained after leaving a room. |
| GET /api/leaderboard?mode=clash\|classic | Public, minimized, opted-in casual standings. No client result submission endpoint exists. |

`/room/{CODE}` and legacy `/?room=CODE` recover existing membership after a guest session check; otherwise show the existing lobby, profile controls and explicit invite join. `/match/{UUID}` requires the matching guest identity; it can resume the room's current match. `/leaderboard` exposes the actual ranking UI.

Mutations require a UUID `clientCommandId`. Ready/leave use current match version when present, otherwise room version; moves/submissions use match version; rematch votes use **room** version. Heartbeat/join do not require an expected version. Submission additionally requires current `roundId` and `{version:1, events, finishedAt?}`. Schemas reject unknown HTTP fields and payloads above 16 KiB (actual streamed bytes). Cookie auth is validated using `getUser()`. POST/PUT requires same-origin JSON. Private responses are dynamic and `private, no-store`.

Errors include `INVALID_INPUT`, `INVALID_CODE`, `ROOM_FULL`, `ROOM_EXPIRED`, `PROFILE_REQUIRED`, `NAME_TAKEN`, `NOT_MEMBER`, `NOT_READY`, `WRONG_PHASE`, `NOT_YOUR_TURN`, `CELL_OCCUPIED`, `STALE_VERSION`, `ROUND_CLOSED`, `ALREADY_SUBMITTED`, `RATE_LIMITED`, `RECONNECT_REQUIRED`, `ONLINE_NOT_CONFIGURED`. They never include credentials or database stack traces. Profile names use 2–18 safe characters; avatars use the six existing IDs.

## Delivery and reconciliation

1. Validate or create the guest session, fetch an authorized snapshot, and set the JWT on Realtime.
2. Subscribe with `config.private=true` to **room:<database room UUID>**. Topic authorization is not based on the invite code.
3. Database triggers send `room_updated` with only `{roomId, version}` when room versions commit. Clients cannot broadcast authoritative moves/scores.
4. On SUBSCRIBED, refetch again to close the fetch/subscribe gap. Refetch on events, focus and a 2.5-second fallback poll. Reject older room versions. Derive every rendered board/turn/claim/result from a snapshot.
5. Presence tracks connection hints keyed by member UUID. These are cosmetic, untrusted signals. Database heartbeat leases decide pauses/forfeits.
6. Heartbeat every five seconds with a fresh command UUID. Cookie/session refresh uses Next.js 15 `middleware.ts` and `@supabase/ssr`. Reauthentication and refetch occur when a room view boots after refresh. Guest-session loss requires returning to the lobby; it cannot reclaim an old seat.

Clock offset is estimated from snapshot server time and request midpoint. Local animations use server timestamps plus that offset. Network asymmetry/jitter can affect presentation; the DB receipt clock and transaction ordering remain authoritative. No fabricated ping/online opponent is displayed. Existing authorized channels may retain Realtime's cached authorization until reauthentication, but notifications contain no hidden state and every snapshot/mutation checks live membership.

## Phase transitions

`waiting → both ready → countdown (3 seconds) → classic_turn | round → finished`.

Clash rounds: shared three-second announcement/countdown → playing → both submissions or authoritative deadline → resolved winner/claim or sudden death. Server rotation is Timing → Memory → Target Rush; local single-game preferences do not override online challenges. A tie creates shortened shared Timing with one press; repeat ties never fabricate a winner. Normal Timing has three stops; local Timing stays one stop.

- **Timing:** server derives dial angle from each event's millisecond offset and committed speed/target; original 22-degree scoring rubric, average across presses, total angular error breaks equal rounded scores. Exactly three presses (one in sudden death), at least 120ms apart.
- **Memory:** seeded unique cells flash for 1550ms; selection toggle trace and bounded `finishedAt`. Original accuracy/speed scoring; accuracy dominates, time breaks otherwise equal scores. No opponent selections/traces are returned. Scores remain hidden until resolution.
- **Target Rush:** 5500ms, four scheduled targets per 550ms batch, shared positions, normal 90 / bonus 140 points. Hit IDs, time window, coordinates and uniqueness checked; at most 80 events and at least 40ms apart. Misses score zero and break otherwise equal scores. Local random respawn behavior remains unchanged.

Only a resolved winner gets a claim. A second consecutive win grants two placements then resets the bonus counter. Alternating winners reset the opposing counter; ties preserve it. Claim window is 15 seconds per placement. Timeout deterministically chooses the lowest empty index and writes an `auto` move. Every individual placement checks board win/draw, discarding unused bonus claims on terminal state.

## Liveness and maintenance

After ten seconds without a heartbeat, active play pauses, preserving board/streak/claim state. Reconnect deadline is the stale lease timestamp + forty seconds (ten-second detection plus thirty-second grace). A heartbeat before expiry can resume; one after expiry cannot resurrect the result. Both stale guests abandon; one stale guest forfeits. Countdown disconnect/unready cancels the unplayed start without stats and resets readiness.

Paused minigames restart the **identical stored challenge** with a new round ID and a shared countdown after reconnect. The old attempt is cancelled, so stale/partial traces cannot score. Claim deadlines shift by the pause duration. Explicit leave forfeits an active match immediately; leaving before play awards no win. The remaining player can see the result; departed guests lose private access. Waiting hosts close the room; waiting O can leave a reusable seat.

Rounds accept submissions until end + two seconds. After that, missing submissions have thirty additional seconds before final forfeit/abandonment; no score is fabricated. Heartbeat-based reconnect pause can intervene. Both accepted submissions resolve immediately. Submitted traces/scores are never broadcast. Ranked integrity is explicitly casual because a browser can manufacture plausible inputs.

Snapshot reads, heartbeats and commands call the same locked reconciliation. `private.sweep_deadlines()` also resolves deadlines with no browser online; schedule it every five seconds using `supabase/cron.sql`. Without Cron, abandoned games advance on the next authorized read/command only. This limitation must remain explicit until a real job is configured and observed.

Rankings refresh on opening, focus and every ten seconds while visible. They never interpolate fictional changes; finalized match rows are the source.
