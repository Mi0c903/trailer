// 0:50 — Vector-art combat simulation in a test chamber.
// Everything is drawn as lines run through a warp() function, so the black hole
// at the end can bend the whole chamber.
import { W, H, F, C, text, glow, drawEye, aiLines, shake, scanlines, corners } from '../draw.js';
import { drawIcon } from '../bodies.js';
import { clamp, ease, prog, smoothstep, lerp, TAU, hash1, hexToRgb, rgba, noise1 } from '../util.js';

const FLOOR = 860, CEIL = 170, LEFT = 140, RIGHT = 1780;
const PANEL = 80;
const BH = { x: 1270, y: 520 };
const U = 6; // pixels per Minecraft "pixel" for the figures

// ── timing (seconds into the scene) ────────────────────────────────────────
const T = {
  doorOpen: 3.3, walkIn: [3.8, 6.6], itemUp: [7.4, 8.4], grab: [8.6, 9.6],
  spawn1: [10.8, 11.1, 11.4], aim1: 12.4, fire1: [13.1, 14.6],
  swap2: 17.0, spawn2: 18.6, grav: 19.9,
  alarm: 24.0, swap3: 25.0, bhSpawn: 26.5, collapse: 32.5, white: 33.1, card: 33.6,
};

// ── warp ───────────────────────────────────────────────────────────────────
let WARP = 0, SWIRL_T = 0;
function warp(x, y) {
  if (WARP <= 0) return [x, y];
  const dx = x - BH.x, dy = y - BH.y;
  const r = Math.hypot(dx, dy) + 1e-3;
  const pull = Math.min(r * 0.92, (WARP * 26000) / (r + 140));
  const sw = WARP * 1.6 * Math.exp(-r / 380);
  const nr = r - pull;
  const a = Math.atan2(dy, dx) + sw;
  return [BH.x + Math.cos(a) * nr, BH.y + Math.sin(a) * nr];
}
function wline(ctx, pts, closed = false) {
  ctx.beginPath();
  const step = WARP > 0 ? 22 : 1e9;
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n];
    const segs = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k <= segs; k++) {
      if (k === 0 && i > 0) continue;
      const u = k / segs;
      const [x, y] = warp(ax + (bx - ax) * u, ay + (by - ay) * u);
      i === 0 && k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
  }
  if (closed) ctx.closePath();
}
const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

// ── figures ────────────────────────────────────────────────────────────────
// Side-view blocky figure. x = centre, y = feet. armA: 0 = hanging, PI/2 = forward.
function figure(ctx, x, y, { face = 1, walk = 0, armA = null, backArmA = null, color = C.cyan, fill = '#06131c', zombie = false, alpha = 1, lean = 0 }) {
  if (alpha <= 0) return null;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'miter';
  const sw = Math.sin(walk) * 0.65;
  const limb = (px, py, w, h, ang, dark) => {
    // rectangle hanging from pivot (px, py), rotated by ang
    const c = Math.cos(ang), s = Math.sin(ang);
    // positive angles swing the limb toward the way the figure faces
    const pts = [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]].map(([lx, ly]) => [px + (lx * c + ly * s) * face, py - lx * s + ly * c]);
    ctx.fillStyle = dark ? '#030a10' : fill;
    ctx.strokeStyle = dark ? rgba(hexToRgb(color.startsWith('#') ? color : '#4ff3ff'), 0.55) : color;
    wline(ctx, pts, true);
    ctx.fill();
    ctx.stroke();
    return [px + h * s * face, py + h * c];
  };
  const hipY = y - 12 * U, shY = y - 24 * U;
  const lx = x + lean * 12 * U, ly = shY;
  limb(x, hipY, 4 * U, 12 * U, -sw, true);
  const bA = backArmA ?? (zombie ? Math.PI / 2 - 0.1 : sw);
  limb(lx, ly + 2 * U, 4 * U, 12 * U, bA, true);
  // torso
  ctx.fillStyle = fill;
  ctx.strokeStyle = color;
  const torso = [[x - 2 * U, hipY], [x + 2 * U, hipY], [lx + 2 * U, shY], [lx - 2 * U, shY]];
  wline(ctx, torso, true);
  ctx.fill(); ctx.stroke();
  limb(x, hipY, 4 * U, 12 * U, sw, false);
  // head
  const hx = lx, hy = shY;
  wline(ctx, rectPts(hx - 4 * U, hy - 8 * U, 8 * U, 8 * U), true);
  ctx.fill(); ctx.stroke();
  // eye
  ctx.fillStyle = zombie ? '#0b0' : color;
  const ex = hx + face * 2 * U - (face < 0 ? 2 * U : 0);
  wline(ctx, rectPts(ex, hy - 5 * U, 2 * U, U), true);
  ctx.fill();
  const fA = armA ?? (zombie ? Math.PI / 2 + Math.sin(walk * 0.5) * 0.05 : -sw);
  const hand = limb(lx, ly + 2 * U, 4 * U, 12 * U, fA, false);
  ctx.restore();
  return hand;
}

