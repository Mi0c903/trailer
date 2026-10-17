// Cinematic renderers for each celestial body type.
// drawBody(ctx, type, cx, cy, R, t, color) — t is seconds into the 6s showcase;
// the "power moment" triggers at POWER_AT.
import { TAU, clamp, lerp, rng, noise1, noise2, fbm2, hexToRgb, rgba, ramp, makeCanvas, ease, invLerp, hash1 } from './util.js';
import { glow, flash, W, H, C } from './draw.js';
import { drawSphere, texture } from './sphere.js';
import { drawBlock } from './blocks.js';

export const POWER_AT = 3.0;

// ── helpers ────────────────────────────────────────────────────────────────
function particles(seed, n, fn) {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => fn(r, i));
}

export function boltPoints(x1, y1, x2, y2, seed, depth = 6, rough = 0.28) {
  const r = rng(seed);
  let pts = [[x1, y1], [x2, y2]];
  let disp = Math.hypot(x2 - x1, y2 - y1) * rough;
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
      const o = (r() - 0.5) * 2 * disp;
      next.push([mx + (nx / nl) * o, my + (ny / nl) * o], pts[i + 1]);
    }
    pts = next;
    disp *= 0.52;
  }
  return pts;
}

export function drawBolt(ctx, pts, color, width = 3, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const passes = [[width * 6, 0.12], [width * 2.5, 0.35], [width, 1]];
  for (const [w, a] of passes) {
    ctx.globalAlpha = alpha * a;
    ctx.strokeStyle = a === 1 ? '#ffffff' : color;
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  ctx.restore();
}

function shockRing(ctx, x, y, r, width, color, alpha, flat = 1) {
  if (alpha <= 0 || r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp(alpha);
  ctx.strokeStyle = color;
  for (const [w, a] of [[width * 3, 0.25], [width, 0.9]]) {
    ctx.globalAlpha = clamp(alpha) * a;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * flat, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

// ── SUN (Helios Lance: a Dyson mirror ring focuses the Sun into a lance) ───
const sunLance = particles(11, 260, (r) => ({ a: (r() - 0.5), v: 0.3 + r() * 1.0, s: 8 + r() * 30, d: r() * 0.6, c: r() }));
const LANCE_DIR = Math.PI * 0.4; // down, one column of the world
function mirrorRing(ctx, cx, cy, R, t, front, focus) {
  const n = 56, rx = R * 1.6, ry = R * 0.42, tilt = -0.22;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + t * 0.12;
    const s = Math.sin(a);
    if ((s > 0) !== front) continue;
    const lx = Math.cos(a) * rx, ly = s * ry;
    const x = cx + lx * ct - ly * st, y = cy + lx * st + ly * ct;
    const glint = Math.pow(Math.max(0, Math.cos(a * 2 - t * 1.5)), 12);
    const lit = clamp(glint + focus);
    const w = R * 0.07 * (0.75 + 0.25 * Math.abs(Math.cos(a))), h = R * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt + Math.atan2(Math.cos(a) * ry, -s * rx) * 0.15);
    ctx.fillStyle = `rgb(${40 + lit * 215 | 0},${36 + lit * 190 | 0},${30 + lit * 120 | 0})`;
    ctx.strokeStyle = 'rgba(255,220,150,0.6)';
    ctx.lineWidth = 1;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();
    if (lit > 0.3) glow(ctx, x, y, R * 0.12 * (1 + lit), '#ffd68a', lit * 0.7);
  }
  // ring frame
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  ctx.strokeStyle = `rgba(255,200,120,${0.35 + focus * 0.4})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
  ctx.stroke();
  ctx.restore();
}
function sun(ctx, cx, cy, R, t) {
  const tp = t - POWER_AT;
  const focus = clamp((tp + 0.8) / 0.8);
  glow(ctx, cx, cy, R * 3.6, '#ff6a10', 0.5);
  glow(ctx, cx, cy, R * 2.1, '#ffb040', 0.75);
  // corona streamers
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU + t * 0.03 + Math.sin(i * 7.3) * 0.1;
    const len = R * (1.25 + 1.3 * Math.pow(noise1(i * 3.7 + t * 0.4), 2));
    ctx.fillStyle = 'rgba(255,170,70,0.07)';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - 0.06) * R * 0.95, cy + Math.sin(a - 0.06) * R * 0.95);
    ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    ctx.lineTo(cx + Math.cos(a + 0.06) * R * 0.95, cy + Math.sin(a + 0.06) * R * 0.95);
    ctx.fill();
  }
  ctx.restore();
  mirrorRing(ctx, cx, cy, R, t, false, focus);
  drawSphere(ctx, cx, cy, R, texture('sun'), { rot: t * 0.06, emissive: true, gain: 1.3, rim: [255, 200, 120], rimPow: 4, rimStrength: 0.6 });
  glow(ctx, cx, cy, R * 1.25, '#fff2c8', 0.3, 0.01);
  // prominences
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let k = 1; k < 5; k++) {
    const base = hash1(k * 19) * TAU;
    const span = 0.06 + 0.1 * hash1(k * 7) + 0.03 * noise1(k * 4 + t * 0.5);
    const hgt = R * (0.08 + 0.25 * hash1(k * 3) + 0.08 * noise1(k * 9 + t * 0.7));
    const a0 = base - span, a1 = base + span;
    const p0 = [cx + Math.cos(a0) * R * 0.97, cy + Math.sin(a0) * R * 0.97];
    const p1 = [cx + Math.cos(a1) * R * 0.97, cy + Math.sin(a1) * R * 0.97];
    const cpd = R + hgt * 1.6;
    const c0 = [cx + Math.cos(a0 - 0.08) * cpd, cy + Math.sin(a0 - 0.08) * cpd];
    const c1 = [cx + Math.cos(a1 + 0.08) * cpd, cy + Math.sin(a1 + 0.08) * cpd];
    for (let strand = 0; strand < 3; strand++) {
      const off = (strand - 1) * R * 0.03 * (1 + noise1(t * 2 + k + strand));
      for (const [w, a, col] of [[R * 0.05, 0.12, '#ff5a10'], [R * 0.02, 0.35, '#ff9a30'], [R * 0.007, 0.8, '#ffe2a0']]) {
        ctx.globalAlpha = a;
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(...p0);
        ctx.bezierCurveTo(c0[0] + off, c0[1] - off, c1[0] - off, c1[1] + off, ...p1);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
  // the lance
  if (tp > 0) {
    const k = ease.outExpo(clamp(tp / 0.25)), fade = clamp(2.9 - tp);
    const wob = 1 + 0.12 * Math.sin(t * 50);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(LANCE_DIR);
    ctx.globalCompositeOperation = 'lighter';
    for (const [wd, a, col] of [[R * 1.1, 0.16, '255,120,30'], [R * 0.5, 0.35, '255,180,70'], [R * 0.16, 0.9, '255,250,225']]) {
      const g = ctx.createLinearGradient(0, 0, 2400, 0);
      g.addColorStop(0, `rgba(${col},${a * fade})`);
      g.addColorStop(1, `rgba(${col},${a * 0.4 * fade})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(R * 0.6, (-wd / 2) * 0.6 * k * wob);
      ctx.lineTo(2600 * k, (-wd / 2) * k * wob);
      ctx.lineTo(2600 * k, (wd / 2) * k * wob);
      ctx.lineTo(R * 0.6, (wd / 2) * 0.6 * k * wob);
      ctx.fill();
    }
    ctx.restore();
    for (const p of sunLance) {
      const tt = tp - p.d * 0.5;
      if (tt <= 0) continue;
      const a = LANCE_DIR + p.a * 0.1;
      const dist = R + p.v * 2200 * (1 - Math.exp(-tt * 1.6));
      const col = p.c < 0.3 ? '#fff0c0' : p.c < 0.7 ? '#ff9a30' : '#ff4a10';
      glow(ctx, cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, p.s * (1 + tt * 1.5), col, clamp(1.1 - tt * 0.35) * 0.8);
    }
    glow(ctx, cx, cy, R * (1.4 + k), '#fff2c8', 0.6 * fade);
    shockRing(ctx, cx, cy, R * (1.1 + tp * 1.6), 6, '#ffb050', clamp(1 - tp * 0.5) * 0.7);
  }
  mirrorRing(ctx, cx, cy, R, t, true, focus);
}

