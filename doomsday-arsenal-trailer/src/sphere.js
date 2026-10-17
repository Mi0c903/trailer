// Software sphere renderer: projects an equirectangular texture onto a lit,
// rotating sphere. Fast enough for real-time at ~500px and fully deterministic.
import { TAU, clamp, fbm3, rng, ramp, makeCanvas } from './util.js';

const geomCache = new Map();
function geometry(N, tilt) {
  const key = N + ':' + tilt;
  if (geomCache.has(key)) return geomCache.get(key);
  const n = N * N;
  const lat = new Float32Array(n), lon = new Float32Array(n);
  const nx = new Float32Array(n), ny = new Float32Array(n), nz = new Float32Array(n);
  const mask = new Float32Array(n);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const R = N / 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const px = (x + 0.5 - R) / R, py = (y + 0.5 - R) / R;
    const d2 = px * px + py * py;
    if (d2 > 1) continue;
    // anti-aliased edge
    mask[i] = clamp((1 - Math.sqrt(d2)) * R * 1.2);
    const pz = Math.sqrt(Math.max(0, 1 - d2));
    nx[i] = px; ny[i] = py; nz[i] = pz;
    // rotate by axial tilt (around view axis)
    const rx = px * ct - py * st, ry = px * st + py * ct;
    lat[i] = Math.asin(clamp(-ry, -1, 1));
    lon[i] = Math.atan2(rx, pz);
  }
  const g = { N, lat, lon, nx, ny, nz, mask, canvas: makeCanvas(N, N) };
  g.ctx = g.canvas.getContext('2d');
  g.img = g.ctx.createImageData(N, N);
  geomCache.set(key, g);
  return g;
}

// tex: { w, h, data: Uint8ClampedArray (RGB, 3 bytes/pixel) }
export function drawSphere(ctx, cx, cy, R, tex, opts = {}) {
  const {
    rot = 0, tilt = 0, light = [-0.55, -0.35, 0.76], ambient = 0.04, emissive = false,
    rim = null, rimPow = 3, rimStrength = 0.8, res = 480, gain = 1, night = null,
  } = opts;
  const N = Math.max(64, Math.min(res, Math.round((R * 2) / 40) * 40));
  const g = geometry(N, tilt);
  const d = g.img.data;
  const { w, h, data } = tex;
  const L = Math.hypot(...light), lx = light[0] / L, ly = light[1] / L, lz = light[2] / L;
  const n = N * N;
  const rr = rim ? rim[0] : 0, rg = rim ? rim[1] : 0, rb = rim ? rim[2] : 0;
  for (let i = 0; i < n; i++) {
    const m = g.mask[i];
    const o = i * 4;
    if (m <= 0) { d[o + 3] = 0; continue; }
    let u = (g.lon[i] + rot) / TAU;
    u -= Math.floor(u);
    const v = g.lat[i] / Math.PI + 0.5;
    const tx = (u * w) | 0, ty = Math.min(h - 1, (v * h) | 0);
    const ti = (ty * w + tx) * 3;
    let r = data[ti], gg = data[ti + 1], b = data[ti + 2];
    const nz = g.nz[i];
    if (emissive) {
      const limb = (0.45 + 0.55 * Math.sqrt(nz)) * gain;
      r *= limb; gg *= limb; b *= limb;
    } else {
      const lam = Math.max(0, g.nx[i] * lx + g.ny[i] * ly + nz * lz);
      const k = (ambient + lam * 1.05) * gain;
      r *= k; gg *= k; b *= k;
    }
    if (rim) {
      const f = Math.pow(1 - nz, rimPow) * rimStrength;
      const lit = emissive ? 1 : clamp(0.25 + (g.nx[i] * lx + g.ny[i] * ly) * 1.2);
      r += rr * f * lit; gg += rg * f * lit; b += rb * f * lit;
    }
    d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255 * m;
  }
  g.ctx.putImageData(g.img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(g.canvas, cx - R, cy - R, R * 2, R * 2);
  ctx.restore();
}

// ── procedural textures ────────────────────────────────────────────────────
function makeTex(w, h, fn) {
  const data = new Uint8ClampedArray(w * h * 3);
  for (let y = 0; y < h; y++) {
    const lat = (y / h - 0.5) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < w; x++) {
      const lon = (x / w) * TAU;
      const px = cl * Math.sin(lon), pz = cl * Math.cos(lon), py = sl;
      const c = fn(px, py, pz, lat, lon, x, y);
      const i = (y * w + x) * 3;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
    }
  }
  return { w, h, data };
}

const texCache = new Map();
export function texture(name) {
  if (texCache.has(name)) return texCache.get(name);
  const t = TEXTURES[name]();
  texCache.set(name, t);
  return t;
}