// Mobs: [spawnTime, spawnX, killTime, killKind]
function mobs(lt) {
  const list = [];
  T.spawn1.forEach((s, i) => list.push({ s, x0: 1320 + i * 140, k: 13.25 + i * 0.2, kind: 'beam', id: i }));
  list.push({ s: T.spawn2, x0: 1360, k: null, kind: 'grav', id: 10 });
  list.push({ s: T.spawn2 + 0.25, x0: 1560, k: null, kind: 'grav', id: 11 });
  return list;
}
function cubes() {
  return [
    { s: T.spawn2 + 0.1, x: 1180, id: 0 },
    { s: T.spawn2 + 0.35, x: 1470, id: 1 },
    { s: T.spawn2 + 0.5, x: 1660, id: 2 },
  ];
}

function gravY(lt, y0, id) {
  // returns y offset (negative = up) under inverted gravity
  const tt = lt - T.grav - (id % 3) * 0.08;
  if (tt <= 0) return { dy: 0, rot: 0, hit: false, th: 0 };
  const g = 1100;
  const maxRise = y0 - (CEIL + 50);
  const tHit = Math.sqrt((2 * maxRise) / g);
  if (tt < tHit) return { dy: -0.5 * g * tt * tt, rot: tt * (1.5 + (id % 2)), hit: false, th: tHit };
  return { dy: -maxRise, rot: tHit * (1.5 + (id % 2)), hit: true, th: tHit, since: tt - tHit };
}

function testCube(ctx, x, y, s, rot, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.translate(-x, -y);
  ctx.strokeStyle = C.cyan;
  ctx.fillStyle = '#081820';
  ctx.lineWidth = 2.5;
  wline(ctx, rectPts(x - s / 2, y - s / 2, s, s), true);
  ctx.fill(); ctx.stroke();
  ctx.lineWidth = 1.5;
  wline(ctx, rectPts(x - s * 0.28, y - s * 0.28, s * 0.56, s * 0.56), true);
  ctx.stroke();
  for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    wline(ctx, [[x + cx * s * 0.5, y + cy * s * 0.28], [x + cx * s * 0.28, y + cy * s * 0.28], [x + cx * s * 0.28, y + cy * s * 0.5]]);
    ctx.stroke();
  }
  glow(ctx, x, y, s * 0.3, C.cyan, 0.5);
  ctx.restore();
}

