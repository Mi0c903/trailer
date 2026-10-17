# Handoff: Doomsday Arsenal trailer (v1.0.0)

For an agent picking this project up cold. Everything below reflects tag `v1.0.0` of
`Mi0c903/trailer` (`main` @ `dd78c13` plus this file). This file lives at
`doomsday-arsenal-trailer/HANDOFF.md`.

## What this is

A ~3-minute promotional trailer for **Doomsday Arsenal**, a Minecraft mod by the repo owner
(CurseForge: https://www.curseforge.com/minecraft/mc-mods/doomsday-arsenal). It is generated
entirely in code: every frame is drawn on an HTML canvas, the soundtrack is synthesized with the
Web Audio API, and real in-game footage is cut into one slot. The project lives in
`doomsday-arsenal-trailer/` of the repo; the repo root `README.md` belongs to an unrelated
planned boardgame site ("chemistry mahjong"), so leave it alone.

## What the owner asked for (in their words, paraphrased)

- A trailer where **an AI introduces that "we've acquired the power of various celestial bodies,
  and you can now use their power as your own"**.
- A **simulation "like the Portal game", simple vector-map style**, then animations of the stars.
- **No voice-over. Background music only.** The AI "speaks" through on-screen typed text.
- **In-game gameplay video after** the animations.
- **About 3 minutes total**, ending on the CurseForge link.
- Hosted on GitHub. The repo was first named `Chemmah`, then renamed to `trailer`.

## Current cut (196.7 s)

| Start | Segment | File |
|---|---|---|
| 0:00 | Boot: ARSENAL//OS terminal, eye opens | `src/scenes/boot.js` |
| 0:08 | AI intro: "…and saw AMMUNITION." | `src/scenes/intro.js` |
| 0:30 | Star map: log-scaled radar of all 18 weapons by real distance; "THEIR POWER… IS NOW YOURS." | `src/scenes/starmap.js` |
| 0:50 | Vector test chamber: Sunspear sky-pillar, Apophis Hammer slam, uplink arms Sagittarius Maw → black hole eats the chamber | `src/scenes/sim.js` |
| 1:26 | "THE ARSENAL" + 8 hero reveals (6 s each) | `src/scenes/showcase.js`, `src/bodies.js` |
| 2:16 | Roll call: 18 cards in the in-game uplink layout → "EIGHTEEN WAYS TO END A WORLD." | `src/scenes/showcase.js` |
| 2:22 | Deploy to the Overworld (pixelate) | `src/scenes/deploy.js` |
| 2:27 | Field tests (4 screenshots) + uplink screen arming Milkomeda | `src/scenes/field.js` |
| 2:34 | In-game footage: Milkomeda strike, two cuts of the clip | `src/scenes/gameplay.js` |
| 3:03 | Logo, tagline, CurseForge link, QR code | `src/scenes/outro.js` |

## Facts about the mod (from the owner's screenshots — config.js is the source of truth)

- 18 weapons, in uplink order with their keys: Helios Lance (1), Betelgeuse Requiem (2),
  Sagittarius Maw (3), Starquake Resonator (4), Lunar Tide Engine (5), Plutonian Winter (6),
  Tabby's Swarm (7), Apophis Redirect (8), Io Flux Tap (9), Sirius Railgun (0), Seven Sisters (-),
  Jovian Hypercane (=), Ringfall (Shift+1), Halley's Return (Shift+2), Pinwheel Burst (Shift+3),
  Kilonova Forge (Shift+4), Andromeda Collision (Shift+5), Milkomeda (Shift+6).
  Subtitles (e.g. "Dyson Mirror Ring · Sol") are in `CONFIG.arsenal`.
- In-game field manual tagline: "Eighteen ways to end a world, and what each one leaves behind".
- Controls: V opens the arsenal while holding **the uplink**; J skips a weapon's film; H opens the
  manual. Commands: `/doomsday strike|call|film|jobs|reset|scars clear|relics`.
- Weapons play cinematic "films", then reshape terrain and leave "scars" (e.g. Helios Lance leaves
  Glassed Waste → Sunstroke; Andromeda Collision leaves Galactic Scar → Galactic Tide).
- Stats the owner's manual actually shows (only these are used as numbers in the trailer):
  Helios Lance Core 72 · Reach 650 · Recharge 180 s; Io Flux Tap Core 260 · Reach 800 · Recharge
  360 s; Andromeda Collision Core 90 · Reach 900 · Recharge 900 s.
- Handheld items seen in screenshots: Sunspear, Apophis Hammer, Midas Maul, the uplink. There are
  also armour sets and beacon pedestals (not used yet).

## Unverified — check with the owner before polishing

- The one-line descriptions for Lunar Tide Engine, Ringfall, Starquake Resonator, Betelgeuse
  Requiem and Sagittarius Maw were written from the weapon names, not from the mod.
- "Drawn from" distances are real-astronomy approximations (e.g. Betelgeuse ~550 ly).
- Nobody has listened to the soundtrack yet: only its levels (no clipping, ~-13 dB mean) and
  spectrogram were checked.
- The trailer runs 3:17; the owner asked for "around 3 minutes". Easiest trims: `SCENE_LEN.sim`
  (36 s), the outro (13 s), or `gameplay.cuts`.

## Running it

Needs Node 18+ (22 used), ffmpeg, and Playwright's Chromium.

```bash
cd doomsday-arsenal-trailer
npm install
npm run dev                  # live player, http://localhost:8080 (scrub, play, load a clip)
npm run render               # out/doomsday-arsenal-trailer.mp4, 1080p30 (~7 min on 4 cores)
npm run render:preview       # 720p
npm run render -- --from 86 --to 130     # a section only
npm run stills -- out/stills 24 92.5 178 # JPEG stills at given seconds (best way to review)
```

If Playwright can't find a browser: `npx playwright install chromium`, or set `CHROMIUM_PATH`.

## How it works (read before changing anything)

- **Every frame is a pure function of time.** `Trailer.render(t)` in `src/trailer.js` picks the
  scene from `src/timeline.js` and calls its `draw(ctx, S)`; scenes return post-effects
  (`flash`, `glitch`, `pixel`, `vignette`, `black`). No `Math.random` at draw time — use
  `rng`/`hash1`/`noise*` from `src/util.js`. This is what lets the renderer split frames across
  parallel Chromium workers.
- **One timeline drives picture and sound.** `src/music.js` reads the same segments, so hits land
  on frames. If you change scene lengths, the music follows automatically; if you add a scene,
  add its section to `score()`.
- **Audio is rendered in 12 s chunks** (`OfflineAudioContext` per chunk, events owned by the
  chunk their start time falls in, tails spill over, then mixed). One giant graph was far too slow.
  New instrument methods must be added to the `INSTRUMENTS` set (and `SPAN` if they take a
  `t0, t1` range) or chunking will mis-schedule them.
- `npm run render` also rewrites `assets/soundtrack.mp3`, which the live player loads instead of
  synthesizing (it falls back to synthesizing if the duration doesn't match).
- Gameplay: `CONFIG.gameplay.cuts` picks `[start, end]` ranges from `assets/gameplay/gameplay.mp4`;
  the slot length is their sum. The renderer extracts frames with ffmpeg `select`; the live player
  maps time through `clipTime()` in `src/gameplay-source.js`.
- Planets/stars use a software sphere renderer (`src/sphere.js`) with procedural textures.
- Gotchas already fixed — don't reintroduce: per-frame film grain made x264 output ~90 Mbps (removed);
  the old integer hash biased all noise dark (now `Math.imul` based); in `sim.js` `figure()`,
  positive limb angles swing toward the facing direction.

## Repo, CI and releases

- Repo: https://github.com/Mi0c903/trailer (public). Default branch `main`.
- `.github/workflows/render.yml` renders the MP4 on pushes to `main` touching the folder (or by hand)
  and uploads it as a run artifact. **It has never run** — the merge of PR #1 produced 0 workflow runs,
  so check that Actions is enabled for the repo.
- `.github/workflows/pages.yml` publishes the live player to GitHub Pages; manual only, because the
  repo is also meant to host a boardgame site.
- Tag `v1.0.0` marks this snapshot; GitHub serves it as a zip at
  https://github.com/Mi0c903/trailer/archive/refs/tags/v1.0.0.zip. Rendered videos are not in the
  repo (too large): rebuild them with `npm run render` or the Render workflow.

## Open items

1. Owner to review the cut; confirm or correct the unverified one-liners above.
2. Decide whether to trim to ~3:00.
3. Get the render workflow running on GitHub (or upload future renders as release assets).
4. Optional: more hero weapons (renderers available: `sun moon storm ringed pulsar supernova
   blackhole galaxy`), more gameplay clips, or using the armour/pedestal screenshots.
