// 0:30 — Vector star map: the AI locks onto every celestial power source.
import { W, H, F, C, text, glow, corners, aiLines, shake, scanlines } from '../draw.js';
import { drawIcon } from '../bodies.js';
import { clamp, ease, prog, smoothstep, lerp, TAU, hexToRgb, rgba, hash1 } from '../util.js';

// Log-scale radar: distance from Earth in light-years → radius on the map.
const LOGMIN = -7.8, LOGMAX = 8.4, R0 = 120, R1 = 570;
const radiusOf = (ly) => R0 + ((Math.log10(ly) - LOGMIN) / (LOGMAX - LOGMIN)) * (R1 - R0);
const RINGS = [[3.17e-8, '1 LIGHT-SECOND'], [1.58e-5, '1 AU'], [1, '1 LY'], [1000, '1,000 LY'], [1e6, '1 MILLION LY'], [2.5e8, '250 MILLION LY']].map(([d, l]) => [radiusOf(d), l]);
export const LOCK0 = 2.0, LOCK_SPAN = 11.4;
export const lockTime = (i, n) => LOCK0 + (i * LOCK_SPAN) / n;
export const POWER_HIT = 16.4;

function camera(lt) {
  const pitch = lerp(Math.PI / 2 * 0.98, 1.02, prog(lt, 0, 3.2, ease.inOutCubic));
  const yaw = 0.35 + lt * 0.045;
  const dive = prog(lt, 15.5, 19.8, ease.inExpo);
  const D = lerp(1500, 260, dive);
  return { pitch, yaw, D, F: 1380, cx: W / 2, cy: H / 2 + 45 };
}

function proj(cam, x, y, z) {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
  const s = cam.F / Math.max(40, cam.D + z2);
  return [cam.cx + x1 * s, cam.cy - y2 * s, s];
}

export function bodyPositions(arsenal) {
  return arsenal.map((w, i) => {
    const a = i * 2.39996 + 0.4; // golden angle keeps neighbours apart
    const r = radiusOf(w.dist);
    const b = { ...w, type: w.icon, name: w.name.toUpperCase() };
    return { b, a, r, h: 20 + 40 * hash1(i * 13 + 5), x: Math.cos(a) * r, z: Math.sin(a) * r };
  });
}

