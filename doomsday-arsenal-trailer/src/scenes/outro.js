// 3:03 — Logo, tagline and the CurseForge link.
import { W, H, F, C, text, glow, drawNebula, shake, setFont, corners } from '../draw.js';
import { drawIcon } from '../bodies.js';
import { clamp, ease, prog, smoothstep, lerp, TAU } from '../util.js';
import { QR } from '../qr-data.js';

const SLAM1 = 0.5, SLAM2 = 1.0;

function slamText(ctx, str, y, lt, at, fill, glowCol) {
  if (lt < at) return;
  const k = prog(lt, at, at + 0.22, ease.outCubic);
  const s = lerp(2.4, 1, k);
  ctx.save();
  ctx.translate(0, y);
  ctx.scale(s, s);
  setFont(ctx, F.display(150), 18);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (k < 1) {
    ctx.globalAlpha = 0.25 * (1 - k);
    ctx.fillStyle = glowCol;
    for (let g = 1; g <= 3; g++) ctx.fillText(str, 0, g * 8);
  }
  ctx.globalAlpha = k;
  ctx.shadowColor = glowCol;
  ctx.shadowBlur = 40;
  ctx.fillStyle = fill;
  ctx.fillText(str, 0, 0);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.strokeText(str, 0, 0);
  ctx.restore();
}

function drawQR(ctx, x, y, size, alpha, lt) {
  if (alpha <= 0) return;
  const n = QR.size, quiet = 3, cell = size / (n + quiet * 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#05070c';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (QR.bits[r * n + c] !== '1') continue;
    // modules assemble diagonally
    const k = clamp((lt - (r + c) * 0.012) / 0.15);
    if (k <= 0) continue;
    const s = cell * k;
    ctx.fillRect(x + (c + quiet) * cell + (cell - s) / 2, y + (r + quiet) * cell + (cell - s) / 2, s + 0.6, s + 0.6);
  }
  ctx.restore();
}

