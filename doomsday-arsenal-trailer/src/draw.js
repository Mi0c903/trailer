// Shared drawing helpers: fonts, glows, starfields, HUD bits, post effects,
// the AI "eye" and the AI's typed text.
import { TAU, clamp, lerp, rng, hash1, noise1, fbm2, makeCanvas, hexToRgb, rgba, mixRgb, ease, invLerp } from './util.js';

export const W = 1920, H = 1080;

export const F = {
  display: (px, w = 900) => `${w} ${px}px Orbitron, "DejaVu Sans", sans-serif`,
  ui: (px, w = 500) => `${w} ${px}px "Chakra Petch", "DejaVu Sans", sans-serif`,
  mono: (px) => `${px}px "Share Tech Mono", "DejaVu Sans Mono", monospace`,
};

export const C = {
  cyan: '#4ff3ff',
  cyanRgb: [79, 243, 255],
  red: '#ff3b30',
  redRgb: [255, 59, 48],
  orange: '#ff7a1a',
  white: '#ffffff',
  bg: '#03050b',
};

export function setFont(ctx, font, spacing = 0) {
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
}

export function text(ctx, str, x, y, { font, color = '#fff', align = 'left', base = 'alphabetic', alpha = 1, glow = 0, glowColor, spacing = 0 } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  setFont(ctx, font, spacing);
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  if (glow > 0) {
    ctx.shadowColor = glowColor || color;
    ctx.shadowBlur = glow;
  }
  ctx.fillText(str, x, y);
  ctx.restore();
}

// ── glow sprites ───────────────────────────────────────────────────────────
const spriteCache = new Map();
export function glowSprite(color, hardness = 0.15) {
  const key = color + hardness;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const s = 128, c = makeCanvas(s, s), g = c.getContext('2d');
  const rgb = hexToRgb(color);
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(hardness, rgba(rgb, 0.9));
  grd.addColorStop(0.45, rgba(rgb, 0.25));
  grd.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  spriteCache.set(key, c);
  return c;
}

export function glow(ctx, x, y, r, color, alpha = 1, hardness) {
  if (alpha <= 0 || r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp(alpha);
  ctx.drawImage(glowSprite(color, hardness), x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// ── starfield ──────────────────────────────────────────────────────────────
export class Starfield {
  constructor(seed = 1, { count = 900, tint = [200, 220, 255] } = {}) {
    const r = rng(seed);
    this.layers = [];
    for (let l = 0; l < 2; l++) {
      const c = makeCanvas(W, H), g = c.getContext('2d');
      const n = l === 0 ? count : count / 4;
      for (let i = 0; i < n; i++) {
        const x = r() * W, y = r() * H;
        const m = Math.pow(r(), l === 0 ? 3 : 1.6);
        const size = l === 0 ? 0.5 + m * 1.3 : 0.9 + m * 1.8;
        const warm = r();
        const col = warm < 0.15 ? [255, 210, 170] : warm < 0.3 ? [170, 200, 255] : tint;
        g.fillStyle = rgba(col, 0.25 + m * 0.75);
        g.beginPath();
        g.arc(x, y, size, 0, TAU);
        g.fill();
      }
      this.layers.push(c);
    }
    this.bright = Array.from({ length: 40 }, () => ({ x: r() * W, y: r() * H, s: 3 + r() * 9, p: r() * TAU, f: 0.5 + r() * 2 }));
  }

  draw(ctx, t, { vx = -8, vy = 0, alpha = 1, twinkle = true } = {}) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    this.layers.forEach((c, i) => {
      const k = i === 0 ? 1 : 2.2;
      const ox = (((t * vx * k) % W) + W) % W, oy = (((t * vy * k) % H) + H) % H;
      for (let ix = -1; ix <= 0; ix++) for (let iy = -1; iy <= 0; iy++) {
        const x = ox + ix * W, y = oy + iy * H;
        if (x + W <= 0 || y + H <= 0 || x >= W || y >= H) continue;
        ctx.drawImage(c, x, y);
      }
    });
    ctx.restore();
    if (twinkle) {
      for (const s of this.bright) {
        const a = alpha * (0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * s.f + s.p), 3));
        const x = (((s.x + t * vx * 2.2) % W) + W) % W, y = (((s.y + t * vy * 2.2) % H) + H) % H;
        glow(ctx, x, y, s.s, '#bfd6ff', a * 0.8);
      }
    }
  }
}

