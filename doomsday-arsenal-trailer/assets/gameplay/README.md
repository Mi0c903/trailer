# Gameplay footage

`gameplay.mp4` is the in-game clip shown in the footage slot (currently the Milkomeda strike).
Only the parts listed in `gameplay.cuts` in `src/config.js` are used: pairs of `[start, end]`
seconds in the clip. The slot is exactly as long as the cuts added together.

To use a different clip, replace this file (or run `npm run render -- --gameplay path/to/clip.mp4`)
and update the cuts. Add `--keep-game-audio` to mix the clip's own sound under the music.

GitHub rejects files over 100 MB, so keep clips reasonably short.
