// Procedural soundtrack, rendered with an OfflineAudioContext.
// It reads the same timeline as the visuals, so every hit lands on its frame.
import { rng, hash1 } from './util.js';
import { POWER_AT } from './bodies.js';
import { lockTime, POWER_HIT } from './scenes/starmap.js';
import { CARD_IN } from './scenes/showcase.js';
import { SCENE_LEN } from './timeline.js';
import { HIT as INTRO_HIT } from './scenes/intro.js';

const SR = 44100;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = {
  Dm: { root: 38, tones: [50, 53, 57] },
  Bb: { root: 34, tones: [46, 50, 53] },
  F: { root: 41, tones: [45, 48, 53] },
  C: { root: 36, tones: [48, 52, 55] },
  Gm: { root: 43, tones: [43, 46, 50] },
  A: { root: 45, tones: [45, 49, 52] },
};
const PROG = ['Dm', 'Bb', 'F', 'C'];

class Synth {
  constructor(ctx, off = 0) {
    this.ctx = ctx;
    this.off = off;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.12;
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(3.6, 2.4);
    const vg = ctx.createGain(); vg.gain.value = 0.5;
    this.verb.connect(vg); vg.connect(this.master);
    const r = rng(1234);
    this.noiseBuf = ctx.createBuffer(2, SR * 3, SR);
    for (let c = 0; c < 2; c++) { const d = this.noiseBuf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
    this.drive = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 2.5); }
    this.curve = curve;
  }
  impulse(sec, decay) {
    const r = rng(77), n = Math.floor(SR * sec), b = this.ctx.createBuffer(2, n, SR);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  T(t) { return Math.max(0, t - this.off); }
  env(param, pts) {
    param.setValueAtTime(pts[0][1], this.T(pts[0][0]));
    for (let i = 1; i < pts.length; i++) {
      const [t, v, type] = pts[i];
      if (type === 'exp') param.exponentialRampToValueAtTime(Math.max(v, 1e-4), this.T(t));
      else if (type === 'set') param.setValueAtTime(v, this.T(t));
      else param.linearRampToValueAtTime(v, this.T(t));
    }
  }
  ramp(param, v, t) { param.exponentialRampToValueAtTime(v, this.T(t)); }
  vca(pts, send = 0.15, pan = 0) {
    const g = this.ctx.createGain();
    g.gain.value = 0;
    this.env(g.gain, pts);
    let out = g;
    if (pan) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    out.connect(this.master);
    if (send > 0) { const s = this.ctx.createGain(); s.gain.value = send; out.connect(s); s.connect(this.verb); }
    return g;
  }
  osc(type, f, t0, t1) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, this.T(t0)); o.start(this.T(t0)); o.stop(this.T(t1) + 0.05);
    return o;
  }
  noise(t0, t1) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true; s.start(this.T(t0), (t0 * 0.37) % 2.5); s.stop(this.T(t1) + 0.05);
    return s;
  }
  filt(type, f, q = 0.7) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  shaper() { const w = this.ctx.createWaveShaper(); w.curve = this.curve; return w; }
  chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }

  // ── drums ──
  kick(t, g = 1) {
    const o = this.osc('sine', 165, t, t + 0.6);
    this.ramp(o.frequency, 44, t + 0.12);
    this.chain(o, this.vca([[t, 0], [t + 0.002, g], [t + 0.5, 1e-4, 'exp']], 0.04));
    const n = this.noise(t, t + 0.03);
    this.chain(n, this.filt('highpass', 3000), this.vca([[t, 0.25 * g], [t + 0.02, 1e-4, 'exp']], 0));
  }
  snare(t, g = 1) {
    const n = this.noise(t, t + 0.3);
    this.chain(n, this.filt('bandpass', 1900, 0.7), this.vca([[t, 0.7 * g], [t + 0.24, 1e-4, 'exp']], 0.25));
    const o = this.osc('triangle', 200, t, t + 0.15);
    this.ramp(o.frequency, 150, t + 0.1);
    this.chain(o, this.vca([[t, 0.45 * g], [t + 0.12, 1e-4, 'exp']], 0.1));
  }
  clap(t, g = 1) {
    for (let k = 0; k < 3; k++) {
      const tt = t + k * 0.011;
      this.chain(this.noise(tt, tt + 0.2), this.filt('bandpass', 1300, 1.2), this.vca([[tt, 0.5 * g], [tt + (k === 2 ? 0.18 : 0.02), 1e-4, 'exp']], 0.3));
    }
  }
  hat(t, g = 1, open = false, pan = 0) {
    this.chain(this.noise(t, t + 0.3), this.filt('highpass', 8000), this.vca([[t, 0.22 * g], [t + (open ? 0.26 : 0.045), 1e-4, 'exp']], 0.05, pan));
  }
  tom(t, f = 70, g = 1) {
    const o = this.osc('sine', f * 1.7, t, t + 0.9);
    this.ramp(o.frequency, f, t + 0.04);
    this.ramp(o.frequency, f * 0.7, t + 0.5);
    this.chain(o, this.vca([[t, 0], [t + 0.003, g], [t + 0.8, 1e-4, 'exp']], 0.35));
    this.chain(this.noise(t, t + 0.2), this.filt('lowpass', 500), this.vca([[t, 0.5 * g], [t + 0.15, 1e-4, 'exp']], 0.3));
  }
  crash(t, g = 1) {
    this.chain(this.noise(t, t + 2.5), this.filt('highpass', 4500), this.vca([[t, 0.28 * g], [t + 2.2, 1e-4, 'exp']], 0.4));
  }

  // ── cinematic ──
  boom(t, g = 1) {
    const o = this.osc('sine', 75, t, t + 3);
    this.ramp(o.frequency, 27, t + 1.8);
    this.chain(o, this.vca([[t, 0], [t + 0.008, g], [t + 2.8, 1e-4, 'exp']], 0.3));
    this.chain(this.noise(t, t + 2.4), this.filt('lowpass', 380), this.vca([[t, 0.9 * g], [t + 2.2, 1e-4, 'exp']], 0.5));
  }
  impact(t, g = 1) {
    this.boom(t, g);
    this.chain(this.noise(t, t + 1.8), this.filt('lowpass', 4000), this.vca([[t, 0.45 * g], [t + 1.5, 1e-4, 'exp']], 0.7));
    this.kick(t, g * 0.9);
  }
  braam(t, dur, rootMidi, g = 1) {
    const f = mtof(rootMidi);
    const lp = this.filt('lowpass', 150, 2.5);
    this.env(lp.frequency, [[t, 150], [t + 0.22, 2600, 'exp'], [t + dur, 380, 'exp']]);
    const out = this.vca([[t, 0], [t + 0.04, g * 0.35], [t + dur * 0.55, g * 0.25], [t + dur, 1e-4, 'exp']], 0.65);
    this.chain(lp, this.shaper(), out);
    for (const [m, type] of [[1, 'sawtooth'], [1.004, 'sawtooth'], [0.5, 'sawtooth'], [1.498, 'sawtooth'], [2.003, 'square'], [0.996, 'sawtooth']]) {
      const o = this.osc(type, f * m, t, t + dur);
      o.connect(lp);
    }
  }
  pad(t0, t1, midis, g = 0.1, cut = 900, fade = 1.5) {
    const lp = this.filt('lowpass', cut, 0.6);
    const lfo = this.osc('sine', 0.13, t0, t1);
    const lg = this.ctx.createGain(); lg.gain.value = cut * 0.35;
    lfo.connect(lg); lg.connect(lp.frequency);
    const out = this.vca([[t0, 0], [t0 + fade, g], [t1 - fade, g], [t1, 0]], 0.6);
    lp.connect(out);
    midis.forEach((m, i) => {
      for (const det of [-7, 7]) {
        const o = this.osc('sawtooth', mtof(m), t0, t1);
        o.detune.value = det + i * 2;
        o.connect(lp);
      }
    });
  }
  pluck(t, midi, g = 0.1, dur = 0.25, type = 'sawtooth', cut = 2600, pan = 0) {
    const o = this.osc(type, mtof(midi), t, t + dur);
    const lp = this.filt('lowpass', cut, 3);
    this.env(lp.frequency, [[t, cut], [t + dur, 280, 'exp']]);
    this.chain(o, lp, this.vca([[t, 0], [t + 0.003, g], [t + dur, 1e-4, 'exp']], 0.3, pan));
  }
  bass(t, midi, dur, g = 0.3, cut = 700) {
    const lp = this.filt('lowpass', cut * 1.6, 1.5);
    this.env(lp.frequency, [[t, cut * 1.6], [t + dur, cut * 0.4, 'exp']]);
    const out = this.vca([[t, 0], [t + 0.006, g], [t + dur * 0.85, g * 0.6], [t + dur, 1e-4, 'exp']], 0.05);
    this.chain(lp, out);
    this.osc('sawtooth', mtof(midi), t, t + dur).connect(lp);
    const sub = this.osc('sine', mtof(midi - 12), t, t + dur);
    this.chain(sub, this.vca([[t, 0], [t + 0.006, g * 0.8], [t + dur, 1e-4, 'exp']], 0));
  }
  riser(t0, t1, g = 0.4) {
    const bp = this.filt('bandpass', 300, 2.5);
    this.env(bp.frequency, [[t0, 300], [t1, 7500, 'exp']]);
    this.chain(this.noise(t0, t1), bp, this.vca([[t0, 0], [t1 - 0.02, g], [t1, 0]], 0.5));
    const o = this.osc('sawtooth', 110, t0, t1);
    this.ramp(o.frequency, 880, t1);
    this.chain(o, this.filt('lowpass', 2500), this.vca([[t0, 0], [t1 - 0.02, g * 0.18], [t1, 0]], 0.4));
  }
  swell(t0, t1, g = 0.5) {
    this.chain(this.noise(t0, t1), this.filt('lowpass', 1800), this.vca([[t0, 1e-4], [t1 - 0.01, g, 'exp'], [t1, 0]], 0.6));
  }
  whoosh(t, dur, g = 0.4) {
    const bp = this.filt('bandpass', 400, 1.5);
    this.env(bp.frequency, [[t, 400], [t + dur * 0.5, 3500, 'exp'], [t + dur, 300, 'exp']]);
    this.chain(this.noise(t, t + dur), bp, this.vca([[t, 0], [t + dur * 0.5, g], [t + dur, 0]], 0.5));
  }
  beep(t, f, dur = 0.06, g = 0.08, type = 'sine', pan = 0) {
    this.chain(this.osc(type, f, t, t + dur), this.vca([[t, 0], [t + 0.003, g], [t + dur, 1e-4, 'exp']], 0.15, pan));
  }
  tick(t, g = 0.05, f = 4500) {
    this.chain(this.noise(t, t + 0.02), this.filt('highpass', f), this.vca([[t, g], [t + 0.012, 1e-4, 'exp']], 0));
  }
  siren(t0, t1, g = 0.06) {
    const o = this.osc('square', 760, t0, t1);
    const lfo = this.osc('triangle', 1.4, t0, t1);
    const lg = this.ctx.createGain(); lg.gain.value = 200;
    lfo.connect(lg); lg.connect(o.frequency);
    this.chain(o, this.filt('lowpass', 1600), this.vca([[t0, 0], [t0 + 0.2, g], [t1 - 0.1, g], [t1, 0]], 0.3));
  }
  drone(t0, t1, midi, g = 0.2, bend = 0, cut = 380) {
    const lp = this.filt('lowpass', cut, 1.2);
    const out = this.vca([[t0, 0], [t0 + 1, g], [t1 - 0.05, g], [t1, 0]], 0.4);
    this.chain(lp, this.shaper(), out);
    for (const d of [0, 9, -12]) {
      const o = this.osc('sawtooth', mtof(midi), t0, t1);
      this.env(o.detune, [[t0, d], [t1, d + bend * 100]]);
      o.connect(lp);
    }
  }
  zap(t0, t1, g = 0.3) {
    const o = this.osc('sawtooth', 220, t0, t1);
    const trem = this.osc('square', 28, t0, t1);
    const tg = this.ctx.createGain(); tg.gain.value = 40;
    trem.connect(tg); tg.connect(o.frequency);
    this.chain(o, this.filt('lowpass', 2200), this.vca([[t0, 0], [t0 + 0.03, g * 0.5], [t1 - 0.2, g * 0.4], [t1, 0]], 0.3));
    this.chain(this.noise(t0, t1), this.filt('bandpass', 1400, 0.8), this.vca([[t0, 0], [t0 + 0.03, g], [t1 - 0.2, g * 0.8], [t1, 0]], 0.3));
  }
  crunch(t, g = 0.4) {
    this.chain(this.noise(t, t + 0.3), this.filt('bandpass', 900, 1.5), this.shaper(), this.vca([[t, g], [t + 0.25, 1e-4, 'exp']], 0.2));
  }
  thunder(t, g = 0.6) {
    this.chain(this.noise(t, t + 0.12), this.filt('highpass', 1500), this.vca([[t, g], [t + 0.1, 1e-4, 'exp']], 0.5));
    this.chain(this.noise(t, t + 3), this.filt('lowpass', 220), this.vca([[t, 0], [t + 0.05, g * 1.2], [t + 2.8, 1e-4, 'exp']], 0.5));
  }
  laser(t, g = 0.3) {
    const o = this.osc('sawtooth', 2200, t, t + 0.8);
    this.ramp(o.frequency, 110, t + 0.7);
    this.chain(o, this.vca([[t, g], [t + 0.75, 1e-4, 'exp']], 0.4));
    const s = this.osc('square', 55, t, t + 1.5);
    this.chain(s, this.filt('lowpass', 400), this.vca([[t, g], [t + 1.4, 1e-4, 'exp']], 0.2));
  }
  shing(t, g = 0.2) {
    for (const f of [2400, 3170, 4730, 6100]) this.chain(this.osc('sine', f, t, t + 1.6), this.vca([[t, g * 0.25], [t + 1.5, 1e-4, 'exp']], 0.5));
    this.chain(this.noise(t, t + 0.2), this.filt('highpass', 6000), this.vca([[t, g], [t + 0.15, 1e-4, 'exp']], 0.4));
  }
  roar(t, dur, g = 0.5) {
    const lp = this.filt('lowpass', 200, 1);
    this.env(lp.frequency, [[t, 200], [t + dur * 0.25, 2600, 'exp'], [t + dur, 300, 'exp']]);
    this.chain(this.noise(t, t + dur), lp, this.shaper(), this.vca([[t, 0], [t + 0.08, g], [t + dur, 1e-4, 'exp']], 0.5));
  }
  sweep(t0, t1, f0, f1, g = 0.05, send = 0.2) {
    const o = this.osc('sine', f0, t0, t1);
    this.ramp(o.frequency, f1, t1);
    this.chain(o, this.vca([[t0, g], [t1, 1e-4, 'exp']], send));
  }
  stutter(t0, t1, g = 0.06, seed = 1) {
    for (let t = t0, k = 0; t < t1; t += 1 / 24, k++) {
      if (hash1(seed * 31 + k) < 0.45) continue;
      this.beep(t, 400 + hash1(seed + k * 7) * 3200, 0.03, g, 'square');
    }
  }
}

