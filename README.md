# TURN//TAKE

Classic tic-tac-toe and three Clash minigames, with independent local play and a Supabase-backed private-room implementation. The existing Next.js 15 / React 19 interface and generated assets are retained.

## Run locally

Use Bun 1.4.4+ and Node.js 26.x. Keep `bun.lock`; do not introduce an npm lockfile.

```powershell
bun install --frozen-lockfile
bun run dev
```

Open `http://localhost:3000`. Local Classic, Casual/Tactical/Master bots and local Clash work without Supabase. Once the page/assets are loaded, local gameplay makes no backend requests. This is not an installable offline PWA.

For online play, copy `.env.example` to `.env.local`, configure a Supabase project, enable anonymous sign-ins, apply the checked-in migrations, and configure private Realtime and Cron. Follow [deployment and setup](docs/DEPLOYMENT.md). Missing configuration produces an explicit unavailable message; it never creates demo rooms or pretend rankings.

## Online behavior

- Two authenticated guests create/join a six-character private room, ready up and start from one committed clock/state.
- Classic uses transactional turns, eight winning lines, draws, immutable results and two-vote rematches with a new match ID.
- Clash rotates Perfect Timing → Flash Memory → Target Rush, sharing stored challenge configurations and server-derived scores. Ties start shortened sudden death. Two consecutive wins grant a normal and bonus placement, resetting the placement streak. Every placement checks terminal state immediately.
- Database deadlines control auto-placement, reconnect pause/grace and forfeits. Realtime only prompts snapshot reads. Browser refresh and duplicate tabs retain the same authenticated seat. Reloading an unfinished Clash attempt requests a shared challenge restart (up to three per guest per match); committed submissions survive refresh.
- Public **casual** rankings are optional per profile, split by Classic/Clash, and based only on finalized online matches. Local/bot play never contributes. `/api/history` returns the guest's finalized match history.
- Browser input is untrusted. Bounded, timestamped traces catch obvious invalid attempts; they do not provide competitive anti-cheat guarantees. Touch/mouse devices may differ.

Guests are real Supabase anonymous users. Their identity persists in SDK-managed cookies in that browser. Clearing site data/signing out loses the identity and access to old seats; a new guest cannot impersonate it.

## Verification

```powershell
bun test
bun run typecheck
bun run lint
bun run build
bun x playwright install chromium
bun run test:e2e
bun audit --production
```

The unit/integration suite executes the actual SQL migrations, RLS and RPC in embedded PostgreSQL/PGlite. Hosted Auth, the Realtime transport, Cron scheduling and real multi-connection races are **not** simulated as successful external integrations. Playwright covers local behavior on desktop and mobile; hosted browser cases are explicitly skipped until enabled.

For a configured **test project**, `bun run test:hosted` creates three real test guests and plays Classic/Clash through user JWTs, including private-channel denial and a concurrent move race. It writes real test match results; remove Smoke-prefixed profiles using your project's admin tooling afterward. To additionally run two independent browser contexts:

```powershell
$env:RUN_HOSTED_E2E = '1'
bun run test:e2e
```

See [implementation status](docs/IMPLEMENTATION_STATUS.md), [database ownership/security](docs/DATABASE_SCHEMA.md), [realtime protocol](docs/REALTIME_PROTOCOL.md), and [original audit](docs/BACKEND_AUDIT.md). No hosted deployment or public URL is claimed.

## Fonts and dependencies

Outfit, DM Sans and JetBrains Mono are self-hosted under `public/fonts/`, with their SIL OFL licenses. This keeps the existing font families and removes build-time Google Fonts requests. The PostCSS override patches Next's transitive copy without a Next.js major upgrade. The deferred longest-streak statistic currently measures bonus-counter progress (maximum two), rather than an uninterrupted run. Remaining development-only audit findings and deployment limitations are recorded in the status document.

## AI Disclosure

This repository has been developed with the assistance of the following LLMs:
- GPT-6 via ChatGPT.com for planning and research
- Nano Banana 2.1 via Google Flow for image and asset generation
- Gemini 4 Hydrogen Max via Google AI Studio for frontend implementation
- Gemini 4 Hydrogen xHigh via Antigravity CLI for full backend and deployment implementation
