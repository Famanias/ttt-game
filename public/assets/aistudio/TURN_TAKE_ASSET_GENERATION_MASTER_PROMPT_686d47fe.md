# TURN//TAKE — Asset Generation Master Prompt

**Purpose:** A single source of truth for generating all visual assets for **TURN//TAKE**, a competitive 2D Tic-Tac-Toe game with head-to-head arcade minigames, private invite-code rooms, and leaderboards.

**Generation platform:** Google Flow (or any image model). Google Flow may not produce transparency; for isolated artwork, request a perfectly flat, single-color chroma-key background and remove it in post.

**How to use:** This is one consolidated prompt document, **not** a request to put all assets into one image. Generate **one numbered asset at a time**. Keep this entire document as the reference, then instruct the model: **“Generate Asset [ID] only, using the global style and all rules below.”** For avatar variants, generate each character as a separate image. Never create a collage, contact sheet, composite UI screenshot, or multiple assets in a single frame unless expressly specified.

---

## A. Unchanging creative direction

### Product concept

TURN//TAKE is a modern, playful, skill-based arcade game. Players compete in quick minigames to earn placements on a 3×3 Tic-Tac-Toe board; two consecutive Clash victories may award a bonus placement. There is also a traditional Classic mode. The interface should feel like a premium, original indie arcade title—not a generic mobile casino, esports shooter, or retro pixel-art clone.

### Visual identity

- **Art direction:** Contemporary 2D neo-arcade; flat/vector-like geometry with restrained layered depth, clean cut silhouettes, sophisticated composition, and subtle controlled glows **only when integrated into normal backgrounds**.
- **Shape language:** Circular timing rings, modular grids, target reticles, geometric stars, rounded rectangles, concentric paths, angular momentum marks, balanced symmetry versus dynamic offsets.
- **Mood:** Competitive and satisfying, expressive without being juvenile, lively without being visually noisy.
- **Rendering:** Crisp 2D illustration, high-quality game-key-art polish; subtle color gradients *inside the artwork* are allowed. No photorealism, rendered 3D scenes, fake device mockups, heavy bevels, glassmorphism, excessive bloom, grain, or messy textures.
- **Consistency:** All assets should look like they came from the **same design system**, with shared stroke weight, geometric vocabulary, corner rounding, scale, highlights, and color treatment.

### Locked palette

| Role | Hex | Usage |
| --- | --- | --- |
| Base background | `#10141D` | Full-screen and card background images |
| Player X | `#43DDE6` | Cyan player cues, accuracy, timing |
| Player O | `#FF795E` | Coral player cues, competition |
| Reward | `#FFDA79` | Wins, streaks, celebratory emphasis |
| Support | `#8B7CFF` | Memory, secondary accents |
| Light neutral | `#F4F4F0` | Sparse line highlights, UI contrast |
| Muted structural | `#65737C` | Subtle geometry, rails, background motifs |

Avoid introducing additional saturated colors. The chroma-key background color is a **production mask**, not part of the brand palette.

### Rules for every asset

1. **Do not generate any readable text**: no logos, letters, numerals, labels, HUD counters, or watermarks. The TURN//TAKE wordmark, buttons, scores, and timers are added in React.
2. Never bake a complete functional interface, gameplay board, cursor, or HTML-like controls into an asset. Backgrounds and illustrations sit **behind or beside** real interactive elements.
3. Keep objects entirely inside frame; no clipped edges unless the asset explicitly calls for an edge-to-edge background.
4. Maintain readable silhouettes at small UI sizes; limit tiny details and competing focal points.
5. Do not produce duplicate variants of the same asset unless requested. No generated image should be mistaken for a screenshot of the final application.
6. Prefer 16:9 for wide scene art, 1:1 for cards and emblems, and 4:3 for small scene illustrations; **do not fake resolution** by placing a smaller canvas inside a larger border.
7. If the generator cannot output the requested pixel resolution exactly, preserve the aspect ratio and upscale/export later.

---

## B. Background and chroma-key protocol — critical

There are **two output types**:

**TYPE 1: Full-background images** (Assets 01, 02, 10; optionally 03–05 card artwork) should be finished illustrations with their intended `#10141D` dark backdrop. **Do not** use a green screen here.