// ── the score ──────────────────────────────────────────────────────────────
function score(S, tr) {
  const segs = tr.tl.segs;
  const at = (id) => segs.find((s) => s.id === id);
  const END = tr.duration;
  const boot = at('boot'), intro = at('intro'), map = at('starmap'), sim = at('sim'), ars = at('arsenal');
  const bodies = segs.filter((s) => s.id === 'body');
  const roll = at('rollcall'), dep = at('deploy'), field = at('field'), game = at('gameplay'), out = at('outro');

  // AI typing ticks
  const typeTicks = (lines, base, cps = 34) => {
    for (const [a, b, str, o = {}] of lines) {
      const plain = str.replace(/[[\]]/g, '');
      const rate = o.big ? cps * 0.7 : cps;
      for (let i = 0; i < plain.length; i++) {
        const t = base + a + i / rate;
        if (t > base + b) break;
        if (plain[i] !== ' ') S.tick(t, 0.03, 3000 + hash1(i) * 3000);
      }
    }
  };

  // BOOT
  S.drone(boot.start, intro.start + 2, 26, 0.12, 0, 120);
  [0.3, 0.85, 1.4, 2.5, 3.05].forEach((t) => S.beep(boot.start + t, 1250, 0.05, 0.07));
  [0.62, 1.17, 1.72, 2.8].forEach((t) => S.beep(boot.start + t, 1850, 0.05, 0.05));
  S.beep(boot.start + 2.25, 140, 0.35, 0.12, 'square');
  S.beep(boot.start + 2.65, 140, 0.35, 0.1, 'square');
  S.stutter(boot.start + 3.2, boot.start + 5.5, 0.025, 3);
  S.sweep(boot.start + 3.5, boot.start + 5.0, 200, 900, 0.05);
  S.swell(boot.start + 4.4, boot.start + 6.0, 0.35);
  S.impact(boot.start + 6.0, 0.6);
  S.whoosh(boot.start + 5.6, 1.2, 0.25);

  // INTRO
  S.pad(boot.start + 6, intro.start + INTRO_HIT, [38, 50, 53, 57], 0.07, 700, 2.5);
  for (let t = intro.start + 1; t < intro.start + INTRO_HIT - 0.6; t += 2) { S.kick(t, 0.35); S.kick(t + 0.28, 0.22); }
  typeTicks(tr.script.intro, intro.start);
  S.swell(intro.start + INTRO_HIT - 1.6, intro.start + INTRO_HIT, 0.4);
  S.impact(intro.start + INTRO_HIT, 1);
  S.braam(intro.start + INTRO_HIT, 4.5, 38, 1);
  S.pad(intro.start + INTRO_HIT, map.start + 1, [38, 45, 50, 53], 0.06, 500, 0.3);
  S.riser(intro.start + 19.4, map.start, 0.35);
  S.whoosh(intro.start + 20, 2, 0.3);

  // STAR MAP — 120 BPM pulse
  const beat = 0.5;
  S.impact(map.start, 0.5);
  for (let bar = 0; bar < 10; bar++) {
    const t0 = map.start + bar * 2;
    if (t0 + 2 > map.start + 14.4) break;
    const ch = CHORDS[PROG[Math.floor(bar / 2) % 4]];
    S.pad(t0, t0 + 2.05, ch.tones, 0.045, 1100, 0.05);
    for (let k = 0; k < 16; k++) {
      const notes = [ch.tones[0] + 12, ch.tones[1] + 12, ch.tones[2] + 12, ch.tones[0] + 24];
      const m = notes[[0, 1, 2, 3, 2, 1, 2, 0][k % 8]];
      S.pluck(t0 + k * 0.125, m, 0.05 + bar * 0.004, 0.18, 'sawtooth', 1600 + bar * 250, k % 2 ? 0.3 : -0.3);
    }
    S.bass(t0, ch.root, 1.9, 0.18);
    if (bar >= 2) for (let k = 0; k < 4; k++) S.kick(t0 + k * beat, 0.55);
    if (bar >= 3) for (let k = 0; k < 8; k++) S.hat(t0 + k * 0.25 + 0.125, 0.6, false, 0.2);
    if (bar >= 4) { S.clap(t0 + 0.5, 0.5); S.clap(t0 + 1.5, 0.5); }
  }
  tr.cfg.arsenal.forEach((b, i, all) => {
    const t = map.start + lockTime(i, all.length);
    S.beep(t, 1500 + (i % 4) * 120, 0.04, 0.06); S.beep(t + 0.06, 2000 + (i % 4) * 160, 0.04, 0.05);
    S.beep(t + 0.75, 880, 0.2, 0.035); S.beep(t + 0.75, 1320, 0.2, 0.025);
  });
  typeTicks(tr.script.starmap, map.start);
  S.boom(map.start + 10.2, 0.5);
  S.pad(map.start + 14.4, map.start + POWER_HIT + 0.1, [38, 50, 57, 62], 0.06, 600, 0.3);
  S.riser(map.start + 14.4, map.start + POWER_HIT, 0.45);
  S.impact(map.start + POWER_HIT, 1.1);
  S.braam(map.start + POWER_HIT, 3.4, 34, 1.1);
  S.swell(map.start + 18.6, sim.start, 0.4);
  S.impact(sim.start, 0.5);

  // SIMULATION — quirky lab electronica
  for (let c = 0; c < 20; c++) for (let r = 0; r < 8; r++) {
    if ((c + r) % 3) continue;
    S.tick(sim.start + 0.2 + Math.hypot(c - 10, r - 4) * 0.12, 0.05, 2500);
  }
  S.pad(sim.start, sim.start + 3.4, [50, 57, 62], 0.04, 900, 1);
  S.whoosh(sim.start + 3.2, 0.8, 0.25);
  const simBeat0 = sim.start + 3.5, simStop = sim.start + 24;
  const bassPat = [0, 0, 12, 0, 3, 0, 7, 5];
  for (let bar = 0; simBeat0 + bar * 2 < simStop; bar++) {
    const t0 = simBeat0 + bar * 2;
    const root = [38, 38, 43, 41][bar % 4];
    for (let k = 0; k < 8; k++) {
      const t = t0 + k * 0.25;
      if (t >= simStop) break;
      S.bass(t, root + bassPat[k], 0.2, 0.17, 900);
      S.hat(t + 0.125, 0.45, false, 0.3);
      if (k % 4 === 0) S.kick(t, 0.6);
      if (k % 4 === 2 && bar > 0) S.clap(t, 0.32);
      if (bar % 2 === 1 && (k === 3 || k === 6)) S.pluck(t, root + 36 + [7, 3][k % 2], 0.05, 0.3, 'triangle', 4000);
    }
  }
  S.shing(sim.start + 7.4, 0.12);
  [10.8, 11.1, 11.4, 18.6, 18.85].forEach((t) => { S.whoosh(sim.start + t - 0.3, 0.6, 0.18); S.beep(sim.start + t, 300, 0.25, 0.06, 'square'); });
  S.swell(sim.start + 12.7, sim.start + 13.1, 0.4);
  S.zap(sim.start + 13.1, sim.start + 14.8, 0.35);
  S.impact(sim.start + 13.1, 0.55);
  [13.25, 13.45, 13.65].forEach((t) => S.crunch(sim.start + t, 0.35));
  S.beep(sim.start + 17.0, 660, 0.4, 0.06); S.beep(sim.start + 17.08, 990, 0.4, 0.05);
  S.sweep(sim.start + 19.9, sim.start + 21.1, 300, 60, 0.25, 0.4);
  S.whoosh(sim.start + 19.9, 1.2, 0.35);
  S.impact(sim.start + 21.05, 0.8);
  S.crunch(sim.start + 21.1, 0.3); S.crunch(sim.start + 21.25, 0.25);
  S.siren(sim.start + 24, sim.start + 33.1, 0.045);
  typeTicks(tr.script.sim, sim.start);
  S.boom(sim.start + 25, 0.4);
  S.drone(sim.start + 26.3, sim.start + 33.1, 26, 0.32, -6, 300);
  S.drone(sim.start + 26.3, sim.start + 33.1, 38, 0.12, -5, 900);
  for (let t = sim.start + 26.5; t < sim.start + 32.5; t += 1) S.tom(t, 55, 0.6);
  S.riser(sim.start + 30.5, sim.start + 33.1, 0.55);
  S.impact(sim.start + 33.1, 1.2);
  S.stutter(sim.start + 33.2, sim.start + 33.6, 0.05, 9);
  [0.35, 0.77, 1.19, 1.61].forEach((d) => S.beep(sim.start + 33.6 + d, 520, 0.1, 0.07, 'square'));
  S.stutter(sim.start + 35.75, sim.start + 36, 0.05, 11);

  // THE ARSENAL
  S.impact(ars.start, 1);
  S.braam(ars.start, 2.2, 38, 0.8);
  S.riser(ars.start + 0.8, ars.start + 2, 0.3);

  // BODIES — trailer drums, one 3-bar block per weapon
  bodies.forEach((seg, i) => {
    const t0 = seg.start;
    const ch = CHORDS[['Dm', 'Bb', 'F', 'C', 'Gm', 'Bb', 'A'][i % 7]];
    S.impact(t0, 0.75);
    S.pad(t0, t0 + 6.05, ch.tones, 0.05, 1000 + i * 120, 0.08);
    for (let bar = 0; bar < 3; bar++) {
      const tb = t0 + bar * 2;
      S.bass(tb, ch.root, 1.95, 0.2, 600);
      for (let k = 0; k < 8; k++) {
        const t = tb + k * 0.25;
        const pm = i === 5 && t > t0 + 2.4 && t < t0 + POWER_AT; // supernova collapse: drums hold their breath
        if (!pm && [0, 3, 4, 6].includes(k)) S.tom(t, k === 0 ? 62 : 82, k === 0 ? 0.9 : 0.55);
        if (!pm && k % 4 === 0) S.kick(t, 0.6);
        if (!pm && i >= 2 && k % 4 === 2) S.snare(t, 0.45);
        S.pluck(t, (k % 2 ? ch.tones[2] : ch.tones[0]) + 12, 0.035, 0.22, 'sawtooth', 1800, k % 2 ? 0.4 : -0.4);
        S.pluck(t + 0.125, ch.tones[1] + 12, 0.025, 0.18, 'sawtooth', 1500, 0);
        if (i >= 4 && !pm) { S.hat(t, 0.45); S.hat(t + 0.125, 0.3); }
      }
    }
    const tp = t0 + POWER_AT;
    S.braam(tp, 2.6, ch.root, 0.95);
    S.boom(tp, 0.9);
    S.crash(tp, 0.8);
    const type = seg.body.type;
    if (type === 'sun') { S.roar(tp, 2.5, 0.55); S.laser(tp, 0.2); }
    else if (type === 'moon') { S.swell(tp - 0.6, tp, 0.35); S.whoosh(tp, 2.4, 0.4); }
    else if (type === 'storm') { S.thunder(tp, 0.7); S.thunder(tp + 0.9, 0.4); S.thunder(tp + 1.7, 0.35); }
    else if (type === 'ringed') { S.shing(tp, 0.25); S.shing(tp + 0.35, 0.18); S.shing(tp + 0.7, 0.14); }
    else if (type === 'pulsar') { S.laser(tp, 0.35); S.zap(tp, tp + 2.6, 0.22); }
    else if (type === 'supernova') { S.riser(t0 + 2.3, tp, 0.5); S.roar(tp, 3, 0.7); S.impact(tp, 0.8); }
    else if (type === 'blackhole') { S.drone(tp, t0 + 6, 26, 0.3, -8, 260); S.swell(tp - 0.8, tp, 0.5); }
    else if (type === 'galaxy') { S.swell(tp - 0.8, tp, 0.45); S.whoosh(tp + 0.3, 2.5, 0.4); S.shing(tp, 0.15); }
    S.whoosh(t0 + 5.4, 0.6, 0.25);
  });

  // ROLL CALL — a hit per card, then the tagline
  tr.cfg.arsenal.forEach((w, k) => {
    const t = roll.start + k * CARD_IN;
    S.tom(t, 70 + (k % 4) * 6, 0.55); S.tick(t, 0.08, 2500);
    if (k % 4 === 0) { S.kick(t, 0.7); S.crash(t, 0.25); }
  });
  const sweep = roll.start + tr.cfg.arsenal.length * CARD_IN + 0.2;
  for (let k = 0; k < tr.cfg.arsenal.length; k++) S.beep(sweep + k * 0.045, 700 + k * 60, 0.04, 0.04, 'square');
  S.pad(roll.start, roll.end + 0.5, [38, 50, 53, 57, 62], 0.05, 900, 0.3);
  S.riser(roll.start + 1.6, roll.start + 3.4, 0.45);
  S.impact(roll.start + 3.4, 1.1);
  S.braam(roll.start + 3.4, 3, 38, 1);

  // DEPLOY
  S.stutter(dep.start, dep.start + 0.4, 0.05, 21);
  typeTicks(tr.script.deploy, dep.start);
  S.drone(dep.start, dep.end, 50, 0.05, 12, 1200);
  for (let t = dep.start + 2.4; t < dep.start + 4.0; t += 0.0625) S.tick(t, 0.04, 5000);
  S.beep(dep.start + 4.0, 1046, 0.3, 0.07); S.beep(dep.start + 4.08, 1568, 0.4, 0.06);
  S.riser(dep.start + 3.0, dep.end, 0.6);
  S.stutter(dep.start + 4.1, dep.end, 0.04, 23);

  // FIELD TESTS + GAMEPLAY — full drive
  S.impact(field.start, 1);
  S.crash(field.start, 0.8);
  for (let k = 1; k < tr.cfg.field.length; k++) { S.crash(field.start + k * SCENE_LEN.fieldShot, 0.4); S.tom(field.start + k * SCENE_LEN.fieldShot, 64, 0.7); }
  const upT = field.start + tr.cfg.field.length * SCENE_LEN.fieldShot;
  S.whoosh(upT - 0.2, 0.6, 0.3);
  for (let t = upT + 0.3; t < field.end - 0.4; t += 0.0625) S.tick(t, 0.035, 5000);
  S.riser(field.end - 1.4, field.end, 0.5);
  S.impact(game.start, 1.1);
  S.crash(game.start, 1);
  const driveStart = field.start;
  const bars = Math.floor((game.end - driveStart) / 2);
  for (let bar = 0; bar < bars; bar++) {
    const t0 = driveStart + bar * 2;
    const ch = CHORDS[PROG[bar % 4]];
    const last = bar === bars - 1;
    S.pad(t0, t0 + 2.05, ch.tones.map((m) => m + 12), 0.035, 1600, 0.05);
    for (let k = 0; k < 16; k++) {
      const t = t0 + k * 0.125;
      if (k % 4 === 0) S.kick(t, 0.85);
      if (k === 4 || k === 12) S.snare(t, 0.65);
      if (last && k >= 8) S.snare(t, 0.25 + (k - 8) * 0.05);
      S.hat(t, k % 2 ? 0.35 : 0.55, k % 8 === 6, k % 2 ? 0.3 : -0.3);
      if (k % 2 === 0) S.bass(t, ch.root + (k % 8 === 6 ? 12 : 0), 0.24, 0.2, 850);
      const arp = [ch.tones[0] + 24, ch.tones[2] + 12, ch.tones[1] + 24, ch.tones[2] + 12];
      S.pluck(t, arp[k % 4], 0.035, 0.15, 'square', 2600, k % 2 ? 0.35 : -0.35);
    }
    if (bar % 8 === 0 && bar) S.crash(t0, 0.7);
  }
  let cutAt = game.start;
  tr.cfg.gameplay.cuts.slice(0, -1).forEach(([a, b]) => { cutAt += b - a; S.impact(cutAt, 0.9); S.crash(cutAt, 0.7); });
  S.riser(game.end - 2, game.end, 0.55);

  // OUTRO
  S.impact(out.start, 1);
  S.impact(out.start + 0.5, 1.1); S.braam(out.start + 0.5, 1.2, 38, 0.9);
  S.impact(out.start + 1.0, 1.2); S.braam(out.start + 1.0, 4, 34, 1);
  S.crash(out.start + 1.0, 0.9);
  S.pad(out.start + 1, END, [38, 50, 53, 57, 62, 69], 0.06, 1200, 2);
  for (let t = out.start + 3; t < out.start + 5.6; t += 1) S.tom(t, 58, 0.7);
  S.whoosh(out.start + 4.9, 1, 0.3);
  S.shing(out.start + 5.7, 0.12);
  for (let t = out.start + 6, k = 0; t < END - 1.2; t += 0.25, k++) {
    const m = [62, 65, 69, 74, 72, 69, 65, 64][k % 8];
    S.pluck(t, m, 0.03, 0.4, 'triangle', 3000, k % 2 ? 0.4 : -0.4);
  }
  S.boom(END - 3, 0.5);
}