export function draw(ctx, S) {
  const { lt, tr } = S;
  const t = S.t;
  const cfg = tr.cfg;
  tr.stars.draw(ctx, t, { alpha: 0.85, vx: -6 });
  drawNebula(ctx, '#ff5a1a', t, 0.25, 9);

  const shk = (lt > SLAM1 ? 18 * Math.exp(-(lt - SLAM1) * 6) : 0) + (lt > SLAM2 ? 22 * Math.exp(-(lt - SLAM2) * 6) : 0);
  const [sx, sy] = shake(t, shk);
  const move = prog(lt, 5.0, 5.9, ease.inOutCubic);
  const gy = lerp(470, 300, move), gs = lerp(1, 0.7, move);

  ctx.save();
  ctx.translate(W / 2 + sx, gy + sy);
  ctx.scale(gs, gs);

  glow(ctx, 0, 0, 900, '#ff6a1a', 0.25 * clamp((lt - SLAM2) / 0.5));
  // orbiting celestial icons
  const weapons = cfg.arsenal;
  const orbitA = clamp((lt - 0.2) / 0.8);
  const icons = weapons.map((b, i) => {
    const a = (i / weapons.length) * TAU + lt * 0.3;
    return { b, x: Math.cos(a) * 780, y: Math.sin(a) * 160 + 40, d: Math.sin(a) };
  });
  const drawIcons = (front) => icons.filter((p) => (p.d > 0) === front).forEach((p) => {
    const s = 20 * (1 + 0.4 * p.d);
    glow(ctx, p.x, p.y, s * 3, p.b.color, orbitA * (0.3 + 0.25 * p.d));
    drawIcon(ctx, p.b.icon, p.x, p.y, s, t, p.b.color, orbitA * (0.5 + 0.5 * p.d));
  });
  ctx.strokeStyle = `rgba(255,150,80,${0.25 * orbitA})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 40, 760, 150, 0, Math.PI, TAU); ctx.stroke();
  drawIcons(false);

  // shockwaves
  for (const at of [SLAM1, SLAM2]) {
    if (lt < at) continue;
    const k = lt - at;
    ctx.strokeStyle = `rgba(255,255,255,${clamp(0.8 - k)})`;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(0, 40, 200 + k * 1400, 60 + k * 420, 0, 0, TAU); ctx.stroke();
  }

  text(ctx, cfg.kicker, 0, -190, { font: F.mono(30), color: C.cyan, align: 'center', alpha: clamp((lt - 1.6) / 0.4), spacing: 12 });
  slamText(ctx, cfg.title[0], -30, lt, SLAM1, '#ffffff', C.cyan);
  if (lt > SLAM2) {
    const grd = ctx.createLinearGradient(0, -110, 0, 140);
    grd.addColorStop(0, '#ffd27a');
    grd.addColorStop(0.5, '#ff7a1a');
    grd.addColorStop(1, '#ff2d1a');
    slamText(ctx, cfg.title[1], 140, lt, SLAM2, grd, '#ff5a1a');
  }
  const tag = cfg.tagline.slice(0, Math.max(0, Math.floor((lt - 2.4) * 30)));
  text(ctx, tag, 0, 240, { font: F.ui(44, 700), color: '#ffffff', align: 'center', spacing: 10, glow: 14, glowColor: C.orange });
  text(ctx, cfg.subtagline, 0, 290, { font: F.mono(28), color: '#ffb43a', align: 'center', spacing: 4, alpha: clamp((lt - 3.6) / 0.4) });
  drawIcons(true);
  ctx.restore();

  // call to action
  const ca = clamp((lt - 5.6) / 0.4);
  if (ca > 0) {
    const qx = 270, qy = 600, qs = 230;
    drawQR(ctx, qx, qy, qs, ca, lt - 5.7);
    corners(ctx, qx - 14, qy - 14, qs + 28, qs + 28, 26, C.cyan, ca, 3);
    const X = 560;
    text(ctx, 'AVAILABLE NOW ON', X, 645, { font: F.mono(30), color: '#a9c0d4', alpha: ca, spacing: 8 });
    text(ctx, cfg.platform, X, 722, { font: F.display(68), color: '#f16436', alpha: clamp((lt - 5.8) / 0.3), spacing: 6, glow: 20 });
    const bx = X, by = 752, bw = 1110, bh = 78;
    const bk = prog(lt, 6.0, 6.4, ease.outCubic);
    ctx.save();
    ctx.globalAlpha = ca;
    ctx.fillStyle = 'rgba(8,14,24,0.85)';
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.rect(bx, by, bw * bk, bh);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const url = cfg.link.slice(0, Math.max(0, Math.floor((lt - 6.3) * 40)));
    setFont(ctx, F.mono(34), 0);
    const uw = ctx.measureText(url).width;
    text(ctx, url, bx + 24, by + 51, { font: F.mono(34), color: '#ffffff', alpha: ca });
    if (Math.floor(lt * 2.5) % 2 === 0) {
      ctx.fillStyle = C.cyan;
      ctx.fillRect(bx + 28 + uw, by + 22, 16, 36);
    }
    text(ctx, `SCAN  //  CLICK  //  SEARCH "${cfg.title.join(' ')}"`, W / 2, 935, { font: F.mono(24), color: '#7f94a8', align: 'center', alpha: clamp((lt - 7.6) / 0.4), spacing: 4 });
  }

  return {
    flash: clamp(1 - lt / 0.6) + (lt > SLAM1 && lt < SLAM1 + 0.1 ? 0.4 : 0) + (lt > SLAM2 && lt < SLAM2 + 0.1 ? 0.5 : 0),
    glitch: (lt > SLAM2 && lt < SLAM2 + 0.08) ? 0.6 : 0,
    black: smoothstep(S.dur - 0.9, S.dur, lt),
  };
}