**TYPE 2: Isolated cutout artwork** (Assets 06–09, avatars, optional emblems; optionally 03–05) must use a **perfectly flat opaque solid chroma color** so the background can be removed afterwards:

- **Default key:** pure chroma green `#00FF00` for artwork dominated by cyan, coral, yellow, violet, white, and navy.
- **Alternative:** pure chroma magenta `#FF00FF` if the subject contains green or yellow-green details that would disappear with green keying. Avoid magenta when the art includes strong magenta/violet edge hues.
- **Alternative:** pure chroma blue `#0000FF` only when the subject contains neither strong blue/cyan edges nor blue glow; otherwise choose another high-contrast solid key.
- Select a key that **does not appear anywhere on the subject**. Choose per asset, rather than applying one key indiscriminately.
- Background color must be **100% uniform edge-to-edge**: no gradient, texture, noise, vignette, horizon, floor, backdrop seam, bloom, reflections, shadows, ambient tint, or color variations.
- No soft rim glow, semi-transparent fringes, cast shadows, blur, feathering, motion smears, or key-color spill touching the silhouette. Contours must be crisp and clean enough for a one-click color-key removal.
- Center the isolated subject; leave **12–15% clean margin on all sides**. No cropping. Avoid tiny detached pieces that could be accidentally removed.
- **Never place a green-screen colored outline or fill inside the subject.**
- Light/particle effects that require transparency should be recreated with SVG, Canvas, or CSS rather than rasterized with a glow on chroma.

**Cutout prompt suffix (attach to every isolated asset):**

> Production cutout asset. One single centered subject, completely in frame, 12–15% clear margin. Perfectly flat opaque pure chroma green `#00FF00` background, identical RGB color in every background pixel; zero texture, gradient, vignette, backdrop lighting, cast shadow, halo, green spill, bloom, blur, or background objects. Hard crisp antialiasable silhouette; no text or watermark. The green is only a removable mask and must not occur inside the object.

For a subject containing green, replace every instance of `#00FF00` in that suffix with `#FF00FF` and replace “green” with “magenta.”

---

## C. Asset manifest (recommended deliverables)

| ID | Export filename | Ratio / target | Type | Priority |
| --- | --- | --- | --- | --- |
| 01 | `01-lobby-background.webp` | 16:9 / 1920×1080 | Full dark scene | Essential |
| 02 | `02-board-background.webp` | 16:9 / 1920×1080 | Full dark scene | Essential |
| 03 | `03-perfect-timing-card.webp` | 1:1 / 1024×1024 | Illustrated card | Essential |
| 04 | `04-flash-memory-card.webp` | 1:1 / 1024×1024 | Illustrated card | Essential |
| 05 | `05-target-rush-card.webp` | 1:1 / 1024×1024 | Illustrated card | Essential |
| 06 | `06-victory-burst.png` | 1:1 / 1024×1024 | Chroma cutout → PNG alpha | Essential |
| 07 | `07-streak-bonus.png` | 1:1 / 1024×1024 | Chroma cutout → PNG alpha | Essential |
| 08a | `08a-avatar-orb-bot.png` | 1:1 / 512×512 | Chroma cutout → PNG alpha | Optional |
| 08b | `08b-avatar-pixel-blob.png` | 1:1 / 512×512 | Chroma cutout → PNG alpha | Optional |
| 08c | `08c-avatar-shield-face.png` | 1:1 / 512×512 | Chroma cutout → PNG alpha | Optional |
| 08d | `08d-avatar-cube-runner.png` | 1:1 / 512×512 | Chroma cutout → PNG alpha | Optional |
| 08e | `08e-avatar-spark-eye.png` | 1:1 / 512×512 | Chroma cutout → PNG alpha | Optional |
| 08f | `08f-avatar-comet-mask.png` | 1:1 / 512×512 | Chroma cutout → PNG alpha | Optional |
| 09 | `09-ui-ornaments.png` | 1:1 / 1024×1024 | Chroma sprite sheet → cut apart | Optional |
| 10 | `10-waiting-room.webp` | 4:3 / 1200×900 | Full dark scene | Optional |
| 11 | `11-draw-emblem.png` | 1:1 / 1024×1024 | Chroma cutout → PNG alpha | Optional |
| 12 | `12-invite-connection.png` | 1:1 / 1024×1024 | Chroma cutout → PNG alpha | Optional |