// The score is rendered in independent time chunks (each event belongs to the
// chunk its start time falls in, tails spill over) and mixed. One giant graph
// would keep thousands of nodes alive for three minutes and render very slowly.
const INSTRUMENTS = new Set(['kick', 'snare', 'clap', 'hat', 'tom', 'crash', 'boom', 'impact', 'braam', 'pad', 'pluck', 'bass', 'riser', 'swell', 'whoosh', 'beep', 'tick', 'siren', 'drone', 'zap', 'crunch', 'thunder', 'laser', 'shing', 'roar', 'sweep', 'stutter']);
function windowed(synth, a, b) {
  let depth = 0;
  return new Proxy(synth, {
    get(target, prop) {
      const v = target[prop];
      if (typeof v !== 'function' || !INSTRUMENTS.has(prop)) return v;
      return function (...args) {
        if (depth === 0 && (args[0] < a || args[0] >= b)) return undefined;
        depth++;
        try { return v.apply(this, args); } finally { depth--; }
      };
    },
  });
}

// Dry run of the score to learn how far each chunk's events ring on.
const SPAN = { pad: (x) => x[1], riser: (x) => x[1], swell: (x) => x[1], siren: (x) => x[1], drone: (x) => x[1], zap: (x) => x[1], sweep: (x) => x[1], stutter: (x) => x[1], braam: (x) => x[0] + x[1], whoosh: (x) => x[0] + x[1], roar: (x) => x[0] + x[1] };
function eventSpans(tr) {
  const ev = [];
  const rec = new Proxy({}, { get: (_, prop) => (...args) => { if (INSTRUMENTS.has(prop)) ev.push([args[0], (SPAN[prop]?.(args) ?? args[0]) + 3]); } });
  score(rec, tr);
  return ev;
}