const TEXTURES = {
  sun: () => {
    const stops = [[0, [90, 12, 0]], [0.35, [210, 70, 8]], [0.6, [255, 150, 30]], [0.8, [255, 215, 110]], [1, [255, 250, 220]]];
    return makeTex(512, 256, (x, y, z) => {
      const big = fbm3(x * 2.2 + 11, y * 2.2, z * 2.2, 4);
      const gran = fbm3(x * 16, y * 16, z * 16, 3);
      let v = 0.74 + (big - 0.5) * 0.9 + (gran - 0.5) * 0.95;
      const spot = fbm3(x * 3 + 40, y * 3, z * 3, 3);
      if (spot > 0.66) v -= (spot - 0.66) * 4;
      return ramp(stops, clamp(v));
    });
  },
  giant: () => {
    // Red supergiant: big blotchy convection cells
    const stops = [[0, [60, 5, 0]], [0.4, [180, 40, 10]], [0.7, [255, 110, 40]], [1, [255, 210, 150]]];
    return makeTex(512, 256, (x, y, z) => {
      const v = fbm3(x * 3.2 + 5, y * 3.2, z * 3.2, 5);
      return ramp(stops, clamp(0.62 + (v - 0.5) * 2.2));
    });
  },
  moon: () => {
    const r = rng(7);
    const W2 = 1024, H2 = 512;
    const base = makeTex(W2, H2, (x, y, z) => {
      const v = fbm3(x * 3 + 2, y * 3, z * 3, 6);
      const mare = fbm3(x * 1.4 + 9, y * 1.4, z * 1.4, 4);
      let g = 120 + (v - 0.5) * 90;
      if (mare > 0.55) g -= (mare - 0.55) * 260;
      g = clamp(g, 30, 230);
      return [g, g, g * 1.04];
    });
    // craters
    const d = base.data;
    for (let k = 0; k < 260; k++) {
      const clat = (r() - 0.5) * Math.PI * 0.95, clon = r() * TAU;
      const rad = 0.012 + Math.pow(r(), 3) * 0.11; // radians
      const cx = Math.cos(clat) * Math.sin(clon), cy = Math.sin(clat), cz = Math.cos(clat) * Math.cos(clon);
      const y0 = Math.max(0, Math.floor(((clat - rad * 1.4) / Math.PI + 0.5) * H2));
      const y1 = Math.min(H2 - 1, Math.ceil(((clat + rad * 1.4) / Math.PI + 0.5) * H2));
      for (let yy = y0; yy <= y1; yy++) {
        const lat = (yy / H2 - 0.5) * Math.PI;
        const cl = Math.cos(lat);
        const span = Math.min(Math.PI, (rad * 1.4) / Math.max(0.05, cl));
        const x0 = Math.floor(((clon - span) / TAU) * W2), x1 = Math.ceil(((clon + span) / TAU) * W2);
        for (let xx = x0; xx <= x1; xx++) {
          const lon = (xx / W2) * TAU;
          const px = cl * Math.sin(lon), py = Math.sin(lat), pz = cl * Math.cos(lon);
          const ang = Math.acos(clamp(px * cx + py * cy + pz * cz, -1, 1)) / rad;
          if (ang > 1.4) continue;
          let f = 0;
          if (ang < 0.85) f = -0.35 * (1 - ang * ang * 0.6);
          else if (ang < 1.05) f = 0.35;
          else f = 0.35 * (1 - (ang - 1.05) / 0.35) * 0.4;
          const wx = ((xx % W2) + W2) % W2;
          const i = (yy * W2 + wx) * 3;
          for (let c = 0; c < 3; c++) d[i + c] = clamp(d[i + c] * (1 + f), 0, 255);
        }
      }
    }
    return base;
  },
  io: () => {
    const stops = [[0, [70, 40, 10]], [0.35, [200, 150, 40]], [0.6, [235, 210, 90]], [0.8, [245, 235, 170]], [1, [255, 250, 220]]];
    return makeTex(256, 128, (x, y, z) => {
      let v = 0.55 + (fbm3(x * 3 + 7, y * 3, z * 3, 5) - 0.5) * 1.6;
      const spot = fbm3(x * 9 + 3, y * 9, z * 9, 2);
      if (spot > 0.66) v -= (spot - 0.66) * 5;
      return ramp(stops, clamp(v));
    });
  },
  jupiter: () => {
    const pal = [[0, [120, 70, 45]], [0.2, [200, 150, 110]], [0.35, [240, 220, 190]], [0.5, [170, 100, 60]], [0.65, [230, 200, 160]], [0.8, [150, 90, 60]], [1, [235, 215, 185]]];
    return makeTex(1024, 512, (x, y, z, lat, lon) => {
      const turb = fbm3(x * 4, y * 9, z * 4, 5);
      let b = Math.sin(lat * 13 + turb * 3.2) * 0.5 + 0.5;
      b = (b + Math.sin(lat * 29 + turb * 5) * 0.15) % 1;
      let c = ramp(pal, clamp(b));
      // Great storm
      const slat = -0.38, slon = 1.2;
      const dl = (lat - slat) / 0.11, dn = Math.atan2(Math.sin(lon - slon), Math.cos(lon - slon)) / 0.2;
      const dd = dl * dl + dn * dn;
      if (dd < 1.3) {
        const sw = fbm3(x * 12, y * 12, z * 12, 3);
        const k = clamp(1.3 - dd) * (0.7 + sw * 0.5);
        c = [c[0] * (1 - k) + 200 * k, c[1] * (1 - k) + 70 * k, c[2] * (1 - k) + 40 * k];
      }
      return c;
    });
  },
  saturn: () => {
    const pal = [[0, [180, 150, 100]], [0.3, [225, 200, 150]], [0.55, [240, 225, 180]], [0.8, [200, 170, 120]], [1, [230, 210, 165]]];
    return makeTex(1024, 512, (x, y, z, lat) => {
      const turb = fbm3(x * 3, y * 6, z * 3, 4);
      const b = Math.sin(lat * 11 + turb * 1.6) * 0.5 + 0.5;
      return ramp(pal, clamp(b * 0.85 + turb * 0.2));
    });
  },
};
