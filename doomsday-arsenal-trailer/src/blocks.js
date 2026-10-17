// Pixel-art isometric Minecraft-style block sprites.
import { rng, makeCanvas, clamp } from './util.js';

const KINDS = {
  grass: { top: [[95, 159, 53], [76, 135, 40], [110, 175, 64]], side: [[134, 96, 67], [115, 80, 55], [150, 108, 74]], strip: [[95, 159, 53], [76, 135, 40]] },
  stone: { top: [[125, 125, 125], [105, 105, 105], [140, 140, 140]], side: [[125, 125, 125], [105, 105, 105], [140, 140, 140]] },
  obsidian: { top: [[20, 16, 32], [40, 26, 60], [12, 10, 20]], side: [[20, 16, 32], [40, 26, 60], [12, 10, 20]] },
  magma: { top: [[160, 50, 10], [230, 110, 20], [90, 25, 10]], side: [[160, 50, 10], [230, 110, 20], [90, 25, 10]] },
};

const cache = new Map();
export function blockSprite(kind = 'grass') {
  if (cache.has(kind)) return cache.get(kind);
  const k = KINDS[kind];
  const S = 96, c = makeCanvas(S, S), g = c.getContext('2d');
  const r = rng(kind.length * 977);
  const P = 8; // pixels per face edge
  // iso basis
  const cx = S / 2, top = 6, hw = S / 2 - 4, hh = hw / 2, vh = hw;
  const ex = [hw / P, hh / P], ey = [-hw / P, hh / P];
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const quad = (p0, a, b, col, shade) => {
    g.fillStyle = `rgb(${col[0] * shade | 0},${col[1] * shade | 0},${col[2] * shade | 0})`;
    g.beginPath();
    g.moveTo(p0[0], p0[1]);
    g.lineTo(p0[0] + a[0], p0[1] + a[1]);
    g.lineTo(p0[0] + a[0] + b[0], p0[1] + a[1] + b[1]);
    g.lineTo(p0[0] + b[0], p0[1] + b[1]);
    g.closePath();
    g.fill();
  };
  // top face
  for (let i = 0; i < P; i++) for (let j = 0; j < P; j++) {
    const p0 = [cx + ex[0] * i + ey[0] * j, top + ex[1] * i + ey[1] * j + hh * 0 + 0];
    quad([p0[0], p0[1] + hh], [ex[0] * 1.02, ex[1] * 1.02], [ey[0] * 1.02, ey[1] * 1.02], pick(k.top), 1.0);
  }
  // left face (shade .72) and right face (shade .86)
  const down = [0, vh / P];
  const leftOrigin = [cx - hw, top + hh];
  const rightOrigin = [cx, top + hh * 2];
  for (let i = 0; i < P; i++) for (let j = 0; j < P; j++) {
    const colL = k.strip && j < 2 && r() < (j === 0 ? 1 : 0.6) ? pick(k.strip) : pick(k.side);
    const colR = k.strip && j < 2 && r() < (j === 0 ? 1 : 0.6) ? pick(k.strip) : pick(k.side);
    const exL = [hw / P, hh / P];
    quad([leftOrigin[0] + exL[0] * i, leftOrigin[1] + exL[1] * i + down[1] * j], [exL[0] * 1.03, exL[1] * 1.03], [0, down[1] * 1.03], colL, 0.7);
    const exR = [hw / P, -hh / P];
    quad([rightOrigin[0] + exR[0] * i, rightOrigin[1] + exR[1] * i + down[1] * j], [exR[0] * 1.03, exR[1] * 1.03], [0, down[1] * 1.03], colR, 0.86);
  }
  cache.set(kind, c);
  return c;
}

export function drawBlock(ctx, x, y, size, rot = 0, kind = 'grass', alpha = 1, glowColor = null) {
  if (alpha <= 0 || size <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(alpha);
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.imageSmoothingEnabled = false;
  if (glowColor) { ctx.shadowColor = glowColor; ctx.shadowBlur = size * 0.4; }
  ctx.drawImage(blockSprite(kind), -size / 2, -size / 2, size, size);
  ctx.restore();
}
