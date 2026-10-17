// Scene schedule. Both the visuals and the soundtrack read from this, so the
// music hits always land on the right frames.
export const SCENE_LEN = {
  boot: 8,
  intro: 22,
  starmap: 20,
  sim: 36,
  arsenal: 2,
  body: 6,
  rollcall: 6,
  deploy: 5,
  fieldShot: 1.3,
  uplink: 2.4,
  outro: 13,
};

export const gameplayLength = (cfg) => cfg.gameplay.cuts.reduce((s, [a, b]) => s + (b - a), 0);

export function buildTimeline(cfg) {
  const segs = [];
  let t = 0;
  const add = (id, dur, extra = {}) => {
    segs.push({ id, start: t, end: t + dur, dur, ...extra });
    t += dur;
  };
  add('boot', SCENE_LEN.boot);
  add('intro', SCENE_LEN.intro);
  add('starmap', SCENE_LEN.starmap);
  add('sim', SCENE_LEN.sim);
  add('arsenal', SCENE_LEN.arsenal);
  cfg.bodies.forEach((body, index) => add('body', SCENE_LEN.body, { body, index }));
  add('rollcall', SCENE_LEN.rollcall);
  add('deploy', SCENE_LEN.deploy);
  add('field', cfg.field.length * SCENE_LEN.fieldShot + SCENE_LEN.uplink);
  add('gameplay', gameplayLength(cfg));
  add('outro', SCENE_LEN.outro);
  return { segs, duration: t };
}

export function segmentAt(tl, t) {
  for (const s of tl.segs) if (t < s.end) return s;
  return tl.segs[tl.segs.length - 1];
}

export const first = (tl, id) => tl.segs.find((s) => s.id === id);

export function gameplayWindow(tl) {
  const s = first(tl, 'gameplay');
  return { start: s.start, end: s.end };
}