// ── nebula backdrop (cached per colour) ────────────────────────────────────
const nebCache = new Map();
export function nebula(color, seed = 3) {
  const key = color + seed;
  if (nebCache.has(key)) return nebCache.get(key);
  const w = 320, h = 180, c = makeCanvas(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h), d = img.data, rgb = hexToRgb(color);
  const ox = seed * 17.3, oy = seed * 9.1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = x / 70 + ox, ny = y / 70 + oy;
    const warp = fbm2(nx * 0.7, ny * 0.7, 3);
    let v = fbm2(nx + warp * 2.2, ny + warp * 1.7, 5);
    v = clamp((v - 0.42) * 2.6);
    v = v * v;
    const i = (y * w + x) * 4;
    d[i] = rgb[0] * v; d[i + 1] = rgb[1] * v; d[i + 2] = rgb[2] * v; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  nebCache.set(key, c);
  return c;
}

export function drawNebula(ctx, color, t, alpha = 0.5, seed = 3) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  const s = 1.3 + 0.04 * Math.sin(t * 0.1);
  ctx.translate(W / 2, H / 2);
  ctx.scale(s, s);
  ctx.rotate(Math.sin(t * 0.05) * 0.03);
  ctx.drawImage(nebula(color, seed), -W / 2, -H / 2, W, H);
  ctx.restore();
}

// ── camera shake ───────────────────────────────────────────────────────────
export function shake(t, amount, seed = 0) {
  if (amount <= 0) return [0, 0];
  return [(noise1(t * 28 + seed) - 0.5) * 2 * amount, (noise1(t * 31 + seed + 50) - 0.5) * 2 * amount];
}

// ── HUD ────────────────────────────────────────────────────────────────────
export function corners(ctx, x, y, w, h, len = 30, color = C.cyan, alpha = 1, lw = 3) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
  ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
  ctx.moveTo(x + w, y + h - len); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - len, y + h);
  ctx.moveTo(x + len, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - len);
  ctx.stroke();
  ctx.restore();
}

export function bar(ctx, x, y, w, h, p, color = C.cyan, alpha = 1, segs = 20) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  const sw = (w - 4) / segs;
  ctx.fillStyle = color;
  const lit = p * segs;
  for (let i = 0; i < segs; i++) {
    const a = clamp(lit - i);
    if (a <= 0) break;
    ctx.globalAlpha = alpha * a;
    ctx.fillRect(x + 2 + i * sw + 1, y + 3, sw - 2, h - 6);
  }
  ctx.restore();
}

// ── post FX ────────────────────────────────────────────────────────────────
let vignetteC;
export function vignette(ctx, strength = 0.75) {
  if (!vignetteC) {
    vignetteC = makeCanvas(W, H);
    const g = vignetteC.getContext('2d');
    const grd = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
  }
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.drawImage(vignetteC, 0, 0);
  ctx.restore();
}

export function scanlines(ctx, alpha = 0.08) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
  ctx.restore();
}