function pixelBurst(ctx, x, y, since, seed, dirX = 1, color = '#5dff7a', radial = false) {
  if (since < 0 || since > 1.6) return;
  for (let j = 0; j < 40; j++) {
    const h1 = hash1(seed * 97 + j), h2 = hash1(seed * 31 + j * 7), h3 = hash1(seed * 13 + j * 3);
    let px, py;
    if (radial) {
      const a = h1 * Math.PI, sp = 150 + h2 * 450;
      px = x + Math.cos(a) * sp * since;
      py = y + Math.sin(a) * sp * since * 0.8 + 260 * since * since;
    } else {
      px = x + (h1 - 0.5) * 60 + dirX * since * (120 + h2 * 500);
      py = y - h3 * 190 + (h2 - 0.5) * since * 300;
    }
    const s = 6 + h3 * 10;
    ctx.globalAlpha = clamp(1 - since / 1.4);
    ctx.fillStyle = j % 3 === 0 ? '#ffffff' : color;
    ctx.fillRect(px - s / 2, py - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}

// The three test items: 0 Sunspear, 1 Apophis Hammer, 2 the uplink.
function heldItem(ctx, idx, x, y, ang, t, color) {
  const dx = Math.sin(ang), dy = Math.cos(ang); // along the arm, away from the shoulder
  ctx.save();
  ctx.lineCap = 'round';
  if (idx === 0) {
    ctx.strokeStyle = '#c9a46a'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x - dx * 70, y - dy * 70); ctx.lineTo(x + dx * 110, y + dy * 110); ctx.stroke();
    ctx.fillStyle = '#ffd27a';
    const tx = x + dx * 110, ty = y + dy * 110, nx = -dy, ny = dx;
    ctx.beginPath(); ctx.moveTo(tx + dx * 34, ty + dy * 34); ctx.lineTo(tx + nx * 10, ty + ny * 10); ctx.lineTo(tx - nx * 10, ty - ny * 10); ctx.fill();
    glow(ctx, tx + dx * 18, ty + dy * 18, 60, color, 0.9);
  } else if (idx === 1) {
    ctx.strokeStyle = '#8a7a6a'; ctx.lineWidth = 7;
    const hx = x + dx * 80, hy = y + dy * 80;
    ctx.beginPath(); ctx.moveTo(x - dx * 10, y - dy * 10); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.translate(hx, hy);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = '#3a3440'; ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.fillRect(-14, -34, 36, 68); ctx.strokeRect(-14, -34, 36, 68);
    ctx.fillStyle = color; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 8);
    ctx.fillRect(-4, -26, 16, 10); ctx.fillRect(-4, 16, 16, 10);
  } else {
    ctx.translate(x + dx * 14, y + dy * 14);
    ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
    ctx.fillStyle = '#1a1c22'; ctx.strokeStyle = '#9aa4b4'; ctx.lineWidth = 2;
    ctx.fillRect(-14, -6, 28, 46); ctx.strokeRect(-14, -6, 28, 46);
    ctx.fillStyle = '#7a2a20'; ctx.fillRect(-9, 8, 18, 22);
    ctx.strokeStyle = '#c0c6d0'; ctx.beginPath(); ctx.moveTo(8, 40); ctx.lineTo(10, 64); ctx.stroke();
    const on = Math.floor(t * 4) % 2 ? 1 : 0.3;
    ctx.fillStyle = `rgba(255,60,40,${on})`; ctx.fillRect(5, 60, 10, 8);
    ctx.restore();
    glow(ctx, x, y, 60, color, 0.6);
    return;
  }
  ctx.restore();
}