**Note on files:** The names are desired **post-processing/export filenames**, not text to place in an illustration. Convert keyed source files into real alpha-transparent PNGs only after color removal. Use WEBP for full backgrounds and card artwork. Keep editable raw source images in a separate source folder.

---

## D. Asset-by-asset generation prompts

### Asset 01 — Main lobby background

**Generate as:** Full background, not chroma. 16:9, landscape. Final: `01-lobby-background.webp`.

> Create the main lobby hero background for TURN//TAKE, an original competitive 2D arcade Tic-Tac-Toe game. A sophisticated dark navy `#10141D` environment built from expansive geometric rings, broken circular timing arcs, lightly layered target shapes, precise grid fragments, and cyan/coral forms that imply two players approaching a clash. Art direction: premium minimal neo-arcade 2D, exceptionally crisp graphic shapes, delicate restrained internal highlights, no photorealism or 3D. Keep the **central 55% of the canvas quiet and mostly dark**, with the strongest visual gestures framing the left and right thirds and subtle detail in the corners. Design the entire composition as a seamless, balanced full-bleed background suitable for a live React hero with large headline, Play Classic, Play Clash, and Join Room buttons laid on top. Palette: `#10141D`, `#43DDE6`, `#FF795E`, sparse `#FFDA79` and `#8B7CFF`. No actual buttons, text, Tic-Tac-Toe marks, UI screenshots, people, or devices. No visual seams or panels.

### Asset 02 — Board gameplay ambient background

**Generate as:** Full background, not chroma. 16:9. Final: `02-board-background.webp`.

> Design a quiet competitive arena backdrop for the live Tic-Tac-Toe board in TURN//TAKE. Dark navy `#10141D` across the entire image. Faint concentric circle segments and understated geometric architecture occupy the far edges; restrained cyan energy cues on the left and coral energy cues on the right suggest two opposing players. Leave a **large completely legible low-contrast center zone** for a code-rendered 3×3 board. Sparse fine grid lines, balanced symmetry, and modern 2D vector-like indie arcade styling. Compared with the lobby, this background must be **noticeably calmer**, less saturated, and less visually dense. No embedded gameplay board, X/O marks, scores, text, buttons, characters, lighting streaks over the center, or distracting icons.

### Asset 03 — Perfect Timing card illustration

**Generate as:** Finished 1:1 thumbnail with dark integrated background. Final: `03-perfect-timing-card.webp`.

> Create a polished square illustrated selection-card artwork for the TURN//TAKE minigame Perfect Timing. The primary focal point is a **single circular precision dial** with multiple neatly spaced concentric rings, one crisp pointer, and one clearly defined golden target segment. Cyan describes the active ring, coral provides an opponent accent, yellow identifies the narrow accuracy zone. Pose the indicator just short of the sweet spot to imply anticipation. Sophisticated 2D game graphic, strong icon silhouette, clean geometry, layered depth without 3D modeling, muted dark navy `#10141D` background built into the thumbnail. Keep edges and important shapes readable at a compact card size. No scores, text, numerals, real hands, or UI controls.

### Asset 04 — Flash Memory card illustration

**Generate as:** Finished 1:1 thumbnail with dark integrated background. Final: `04-flash-memory-card.webp`.

> Create a polished square illustrated selection-card artwork for the TURN//TAKE minigame Flash Memory. Center a tidy 3×3 arrangement of softly rounded square tiles, viewed **straight-on, flat 2D**, with a small deliberate subset lit in cyan and violet while the other tiles remain subdued. Use tiny crisp geometric accent marks to imply a memorized sequence, but show no text or numbers. Maintain the same visual density, framing, line weights, and dark navy card background as the Perfect Timing artwork. The puzzle silhouette should be legible instantly at small scale. Keep the composition restrained, balanced and premium, not photorealistic, not holographic 3D.

### Asset 05 — Target Rush card illustration

**Generate as:** Finished 1:1 thumbnail with dark integrated background. Final: `05-target-rush-card.webp`.

> Create a polished square illustrated selection-card artwork for the TURN//TAKE minigame Target Rush. Present three or four geometric bullseye targets arranged in a fast yet clean composition with simple motion chevrons, a restrained reticle, and a few small impact fragments. Vary target sizes to suggest scoring, but keep the focal point immediately obvious and avoid a cluttered shooter-game style. Use coral and cyan for targets, yellow for one successful hit, with subtle violet details on a dark navy `#10141D` background. Premium 2D graphic illustration; match the exact artistic family, contrast, edge crispness and framing used for Assets 03 and 04. No guns, weapons, text, floating numbers, or UI buttons.