// ── MOON ───────────────────────────────────────────────────────────────────
const moonBlocks = particles(21, 40, (r) => ({ x: r() * W, d: r() * 1.4, s: 60 + r() * 80, spin: (r() - 0.5) * 4, sway: r() * TAU, kind: r() < 0.6 ? 'grass' : r() < 0.85 ? 'stone' : 'obsidian', v: 0.6 + r() * 0.8 }));
function moon(ctx, cx, cy, R, t) {
  const tp = t - POWER_AT;
  glow(ctx, cx, cy, R * 2.4, '#7f9cff', 0.25);
  // gravity rings (behind)
  const pulse = tp > 0 ? 1 : 0.25;
  for (let i = 0; i < 5; i++) {
    const ph = ((t * (tp > 0 ? 0.9 : 0.35) + i / 5) % 1);
    shockRing(ctx, cx, cy, R * (1.05 + ph * 2.2), 3, '#a9bcff', (1 - ph) * 0.5 * pulse, 0.9);
  }
  drawSphere(ctx, cx, cy, R, texture('moon'), { rot: t * 0.05, light: [0.75, -0.35, 0.56], ambient: 0.025, rim: [120, 150, 255], rimStrength: 0.35 });
  // blocks rise off the ground and settle into orbit around the moon
  for (const b of moonBlocks) {
    const tt = tp > 0 ? tp - b.d * 0.35 : -1;
    const lift = tt > 0 ? ease.inOutCubic(clamp(tt / (1.0 + b.v * 0.6))) : 0;
    const idleY = H + 30 - ((t * 18 * b.v + b.x) % 90);
    const oa = b.sway + t * 0.5 * (b.v > 1 ? 1 : -1);
    const orr = R * (1.25 + b.v * 0.45);
    const tx = cx + Math.cos(oa) * orr, ty = cy + Math.sin(oa) * orr * 0.42;
    const bx = lerp(b.x, tx, lift), by = lerp(idleY, ty, lift);
    const sz = b.s * lerp(1, 0.75, lift);
    const behind = lift > 0.9 && Math.sin(oa) < 0;
    const a = tt > 0 ? (behind ? 0.45 : 1) : clamp((H - idleY + 60) / 140) * 0.7;
    drawBlock(ctx, bx, by, sz, t * b.spin * (0.15 + lift * 0.5), b.kind, a);
  }
}