let gbuf, gR, gC;
export function glitch(ctx, amount, frame, seed = 0) {
  if (amount <= 0.01) return;
  if (!gbuf) { gbuf = makeCanvas(W, H); gR = makeCanvas(W, H); gC = makeCanvas(W, H); }
  const b = gbuf.getContext('2d');
  b.globalCompositeOperation = 'copy';
  b.drawImage(ctx.canvas, 0, 0);
  b.globalCompositeOperation = 'source-over';
  // RGB split
  const dx = 4 + amount * 22;
  for (const [cv, col] of [[gR, '#ff0000'], [gC, '#00ffff']]) {
    const g = cv.getContext('2d');
    g.globalCompositeOperation = 'copy';
    g.drawImage(gbuf, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = col;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(gR, -dx, 0);
  ctx.drawImage(gC, dx, 0);
  ctx.globalCompositeOperation = 'source-over';
  // displaced slices
  const n = 4 + Math.floor(amount * 14);
  for (let i = 0; i < n; i++) {
    const h0 = hash1(frame * 131 + i * 17 + seed);
    const y = h0 * H, h = 6 + hash1(frame * 71 + i * 3 + seed) * 70 * amount;
    const off = (hash1(frame * 13 + i * 29 + seed) - 0.5) * 260 * amount;
    ctx.drawImage(gbuf, 0, y, W, h, off, y, W, h);
  }
  ctx.restore();
}

// Blocky pixelation (used for the "deploy to Minecraft" transition).
let pixC;
export function pixelate(ctx, block) {
  if (block <= 1) return;
  if (!pixC) pixC = makeCanvas(W, H);
  const w = Math.max(1, Math.round(W / block)), h = Math.max(1, Math.round(H / block));
  const g = pixC.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.clearRect(0, 0, w, h);
  g.drawImage(ctx.canvas, 0, 0, w, h);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pixC, 0, 0, w, h, 0, 0, W, H);
  ctx.restore();
}

export function flash(ctx, alpha, color = '#fff') {
  if (alpha <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = clamp(alpha);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ── the AI's eye ───────────────────────────────────────────────────────────
export function drawEye(ctx, x, y, r, t, { open = 1, red = 0, talk = 0, alpha = 1 } = {}) {
  if (alpha <= 0) return;
  const col = mixRgb(C.cyanRgb, C.redRgb, red);
  const cs = rgba(col, 1);
  const hex = '#' + col.map((v) => (v | 0).toString(16).padStart(2, '0')).join('');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  // Outer dashed ring
  ctx.strokeStyle = rgba(col, 0.45);
  ctx.lineWidth = 3;
  for (let i = 0; i < 48; i++) {
    const a0 = (i / 48) * TAU + t * 0.15;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.42, a0, a0 + TAU / 48 * 0.55);
    ctx.stroke();
  }
  // Tick ring
  ctx.strokeStyle = rgba(col, 0.6);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.2, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU - t * 0.08;
    const l = i % 6 === 0 ? 14 : 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2);
    ctx.lineTo(Math.cos(a) * (r * 1.2 + l), Math.sin(a) * (r * 1.2 + l));
    ctx.stroke();
  }
  // Talk bars
  if (talk > 0) {
    ctx.strokeStyle = rgba(col, 0.8 * talk);
    ctx.lineWidth = 4;
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU;
      const v = noise1(t * 14 + i * 1.7) * talk;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 1.62, Math.sin(a) * r * 1.62);
      ctx.lineTo(Math.cos(a) * r * (1.62 + 0.03 + v * 0.35), Math.sin(a) * r * (1.62 + 0.03 + v * 0.35));
      ctx.stroke();
    }
  }

  // Lid clip
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.12, Math.max(0.5, r * 1.12 * open), 0, 0, TAU);
  ctx.clip();
  // Thick segment ring
  ctx.strokeStyle = cs;
  ctx.lineWidth = r * 0.09;
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * TAU - t * 0.35;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.98, a0, a0 + (TAU / 6) * 0.72);
    ctx.stroke();
  }
  // Iris
  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.82);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.18, rgba(mixRgb(col, [255, 255, 255], 0.5), 1));
  grd.addColorStop(0.55, rgba(col, 0.75));
  grd.addColorStop(1, rgba(col.map((v) => v * 0.15), 1));
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, 0, TAU);
  ctx.fill();
  // Iris spokes
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + t * 0.05;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32);
    ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
    ctx.stroke();
  }
  // Pupil (hexagon)
  const pr = r * (0.22 + 0.03 * Math.sin(t * 2.1)) * (1 - red * 0.3);
  ctx.fillStyle = '#02040a';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * pr * 0.75, Math.sin(a) * pr * 1.25);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Lid line when nearly closed
  if (open < 1) {
    ctx.strokeStyle = rgba(col, 1 - open);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r * 1.3, 0);
    ctx.lineTo(r * 1.3, 0);
    ctx.stroke();
  }
  ctx.restore();
  glow(ctx, x, y, r * 2.6, hex, alpha * (0.35 + 0.35 * open + talk * 0.15));
}

