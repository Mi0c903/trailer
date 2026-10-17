// Sources for the in-game footage slot.
import { W, H } from './draw.js';

function cover(ctx, img, iw, ih) {
  const s = Math.max(W / iw, H / ih);
  const w = iw * s, h = ih * s;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

// Map time within the gameplay slot to time within the clip, through the cuts.
export function clipTime(lt, cuts) {
  for (const [a, b] of cuts) {
    if (lt < b - a) return a + lt;
    lt -= b - a;
  }
  const [, end] = cuts[cuts.length - 1];
  return end;
}

// Live player: a <video> element kept in sync with the trailer clock.
export class VideoSource {
  constructor(url, cuts = null) {
    this.cuts = cuts;
    this.video = Object.assign(document.createElement('video'), { src: url, muted: true, playsInline: true, preload: 'auto' });
    this.ready = false;
    this.video.addEventListener('loadeddata', () => (this.ready = true));
    this.video.load();
  }
  sync(localTime, playing) {
    const v = this.video;
    if (!this.ready) return;
    const ct = this.cuts ? clipTime(localTime, this.cuts) : localTime;
    const want = Math.min(ct, (v.duration || 1e9) - 0.05);
    if (Math.abs(v.currentTime - want) > 0.25) v.currentTime = Math.max(0, want);
    if (playing && v.paused && ct < v.duration) v.play().catch(() => {});
    if (!playing && !v.paused) v.pause();
  }
  stop() { if (!this.video.paused) this.video.pause(); }
  draw(ctx) {
    const v = this.video;
    if (v.videoWidth) cover(ctx, v, v.videoWidth, v.videoHeight);
  }
}

// Offline renderer: pre-extracted JPEG frames (frames/000001.jpg ...).
export class FrameSource {
  constructor(base, count, fps) {
    Object.assign(this, { base, count, fps, ready: true, cache: new Map() });
  }
  index(lt) { return Math.min(this.count, Math.max(1, Math.floor(lt * this.fps + 1e-6) + 1)); }
  async load(lt) {
    const i = this.index(lt);
    if (this.cache.has(i)) return;
    const img = new Image();
    img.src = `${this.base}/${String(i).padStart(6, '0')}.jpg`;
    await img.decode();
    this.cache.clear();
    this.cache.set(i, img);
  }
  draw(ctx, lt) {
    const img = this.cache.get(this.index(lt));
    if (img) cover(ctx, img, img.naturalWidth, img.naturalHeight);
  }
}
