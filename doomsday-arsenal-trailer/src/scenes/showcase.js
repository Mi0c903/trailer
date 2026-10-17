// 1:26 — The arsenal: one cinematic reveal per hero weapon, then the 18-weapon roll call.
import { W, H, F, C, text, glow, corners, shake, drawNebula, bar, setFont } from '../draw.js';
import { drawBody as renderBody, bodyImpact, BODY_SIZE, POWER_AT, drawIcon } from '../bodies.js';
import { clamp, ease, prog, smoothstep, lerp, hash1, hexToRgb, rgba, TAU } from '../util.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const SCRAMBLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$';

function scramble(str, lt, start, dur, frame) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const reveal = start + (i / str.length) * dur;
    if (lt < reveal - 0.25) break;
    out += lt >= reveal || str[i] === ' ' ? str[i] : SCRAMBLE[Math.floor(hash1(frame * 17 + i * 3) * SCRAMBLE.length)];
  }
  return out;
}

function fitFont(ctx, str, px, maxW, spacing, family = F.display) {
  setFont(ctx, family(px), spacing);
  const w = ctx.measureText(str).width;
  return w > maxW ? Math.floor((px * maxW) / w) : px;
}

function wrap(ctx, str, maxW) {
  const words = str.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function drawTitle(ctx, S) {
  const { lt, tr } = S;
  tr.stars.draw(ctx, S.t, { alpha: 0.6, vx: -20 });
  const k = prog(lt, 0, 0.35, ease.outCubic);
  const sc = lerp(1.25, 1, k) + lt * 0.02;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(sc, sc);
  text(ctx, 'THE ARSENAL', 0, 30, { font: F.display(130), color: '#ffffff', align: 'center', alpha: k, glow: 40, glowColor: C.orange, spacing: 22 });
  ctx.restore();
  text(ctx, `${tr.cfg.arsenal.length} CELESTIAL WEAPONS  //  UNLOCKED`, W / 2, H / 2 + 120, { font: F.mono(28), color: C.cyan, align: 'center', alpha: clamp((lt - 0.4) / 0.3), spacing: 6 });
  return { flash: clamp(1 - lt / 0.25), glitch: lt > 1.8 ? 0.7 : 0 };
}

export function drawBody(ctx, S) {
  const { lt, frame, tr, seg } = S;
  const b = seg.body, i = seg.index, n = tr.cfg.bodies.length;
  const t = S.t;
  const rgb = hexToRgb(b.color);
  const imp = bodyImpact(b.type, lt);
  const [sx, sy] = shake(t, imp.shake);

  tr.stars.draw(ctx, t, { alpha: 0.9, vx: -14 - i * 2 });
  drawNebula(ctx, b.color, t, 0.32, i + 2);

  // body
  const push = lerp(0.94, 1.06, ease.inOutCubic(lt / 6));
  const R = (BODY_SIZE[b.type] || 280) * push;
  const cx = 1240 + lt * -6, cy = 540;
  ctx.save();
  ctx.translate(sx, sy);
  renderBody(ctx, b.type, cx, cy, R, lt);
  ctx.restore();

  // target brackets around the body
  const brA = prog(lt, 0.3, 0.7, ease.outCubic) * (1 - smoothstep(POWER_AT - 0.1, POWER_AT + 0.2, lt));
  if (brA > 0) {
    const s = Math.min(980, lerp(R * 3.2, R * 2.5, brA));
    corners(ctx, cx - s / 2 + sx, cy - s / 2 + sy, s, s, 40, b.color, brA * 0.8, 2);
    text(ctx, `TARGET LOCK // ${b.sub.toUpperCase()}`, cx - s / 2 + sx, cy - s / 2 - 14 + sy, { font: F.mono(18), color: b.color, alpha: brA * 0.9, spacing: 2 });
  }

  // left panel: dark gradient for legibility
  const grd = ctx.createLinearGradient(0, 0, 940, 0);
  grd.addColorStop(0, 'rgba(2,4,10,0.88)');
  grd.addColorStop(0.75, 'rgba(2,4,10,0.4)');
  grd.addColorStop(1, 'rgba(2,4,10,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 940, H);

  const X = 130, PW = 680;
  const out = 1 - smoothstep(5.7, 5.95, lt);
  const a0 = clamp((lt - 0.15) / 0.25) * out;
  text(ctx, `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`, X, 215, { font: F.mono(24), color: b.color, alpha: a0, spacing: 4 });
  text(ctx, `ARSENAL KEY  ${b.key}`, X + PW, 215, { font: F.mono(22), color: '#9fb4c8', alpha: a0, align: 'right', spacing: 3 });

  const name = b.name.toUpperCase();
  const nameK = prog(lt, 0.2, 0.6, ease.outCubic);
  const npx = fitFont(ctx, name, 96, PW, 6);
  text(ctx, name, X - (1 - nameK) * 60, 320, { font: F.display(npx), color: '#ffffff', alpha: nameK * out, glow: 24, glowColor: b.color, spacing: 6 });
  text(ctx, scramble(b.sub.toUpperCase(), lt, 0.5, 0.6, frame), X, 370, { font: F.mono(26), color: rgba(rgb, 1), alpha: clamp((lt - 0.5) / 0.2) * out, spacing: 3, glow: 10 });
  const lineW = prog(lt, 0.6, 1.1, ease.outCubic) * PW;
  ctx.fillStyle = rgba(rgb, 0.8 * out);
  ctx.fillRect(X, 398, lineW, 2);

  const pa = clamp((lt - 0.9) / 0.25) * out;
  text(ctx, 'DRAWN FROM', X, 448, { font: F.mono(20), color: '#7f94a8', alpha: pa, spacing: 5 });
  const fpx = fitFont(ctx, b.from, 30, PW, 0, (px) => F.ui(px, 700));
  text(ctx, b.from, X, 490, { font: F.ui(fpx, 700), color: '#ffffff', alpha: pa });
  text(ctx, b.distance, X, 524, { font: F.mono(22), color: rgba(rgb, 0.9), alpha: pa, spacing: 2 });

  // tagline, typed and wrapped
  setFont(ctx, F.ui(34, 500), 0);
  const lines = wrap(ctx, b.line, PW);
  let left = Math.max(0, Math.floor((lt - 1.6) * 40));
  lines.forEach((ln, k) => {
    const shown = ln.slice(0, left);
    left -= ln.length + 1;
    if (shown) text(ctx, shown, X, 590 + k * 44, { font: F.ui(34, 500), color: '#eaf3ff', alpha: out });
  });

  let y = 590 + lines.length * 44 + 40;
  (b.stats || []).forEach(([k, v], j) => {
    const sa = clamp((lt - 2.2 - j * 0.15) / 0.25) * out;
    text(ctx, k, X, y, { font: F.mono(24), color: '#7f94a8', alpha: sa, spacing: 2 });
    text(ctx, v, X + PW, y, { font: F.mono(24), color: '#ffffff', alpha: sa, align: 'right', spacing: 2 });
    ctx.fillStyle = `rgba(127,148,168,${0.25 * sa})`;
    ctx.fillRect(X, y + 12, PW, 1);
    y += 46;
  });
  y += 8;
  const ta = clamp((lt - 2.6) / 0.25) * out;
  text(ctx, 'THREAT LEVEL', X, y, { font: F.mono(24), color: '#7f94a8', alpha: ta, spacing: 2 });
  const tp = lt < POWER_AT ? prog(lt, 2.6, POWER_AT) * 0.7 : 1;
  bar(ctx, X + 230, y - 22, PW - 230, 28, tp, lt > POWER_AT ? C.red : b.color, ta, 16);
  if (lt > POWER_AT) text(ctx, 'EXTINCTION', X + PW, y + 40, { font: F.mono(22), color: C.red, alpha: ta * (Math.floor(lt * 6) % 2 ? 1 : 0.5), align: 'right', spacing: 4 });

  return {
    flash: Math.max(clamp(1 - lt / 0.22), imp.flash),
    flashColor: lt < 0.3 ? '#ffffff' : b.color,
    glitch: lt < 0.15 ? 0.8 : lt > 5.85 ? 0.9 : 0,
  };
}

// The uplink grid: all eighteen weapons, laid out like the in-game arsenal screen.
export const CARD_IN = 0.12;
export function cardRects(n) {
  const x0 = 150, wAll = 1620, gap = 18, cw = (wAll - gap * 3) / 4, ch = 128, y0 = 120;
  const rects = [];
  const full = Math.floor(n / 4) * 4 === n ? n : n - (n % 4);
  for (let i = 0; i < n; i++) {
    if (i < full) rects.push([x0 + (i % 4) * (cw + gap), y0 + Math.floor(i / 4) * (ch + 16), cw, ch]);
    else {
      const rest = n - full, j = i - full, w = (wAll - gap * (rest - 1)) / rest;
      rects.push([x0 + j * (w + gap), y0 + Math.floor(full / 4) * (ch + 16), w, ch]);
    }
  }
  return rects;
}
export function drawRollcall(ctx, S) {
  const { lt, tr } = S;
  const arsenal = tr.cfg.arsenal;
  const rects = cardRects(arsenal.length);
  tr.stars.draw(ctx, S.t, { alpha: 0.6, vx: -10 });
  const allIn = arsenal.length * CARD_IN;
  const sweep0 = allIn + 0.2, sweepStep = 0.045;
  const dim = 1 - 0.75 * smoothstep(3.3, 3.8, lt);
  const zoom = 1 - 0.05 * smoothstep(3.3, 6, lt);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2, -H / 2);
  ctx.globalAlpha = dim;
  text(ctx, 'DOOMSDAY ARSENAL', 150, 92, { font: F.display(34, 900), color: '#ffffff', spacing: 4, alpha: clamp(lt / 0.3) });
  text(ctx, 'ALL WEAPONS ARMED  //  UPLINK READY', 1770, 92, { font: F.mono(22), color: C.orange, align: 'right', spacing: 3, alpha: clamp((lt - allIn) / 0.3) });
  arsenal.forEach((w, i) => {
    const at = i * CARD_IN;
    if (lt < at) return;
    const k = prog(lt, at, at + 0.12, ease.outCubic);
    const [x, y, cw, ch] = rects[i];
    const armedIdx = Math.floor((lt - sweep0) / sweepStep);
    const armed = lt > sweep0 && (armedIdx === i || (armedIdx >= arsenal.length && i === arsenal.length - 1));
    ctx.save();
    ctx.globalAlpha = dim * k;
    ctx.translate(x + cw / 2, y + ch / 2);
    ctx.scale(lerp(1.15, 1, k), lerp(1.15, 1, k));
    ctx.translate(-cw / 2, -ch / 2);
    ctx.fillStyle = armed ? 'rgba(60,40,10,0.92)' : 'rgba(10,14,24,0.9)';
    ctx.fillRect(0, 0, cw, ch);
    corners(ctx, 0, 0, cw, ch, 22, armed ? '#ffb43a' : 'rgba(200,215,230,0.55)', 1, armed ? 4 : 2);
    text(ctx, w.key, 18, 32, { font: F.mono(22), color: armed ? '#ffb43a' : '#8a9aac' });
    if (armed) text(ctx, 'ARMED', 18 + w.key.length * 12 + 18, 32, { font: F.mono(20), color: '#ffb43a', spacing: 2 });
    const npx = fitFont(ctx, w.name, 34, cw - 100, 0, (px) => F.ui(px, 700));
    text(ctx, w.name, 18, 78, { font: F.ui(npx, 700), color: '#ffffff' });
    const spx = fitFont(ctx, w.sub, 17, cw - 36, 0, F.mono);
    text(ctx, w.sub, 18, 108, { font: F.mono(spx), color: w.color });
    drawIcon(ctx, w.icon, cw - 46, 46, 24, S.t, w.color, 1);
    ctx.restore();
    if (lt - at < 0.1) glow(ctx, x + cw / 2, y + ch / 2, cw * 0.7, w.color, (1 - (lt - at) / 0.1) * 0.6);
  });
  ctx.restore();
  // EIGHTEEN WAYS TO END A WORLD.
  const k2 = lt - 3.4;
  if (k2 > 0) {
    const s = lerp(1.3, 1, prog(k2, 0, 0.25, ease.outCubic)) + k2 * 0.02;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(s, s);
    const a = clamp(k2 / 0.15) * (1 - smoothstep(2.3, 2.6, k2));
    ctx.fillStyle = `rgba(2,4,10,${0.75 * a})`;
    ctx.fillRect(-W, -90, W * 2, 220);
    const tpx = fitFont(ctx, tr.cfg.tagline, 84, 1560, 8);
    text(ctx, tr.cfg.tagline, 0, 20, { font: F.display(tpx), color: '#ffffff', align: 'center', alpha: a, glow: 40, glowColor: C.orange, spacing: 8 });
    text(ctx, tr.cfg.subtagline.toUpperCase(), 0, 90, { font: F.mono(30), color: '#ffb43a', align: 'center', alpha: a * clamp((k2 - 0.6) / 0.3), spacing: 8 });
    ctx.restore();
  }
  const card = Math.floor(lt / CARD_IN);
  return {
    flash: lt < allIn && lt - card * CARD_IN < 0.05 ? 0.15 : k2 > 0 && k2 < 0.2 ? (0.2 - k2) * 4 : 0,
    flashColor: C.orange,
    glitch: k2 > 0 && k2 < 0.1 ? 0.8 : lt > 5.85 ? 0.8 : 0,
  };
}