const CHUNK = 12, REVERB = 3.8;
export async function renderSoundtrack(tr, onProgress = () => {}) {
  const total = Math.ceil(SR * tr.duration);
  const mix = [new Float32Array(total), new Float32Array(total)];
  const n = Math.ceil(tr.duration / CHUNK);
  const spans = eventSpans(tr);
  for (let c = 0; c < n; c++) {
    const a = c * CHUNK, b = Math.min(tr.duration, a + CHUNK);
    const ringOut = spans.reduce((m, [s, e]) => (s >= a && s < b ? Math.max(m, e) : m), b);
    const len = Math.min(tr.duration, ringOut + REVERB) - a;
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * len), SR);
    score(windowed(new Synth(ctx, a), a, b), tr);
    const buf = await ctx.startRendering();
    const o = Math.round(a * SR);
    for (let ch = 0; ch < 2; ch++) {
      const src = buf.getChannelData(ch), dst = mix[ch];
      const m = Math.min(src.length, total - o);
      for (let i = 0; i < m; i++) dst[o + i] += src[i];
    }
    onProgress((c + 1) / n);
  }
  // final fade-out and a gentle safety limiter
  const fade = Math.round(1.6 * SR);
  for (let ch = 0; ch < 2; ch++) {
    const d = mix[ch];
    for (let i = 0; i < total; i++) {
      let v = d[i];
      if (i > total - fade) v *= (total - i) / fade;
      d[i] = Math.abs(v) < 0.8 ? v : Math.sign(v) * (0.8 + 0.2 * Math.tanh((Math.abs(v) - 0.8) / 0.2));
    }
  }
  const out = new AudioBuffer({ length: total, numberOfChannels: 2, sampleRate: SR });
  out.copyToChannel(mix[0], 0);
  out.copyToChannel(mix[1], 1);
  return out;
}

// Renders the soundtrack and returns it as a base64 16-bit WAV string.
export async function renderSoundtrackWav(tr) {
  const buf = await renderSoundtrack(tr);
  const n = buf.length, ch = buf.numberOfChannels;
  const bytes = new Uint8Array(44 + n * ch * 2);
  const dv = new DataView(bytes.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, SR, true);
  dv.setUint32(28, SR * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, n * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