// ── AI typed text ──────────────────────────────────────────────────────────
function parseHl(str) {
  const segs = [];
  let hl = false, cur = '';
  for (const ch of str) {
    if (ch === '[' || ch === ']') {
      if (cur) segs.push({ s: cur, hl });
      cur = '';
      hl = ch === '[';
    } else cur += ch;
  }
  if (cur) segs.push({ s: cur, hl });
  return segs;
}

// Draws the line active at local time `lt`. Returns a 0..1 "talking" level for the eye.
export function aiLines(ctx, lines, lt, frame, { x = W / 2, y = 930, size = 46, label = 'ARSENAL//OS', cps = 34, align = 'center', color = '#eaf6ff' } = {}) {
  let talking = 0;
  for (const [a, b, str, o = {}] of lines) {
    if (lt < a || lt > b) continue;
    const segs = parseHl(str);
    const plain = segs.map((s) => s.s).join('');
    const px = o.big ? size * 1.5 : size;
    const n = Math.floor((lt - a) * (o.big ? cps * 0.7 : cps));
    const shown = Math.min(n, plain.length);
    const out = clamp((b - lt) / 0.35);
    talking = Math.max(talking, shown < plain.length ? 1 : 0.25 * out);

    ctx.save();
    setFont(ctx, F.ui(px, 700), o.big ? 4 : 1);
    ctx.textBaseline = 'alphabetic';
    const full = ctx.measureText(plain).width;
    let cx = align === 'center' ? x - full / 2 : x;
    // label
    text(ctx, label + '  ›', align === 'center' ? x : x, y - px * 1.05, { font: F.mono(20), color: C.cyan, align, alpha: 0.85 * out, spacing: 3 });
    let left = shown;
    const sh = o.big ? 24 : 10;
    for (const s of segs) {
      if (left <= 0) break;
      let part = s.s.slice(0, left);
      left -= part.length;
      const glitchChar = left <= 0 && shown < plain.length;
      if (glitchChar && part.length) {
        const pool = '#%&@$*/<>[]{}01';
        part = part.slice(0, -1) + pool[Math.floor(hash1(frame * 7 + shown) * pool.length)];
      }
      setFont(ctx, F.ui(px, 700), o.big ? 4 : 1);
      ctx.globalAlpha = out;
      ctx.fillStyle = s.hl ? C.red : color;
      ctx.shadowColor = s.hl ? C.red : 'rgba(79,243,255,0.6)';
      ctx.shadowBlur = s.hl ? sh * 2 : sh;
      ctx.fillText(part, cx, y);
      cx += ctx.measureText(part).width;
    }
    // cursor
    if (Math.floor(lt * 3) % 2 === 0 || shown < plain.length) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = C.cyan;
      ctx.globalAlpha = out;
      ctx.fillRect(cx + 6, y - px * 0.78, px * 0.42, px * 0.86);
    }
    ctx.restore();
  }
  return talking;
}

// Simple typed text (terminal style)
export function typed(str, lt, cps = 40) {
  const n = Math.max(0, Math.floor(lt * cps));
  return str.slice(0, n);
}

export { ease, invLerp, lerp, clamp, TAU };