// ── scene ──────────────────────────────────────────────────────────────────
export function draw(ctx, S) {
  const { lt, frame, tr } = S;
  const t = S.t;
  const bodies = tr.cfg.bodies;
  const items = tr.cfg.sim;

  // end card
  if (lt > T.card) return endCard(ctx, S);

  WARP = lt > T.bhSpawn ? ease.inCubic(prog(lt, T.bhSpawn, T.collapse)) * 1.0 + ease.inExpo(prog(lt, T.collapse, T.white)) * 4 : 0;
  const alarm = lt > T.alarm ? 1 : 0;

  // shake sources
  let shk = 0;
  if (lt > T.fire1[0] && lt < T.fire1[1]) shk = 9;
  const gHit = T.grav + 1.12;
  if (lt > gHit) shk = Math.max(shk, 26 * Math.exp(-(lt - gHit) * 4));
  if (lt > T.bhSpawn) shk = Math.max(shk, 3 + WARP * 14);
  const [sx, sy] = shake(t, shk);
  ctx.save();
  ctx.translate(sx, sy);

  // backdrop + build-in
  const build = (c, r) => clamp((lt - 0.2 - Math.hypot(c - 10, r - 4) * 0.12) / 0.3);
  ctx.lineWidth = 1.5;
  for (let c = 0; c < 20; c++) for (let r = 0; r < 8; r++) {
    const b = build(c, r);
    if (b <= 0) continue;
    const x = 160 + c * PANEL, y = 190 + r * PANEL;
    // detach into the singularity
    const d = Math.hypot(x + PANEL / 2 - BH.x, y + PANEL / 2 - BH.y);
    const td = T.bhSpawn + 0.5 + (d / 1100) * 5.5 + hash1(c * 31 + r) * 0.6;
    if (lt > td) {
      const tau = lt - td;
      if (tau > 1.4) continue;
      const k = ease.inCubic(tau / 1.4);
      const a0 = Math.atan2(y - BH.y, x - BH.x) + k * 4;
      const rr = d * (1 - k);
      const px = BH.x + Math.cos(a0) * rr, py = BH.y + Math.sin(a0) * rr;
      const s = (PANEL - 8) * (1 - k * 0.8);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(tau * 6 + c);
      ctx.strokeStyle = alarm ? 'rgba(255,90,70,0.6)' : 'rgba(79,243,255,0.5)';
      ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      continue;
    }
    const lit = hash1(c * 7 + r * 13) > 0.85;
    ctx.strokeStyle = alarm && Math.floor(lt * 4) % 2 ? `rgba(255,70,60,${0.28 * b})` : `rgba(79,243,255,${(lit ? 0.38 : 0.2) * b})`;
    const h = (PANEL - 8) * b;
    wline(ctx, rectPts(x + 4, y + 4 + (PANEL - 8 - h) / 2, PANEL - 8, h), true);
    ctx.stroke();
    if (lit && b >= 1) {
      ctx.fillStyle = 'rgba(79,243,255,0.05)';
      ctx.fill();
    }
  }

  const struct = prog(lt, 0, 1.2, ease.outCubic);
  ctx.strokeStyle = alarm ? '#ff5a4a' : C.cyan;
  ctx.lineWidth = 4;
  // floor & ceiling & walls
  wline(ctx, [[W / 2 - (W / 2 - LEFT) * struct, FLOOR], [W / 2 + (RIGHT - W / 2) * struct, FLOOR]]); ctx.stroke();
  wline(ctx, [[W / 2 - (W / 2 - LEFT) * struct, CEIL], [W / 2 + (RIGHT - W / 2) * struct, CEIL]]); ctx.stroke();
  wline(ctx, [[LEFT, FLOOR], [LEFT, FLOOR - (FLOOR - CEIL) * struct]]); ctx.stroke();
  wline(ctx, [[RIGHT, FLOOR], [RIGHT, FLOOR - (FLOOR - CEIL) * struct]]); ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = alarm ? 'rgba(255,90,74,0.4)' : 'rgba(79,243,255,0.35)';
  for (let x = LEFT; x < LEFT + (RIGHT - LEFT) * struct; x += 40) {
    wline(ctx, [[x, FLOOR + 4], [x + 30, FLOOR + 34]]); ctx.stroke();
    wline(ctx, [[x, CEIL - 34], [x + 30, CEIL - 4]]); ctx.stroke();
  }

  // chamber sign
  const signA = clamp((lt - 0.8) / 0.5);
  if (signA > 0) {
    ctx.save();
    ctx.globalAlpha = signA;
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(2,10,16,0.85)';
    wline(ctx, rectPts(190, 210, 250, 300), true); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (WARP < 0.3) {
      text(ctx, '07', 315, 345, { font: F.display(120), color: C.cyan, align: 'center', alpha: signA, glow: 12 });
      text(ctx, 'CELESTIAL', 315, 395, { font: F.mono(22), color: '#bfefff', align: 'center', alpha: signA, spacing: 3 });
      text(ctx, 'CALIBRATION', 315, 422, { font: F.mono(22), color: '#bfefff', align: 'center', alpha: signA, spacing: 3 });
      const n = Math.min(items.length, 3);
      items.forEach((b, i) => {
        const done = (i === 0 && lt > T.fire1[1]) || (i === 1 && lt > gHit) || (i === 2 && lt > T.collapse);
        drawIcon(ctx, b.icon, 255 + i * 60, 470, 18, t, done ? b.color : 'rgba(120,150,170,0.7)', signA);
      });
      void n;
    }
  }

  // observation window with the AI
  const winA = clamp((lt - 1.0) / 0.5);
  if (winA > 0) {
    ctx.save();
    ctx.globalAlpha = winA;
    ctx.fillStyle = 'rgba(2,8,14,0.9)';
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 3;
    wline(ctx, rectPts(1430, 200, 300, 170), true); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (WARP < 0.4) {
      const red = lt > T.alarm ? 1 : 0;
      ctx.save();
      ctx.beginPath(); ctx.rect(1432, 202, 296, 166); ctx.clip();
      drawEye(ctx, 1580, 285, 46, t, { red, alpha: winA, talk: 0 });
      ctx.restore();
      ctx.strokeStyle = `rgba(200,240,255,${0.25 * winA})`;
      ctx.lineWidth = 2;
      for (const o of [40, 70, 200]) { ctx.beginPath(); ctx.moveTo(1430 + o, 370); ctx.lineTo(1430 + o + 60, 200); ctx.stroke(); }
      if (lt > 29.5) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.5;
        for (let k = 0; k < 9; k++) {
          const a = hash1(k * 5) * TAU, l = 40 + hash1(k) * 120;
          ctx.beginPath(); ctx.moveTo(1520, 260); ctx.lineTo(1520 + Math.cos(a) * l, 260 + Math.sin(a) * l * 0.6); ctx.stroke();
        }
      }
    }
    text(ctx, 'OBSERVATION', 1580, 395, { font: F.mono(18), color: C.cyan, align: 'center', alpha: winA * 0.7 * (WARP < 0.4 ? 1 : 0), spacing: 3 });
  }

  // doors
  const doorK = prog(lt, T.doorOpen, T.doorOpen + 0.5, ease.inOutCubic) * (1 - prog(lt, 7.0, 7.5, ease.inOutCubic));
  ctx.strokeStyle = C.cyan; ctx.lineWidth = 3; ctx.fillStyle = '#04121a';
  const door = (x0) => {
    const dw = 140, dh = 230, half = dw / 2;
    wline(ctx, rectPts(x0 - 8, FLOOR - dh - 8, dw + 16, dh + 8), true); ctx.stroke();
    const o = doorK * half;
    if (x0 > 1000) { wline(ctx, rectPts(x0, FLOOR - dh, half, dh), true); ctx.fill(); ctx.stroke(); wline(ctx, rectPts(x0 + half, FLOOR - dh, half, dh), true); ctx.fill(); ctx.stroke(); return; }
    wline(ctx, rectPts(x0 - o, FLOOR - dh, half, dh), true); ctx.fill(); ctx.stroke();
    wline(ctx, rectPts(x0 + half + o, FLOOR - dh, half, dh), true); ctx.fill(); ctx.stroke();
  };
  if (struct >= 1) { door(190); door(1590); }

  // pedestal
  const pedA = clamp((lt - 1.4) / 0.5);
  if (pedA > 0) {
    ctx.save(); ctx.globalAlpha = pedA;
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 3; ctx.fillStyle = '#04121a';
    wline(ctx, [[930, FLOOR], [940, 770], [1020, 770], [1030, FLOOR]], true); ctx.fill(); ctx.stroke();
    wline(ctx, rectPts(920, 762, 120, 10), true); ctx.stroke();
    ctx.restore();
  }

  // ── subject ────────────────────────────────────────────────────────────
  let px = 260, walk = 0;
  if (lt > T.walkIn[0]) { const k = prog(lt, T.walkIn[0], T.walkIn[1]); px = lerp(260, 820, k); walk = k < 1 ? lt * 9 : 0; }
  if (lt > T.grab[0]) { const k = prog(lt, T.grab[0], T.grab[0] + 0.6); px = lerp(820, 880, k); walk = k < 1 ? lt * 9 : 0; }
  let lean = 0;
  if (lt > T.bhSpawn) { const k = ease.inCubic(prog(lt, T.bhSpawn, T.collapse)); px += k * 140; lean = -0.25 * k; walk = lt * 14 * k; }
  let armA = null;
  const REST = Math.PI / 2.4, UP = Math.PI * 0.9;
  if (lt > T.grab[0] + 0.5 && lt < T.grab[1]) armA = lerp(0, REST, prog(lt, T.grab[0] + 0.5, T.grab[1] - 0.2));
  if (lt > T.grab[1]) armA = REST;
  // Sunspear: raised to the sky
  if (lt > T.aim1 - 0.3 && lt < T.swap2) armA = lerp(lerp(REST, UP, prog(lt, T.aim1 - 0.3, T.aim1, ease.outCubic)), REST, prog(lt, T.fire1[1] + 0.2, T.fire1[1] + 0.7));
  // Apophis Hammer: wind up overhead, slam
  if (lt > T.grav - 0.7 && lt < T.swap3) {
    armA = lt < T.grav - 0.15 ? lerp(REST, Math.PI * 0.97, prog(lt, T.grav - 0.7, T.grav - 0.15, ease.outCubic))
      : lerp(lerp(Math.PI * 0.97, Math.PI * 0.22, prog(lt, T.grav - 0.15, T.grav, ease.inCubic)), REST, prog(lt, 21.6, 22.2));
  }
  // The uplink: held out
  if (lt > T.swap3 + 1.0) armA = lerp(REST, Math.PI / 2, prog(lt, T.swap3 + 1.0, T.swap3 + 1.4));

  // subject + entry fade
  const subA = clamp((lt - T.walkIn[0] + 0.3) / 0.3);
  const hand = figure(ctx, px, FLOOR, { face: 1, walk, armA, alpha: subA, lean });

  // held item / orb
  let itemIdx = lt < T.swap2 ? 0 : lt < T.swap3 ? 1 : 2;
  const item = items[itemIdx];
  let ix = 980, iy = 740 - prog(lt, T.itemUp[0], T.itemUp[1], ease.outCubic) * 50 + Math.sin(t * 2) * 6;
  const held = lt > T.grab[1] - 0.2;
  if (held && hand) {
    const k = prog(lt, T.grab[1] - 0.2, T.grab[1], ease.outCubic);
    ix = lerp(ix, hand[0], k); iy = lerp(iy, hand[1], k);
  }
  if (lt > T.itemUp[0] - 0.4 && lt < T.white) {
    const swapFlash = (lt > T.swap2 && lt < T.swap2 + 0.3) || (lt > T.swap3 && lt < T.swap3 + 0.3);
    if (swapFlash) glow(ctx, ix, iy, 120, item.color, 0.9);
    const ang = held && armA != null ? armA : Math.PI; // direction the arm points (0 = down)
    heldItem(ctx, itemIdx, ix, iy, ang, t, item.color);
    if (lt > T.itemUp[0] && lt < T.aim1 + 0.5 || (lt > T.swap2 && lt < T.swap2 + 2) || (lt > T.swap3 && lt < T.swap3 + 1.8)) {
      const la = lt < T.swap2 ? clamp((lt - T.itemUp[0]) / 0.3) * clamp((T.aim1 + 0.5 - lt) / 0.3) : lt < T.swap3 ? clamp((T.swap2 + 2 - lt) / 0.3) : clamp((T.swap3 + 1.8 - lt) / 0.3);
      corners(ctx, ix - 34, iy - 34, 68, 68, 14, item.color, la, 2);
      text(ctx, item.name, ix, iy - 52, { font: F.display(22, 700), color: '#fff', align: 'center', alpha: la, spacing: 2 });
      text(ctx, item.note, ix, iy + 64, { font: F.mono(18), color: item.color, align: 'center', alpha: la, spacing: 2 });
    }
  }

  // ── mobs ───────────────────────────────────────────────────────────────
  for (const m of mobs(lt)) {
    if (lt < m.s - 0.4) continue;
    const sp = lt - m.s;
    // spawn beam
    if (sp > -0.4 && sp < 0.4) {
      const a = 1 - Math.abs(sp) / 0.4;
      ctx.fillStyle = `rgba(93,255,122,${0.25 * a})`;
      ctx.fillRect(m.x0 - 40, CEIL, 80, FLOOR - CEIL);
      glow(ctx, m.x0, FLOOR - 100, 140, '#5dff7a', a * 0.6);
    }
    if (sp < 0) continue;
    let mx = m.x0 - Math.min(sp, 6) * 34;
    let my = FLOOR, rot = 0;
    if (m.kind === 'beam') {
      if (lt > m.k) { pixelBurst(ctx, mx, FLOOR, lt - m.k, m.id + 3, 1, '#ff9a30'); continue; }
    } else {
      mx = m.x0 - Math.min(sp, T.grav - m.s) * 34;
      const g = gravY(lt, FLOOR - 100, m.id);
      if (g.hit) { pixelBurst(ctx, mx, CEIL + 60, g.since, m.id + 7, 0, '#5dff7a', true); continue; }
      my = FLOOR + g.dy; rot = g.rot;
    }
    ctx.save();
    if (rot) { ctx.translate(mx, my - 100); ctx.rotate(rot); ctx.translate(-mx, -(my - 100)); }
    figure(ctx, mx, my, { face: -1, walk: sp * 6, zombie: true, color: '#5dff7a', fill: '#06180a', alpha: clamp(sp / 0.3) });
    ctx.restore();
  }
  for (const c of cubes()) {
    if (lt < c.s) continue;
    const sp = lt - c.s;
    const g = gravY(lt, FLOOR - 35, c.id + 20);
    const fallBack = lt > 23.2 ? ease.inQuad(prog(lt, 23.2, 23.8)) : 0;
    const cy = FLOOR - 35 + g.dy * (1 - fallBack);
    testCube(ctx, c.x, cy, 70, g.rot * (1 - fallBack) + (g.hit ? 0.3 : 0), clamp(sp / 0.3) * (lt > T.collapse - 1 ? 1 - prog(lt, T.collapse - 1, T.collapse) : 1));
  }

  // ── Sunspear: a pillar of sunlight from the sky, walked across the hostiles ──
  if (hand && lt > T.aim1 && lt < T.fire1[0]) glow(ctx, hand[0], hand[1] - 60, 30 + prog(lt, T.aim1, T.fire1[0]) * 90, '#ffb040', prog(lt, T.aim1, T.fire1[0]));
  if (lt > T.fire1[0] && lt < T.fire1[1] + 0.3) {
    const kills = mobs(lt).filter((m) => m.kind === 'beam').map((m) => [m.k, m.x0 - Math.min(m.k - m.s, 6) * 34]);
    let bx = kills[0][1];
    for (let i = 0; i < kills.length - 1; i++) if (lt > kills[i][0]) bx = lerp(kills[i][1], kills[i + 1][1], prog(lt, kills[i][0], kills[i + 1][0], ease.inOutCubic));
    const k = prog(lt, T.fire1[0], T.fire1[0] + 0.1, ease.outExpo) * (1 - prog(lt, T.fire1[1] - 0.2, T.fire1[1] + 0.3));
    const wob = 1 + 0.15 * Math.sin(t * 70);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [w, a, c] of [[150, 0.22, '255,120,30'], [64, 0.45, '255,180,60'], [22, 1, '255,250,220']]) {
      ctx.fillStyle = `rgba(${c},${a * k})`;
      ctx.fillRect(bx - (w * wob) / 2, 0, w * wob, FLOOR);
    }
    ctx.strokeStyle = `rgba(255,220,140,${0.9 * k})`;
    ctx.lineWidth = 4;
    const ring = 60 + ((lt - T.fire1[0]) * 260) % 160;
    ctx.beginPath(); ctx.ellipse(bx, FLOOR, ring, ring * 0.18, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    glow(ctx, bx, FLOOR, 220 * k, '#ffb040', k);
    glow(ctx, bx, CEIL, 140 * k, '#fff0c0', k * 0.8);
  }
  // ── Apophis Hammer: the slam ──
  if (lt > T.grav - 0.05 && lt < T.grav + 2.2) {
    const k = lt - T.grav;
    const sx0 = px + 70;
    for (let i = 0; i < 3; i++) {
      const kk = k - i * 0.12;
      if (kk <= 0) continue;
      const rx = 40 + kk * 1400, a = clamp(1 - kk / 1.4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,${180 - i * 40},${110 - i * 30},${a * 0.9})`;
      ctx.lineWidth = 8 - i * 2;
      ctx.beginPath(); ctx.ellipse(sx0, FLOOR, rx, rx * 0.07, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    glow(ctx, sx0, FLOOR, 260 * clamp(1 - k / 0.6), '#ffb070', clamp(1 - k / 0.6));
    for (let j = 0; j < 24; j++) {
      const a = Math.PI + (j / 23) * Math.PI, sp = 300 + hash1(j * 7) * 500;
      const x = sx0 + Math.cos(a) * sp * k, y = FLOOR + Math.sin(a) * sp * k * 0.9 + 600 * k * k;
      ctx.fillStyle = `rgba(255,200,150,${clamp(1 - k / 1.2)})`;
      ctx.fillRect(x - 5, y - 5, 10, 10);
    }
  }
  // impact gauge
  if (lt > T.spawn2 && lt < T.alarm + 1) {
    const e = lt < T.grav ? 0 : Math.round(1200 * prog(lt, T.grav, T.grav + 0.5, ease.outCubic));
    const a = clamp((lt - T.spawn2) / 0.3) * clamp((T.alarm + 1 - lt) / 0.3);
    text(ctx, 'IMPACT ENERGY', 1640, 470, { font: F.mono(20), color: C.cyan, align: 'center', alpha: a, spacing: 2 });
    text(ctx, `${e.toLocaleString('en-US')} MT`, 1640, 530, { font: F.display(48), color: e > 0 ? '#ffb070' : '#ffffff', align: 'center', alpha: a, glow: 16, glowColor: C.orange });
  }

  // ── singularity ────────────────────────────────────────────────────────
  if (lt > T.bhSpawn) {
    const grow = prog(lt, T.bhSpawn, T.bhSpawn + 1.2, ease.outCubic);
    const coll = prog(lt, T.collapse, T.white, ease.inExpo);
    const R = 70 * grow * (1 + coll * 30);
    // in-falling streaks
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const ph = (lt * (0.4 + hash1(i) * 0.5) + hash1(i * 3)) % 1;
      const a = hash1(i * 7) * TAU + ph * 3;
      const r0 = (1 - ph) * 900 + R;
      ctx.strokeStyle = i % 3 ? `rgba(255,140,60,${ph * 0.6 * grow})` : `rgba(79,243,255,${ph * 0.6 * grow})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(BH.x, BH.y, r0, a, a + 0.25 + ph * 0.4);
      ctx.stroke();
    }
    ctx.restore();
    glow(ctx, BH.x, BH.y, R * 5, '#ff6a1a', grow * 0.6);
    ctx.save();
    ctx.translate(BH.x, BH.y);
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 10; k++) {
      ctx.strokeStyle = `rgba(255,${150 + k * 10},${60 + k * 15},${0.5 * grow})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, R * (1.5 + k * 0.25), R * (0.35 + k * 0.05), -0.2, lt * (3 - k * 0.2), lt * (3 - k * 0.2) + 4.2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(BH.x, BH.y, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,180,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(BH.x, BH.y, R * 1.03, 0, TAU); ctx.stroke();
  }
  ctx.restore();

  // ── HUD ────────────────────────────────────────────────────────────────
  const hdrA = clamp((lt - 0.5) / 0.4);
  if (lt < T.alarm) {
    const hdr = 'CELESTIAL TEST FACILITY  //  CHAMBER 07  //  COMBAT SIMULATION';
    text(ctx, hdr.slice(0, Math.floor((lt - 0.5) * 60)), W / 2, 112, { font: F.mono(24), color: C.cyan, align: 'center', alpha: hdrA, spacing: 3 });
  } else {
    const blink = Math.floor(lt * 4) % 2 ? 1 : 0.3;
    text(ctx, '!  WARNING: CHAMBER NOT RATED FOR SINGULARITY TESTING  !', W / 2, 112, { font: F.mono(26), color: C.red, align: 'center', alpha: blink, glow: 12, spacing: 2 });
    // hazard stripes
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (const y0 of [0, H - 34]) {
      ctx.beginPath(); ctx.rect(0, y0, W, 34); ctx.clip();
      for (let x = -60 + ((lt * 120) % 60); x < W + 60; x += 60) {
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.moveTo(x, y0 + 34); ctx.lineTo(x + 30, y0); ctx.lineTo(x + 60, y0); ctx.lineTo(x + 30, y0 + 34); ctx.fill();
      }
    }
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,30,20,${0.12 * (0.5 + 0.5 * Math.sin(lt * 9))})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const dot = Math.floor(lt * 2) % 2 ? 1 : 0.25;
  ctx.fillStyle = C.red; ctx.globalAlpha = dot * hdrA;
  ctx.beginPath(); ctx.arc(90, 64, 9, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  text(ctx, 'SIMULATION', 110, 72, { font: F.mono(24), color: '#ffffff', alpha: hdrA, spacing: 3 });
  const hostiles = lt < T.spawn1[0] ? 0 : lt < T.fire1[0] ? T.spawn1.filter((s) => lt > s).length : lt < 13.85 ? 3 - Math.floor((lt - 13.25) / 0.2 + 1) : lt < T.spawn2 ? 0 : lt < T.grav + 1.15 ? 2 : 0;
  text(ctx, `HOSTILES: ${Math.max(0, hostiles)}`, W - 90, 72, { font: F.mono(24), color: hostiles > 0 ? '#5dff7a' : C.cyan, align: 'right', alpha: hdrA, spacing: 3 });

  aiLines(ctx, tr.script.sim, lt, frame, { y: 990, size: 40 });
  scanlines(ctx, 0.05);

  return {
    flash: lt > T.white ? 1 : (lt > T.fire1[0] && lt < T.fire1[0] + 0.15 ? 0.35 : 0) + (lt > gHit && lt < gHit + 0.15 ? 0.25 : 0),
    flashColor: lt > T.fire1[1] && lt < T.white ? '#c9d6ff' : '#ffffff',
    glitch: (lt > T.white - 0.5 && lt < T.white) ? 0.8 : lt > T.bhSpawn && hash1(frame) > 0.85 ? 0.4 : 0,
  };
}

function endCard(ctx, S) {
  const { lt, tr } = S;
  const k = lt - T.card;
  const rows = [
    ['HOSTILES ELIMINATED', '100%', '#5dff7a'],
    ['CHAMBER INTEGRITY', '0%', C.red],
    ['TEST SUBJECT', 'MOSTLY INTACT', '#ffd23f'],
    ['RESULT', 'ACCEPTABLE', C.cyan],
  ];
  text(ctx, 'SIMULATION TERMINATED', W / 2, 330, { font: F.display(72), color: C.red, align: 'center', alpha: clamp(k / 0.15), glow: 26, spacing: 8 });
  rows.forEach(([a, b, col], i) => {
    const s = 0.35 + i * 0.42;
    if (k < s) return;
    const y = 470 + i * 70;
    text(ctx, a, 520, y, { font: F.mono(36), color: '#a9c6d6' });
    text(ctx, '.'.repeat(18), 520 + a.length * 18 + 20, y, { font: F.mono(36), color: '#2a4c5c' });
    text(ctx, b, 1400, y, { font: F.mono(36), color: col, align: 'right', glow: 10, alpha: clamp((k - s) / 0.1) });
  });
  return {
    flash: clamp(1 - k / 0.5),
    glitch: k > 2.15 ? 0.9 : k < 0.1 ? 0.6 : 0,
  };
}
