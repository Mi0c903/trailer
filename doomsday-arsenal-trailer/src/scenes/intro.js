// 0:08 — The AI introduces itself.
import { W, H, F, C, drawEye, aiLines, shake, glow, scanlines } from '../draw.js';
import { clamp, ease, prog, smoothstep, TAU } from '../util.js';
import { EYE } from './boot.js';

export const HIT = 15.8; // "AMMUNITION" lands here

export function draw(ctx, S) {
  const { lt, frame, tr } = S;
  const t = S.t;
  tr.stars.draw(ctx, t, { alpha: smoothstep(0, 3, lt) * 0.75, vx: -5 });

  // faint orbit rings behind the eye
  ctx.save();
  ctx.strokeStyle = 'rgba(79,243,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(EYE.x, EYE.y, 260 * i * 0.9, 80 * i * 0.9, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();

  const red = smoothstep(HIT, HIT + 0.25, lt);
  const [sx, sy] = shake(t, lt > HIT ? 26 * Math.exp(-(lt - HIT) * 3) : 0);
  ctx.save();
  ctx.translate(sx, sy);

  // zoom into the pupil at the end
  const zoom = prog(lt, 19.6, 22, ease.inExpo);
  const r = EYE.r * (1 + lt * 0.012) * (1 + zoom * 30);
  const ey = EYE.y + (H / 2 - EYE.y) * zoom;

  const talk = aiLines(ctx, tr.script.intro, lt, frame, { y: 860, size: 48 });
  drawEye(ctx, EYE.x, ey, r, t, { open: 1, red, talk });
  if (red > 0) glow(ctx, EYE.x, ey, r * 4, C.red, red * 0.25 * (1 - zoom));
  ctx.restore();

  scanlines(ctx, 0.06);
  const hitFlash = lt > HIT && lt < HIT + 0.3 ? (HIT + 0.3 - lt) / 0.3 : 0;
  return {
    flash: hitFlash * 0.55 + (lt > 21.4 ? smoothstep(21.4, 22, lt) : 0),
    flashColor: lt > 21 ? '#000000' : C.red,
    glitch: lt > HIT && lt < HIT + 0.2 ? 1 : lt > 21.3 ? 0.6 : 0,
  };
}
