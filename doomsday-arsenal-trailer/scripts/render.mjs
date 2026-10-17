// Renders the trailer to MP4: frames come from headless Chromium (render.html),
// the soundtrack from an OfflineAudioContext in the same page, ffmpeg does the rest.
//
//   npm run render                                   → out/doomsday-arsenal-trailer.mp4
//   npm run render -- --gameplay clips/other.mp4     → use a different clip (cuts from src/config.js)
//   npm run render -- --keep-game-audio              → also mix the clip's own audio in
//   npm run render:preview                           → quick 720p render
//   npm run render -- --from 86 --to 130             → just a section (seconds)
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { cpus } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { generateQr } from './gen-qr.mjs';
import { CONFIG } from '../src/config.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };

const preview = flag('preview');
const out = resolve(opt('out', join(ROOT, 'out', preview ? 'doomsday-arsenal-trailer-preview.mp4' : 'doomsday-arsenal-trailer.mp4')));
const gameplay = opt('gameplay', null) || (existsSync(join(ROOT, CONFIG.gameplay.file)) ? join(ROOT, CONFIG.gameplay.file) : null);
const cuts = CONFIG.gameplay.cuts;
const slot = cuts.reduce((s, [a, b]) => s + (b - a), 0);
const between = cuts.map(([a, b]) => `between(t,${a},${b})`).join('+');
const workers = Number(opt('workers', Math.max(1, Math.min(6, cpus().length))));
const crf = opt('crf', preview ? '26' : '19');
const quality = Number(opt('jpeg', preview ? 0.85 : 0.94));
const keepGameAudio = flag('keep-game-audio');
const audioOnly = flag('audio-only');
const CACHE = join(ROOT, 'out', '.cache');
const fps = CONFIG.fps;

const log = (...a) => console.log('›', ...a);
const ffmpegBin = process.env.FFMPEG || 'ffmpeg';

function run(cmd, args) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('exit', (c) => (c === 0 ? ok() : fail(new Error(`${cmd} exited with ${c}`))));
  });
}

async function launch() {
  const opts = { args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] };
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  return chromium.launch(opts);
}

async function openPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 });
  return page;
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(resolve(out, '..'), { recursive: true });
  generateQr(CONFIG.link);

  // 1. gameplay frames
  let query = '';
  const extra = {};
  if (gameplay && !audioOnly) {
    const dir = join(CACHE, 'gameplay');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    log(`extracting gameplay frames from ${gameplay}`);
    await run(ffmpegBin, ['-loglevel', 'error', '-y', '-i', gameplay, '-an',
      '-vf', `select='${between}',setpts=N/FRAME_RATE/TB,fps=${fps},scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080`,
      '-q:v', '3', join(dir, '%06d.jpg')]);
    const count = readdirSync(dir).filter((f) => f.endsWith('.jpg')).length;
    log(`${count} gameplay frames (${(count / fps).toFixed(1)}s, slot is ${slot.toFixed(1)}s)`);
    extra['/__gameplay'] = dir;
    query = `?frames=/__gameplay&count=${count}`;
  } else if (!audioOnly) {
    log('no gameplay clip given — rendering the placeholder slate (use --gameplay your-clip.mp4)');
  }

  const { server, port } = await startServer({ extra });
  const url = `http://127.0.0.1:${port}/render.html${query}`;

  // 2. soundtrack
  const browser0 = await launch();
  const page0 = await openPage(browser0, url);
  const info = await page0.evaluate(() => window.trailerInfo);
  const from = Number(opt('from', 0)), to = Math.min(info.duration, Number(opt('to', info.duration)));
  log(`trailer length ${info.duration.toFixed(1)}s; rendering ${from}s → ${to}s`);
  const wavPath = join(CACHE, 'soundtrack.wav');
  log('rendering soundtrack…');
  const len = await page0.evaluate(() => window.renderSoundtrack());
  const CH = 4 * 262144;
  let b64 = '';
  for (let i = 0; i < len; i += CH) b64 += await page0.evaluate(([i, n]) => window.wavChunk(i, n), [i, CH]);
  writeFileSync(wavPath, Buffer.from(b64, 'base64'));
  await browser0.close();
  log(`soundtrack → ${wavPath}`);
  // keep the live player's copy of the soundtrack in sync with this cut
  await run(ffmpegBin, ['-loglevel', 'error', '-y', '-i', wavPath, '-c:a', 'libmp3lame', '-b:a', '192k', join(ROOT, 'assets', 'soundtrack.mp3')]);
  if (audioOnly) { server.close(); return; }

  // 3. frames, in parallel
  const f0 = Math.round(from * fps), f1 = Math.round(to * fps), total = f1 - f0;
  const per = Math.ceil(total / workers);
  const segFiles = [];
  let done = 0;
  const t0 = Date.now();
  const progress = setInterval(() => {
    const el = (Date.now() - t0) / 1000, rate = done / Math.max(el, 1e-3);
    process.stdout.write(`\r› frames ${done}/${total}  ${(100 * done / total).toFixed(1)}%  ${rate.toFixed(1)} fps  ETA ${Math.round((total - done) / Math.max(rate, 0.01))}s   `);
  }, 1000);
  const vf = preview ? ['-vf', 'scale=1280:720:flags=lanczos'] : [];
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const a = f0 + w * per, b = Math.min(f1, a + per);
    if (a >= b) return;
    const file = join(CACHE, `seg${String(w).padStart(2, '0')}.mp4`);
    segFiles[w] = file;
    const browser = await launch();
    const page = await openPage(browser, url);
    const ff = spawn(ffmpegBin, ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      ...vf, '-c:v', 'libx264', '-preset', preview ? 'veryfast' : 'medium', '-crf', crf, '-pix_fmt', 'yuv420p', '-r', String(fps), file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const closed = new Promise((ok, fail) => ff.on('exit', (c) => (c === 0 ? ok() : fail(new Error('ffmpeg failed')))));
    for (let f = a; f < b; f++) {
      const data = await page.evaluate(async ([t, q]) => { await window.drawAt(t); return window.grab(q); }, [f / fps, quality]);
      const buf = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
      if (!ff.stdin.write(buf)) await new Promise((ok) => ff.stdin.once('drain', ok));
      done++;
    }
    ff.stdin.end();
    await closed;
    await browser.close();
  }));
  clearInterval(progress);
  process.stdout.write('\n');
  server.close();

  // 4. concat + mux
  const list = join(CACHE, 'segments.txt');
  writeFileSync(list, segFiles.filter(Boolean).map((f) => `file '${f}'`).join('\n'));
  const args = ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-ss', String(from), '-t', String(to - from), '-i', wavPath];
  let filter = null;
  if (gameplay && keepGameAudio) {
    const gs = info.gameplay.start;
    args.push('-i', gameplay);
    const delay = Math.max(0, Math.round((gs - from) * 1000));
    filter = `[2:a]aselect='${between}',asetpts=N/SR/TB,afade=t=out:st=${slot - 0.6}:d=0.6,volume=0.55,adelay=${delay}|${delay}[g];[1:a][g]amix=inputs=2:normalize=0:duration=first[a]`;
  }
  if (filter) args.push('-filter_complex', filter, '-map', '0:v', '-map', '[a]');
  else args.push('-map', '0:v', '-map', '1:a');
  args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out);
  await run(ffmpegBin, args);
  const el = ((Date.now() - t0) / 1000).toFixed(0);
  const size = (Number(execFileSync('stat', ['-c', '%s', out]).toString()) / 1e6).toFixed(1);
  log(`done in ${el}s → ${out} (${size} MB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
