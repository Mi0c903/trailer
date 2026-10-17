// Field tests: in-game screenshots, then the uplink screen arming the weapon
// that the gameplay footage shows.
import { W, H, F, C, text, corners, scanlines, bar, glow } from '../draw.js';
import { SCENE_LEN } from '../timeline.js';
import { clamp, ease, prog, lerp } from '../util.js';

function drawCrop(ctx, img, crop, zoom, fx = 0.5, fy = 0.5) {
  const [x, y, w, h] = crop;
  // fit the crop to 16:9, then zoom toward (fx, fy) of the crop
  const cw = w / zoom, ch = h / zoom;
  const sx = x + (w - cw) * fx, sy = y + (h - ch) * fy;
  const scale = Math.max(W / cw, H / ch);
  const dw = cw * scale, dh = ch * scale;
  ctx.drawImage(img, sx, sy, cw, ch, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

export function draw(ctx, S) {
  const { lt, frame, tr, dur } = S;
  const shots = tr.cfg.field;
  const shot = SCENE_LEN.fieldShot;
  const upStart = shots.length * shot;
  const imgs = tr.images || new Map();

  if (lt < upStart) {
    const i = Math.floor(lt / shot), u = (lt - i * shot) / shot;
    const f = shots[i];
    const img = imgs.get(f.src);
    if (img) drawCrop(ctx, img, f.crop, lerp(1.0, 1.08, u), i % 2 ? 0.6 : 0.4, 0.45);
    scanlines(ctx, 0.05);
    const a = clamp((u * shot - 0.1) / 0.15);
    corners(ctx, 40, 40, W - 80, H - 80, 50, '#ffffff', 0.7, 3);
    text(ctx, 'FIELD TESTS  //  OVERWORLD', 80, 92, { font: F.mono(26), color: '#ffffff', alpha: 0.9, spacing: 3, glow: 8, glowColor: '#000' });
    ctx.fillStyle = 'rgba(2,4,10,0.72)';
    ctx.fillRect(80, H - 210, 640, 120);
    ctx.fillStyle = f.color || C.orange;
    ctx.fillRect(80, H - 210, 6, 120);
    text(ctx, `FIELD TEST ${String(i + 1).padStart(2, '0')}`, 110, H - 168, { font: F.mono(22), color: '#ffb43a', alpha: a, spacing: 4 });
    text(ctx, f.caption, 110 - (1 - ease.outCubic(a)) * 30, H - 115, { font: F.display(48), color: '#ffffff', alpha: a, spacing: 4 });
    return { flash: clamp(1 - (u * shot) / 0.12) * 0.7, glitch: u * shot < 0.08 ? 0.7 : 0, vignette: 0.45 };
  }

  // the in-game uplink, arming the weapon
  const up = tr.cfg.uplinkScreen;
  const k = lt - upStart, span = dur - upStart;
  const img = imgs.get(up.src);
  const [hx, hy, hw, hh] = up.highlight;
  const z = lerp(1.0, 1.35, ease.inOutCubic(clamp(k / span)));
  const iw = img ? img.naturalWidth : 1600, ih = img ? img.naturalHeight : 900;
  const fx = (hx + hw / 2) / iw, fy = (hy + hh / 2) / ih;
  if (img) drawCrop(ctx, img, [0, 0, iw, ih], z, fx, fy);
  // map the highlight rect into screen space
  const cw = iw / z, ch = ih / z, sx = (iw - cw) * fx, sy = (ih - ch) * fy, sc = Math.max(W / cw, H / ch);
  const rx = (hx - sx) * sc + (W - cw * sc) / 2, ry = (hy - sy) * sc + (H - ch * sc) / 2;
  const blink = Math.floor(k * 8) % 2 ? 1 : 0.4;
  glow(ctx, rx + (hw * sc) / 2, ry + (hh * sc) / 2, hw * sc * 0.7, '#ffb43a', 0.35 * blink);
  corners(ctx, rx - 12, ry - 12, hw * sc + 24, hh * sc + 24, 30, '#ffb43a', blink, 6);
  ctx.fillStyle = 'rgba(2,4,10,0.8)';
  ctx.fillRect(W / 2 - 420, 60, 840, 110);
  const p = prog(k, 0.3, span - 0.4, ease.inOutCubic);
  text(ctx, p < 1 ? `ARMING: ${up.arming}` : `${up.arming}: ARMED`, W / 2, 110, { font: F.display(40), color: p < 1 ? '#ffffff' : '#ffb43a', align: 'center', spacing: 6, glow: 16, glowColor: '#ff7a1a' });
  bar(ctx, W / 2 - 380, 130, 760, 24, p, '#ffb43a', 1, 30);
  scanlines(ctx, 0.04);
  return { flash: Math.max(clamp(1 - k / 0.15) * 0.6, prog(k, span - 0.3, span)), glitch: k < 0.1 ? 0.6 : 0, vignette: 0.5 };
}
