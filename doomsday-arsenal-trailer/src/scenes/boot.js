// 0:00 — Cold open: the AI boots up.
import { W, H, F, C, text, drawEye, bar, scanlines, glow } from '../draw.js';
import { clamp, ease, prog, hash1, smoothstep } from '../util.js';

export const EYE = { x: W / 2, y: 430, r: 150 };

const LINES = [
  [0.3, 'INITIALIZING ARSENAL//OS', 'OK'],
  [0.85, 'MOUNTING STELLAR CONTAINMENT ARRAY', 'OK'],
  [1.4, 'CALIBRATING GRAVITATIONAL DAMPENERS', 'OK'],
  [1.95, 'SINGULARITY SAFETY LOCKS', 'FAIL'],
  [2.5, 'MANUAL OVERRIDE', 'ACCEPTED'],
  [3.05, 'WAKING CORE INTELLIGENCE', '...'],
];

export function draw(ctx, S) {
  const { lt, frame } = S;
  const termA = 1 - smoothstep(5.1, 5.7, lt);
  // terminal
  ctx.save();
  LINES.forEach(([a, str, status], i) => {
    if (lt < a) return;
    const y = 200 + i * 58;
    const n = Math.floor((lt - a) * 70);
    const shown = ('> ' + str).slice(0, n);
    text(ctx, shown, 150, y, { font: F.mono(32), color: '#9fe9ff', alpha: termA * 0.9 });
    if (lt > a + 0.3) {
      const dots = '.'.repeat(Math.max(0, 52 - str.length));
      text(ctx, dots, 150 + (str.length + 3) * 16.1, y, { font: F.mono(32), color: '#2a6c80', alpha: termA });
      const bad = status === 'FAIL';
      const blink = bad ? (Math.floor(lt * 5) % 2 ? 1 : 0.35) : 1;
      text(ctx, `[ ${status} ]`, 1180, y, { font: F.mono(32), color: bad ? C.red : status === 'ACCEPTED' ? '#ffd23f' : '#5dffa0', alpha: termA * blink, glow: bad ? 14 : 0 });
    }
  });
  ctx.restore();

  // streaming hex readout
  const hexA = clamp((lt - 3.2) / 0.3) * termA;
  if (hexA > 0) {
    for (let row = 0; row < 14; row++) {
      let s = '';
      for (let k = 0; k < 6; k++) s += Math.floor(hash1(frame * 13 + row * 7 + k) * 65535).toString(16).toUpperCase().padStart(4, '0') + ' ';
      text(ctx, s, 150, 600 + row * 26, { font: F.mono(20), color: '#1f6f86', alpha: hexA * (0.4 + 0.6 * hash1(row + frame)) });
    }
  }
  // core sync bar
  const syncA = clamp((lt - 3.4) / 0.3) * termA;
  if (syncA > 0) {
    const p = prog(lt, 3.5, 5.0, ease.inOutCubic);
    text(ctx, 'CORE SYNC', 1180, 640, { font: F.mono(26), color: C.cyan, alpha: syncA });
    text(ctx, `${Math.round(p * 100)}%`, 1770, 640, { font: F.mono(26), color: C.cyan, alpha: syncA, align: 'right' });
    bar(ctx, 1180, 660, 590, 34, p, C.cyan, syncA, 24);
    if (lt > 5.0) text(ctx, 'CONSCIOUSNESS: ONLINE', 1180, 740, { font: F.mono(26), color: '#5dffa0', alpha: syncA * (Math.floor(lt * 6) % 2 ? 1 : 0.4) });
  }

  // eye opens
  const open = prog(lt, 6.0, 7.3, ease.outCubic);
  const eyeA = clamp((lt - 5.7) / 0.4);
  if (eyeA > 0) {
    if (lt < 6.0) {
      // a single glowing line first
      const w = prog(lt, 5.7, 6.0, ease.outExpo) * 420;
      ctx.fillStyle = C.cyan;
      ctx.fillRect(EYE.x - w, EYE.y - 1.5, w * 2, 3);
      glow(ctx, EYE.x, EYE.y, 120, C.cyan, 0.6);
    } else {
      drawEye(ctx, EYE.x, EYE.y, EYE.r, S.t, { open, alpha: eyeA, talk: 0 });
    }
  }
  scanlines(ctx, 0.12);
  const g = lt < 0.25 ? 0.6 : lt > 5.4 && lt < 6.0 ? 0.8 : lt > 1.95 && lt < 2.1 ? 0.5 : 0;
  return { glitch: g, flash: lt > 5.95 && lt < 6.2 ? (6.2 - lt) * 2 : 0, flashColor: C.cyan };
}