export function draw(ctx, S) {
  const { lt, frame, tr } = S;
  const t = S.t;
  const cam = camera(lt);
  const bodies = tr.cfg.arsenal;
  const pos = bodyPositions(bodies);
  const drawIn = prog(lt, 0.1, 2.0, ease.outCubic);
  const [sx, sy] = shake(t, lt > POWER_HIT ? 20 * Math.exp(-(lt - POWER_HIT) * 2.5) : 0);
  const dive = prog(lt, 15.5, 19.8, ease.inExpo);

  tr.stars.draw(ctx, t, { alpha: 0.5 * (1 - dive), vx: -3 });
  ctx.save();
  ctx.translate(sx, sy);

  // grid plane
  ctx.lineWidth = 1;
  for (let g = -6; g <= 6; g++) {
    const a = 0.06 * drawIn * (1 - dive);
    ctx.strokeStyle = `rgba(79,243,255,${a})`;
    ctx.beginPath();
    let p = proj(cam, g * 110, 0, -660), q = proj(cam, g * 110, 0, 660);
    ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
    p = proj(cam, -660, 0, g * 110); q = proj(cam, 660, 0, g * 110);
    ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
    ctx.stroke();
  }
  // rings
  RINGS.forEach(([r, label], i) => {
    const rr = r * clamp(drawIn * 1.3 - i * 0.08);
    if (rr <= 0) return;
    ctx.strokeStyle = `rgba(79,243,255,${0.45 * (1 - dive)})`;
    ctx.lineWidth = i === RINGS.length - 1 ? 2 : 1.2;
    ctx.setLineDash(i % 2 ? [6, 8] : []);
    ctx.beginPath();
    for (let k = 0; k <= 96; k++) {
      const a = (k / 96) * TAU;
      const p = proj(cam, Math.cos(a) * rr, 0, Math.sin(a) * rr);
      k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const lp = proj(cam, rr * Math.cos(-0.5), 0, rr * Math.sin(-0.5));
    text(ctx, label, lp[0] + 6, lp[1] - 6, { font: F.mono(17), color: C.cyan, alpha: 0.6 * drawIn * (1 - dive) });
  });
  // spokes
  ctx.strokeStyle = `rgba(79,243,255,${0.12 * drawIn * (1 - dive)})`;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    const p = proj(cam, 0, 0, 0), q = proj(cam, Math.cos(a) * 590 * drawIn, 0, Math.sin(a) * 590 * drawIn);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  }
  // sweep
  if (drawIn > 0.5 && dive < 1) {
    const sw = lt * 1.3;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 14; k++) {
      const a0 = sw - k * 0.05, a1 = a0 - 0.05;
      const o = proj(cam, 0, 0, 0), p = proj(cam, Math.cos(a0) * 590, 0, Math.sin(a0) * 590), q = proj(cam, Math.cos(a1) * 590, 0, Math.sin(a1) * 590);
      ctx.fillStyle = `rgba(79,243,255,${0.13 * (1 - k / 14) * (1 - dive)})`;
      ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.fill();
    }
    ctx.restore();
  }

  // Earth / operator at the centre
  const c0 = proj(cam, 0, 0, 0);
  const allLocked = clamp((lt - (LOCK0 + LOCK_SPAN)) / 1.5);
  const coreGlow = 0.4 + allLocked * 0.6 + dive * 2;
  glow(ctx, c0[0], c0[1], 60 + allLocked * 120 + dive * 1400, '#6fb8ff', clamp(coreGlow * 0.7));
  ctx.save();
  ctx.strokeStyle = '#8fd0ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(c0[0], c0[1], 26, 0, TAU); ctx.stroke();
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(c0[0], c0[1] + k * 9, Math.sqrt(1 - (k * 9 / 26) ** 2) * 26, 3, 0, 0, TAU); ctx.stroke(); }
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(c0[0], c0[1], 26 * Math.abs(Math.cos(t * 0.8 + k)), 26, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
  text(ctx, 'OPERATOR // EARTH', c0[0], c0[1] + 58, { font: F.mono(18), color: '#8fd0ff', align: 'center', alpha: drawIn * (1 - dive) });

  // bodies
  const order = pos.map((p, i) => ({ ...p, i, pr: proj(cam, p.x, p.h, p.z) })).sort((a, b) => a.pr[2] - b.pr[2]);
  let locked = 0;
  for (const p of order) {
    const { b, i } = p;
    const col = b.color, rgb = hexToRgb(col);
    const lockT = lockTime(i, bodies.length);
    const appear = clamp((drawIn - 0.4) * 2);
    // during the dive, the bodies get pulled into the core
    const pull = dive;
    const wx = p.x * (1 - pull), wz = p.z * (1 - pull), wh = p.h * (1 - pull);
    const [x, y, s] = proj(cam, wx, wh, wz);
    const base = proj(cam, wx, 0, wz);
    const alpha = appear * (1 - pull * 0.6);
    // stem
    ctx.strokeStyle = rgba(rgb, 0.5 * alpha);
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(base[0], base[1]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba(rgb, 0.6 * alpha);
    ctx.beginPath(); ctx.ellipse(base[0], base[1], 10 * s, 4 * s, 0, 0, TAU); ctx.stroke();
    const isLocked = lt > lockT;
    if (isLocked) locked++;
    const ir = 17 * s * 1.1;
    glow(ctx, x, y, ir * 3.2, col, alpha * (isLocked ? 0.65 : 0.25));
    drawIcon(ctx, b.type, x, y, ir, t, isLocked ? col : 'rgba(170,190,210,0.8)', alpha);

    // energy stream to the core
    if (isLocked) {
      const k = clamp((lt - lockT - 0.5) / 0.5) * alpha;
      if (k > 0) {
        const mx = (x + c0[0]) / 2, my = (y + c0[1]) / 2 - 120 * s;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(rgb, 0.55 * k);
        ctx.lineWidth = 2.5;
        ctx.setLineDash([14, 10]);
        ctx.lineDashOffset = -t * 90;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx, my, c0[0], c0[1]); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        for (let q = 0; q < 3; q++) {
          const u = (t * 0.7 + q / 3 + i * 0.13) % 1;
          const px = (1 - u) * (1 - u) * x + 2 * (1 - u) * u * mx + u * u * c0[0];
          const py = (1 - u) * (1 - u) * y + 2 * (1 - u) * u * my + u * u * c0[1];
          glow(ctx, px, py, 16, col, k);
        }
      }
    }
    // lock-on bracket + label
    if (lt > lockT && pull < 0.6) {
      const age = lt - lockT;
      const lk = prog(lt, lockT, lockT + 0.25, ease.outCubic);
      const fresh = 1 - smoothstep(1.2, 1.6, age);
      const sz = lerp(130, 46, lk) * Math.max(0.7, s) * lerp(0.75, 1, fresh);
      const la = clamp(age / 0.1) * (1 - pull * 1.6);
      corners(ctx, x - sz / 2, y - sz / 2, sz, sz, sz * 0.28, lk < 1 && Math.floor(lt * 20) % 2 ? '#ffffff' : col, la * lerp(0.35, 1, fresh), 2);
      const pr = prog(lt, lockT + 0.2, lockT + 0.75);
      if (fresh > 0) {
        ctx.save();
        ctx.globalAlpha = la * fresh;
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, sz * 0.62, -Math.PI / 2, -Math.PI / 2 + pr * TAU); ctx.stroke();
        ctx.restore();
      }
      const lx = x + sz * 0.6, ly = y - sz * 0.15;
      if (fresh > 0) {
        text(ctx, b.name, lx + 8, ly - 14, { font: F.display(20, 700), color: '#fff', alpha: la * fresh, spacing: 1 });
        const status = pr < 1 ? `HARVESTING ${Math.round(pr * 100)}%` : 'ACQUIRED';
        text(ctx, status, lx + 8, ly + 10, { font: F.mono(17), color: pr < 1 ? '#ffd23f' : col, alpha: la * fresh });
      }
    }
  }
  ctx.restore();

  // HUD frame
  const hudA = drawIn * (1 - dive);
  text(ctx, 'LOCAL SECTOR // DEEP SCAN', 80, 80, { font: F.mono(24), color: C.cyan, alpha: hudA, spacing: 3 });
  text(ctx, `SOURCES ACQUIRED  ${String(locked).padStart(2, '0')} / ${String(bodies.length).padStart(2, '0')}`, W - 80, 80, { font: F.mono(24), color: locked === bodies.length ? '#5dffa0' : C.cyan, alpha: hudA, align: 'right', spacing: 2 });
  ctx.fillStyle = `rgba(79,243,255,${0.4 * hudA})`;
  ctx.fillRect(80, 96, W - 160, 1);
  corners(ctx, 50, 40, W - 100, H - 80, 40, C.cyan, hudA * 0.6, 2);

  aiLines(ctx, tr.script.starmap, lt, frame, { y: 990, size: 42 });

  // THEIR POWER... IS NOW YOURS.
  const dim = smoothstep(14.2, 14.8, lt) * 0.55;
  if (dim > 0) { ctx.fillStyle = `rgba(0,0,0,${dim})`; ctx.fillRect(0, 0, W, H); }
  const a1 = clamp((lt - 14.4) / 0.25) * clamp((POWER_HIT - 0.05 - lt) / 0.2 + 1) * (lt < POWER_HIT ? 1 : 0);
  if (a1 > 0) {
    const sc = 1 + (lt - 14.4) * 0.03;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(sc, sc);
    text(ctx, 'THEIR POWER...', 0, 30, { font: F.display(96), color: '#ffffff', align: 'center', alpha: a1, glow: 30, glowColor: C.cyan, spacing: 12 });
    ctx.restore();
  }
  if (lt > POWER_HIT) {
    const k = prog(lt, POWER_HIT, POWER_HIT + 0.25, ease.outCubic);
    const sc = lerp(1.5, 1, k) + (lt - POWER_HIT) * 0.04;
    ctx.save(); ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(sc, sc);
    text(ctx, 'IS NOW YOURS.', 0, 30, { font: F.display(120), color: '#ffffff', align: 'center', alpha: k * (1 - smoothstep(19.3, 19.8, lt)), glow: 40, glowColor: C.red, spacing: 14 });
    ctx.restore();
  }
  scanlines(ctx, 0.05);
  const fl = lt > POWER_HIT && lt < POWER_HIT + 0.25 ? (POWER_HIT + 0.25 - lt) * 3 : 0;
  return {
    flash: Math.max(fl, smoothstep(19.4, 20, lt)),
    glitch: lt > POWER_HIT && lt < POWER_HIT + 0.15 ? 1 : lt < 0.2 ? 0.5 : 0,
  };
}