### Asset 06 — Victory celebration burst

**Generate as:** Isolated cutout, pure chroma green `#00FF00`; post-process to true alpha PNG. Final: `06-victory-burst.png`.

> A singular premium 2D victory celebration emblem for TURN//TAKE, structured around an open radiant geometric starburst with bold layered angular stars, clean concentric arcs and a few solid confetti shards. Joyful but precise; immediately readable as a win from across the screen. Balanced cyan `#43DDE6`, coral `#FF795E`, and warm reward yellow `#FFDA79`. Keep all shards relatively large and grouped to preserve clean chroma separation. Avoid soft particle glows; code will animate the burst and confetti later. Flat arcade illustration, crisp contours, exactly one centered emblem, no words, badges with lettering, score numbers, or background scene. **Apply the cutout prompt suffix in Section B.**

### Asset 07 — Two-win streak / bonus turn emblem

**Generate as:** Isolated cutout, pure chroma green `#00FF00`; post-process to true alpha PNG. Final: `07-streak-bonus.png`.

> A singular emblem for TURN//TAKE that conveys **two consecutive Clash wins and an extra placement** without using any numerals or writing. Combine two interlocking forward chevrons, a stylized lightning bolt and a controlled circular badge construction. Make reward yellow `#FFDA79` dominant, with small cyan and coral inflections. The shape should look more focused and powerful than the victory burst—competitive momentum rather than generic celebration. Premium clean flat 2D vector-like game illustration, clear silhouette at 80 pixels wide, no fuzzy glows, crisp separated edges, no scene and no embedded text. **Apply the cutout prompt suffix in Section B.**

### Asset 08 — Six collectible player avatars

**Generate as:** Six separate isolated cutout images, **not one sheet**. 1:1. Prefer chroma `#00FF00`, but verify it is absent from each character. Match height, framing, outline/stroke style, scale and face placement across all six. Final names in the manifest.

**Shared avatar direction:**

> Create exactly one original collectible player avatar for TURN//TAKE, a premium modern 2D arcade game. The character is a friendly geometric mascot with an expressive face made from only a few deliberate features, strong silhouette, clean flat color blocks and very restrained inner highlights. Show a front-facing or slight three-quarter bust, centered with generous margin. Use the locked brand palette, the same consistent character scale and artistic treatment across the collection. Avoid human skin realism, cluttered accessories, tiny details, thick soft shadows, photographic rendering, letters, and numbers. **Apply the cutout prompt suffix in Section B.**

Then append **one** variant:

- **08a Orb Bot:** Round cyan robot mascot; two compact expressive eyes, coral cheek/panel accents, little floating side antennae; optimistic and confident.
- **08b Pixel Blob:** Violet rounded amorphous geometric mascot with clean stepped contour details and a mischievous expression; a hint of cyan contrast; not literal pixel-art rendering.
- **08c Shield Face:** Coral shield-shaped mascot, sharp but friendly facial design, golden edge accents, determined expression.
- **08d Cube Runner:** Off-white and cyan cube-headed mascot with slightly skewed geometric facial panels and an energetic grin; angular silhouette without full rendered 3D.
- **08e Spark Eye:** Yellow diamond/spark mascot with a bold single circular eye, simple expressive brow, minimal coral trim.
- **08f Comet Mask:** Sleek rounded triangular masked mascot, primarily coral and violet, with two crisp side streaks that suggest speed while remaining inside its silhouette.

### Asset 09 — Modular UI ornaments sprite sheet

**Generate as:** Exception: a deliberately organized single sheet of **independent decorative pieces** intended to be manually cut apart. 1:1, solid chroma green. Final: `09-ui-ornaments.png` or individual cropped PNGs.

> Design a neatly arranged library of 8–12 separate 2D arcade UI ornament motifs for TURN//TAKE. Examples: corner brackets, thin target arcs, double chevrons, dotted orbit rings, small geometric spark clusters, angular motion streaks, clean precision crosshair, segmented circular rim. Consistent fine stroke weight and locked color palette. Each motif isolated in its **own clear empty cell with generous separation** so a developer can manually cut them apart. No visible table grid, labels, or typography. Crisp, flat artwork; no shadows, glows, or partially transparent elements. **Apply Section B's flat chroma-key rules to the entire sheet.**