// ── STORM (gas giant + lightning) ──────────────────────────────────────────
function fluxTube(ctx, x1, y1, x2, y2, bend, t, a, seed) {
  // a glowing current along a magnetic field line, drawn as a curved bolt
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + bend;
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24, j = (hash1(Math.floor(t * 18) * 31 + i + seed) - 0.5) * 10 * Math.sin(u * Math.PI);
    pts.push([(1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * mx + u * u * x2 + j, (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * my + u * u * y2 + j]);
  }
  drawBolt(ctx, pts, '#ffcf6a', 2.5, a);
}
function storm(ctx, cx, cy, R, t) {
  const tp = t - POWER_AT;
  glow(ctx, cx, cy, R * 2.3, '#ff8a5c', 0.22);
  // Io, in front and to the left
  const ia = 0.55 + t * 0.06;
  const ix = cx + Math.cos(ia) * R * 1.75, iy = cy + Math.sin(ia) * R * 0.5 + R * 0.25, ir = R * 0.17;
  const ioFront = Math.sin(ia) > -0.2;
  const drawIo = () => {
    glow(ctx, ix, iy, ir * 2.2, '#ffcf6a', 0.35);
    drawSphere(ctx, ix, iy, ir, texture('io'), { rot: t * 0.3, light: [0.7, -0.3, 0.65], ambient: 0.05, res: 120 });
  };
  if (!ioFront) drawIo();
  drawSphere(ctx, cx, cy, R, texture('jupiter'), { rot: t * 0.09, tilt: 0.05, light: [-0.6, -0.25, 0.76], ambient: 0.03, rim: [255, 190, 150], rimStrength: 0.45 });
  // the flux tube: Io to Jupiter's poles
  const tubeA = 0.55 + 0.35 * Math.sin(t * 9) * Math.sin(t * 3.1) + (tp > -0.6 ? 0.5 : 0);
  fluxTube(ctx, ix, iy, cx - R * 0.15, cy - R * 0.97, -R * 0.6, t, clamp(tubeA), 1);
  fluxTube(ctx, ix, iy, cx - R * 0.15, cy + R * 0.97, R * 0.4, t, clamp(tubeA), 2);
  if (ioFront) drawIo();
  // storm flashes on the disk
  for (let i = 0; i < 10; i++) {
    const slot = Math.floor(t * 6 + i * 13.7);
    if (hash1(slot * 31 + i) < 0.55) continue;
    const a = hash1(slot * 7 + i) * TAU, rr = Math.sqrt(hash1(slot * 3 + i)) * R * 0.85;
    glow(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, R * 0.12, '#c8e0ff', 0.55);
  }
  if (tp > 0) {
    const k = clamp(tp / 0.3);
    // crown of arcs
    const frame = Math.floor(t * 14);
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * TAU + t * 0.6, a1 = a0 + 0.5;
      const pts = boltPoints(cx + Math.cos(a0) * R * 1.05, cy + Math.sin(a0) * R * 1.05, cx + Math.cos(a1) * R * 1.05, cy + Math.sin(a1) * R * 1.05, frame * 100 + i, 5, 0.35);
      drawBolt(ctx, pts, '#9fc8ff', 2, 0.8 * k);
    }
    // the current, earthed: bolts out of Io and Jupiter to the edges of the screen
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * (0.12 + i * 0.12) + Math.sin(t * 2 + i) * 0.05;
      const pts = boltPoints(ix, iy, ix + Math.cos(a) * 1500, iy + Math.sin(a) * 1500, frame * 11 + i * 777, 7, 0.2);
      drawBolt(ctx, pts, '#ffcf6a', 5, (hash1(frame * 5 + i) > 0.2 ? 1 : 0.3) * k * clamp(2.6 - tp * 0.6));
    }
    glow(ctx, ix, iy, ir * 5 * k, '#fff0c0', clamp(2.6 - tp * 0.6));
    for (let i = 0; i < 7; i++) {
      const seedA = hash1(i * 17) * TAU;
      const a = seedA + Math.sin(t + i) * 0.1;
      const tx = cx + Math.cos(a) * 2200, ty = cy + Math.sin(a) * 2200;
      const pts = boltPoints(cx + Math.cos(a) * R, cy + Math.sin(a) * R, tx, ty, frame * 7 + i * 1000, 7, 0.22);
      const on = hash1(frame * 3 + i) > 0.25 ? 1 : 0.2;
      drawBolt(ctx, pts, '#7fb0ff', 4, on * k * clamp(2.6 - tp * 0.6));
    }
    if (hash1(Math.floor(t * 14)) > 0.6) flash(ctx, 0.12 * clamp(2.5 - tp * 0.7), '#bcd6ff');
  }
}

