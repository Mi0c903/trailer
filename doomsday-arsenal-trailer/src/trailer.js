// The trailer: owns the canvas, the timeline and the post-processing chain.
import { CONFIG, aiScript } from './config.js';
import { buildTimeline, segmentAt } from './timeline.js';
import { W, H, Starfield, vignette, glitch, flash, pixelate } from './draw.js';
import { texture } from './sphere.js';
import { clamp } from './util.js';
import * as boot from './scenes/boot.js';
import * as intro from './scenes/intro.js';
import * as starmap from './scenes/starmap.js';
import * as sim from './scenes/sim.js';
import * as showcase from './scenes/showcase.js';
import * as deploy from './scenes/deploy.js';
import * as field from './scenes/field.js';
import * as gameplay from './scenes/gameplay.js';
import * as outro from './scenes/outro.js';

const SCENES = {
  boot: boot.draw,
  intro: intro.draw,
  starmap: starmap.draw,
  sim: sim.draw,
  arsenal: showcase.drawTitle,
  body: showcase.drawBody,
  rollcall: showcase.drawRollcall,
  field: field.draw,
  deploy: deploy.draw,
  gameplay: gameplay.draw,
  outro: outro.draw,
};

export class Trailer {
  constructor(canvas, cfg = CONFIG) {
    canvas.width = W;
    canvas.height = H;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.cfg = cfg;
    this.tl = buildTimeline(cfg);
    this.duration = this.tl.duration;
    this.script = aiScript(cfg);
    this.stars = new Starfield(5);
    this.gameplay = null; // { draw(ctx, localTime) } supplied by the host page
  }

  static async fonts() {
    if (typeof document === 'undefined' || !document.fonts) return;
    await Promise.all([
      document.fonts.load('900 40px Orbitron'),
      document.fonts.load('700 40px Orbitron'),
      document.fonts.load('500 40px "Chakra Petch"'),
      document.fonts.load('700 40px "Chakra Petch"'),
      document.fonts.load('40px "Share Tech Mono"'),
    ]);
  }

  // Load the screenshots used by the field-test scene.
  async loadImages(base = '') {
    this.images = new Map();
    const srcs = [...this.cfg.field.map((f) => f.src), this.cfg.uplinkScreen.src];
    await Promise.all(srcs.map(async (src) => {
      const img = new Image();
      img.src = base + src;
      try { await img.decode(); this.images.set(src, img); } catch { console.warn('missing image', src); }
    }));
  }

  // Pre-build the expensive procedural textures so the first frames don't stall.
  prepare() {
    for (const n of ['sun', 'moon', 'jupiter', 'saturn', 'giant', 'io']) texture(n);
  }

  render(t) {
    const ctx = this.ctx;
    t = clamp(t, 0, this.duration - 1e-6);
    const fps = this.cfg.fps;
    const frame = Math.round(t * fps);
    const seg = segmentAt(this.tl, t);
    const S = { t, lt: t - seg.start, dur: seg.dur, seg, frame, tr: this };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, W, H);
    const fx = SCENES[seg.id](ctx, S) || {};
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (fx.pixel) pixelate(ctx, fx.pixel);
    if (fx.glitch) glitch(ctx, fx.glitch, frame, seg.start | 0);
    if (fx.flash) flash(ctx, fx.flash, fx.flashColor || '#ffffff');
    if (!fx.noVignette) vignette(ctx, fx.vignette ?? 0.72);
    if (fx.black) flash(ctx, fx.black, '#000000');
  }
}
