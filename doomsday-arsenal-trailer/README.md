# DOOMSDAY ARSENAL — Trailer

A ~3-minute animated trailer for the **Doomsday Arsenal** Minecraft mod, built entirely in code:
every frame is drawn on an HTML canvas and the soundtrack is synthesized with the Web Audio API.
No stock footage, no voice-over. An AI (ARSENAL//OS) speaks in on-screen text.

▶ **Mod page:** https://www.curseforge.com/minecraft/mc-mods/doomsday-arsenal

## The cut

| Time | Scene |
|---|---|
| 0:00 | **Boot.** ARSENAL//OS wakes up in a terminal ("SINGULARITY SAFETY LOCKS … FAIL"). |
| 0:08 | **The AI speaks.** *"For ten thousand years, your kind has looked up at the sky… and seen only light. I looked up… and saw AMMUNITION."* |
| 0:30 | **Star map.** A vector radar, log-scaled by real distance from Earth (Moon → GW170817). The AI locks onto all 18 power sources. *"Their power… IS NOW YOURS."* |
| 0:50 | **Combat simulation.** A Portal-style vector test chamber: the Sunspear calls a pillar of sunlight onto the hostiles, the Apophis Hammer's slam launches them into the ceiling, and the uplink arms Sagittarius Maw, which eats the chamber. |
| 1:26 | **The Arsenal.** Cinematic reveals for Helios Lance, Lunar Tide Engine, Io Flux Tap, Ringfall, Starquake Resonator, Betelgeuse Requiem, Sagittarius Maw and Andromeda Collision. |
| 2:16 | **Roll call.** All 18 weapons, in the in-game uplink layout. *"Eighteen ways to end a world."* |
| 2:22 | **Deploy → field tests.** In-game shots (Sunspear, Apophis Hammer, Midas Maul, the uplink), then the real arsenal screen arming Milkomeda. |
| 2:34 | **In-game footage.** The Milkomeda strike, from the clip in `assets/gameplay/`. |
| 3:03 | **Logo + link.** DOOMSDAY ARSENAL, the tagline, the CurseForge link and a QR code. |

## Quick start

Requires Node 18+ and ffmpeg.

```bash
cd doomsday-arsenal-trailer
npm install
npm run dev            # live player → http://localhost:8080
npm run render         # full 1080p30 MP4 → out/doomsday-arsenal-trailer.mp4
```

Other render options:

```bash
npm run render -- --gameplay clips/other.mp4          # use a different clip
npm run render -- --keep-game-audio                    # mix the clip's own sound in
npm run render:preview                                 # fast 720p check
npm run render -- --from 86 --to 130                   # render just a section (seconds)
npm run stills -- out/stills 24 92.5 178               # save individual frames as JPEGs
```

A full render takes about 10–15 minutes on a 4-core machine. If Playwright can't find a browser, run
`npx playwright install chromium`, or set `CHROMIUM_PATH` to a Chromium binary.

## Gameplay footage and screenshots

The footage slot plays `assets/gameplay/gameplay.mp4`, cut down by `gameplay.cuts` in
`src/config.js` (pairs of `[start, end]` seconds in the clip). The slot is exactly as long as the
cuts added together, and the music follows. To use another clip, replace the file (or pass
`--gameplay path/to/clip.mp4`) and update the cuts. In the live player you can also click
**LOAD GAMEPLAY** to preview any local file.

The field-test shots are the images listed under `field` in `src/config.js` (with a crop rectangle
each, used to keep chat messages out of frame), and `uplinkScreen` is the in-game arsenal screen
shown arming the weapon in the footage.

## Customising

Almost everything lives in **`src/config.js`**:

- `arsenal`: all 18 weapons in uplink order: key, name, subtitle, colour, icon and distance from
  Earth in light-years (which places them on the star map).
- `bodies`: the weapons that get a 6-second cinematic reveal, which animation each uses
  (`sun`, `moon`, `storm`, `ringed`, `pulsar`, `supernova`, `blackhole`, `galaxy`), and the
  "drawn from" text, one-line description and stats shown beside it.
- `sim`: the three items used in the test chamber.
- `aiScript()`: everything the AI says, with timings. Wrap a word in `[brackets]` to make it red.
- `title`, `tagline`, `subtagline`, `link`, `platform`.

Changing the link regenerates the QR code automatically on the next render (or run `npm run qr`).

## How it works

```
index.html            live player (canvas + Web Audio, scrubbable)
render.html           headless render target used by the renderer
src/config.js         ← edit me
src/timeline.js       scene schedule shared by the visuals and the music
src/trailer.js        frame compositor + post effects (glitch, pixelate, flashes, vignette)
src/scenes/*.js       boot, intro, starmap, sim (test chamber), showcase + roll call, deploy, field, gameplay, outro
src/bodies.js         the celestial bodies and their power moments
src/sphere.js         software sphere renderer + procedural planet/star textures
src/music.js          procedural soundtrack (synths, drums, braams, risers), rendered offline
scripts/render.mjs    Playwright → JPEG frames → ffmpeg (parallel workers) + soundtrack mux
```

Every frame is a pure function of time, so the live player and the offline renderer produce the same
pictures, and the renderer can split the work across several browser processes. Each music hit is
scheduled from the same timeline, so it lands on the frame it belongs to.

## On GitHub

The workflows live at the repository root in `.github/workflows/`:

- **Actions → Render Doomsday Arsenal trailer** renders the full 1080p MP4 on every push to `main`
  that touches this folder (or by hand from the Actions tab, with an optional 720p preview) and
  attaches it to the run as a downloadable artifact.
- **Actions → Publish trailer player** puts the live player on GitHub Pages. It only runs when you
  start it by hand, because it would replace anything else this repo publishes to Pages.
  One-time setup: *Settings → Pages → Source: GitHub Actions*.

## Credits

Fonts: [Orbitron](https://github.com/theleagueof/orbitron), [Chakra Petch](https://github.com/cadsondemak/Chakra-Petch)
and [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono), all under the SIL Open Font
License (copies in `fonts/`). Minecraft is a trademark of Mojang Studios; this trailer is fan-made
promotional material for a community mod and is not affiliated with Mojang or Microsoft.