// ── RINGED (rings become blades) ───────────────────────────────────────────
let ringTex;
function ringTexture() {
  if (ringTex) return ringTex;
  const S = 1024, c = makeCanvas(S, S), g = c.getContext('2d');
  const img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const r = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
    const i = (y * S + x) * 4;
    if (r < 0.5 || r > 1) { d[i + 3] = 0; continue; }
    let a = 0.35 + 0.65 * noise1(r * 90) * (0.6 + 0.4 * noise1(r * 13));
    if (r > 0.78 && r < 0.81) a *= 0.08; // Cassini division
    a *= clamp((r - 0.5) / 0.04) * clamp((1 - r) / 0.03);
    const col = ramp([[0.5, [150, 130, 100]], [0.7, [235, 215, 170]], [0.85, [210, 190, 150]], [1, [180, 160, 130]]], r);
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = a * 235;
  }
  g.putImageData(img, 0, 0);
  ringTex = c;
  return c;
}
const blades = particles(31, 30, (r, i) => ({ a: (i / 30) * TAU + r() * 0.1, rr: 0.62 + r() * 0.36, v: 0.7 + r() * 0.8, spin: (r() < 0.5 ? -1 : 1) * (5 + r() * 6), s: 0.8 + r() * 0.6 }));
function ringed(ctx, cx, cy, R, t) {
  const tp = t - POWER_AT;
  const tilt = -0.32, flat = 0.27, RO = R * 2.35;
  const ringAlpha = tp > 0 ? clamp(1 - tp * 2.5) : 1;
  glow(ctx, cx, cy, R * 2.2, '#ffd98a', 0.18);
  const drawRing = (front) => {
    if (ringAlpha <= 0) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.beginPath();
    if (front) ctx.rect(-RO * 1.1, 0, RO * 2.2, RO);
    else ctx.rect(-RO * 1.1, -RO, RO * 2.2, RO);
    ctx.clip();
    ctx.scale(1, flat);
    ctx.rotate(t * 0.05);
    ctx.globalAlpha = ringAlpha;
    ctx.drawImage(ringTexture(), -RO, -RO, RO * 2, RO * 2);
    ctx.restore();
  };
  drawRing(false);
  drawSphere(ctx, cx, cy, R, texture('saturn'), { rot: t * 0.07, tilt: tilt, light: [-0.55, -0.4, 0.73], ambient: 0.03, rim: [255, 230, 180], rimStrength: 0.35 });
  drawRing(true);
  if (tp > -0.2) {
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    for (const b of blades) {
      const tt = Math.max(0, tp);
      const out = 1 + b.v * ease.inQuad(clamp(tt / 2.8)) * 3.2;
      const a = b.a + t * 0.05 + tt * 0.3;
      const lx = Math.cos(a) * RO * b.rr * out, ly = Math.sin(a) * RO * b.rr * out * flat * (1 + tt * 0.6);
      const x = cx + lx * ct - ly * st, y = cy + lx * st + ly * ct;
      const s = R * 0.2 * b.s * (1 + tt * 0.6);
      const al = clamp((tp + 0.2) / 0.3) * clamp(3 - tt);
      glow(ctx, x, y, s * 1.8, '#ffd98a', al * 0.45);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * b.spin);
      ctx.globalAlpha = al;
      // crescent blade
      const bg = ctx.createLinearGradient(0, -s, s, s);
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(0.5, '#ffe6a8');
      bg.addColorStop(1, '#c79a4a');
      ctx.fillStyle = bg;
      ctx.strokeStyle = '#fff6dc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, s, -1.25, 1.25);
      ctx.quadraticCurveTo(s * 1.25, 0, Math.cos(-1.25) * s, Math.sin(-1.25) * s);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ── PULSAR ─────────────────────────────────────────────────────────────────
function rotX(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; }
function rotY(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; }
function pulsar(ctx, cx, cy, R, t) {
  const tp = t - POWER_AT;
  const alpha = 0.55; // magnetic inclination
  const phi = t * 2.4 + (tp > 0 ? 0 : 0);
  const view = (p) => rotX(rotY(p, phi), 0.42);
  const m = view([Math.sin(alpha), Math.cos(alpha), 0]);
  // field lines
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 1.6;
  for (const L of [R * 0.9, R * 1.6]) {
    for (let k = 0; k < 10; k++) {
      const psi = (k / 10) * TAU;
      ctx.strokeStyle = `rgba(110,200,255,${L < R ? 0.45 : 0.25})`;
      ctx.beginPath();
      for (let j = 0; j <= 40; j++) {
        const th = 0.12 + (j / 40) * (Math.PI - 0.24);
        const rr = L * Math.sin(th) ** 2;
        // in the magnetic frame: axis = y
        let p = [rr * Math.sin(th) * Math.cos(psi), rr * Math.cos(th), rr * Math.sin(th) * Math.sin(psi)];
        // tilt magnetic frame by alpha around z
        p = [p[0] * Math.cos(alpha) + p[1] * Math.sin(alpha), -p[0] * Math.sin(alpha) + p[1] * Math.cos(alpha), p[2]];
        p = view(p);
        const x = cx + p[0], y = cy - p[1];
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
  // beams
  const beamAlpha = tp > 0 ? clamp(1 - tp * 3) : 1;
  for (const sgn of [1, -1]) {
    const dx = m[0] * sgn, dy = -m[1] * sgn;
    const pl = Math.hypot(dx, dy);
    if (beamAlpha <= 0) break;
    const len = 1500 * pl;
    const ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.globalCompositeOperation = 'lighter';
    for (const [wd, a] of [[220, 0.18], [90, 0.35], [26, 0.8]]) {
      const g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, `rgba(230,250,255,${a * beamAlpha})`);
      g.addColorStop(0.4, `rgba(120,200,255,${a * 0.6 * beamAlpha})`);
      g.addColorStop(1, 'rgba(80,150,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -wd * 0.06);
      ctx.lineTo(len, -wd * 0.5 * pl - 4);
      ctx.lineTo(len, wd * 0.5 * pl + 4);
      ctx.lineTo(0, wd * 0.06);
      ctx.fill();
    }
    ctx.restore();
  }
  // core
  const lighthouse = Math.pow(Math.abs(m[2]), 10) * beamAlpha;
  glow(ctx, cx, cy, R * 2.6, '#4fa8ff', 0.35 + lighthouse * 0.4);
  glow(ctx, cx, cy, R * 0.9, '#bfe6ff', 0.9);
  glow(ctx, cx, cy, R * 0.35, '#ffffff', 1, 0.4);
  if (lighthouse > 0.05) flash(ctx, lighthouse * 0.35, '#cfeaff');
  // LANCE
  if (tp > 0) {
    const k = ease.outExpo(clamp(tp / 0.25));
    const fade = clamp(2.9 - tp);
    const wob = 1 + 0.15 * Math.sin(t * 60);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI + 0.12);
    ctx.globalCompositeOperation = 'lighter';
    for (const [wd, a, col] of [[260, 0.25, '80,160,255'], [110, 0.5, '140,210,255'], [36, 1, '255,255,255']]) {
      ctx.fillStyle = `rgba(${col},${a * fade})`;
      ctx.fillRect(0, (-wd / 2) * k * wob, 2600 * k, wd * k * wob);
    }
    for (let i = 0; i < 6; i++) {
      const ph = (tp * 1.6 + i / 6) % 1;
      ctx.strokeStyle = `rgba(180,230,255,${(1 - ph) * 0.8 * fade})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(ph * 1600, 0, 30 + ph * 40, 120 + ph * 160, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    glow(ctx, cx, cy, R * 3 * k, '#e0f4ff', fade);
  }
}

// ── SUPERNOVA ──────────────────────────────────────────────────────────────
const ejecta = particles(41, 420, (r) => ({ a: r() * TAU, v: 0.25 + Math.pow(r(), 0.6) * 0.9, s: 5 + r() * 22, c: r(), w: (r() - 0.5) * 0.3 }));
function supernova(ctx, cx, cy, R, t) {
  const tp = t - POWER_AT;
  if (tp < 0) {
    const collapse = ease.inExpo(clamp((t - 2.45) / 0.55));
    const unstable = clamp(t / 2.4);
    const rr = R * (1 + 0.035 * Math.sin(t * 3.1) + 0.02 * unstable * Math.sin(t * 23)) * (1 - collapse * 0.93);
    glow(ctx, cx, cy, rr * 3, '#ff3a10', 0.45 + collapse * 0.5);
    glow(ctx, cx, cy, rr * 1.8, collapse > 0.3 ? '#ffffff' : '#ff7a30', 0.55 + collapse * 0.5);
    drawSphere(ctx, cx, cy, Math.max(4, rr), texture('giant'), { rot: t * 0.05, emissive: true, gain: 1.25 + collapse * 2.5 + unstable * 0.2, rim: [255, 120, 60], rimStrength: 0.7 });
    glow(ctx, cx, cy, rr * 1.2, '#ffb080', 0.25 + collapse * 0.5, 0.01);
    if (collapse > 0) {
      // in-falling streaks
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,220,200,${collapse * 0.6})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 60; i++) {
        const a = hash1(i * 9) * TAU, d0 = R * (1.2 + hash1(i) * 2.5) * (1 - collapse);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0);
        ctx.lineTo(cx + Math.cos(a) * (d0 + 120), cy + Math.sin(a) * (d0 + 120));
        ctx.stroke();
      }
      ctx.restore();
    }
    return;
  }
  // detonation
  const shell = 1 - Math.exp(-tp * 1.7);
  glow(ctx, cx, cy, R * (1.5 + shell * 6), '#ff4fa3', clamp(1.2 - tp * 0.3) * 0.7);
  glow(ctx, cx, cy, R * (0.8 + shell * 3), '#9fd0ff', clamp(1.2 - tp * 0.35) * 0.8);
  for (const p of ejecta) {
    const d = p.v * 1250 * shell;
    const a = p.a + p.w * shell;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.92;
    const col = p.c < 0.35 ? '#ff4fa3' : p.c < 0.6 ? '#7fd8ff' : p.c < 0.85 ? '#ffb050' : '#ffffff';
    glow(ctx, x, y, p.s * (1 + tp * 1.2), col, clamp(1.3 - tp * 0.32) * 0.75);
  }
  // filaments
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const a = hash1(i * 13) * TAU;
    const d1 = R * 0.3 + shell * 900 * (0.5 + hash1(i * 5) * 0.6);
    ctx.strokeStyle = `rgba(255,170,220,${clamp(1 - tp * 0.3) * 0.25})`;
    ctx.lineWidth = 2 + hash1(i) * 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * d1 * 0.4, cy + Math.sin(a) * d1 * 0.4);
    ctx.lineTo(cx + Math.cos(a) * d1, cy + Math.sin(a) * d1);
    ctx.stroke();
  }
  ctx.restore();
  shockRing(ctx, cx, cy, 60 + tp * 1300, 10, '#ffffff', clamp(1 - tp * 0.45));
  shockRing(ctx, cx, cy, 40 + tp * 800, 6, '#ff9ad0', clamp(1 - tp * 0.4) * 0.8);
  // remnant
  glow(ctx, cx, cy, 70 + 20 * Math.sin(t * 20), '#ffffff', 0.9);
  flash(ctx, clamp(1 - tp / 0.35), '#ffffff');
}

// ── BLACK HOLE ─────────────────────────────────────────────────────────────
let lensSrc, lensC, lensImg;
function lensSource() {
  if (lensSrc) return lensSrc;
  const S = 512, d = new Uint8ClampedArray(S * S * 3), r = rng(77);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = fbm2(x / 90, y / 90, 4);
    const v = clamp((n - 0.45) * 2.5) ** 2;
    const i = (y * S + x) * 3;
    d[i] = 60 * v; d[i + 1] = 30 * v; d[i + 2] = 70 * v;
  }
  for (let k = 0; k < 1400; k++) {
    const x = (r() * S) | 0, y = (r() * S) | 0, b = 120 + r() * 135, big = r() < 0.08;
    for (let oy = big ? -1 : 0; oy <= (big ? 1 : 0); oy++) for (let ox = big ? -1 : 0; ox <= (big ? 1 : 0); ox++) {
      const i = ((((y + oy) & 511) * S) + ((x + ox) & 511)) * 3;
      const f = ox || oy ? 0.45 : 1;
      d[i] = Math.max(d[i], b * f); d[i + 1] = Math.max(d[i + 1], b * f * 0.95); d[i + 2] = Math.max(d[i + 2], b * f);
    }
  }
  lensSrc = { S, d };
  return lensSrc;
}
function drawLens(ctx, cx, cy, Q, S, t) {
  const M = 300;
  if (!lensC) { lensC = makeCanvas(M, M); lensImg = lensC.getContext('2d').createImageData(M, M); }
  const src = lensSource(), sd = src.d, SS = src.S;
  const d = lensImg.data;
  const E2 = (S * 1.7) ** 2;
  const scale = (2 * Q) / M;
  const drift = t * 6;
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const dx = (x + 0.5) * scale - Q, dy = (y + 0.5) * scale - Q;
    const r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
    const o = (y * M + x) * 4;
    if (r > Q) { d[o + 3] = 0; continue; }
    if (r < S) { d[o] = d[o + 1] = d[o + 2] = 0; d[o + 3] = 255; continue; }
    const k = 1 - E2 / r2;
    const sx = ((((dx * k) * 0.35 + drift + 256) | 0) & 511), sy = ((((dy * k) * 0.35 + 256) | 0) & 511);
    const i = (sy * SS + sx) * 3;
    const boost = 1 + 1.5 * Math.exp(-(r - S) / (S * 0.15));
    d[o] = sd[i] * boost; d[o + 1] = sd[i + 1] * boost; d[o + 2] = sd[i + 2] * boost;
    d[o + 3] = 255 * clamp((Q - r) / (Q * 0.3));
  }
  lensC.getContext('2d').putImageData(lensImg, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lensC, cx - Q, cy - Q, Q * 2, Q * 2);
  ctx.restore();
}
const diskTemp = [[0, [255, 250, 235]], [0.25, [255, 210, 130]], [0.6, [255, 120, 30]], [1, [150, 30, 5]]];
function diskArcs(ctx, cx, cy, S, t, front, gain = 1, tilt = -0.1) {
  const rings = 16, segs = 40, flat = 0.17;
  const r0 = S * 1.55, r1 = S * 4.3;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'butt';
  for (let k = 0; k < rings; k++) {
    const f = k / (rings - 1);
    const a = lerp(r0, r1, f);
    const col = ramp(diskTemp, f);
    const speed = 2.2 / Math.pow(0.4 + f, 1.5);
    ctx.lineWidth = ((r1 - r0) / rings) * 1.25 * flat * 2.2 + 1;
    for (let s = 0; s < segs; s++) {
      const th0 = (front ? 0 : Math.PI) + (s / segs) * Math.PI;
      const th1 = th0 + Math.PI / segs + 0.01;
      const mid = (th0 + th1) / 2;
      const n = noise2(k * 1.7, mid * 3 - t * speed);
      const dop = 1 + 0.8 * -Math.cos(mid);
      const b = (0.25 + n * 0.9) * dop * (1 - f * 0.55) * gain;
      ctx.strokeStyle = rgba(col, clamp(b * 0.55));
      ctx.beginPath();
      ctx.ellipse(0, 0, a, a * flat, 0, th0, th1);
      ctx.stroke();
    }
  }
  ctx.restore();
}
function haloArcs(ctx, cx, cy, S, t, gain = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 7; k++) {
    const f = k / 6;
    const rr = S * lerp(1.08, 1.62, f);
    const col = ramp(diskTemp, f * 0.9);
    ctx.lineWidth = S * 0.09;
    for (let s = 0; s < 48; s++) {
      const th0 = (s / 48) * TAU, th1 = th0 + TAU / 48 + 0.01, mid = (th0 + th1) / 2;
      const top = Math.max(0, -Math.sin(mid)); // upper half strongest
      const n = noise2(k * 2.3 + 10, mid * 3 + t * 1.4);
      const b = (0.3 + top * 1.3) * (0.5 + n * 0.8) * (1 + 0.6 * -Math.cos(mid)) * (1 - f * 0.6) * gain;
      ctx.strokeStyle = rgba(col, clamp(b * 0.5));
      ctx.beginPath();
      ctx.arc(0, 0, rr, th0, th1);
      ctx.stroke();
    }
  }
  ctx.restore();
}
const bhDebris = particles(51, 34, (r) => ({ a: r() * TAU, d0: 900 + r() * 700, s: 30 + r() * 50, k: r() < 0.5 ? 'stone' : r() < 0.75 ? 'grass' : 'obsidian', dl: r() * 1.2 }));
export function blackhole(ctx, cx, cy, R, t, { lens = true } = {}) {
  const tp = t - POWER_AT;
  const S = R * 0.42;
  const grow = tp > 0 ? 1 + 0.25 * ease.outCubic(clamp(tp / 0.6)) : 1;
  const SS = S * grow;
  const gain = tp > 0 ? 1.6 : 1;
  if (lens) drawLens(ctx, cx, cy, R * 2.5, SS, t);
  glow(ctx, cx, cy, R * 3, '#ff6a1a', 0.22 * gain);
  diskArcs(ctx, cx, cy, SS, t, false, gain);
  haloArcs(ctx, cx, cy, SS, t, gain);
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(cx, cy, SS, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255,230,190,0.9)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, SS * 1.02, 0, TAU);
  ctx.stroke();
  ctx.restore();
  diskArcs(ctx, cx, cy, SS, t, true, gain);
  // debris being swallowed
  for (const b of bhDebris) {
    const tt = (tp > 0 ? tp * 1.8 : 0) + t * 0.12 - b.dl * 0.15;
    if (tt <= 0) continue;
    const fall = clamp(tt / 3.2);
    const d = b.d0 * Math.pow(1 - fall, 1.6) + SS * 0.9;
    const a = b.a + fall * 6;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.55;
    const near = clamp(1 - (d - SS) / (SS * 3));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(y - cy, x - cx));
    ctx.scale(1 + near * 2.5, 1 - near * 0.7);
    drawBlock(ctx, 0, 0, b.s * (1 - fall * 0.5), tt * 3, b.k, clamp(1 - fall * 1.05));
    ctx.restore();
  }
  // relativistic jets
  if (tp > 0) {
    const k = ease.outExpo(clamp(tp / 0.4)), fade = clamp(2.8 - tp);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.1);
    ctx.globalCompositeOperation = 'lighter';
    for (const sgn of [-1, 1]) {
      for (const [wd, a] of [[160, 0.18], [60, 0.45], [16, 0.9]]) {
        const g = ctx.createLinearGradient(0, 0, 0, sgn * 1200 * k);
        g.addColorStop(0, `rgba(200,230,255,${a * fade})`);
        g.addColorStop(1, 'rgba(120,160,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-wd * 0.1, 0);
        ctx.lineTo(-wd / 2, sgn * 1200 * k);
        ctx.lineTo(wd / 2, sgn * 1200 * k);
        ctx.lineTo(wd * 0.1, 0);
        ctx.fill();
      }
    }
    ctx.restore();
    shockRing(ctx, cx, cy, SS * (1.2 + tp * 5), 6, '#ffb070', clamp(1 - tp * 0.5) * 0.7, 0.35);
  }
}

// ── GALAXY (Andromeda Collision) ───────────────────────────────────────────
const galaxyStars = particles(61, 3200, (r, i) => {
  const arm = i % 2;
  const core = r() < 0.22;
  const rr = core ? Math.pow(r(), 2) * 0.28 : 0.12 + Math.pow(r(), 0.8) * 0.88;
  const spread = (r() - 0.5) * (core ? TAU : 0.55 + rr * 0.3);
  const a = arm * Math.PI + Math.log(rr + 0.05) * 2.6 + spread;
  const tint = r();
  const col = core ? (tint < 0.6 ? '#fff1d0' : '#ffd7a0') : tint < 0.08 ? '#ff8ad0' : tint < 0.55 ? '#a9c4ff' : '#e8e6ff';
  return { rr, a, col, s: core ? 1.6 + r() * 1.6 : 1 + r() * 1.8, stream: !core && rr > 0.45 && rr < 0.85 && Math.abs(spread) < 0.18, d: r() };
});
const GAL_COLS = ['#fff1d0', '#ffd7a0', '#ff8ad0', '#a9c4ff', '#e8e6ff'];
function galaxy(ctx, cx, cy, R, t) {
  const tp = t - POWER_AT;
  const incl = 0.36, pa = -0.5;
  const cp = Math.cos(pa), sp = Math.sin(pa);
  const RG = R * 2.2;
  const proj = (x, y) => { const yy = y * incl; return [cx + x * cp - yy * sp, cy + x * sp + yy * cp]; };
  // haze
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(pa);
  ctx.scale(1, incl);
  const hz = ctx.createRadialGradient(0, 0, 0, 0, 0, RG * 1.05);
  hz.addColorStop(0, 'rgba(255,230,190,0.55)');
  hz.addColorStop(0.15, 'rgba(200,170,255,0.22)');
  hz.addColorStop(0.6, 'rgba(120,130,255,0.08)');
  hz.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hz;
  ctx.beginPath();
  ctx.arc(0, 0, RG * 1.05, 0, TAU);
  ctx.fill();
  ctx.restore();
  // stars, batched by colour
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const pull = tp > 0;
  for (const col of GAL_COLS) {
    ctx.fillStyle = col;
    for (const st of galaxyStars) {
      if (st.col !== col) continue;
      let rr = st.rr, a = st.a + t * 0.18 / Math.sqrt(st.rr + 0.08);
      let x, y;
      if (pull && st.stream) {
        // two streams come loose, spiral down into the engine...
        const k = clamp((tp - st.d * 0.6) / 1.3);
        rr = rr * (1 - ease.inCubic(k));
        a += k * 3.5;
        [x, y] = proj(Math.cos(a) * rr * RG, Math.sin(a) * rr * RG);
        // ...and out along its axis, toward us
        const j = clamp((tp - st.d * 0.6 - 1.3) / 1.2);
        if (j > 0) {
          const ax = Math.cos(Math.PI * 0.72), ay = Math.sin(Math.PI * 0.72);
          const spread = (st.d - 0.5) * 0.25;
          x += (ax * Math.cos(spread) - ay * Math.sin(spread)) * j * 1600;
          y += (ay * Math.cos(spread) + ax * Math.sin(spread)) * j * 1600;
        }
        const sz = st.s * (1.4 + j * 3);
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        continue;
      }
      [x, y] = proj(Math.cos(a) * rr * RG, Math.sin(a) * rr * RG);
      ctx.globalAlpha = 0.75;
      ctx.fillRect(x - st.s / 2, y - st.s / 2, st.s, st.s);
    }
  }
  ctx.restore();
  // dust lanes
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(pa);
  ctx.scale(1, incl);
  ctx.strokeStyle = 'rgba(10,6,20,0.35)';
  ctx.lineWidth = RG * 0.03;
  for (const r0 of [0.42, 0.62]) {
    ctx.beginPath();
    ctx.arc(0, 0, RG * r0, Math.PI * 1.05 + t * 0.05, Math.PI * 1.85 + t * 0.05);
    ctx.stroke();
  }
  ctx.restore();
  glow(ctx, cx, cy, R * 0.9, '#ffe2b0', 0.85);
  // the tide engine: an astropolis ring round the core
  const eng = 0.6 + (tp > -0.5 ? 0.4 : 0);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(pa);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU + t * 0.6;
    const x = Math.cos(a) * R * 0.32, y = Math.sin(a) * R * 0.32 * incl;
    const on = 0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin(i * 1.7 + t * 6), 4);
    ctx.fillStyle = `rgba(210,170,255,${on * eng})`;
    ctx.fillRect(x - 3, y - 2, 6, 4);
  }
  ctx.strokeStyle = `rgba(200,150,255,${0.6 * eng})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, R * 0.32, R * 0.32 * incl, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
  if (tp > 0) {
    const fade = clamp(2.9 - tp);
    shockRing(ctx, cx, cy, R * (0.3 + tp * 2), 5, '#c58aff', clamp(1 - tp * 0.45) * 0.8, incl * 1.4);
    glow(ctx, cx, cy, R * (0.6 + tp * 0.8), '#e8c8ff', 0.6 * fade);
  }
}

// ── public ─────────────────────────────────────────────────────────────────
const RENDER = { sun, moon, storm, ringed, pulsar, supernova, blackhole, galaxy };
export const BODY_SIZE = { sun: 300, moon: 290, storm: 300, ringed: 215, pulsar: 150, supernova: 230, blackhole: 265, galaxy: 300 };

export function drawBody(ctx, type, cx, cy, R, t) {
  (RENDER[type] || sun)(ctx, cx, cy, R, t);
}

// Screen-shake / flash envelope a body wants at time t (used by scenes).
export function bodyImpact(type, t) {
  const tp = t - POWER_AT;
  if (tp < 0) return { shake: type === 'supernova' ? clamp((t - 2.4) / 0.6) * 6 : 0, flash: 0 };
  const decay = Math.exp(-tp * 2.2);
  const big = type === 'supernova' || type === 'blackhole' ? 1.4 : 1;
  return { shake: 22 * decay * big, flash: clamp(1 - tp / 0.18) * (type === 'supernova' ? 0 : 0.6) };
}

// ── small vector icons (star map, chamber sign, outro) ─────────────────────
export function drawIcon(ctx, type, x, y, r, t, color, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  const circ = (rr, fill = false) => { ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); fill ? ctx.fill() : ctx.stroke(); };
  switch (type) {
    case 'sun':
      circ(r * 0.55);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + t * 0.3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
      break;
    case 'moon':
      circ(r * 0.75);
      ctx.beginPath();
      ctx.arc(r * 0.2, -r * 0.1, r * 0.15, 0, TAU);
      ctx.arc(-r * 0.25, r * 0.3, r * 0.1, 0, TAU);
      ctx.stroke();
      break;
    case 'storm':
      circ(r * 0.75);
      for (const yy of [-0.35, 0, 0.35]) {
        ctx.beginPath();
        ctx.ellipse(0, yy * r, r * 0.68 * Math.sqrt(1 - yy * yy), r * 0.08, 0, 0, TAU);
        ctx.stroke();
      }
      break;
    case 'ringed':
      circ(r * 0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.3, -0.35, 0, TAU);
      ctx.stroke();
      break;
    case 'pulsar':
      circ(r * 0.2, true);
      ctx.save();
      ctx.rotate(t * 2);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(r, -r * 0.18); ctx.lineTo(r, r * 0.18); ctx.closePath();
      ctx.moveTo(0, 0); ctx.lineTo(-r, -r * 0.18); ctx.lineTo(-r, r * 0.18); ctx.closePath();
      ctx.globalAlpha *= 0.6;
      ctx.fill();
      ctx.restore();
      break;
    case 'supernova':
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + t * 0.2;
        const rr = i % 2 ? r * 0.35 : r;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    case 'blackhole':
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.28, -0.15, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#000';
      circ(r * 0.42, true);
      circ(r * 0.42);
      break;
    case 'galaxy':
    case 'twin': {
      const arms = (ox, oy, rr, rot) => {
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          for (let j = 0; j <= 20; j++) {
            const u = j / 20, a = rot + k * Math.PI + u * 3.2;
            const px = ox + Math.cos(a) * rr * u, py = oy + Math.sin(a) * rr * u * 0.6;
            j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(ox, oy, rr * 0.15, 0, TAU); ctx.fill();
      };
      if (type === 'galaxy') arms(0, 0, r, t * 0.4);
      else { arms(-r * 0.45, -r * 0.1, r * 0.6, t * 0.4); arms(r * 0.45, r * 0.15, r * 0.55, -t * 0.4 + 1); }
      break;
    }
    case 'comet':
      circ(r * 0.22, true);
      for (const o of [-0.18, 0, 0.18]) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * Math.cos(0.6 + o), -r * Math.sin(0.6 + o)); ctx.stroke();
      }
      break;
    case 'asteroid':
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU, rr = r * (0.42 + 0.18 * hash1(i * 7));
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr * 0.85);
      }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.45, r * 0.25); ctx.lineTo(r, r * 0.6); ctx.moveTo(r * 0.5, r * 0.05); ctx.lineTo(r * 0.95, r * 0.25); ctx.stroke();
      break;
    case 'snow':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + t * 0.2;
        const ex = Math.cos(a) * r, ey = Math.sin(a) * r;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ex, ey);
        const bx = Math.cos(a) * r * 0.55, by = Math.sin(a) * r * 0.55;
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + 0.7) * r * 0.3, by + Math.sin(a + 0.7) * r * 0.3);
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a - 0.7) * r * 0.3, by + Math.sin(a - 0.7) * r * 0.3);
        ctx.stroke();
      }
      break;
    case 'swarm':
      for (let i = 0; i < 7; i++) {
        const a = (i / 6) * TAU + t * 0.3, rr = i === 6 ? 0 : r * 0.55;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, r * 0.24, 0, TAU);
        ctx.stroke();
      }
      break;
    case 'cluster':
      [[-0.6, 0.2], [-0.25, -0.1], [0.05, 0.25], [0.3, -0.35], [0.55, 0.05], [0.7, -0.5], [-0.1, 0.6]].forEach(([x, y], i) => {
        ctx.beginPath(); ctx.arc(x * r, y * r, r * (i % 3 ? 0.08 : 0.13), 0, TAU); ctx.fill();
      });
      ctx.beginPath(); ctx.moveTo(-0.6 * r, 0.2 * r); ctx.lineTo(-0.25 * r, -0.1 * r); ctx.lineTo(0.05 * r, 0.25 * r); ctx.lineTo(0.3 * r, -0.35 * r); ctx.lineTo(0.55 * r, 0.05 * r); ctx.stroke();
      break;
    case 'rail':
      ctx.strokeRect(-r, -r * 0.22, r * 1.6, r * 0.44);
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-r * 0.6 + i * r * 0.45, 0, r * 0.12, 0, TAU); ctx.stroke(); }
      circ(0);
      ctx.beginPath(); ctx.arc(r * 0.85, 0, r * 0.14, 0, TAU); ctx.fill();
      break;
    case 'pinwheel':
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        for (let j = 0; j <= 20; j++) {
          const u = j / 20, a = (k / 3) * TAU + u * 4 + t * 0.6;
          const px = Math.cos(a) * r * u, py = Math.sin(a) * r * u;
          j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      break;
    case 'kilonova': {
      const d = r * 0.3 * (0.6 + 0.4 * Math.cos(t * 2));
      ctx.beginPath(); ctx.arc(-d, 0, r * 0.15, 0, TAU); ctx.arc(d, 0, r * 0.15, 0, TAU); ctx.fill();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
      }
      break;
    }
    case 'io':
      circ(r * 0.6);
      ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.1, r * 0.12, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 0.55); ctx.lineTo(-r * 0.05, -r * 0.8); ctx.lineTo(-r * 0.25, -r * 0.85); ctx.lineTo(0, -r * 1.1);
      ctx.stroke();
      break;
    case 'hypercane':
      ctx.beginPath();
      for (let j = 0; j <= 30; j++) {
        const u = j / 30, a = u * 9 + t;
        const px = Math.cos(a) * r * u, py = Math.sin(a) * r * u * 0.8;
        j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      break;
    default:
      circ(r * 0.7);
  }
  ctx.restore();
}