### Asset 10 — Waiting room scene

**Generate as:** Full dark background, not chroma. 4:3. Final: `10-waiting-room.webp`.

> Create a polished 2D artwork for the Waiting for Opponent state of TURN//TAKE. A compact abstract arena with two opposing geometric stations or podium shapes, cyan on the left and coral on the right, facing a calm unoccupied center. Use circular signal arcs and symmetrical framing to communicate that a multiplayer connection is being established. Clean, game-ready illustration on a dark navy `#10141D` background, with subtle yellow highlights. Leave ample room around the focal scene so a real invite code, Copy Link button, and connection indicator can sit nearby in React. No human characters, no readable labels, no actual code strings, no UI panels/buttons, no text.

### Asset 11 — Draw emblem (optional)

**Generate as:** Isolated cutout, pure chroma green `#00FF00`; alpha PNG after cleanup. Final: `11-draw-emblem.png`.

> Single balanced geometric emblem representing a tied match in TURN//TAKE. Two equal symmetrical arcs or opposing mirrored tokens, one cyan and one coral, meet in a harmonious circular composition. Small off-white neutral center, yellow only if extremely subtle. It should read as balance and mutual respect rather than victory. Crisp flat 2D arcade silhouette, centered, no text or numerals. **Apply the cutout prompt suffix in Section B.**

### Asset 12 — Invite connection illustration (optional)

**Generate as:** Isolated cutout, pure chroma green `#00FF00`; alpha PNG after cleanup. Final: `12-invite-connection.png`.

> A single clean icon-scale illustration for TURN//TAKE's Invite a Friend action: two distinct geometric player nodes—one cyan and one coral—connected by a precise energetic signal arc or paired docking shape. Strong centered silhouette, minimal 2D neo-arcade geometry, legible at card scale, no QR code, no letters, no numeric room codes, no people and no text. **Apply the cutout prompt suffix in Section B.**

---

## E. Consistency and quality-control checklist

Before accepting any output, verify:

- [ ] Matches the TURN//TAKE palette and geometric 2D style.
- [ ] Has no stray words, numbers, logo inventions, watermarks or fake buttons.
- [ ] Correct ratio, intended negative space and no accidentally cropped elements.
- [ ] Card arts 03–05 clearly belong to the same visual family.
- [ ] Background 02 is significantly less distracting than Background 01.
- [ ] Chroma cutouts have a uniformly keyed single-color background and crisp edges with no spill/halos.
- [ ] No subject uses the same exact hue as its chroma background.
- [ ] No essential information appears only inside an image; all gameplay and live UI will be implemented with code.
- [ ] Assets remain distinct and useful, avoiding redundant decoration.

### Post-production / integration notes

- Remove chroma key **before** using isolated imagery in the app; save true alpha PNG or WebP with alpha if your tool supports it. Inspect contours against both light and dark backgrounds.
- Optimize images for web delivery and include meaningful alt text for decorative/nondecorative roles as appropriate.
- Suggested integration destination: `public/assets/turn-take/`; reference as `/assets/turn-take/<filename>` in Next.js.
- The actual 3×3 grid, marks, timers, scoreboard, action buttons, minigames, active targets, score logic, and effects that need to respond to game state should be implemented with **React + SVG/Canvas/CSS**—not generated as static images.
- Do not force animated background effects into raster imagery. Any animation of rings, masks, movement, confetti, or victory bursts should be authored in code and respect reduced-motion preferences.

---

## F. Suggested production order

**Essential seven:** 01 → 02 → 03 → 04 → 05 → 06 → 07.

**Then, if time permits:** 08a–08f → 10 → 11 → 12 → 09.

**Short invocation you can reuse in Google Flow:**

> Use the attached TURN//TAKE Asset Generation Master Prompt as the mandatory art-direction and production specification. Generate **Asset [ID] only** at its specified aspect ratio. Follow its exact subject and composition, locked palette, global restrictions, and background/chroma requirements. Do not produce a collage, asset sheet, extra variants, text, or UI mockup unless the selected asset explicitly requests one.
