// 2:34 — In-game footage slot. The host page supplies `tr.gameplay` with a
// draw(ctx, localTime) method; without it a placeholder slate is shown.
import { W, H, F, C, text, corners } from '../draw.js';
import { drawBlock } from '../blocks.js';
import { clamp, ease, prog, hash1 } from '../util.js';

function timecode(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60), f = Math.floor((s % 1) * 30);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}

export function draw(ctx, S) {
  const { lt, dur, tr } = S;
  const src = tr.gameplay;
  if (src && src.ready) {
    src.draw(ctx, lt);
  } else {
    // placeholder slate
    ctx.fillStyle = '#0a0d12';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      const x = ((hash1(i * 5) * W + lt * 30 * (0.5 + hash1(i))) % (W + 200)) - 100;
      const y = hash1(i * 9) * H;
      drawBlock(ctx, x, y, 60 + hash1(i * 2) * 80, hash1(i) * 6 + lt * 0.2, i % 3 ? 'grass' : 'stone', 0.18);
    }
    ctx.save();
    ctx.setLineDash([18, 12]);
    ctx.strokeStyle = 'rgba(93,255,122,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeRect(410, 250, 1100, 580);
    ctx.restore();
    text(ctx, 'IN-GAME FOOTAGE', W / 2, 500, { font: F.display(80), color: '#ffffff', align: 'center', glow: 24, glowColor: '#5dff7a', spacing: 8 });
    text(ctx, 'Your gameplay clip goes here', W / 2, 580, { font: F.ui(38, 500), color: '#cfe8d6', align: 'center' });
    text(ctx, 'npm run render -- --gameplay your-clip.mp4', W / 2, 680, { font: F.mono(28), color: '#5dff7a', align: 'center', alpha: 0.8 });
  }
  // HUD overlay (kept to the corners and the bottom so the film's own HUD stays readable)
  const hud = clamp((lt - 0.6) / 0.3) * (1 - clamp((lt - (dur - 0.4)) / 0.3));
  corners(ctx, 30, 30, W - 60, H - 60, 50, '#ffffff', hud * 0.6, 3);
  text(ctx, tr.cfg.gameplay.label, 70, H - 62, { font: F.mono(24), color: '#ffffff', alpha: hud * 0.85, spacing: 3, glow: 8, glowColor: '#000' });
  text(ctx, tr.cfg.title.join(' '), W - 70, H - 62, { font: F.display(24, 700), color: '#ffffff', alpha: hud * 0.8, spacing: 4, align: 'right', glow: 8, glowColor: '#000' });
  const rec = Math.floor(lt * 1.6) % 2 ? 1 : 0.25;
  ctx.globalAlpha = hud * rec;
  ctx.fillStyle = C.red;
  ctx.beginPath(); ctx.arc(W / 2 - 60, H - 70, 8, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  text(ctx, timecode(lt), W / 2 - 42, H - 62, { font: F.mono(22), color: '#ffffff', alpha: hud * 0.8 });

  // hard cut between clip sections: flash + glitch
  const cuts = tr.cfg.gameplay.cuts;
  let edge = Infinity, acc = 0;
  for (let i = 0; i < cuts.length - 1; i++) { acc += cuts[i][1] - cuts[i][0]; if (Math.abs(lt - acc) < Math.abs(edge)) edge = lt - acc; }
  const atCut = edge > -0.12 && edge < 0.25;

  const unpix = lt < 0.5 ? 1 + (1 - ease.outCubic(prog(lt, 0, 0.5))) * 90 : 0;
  return {
    pixel: unpix,
    flash: Math.max(clamp(1 - lt / 0.3) * 0.8, prog(lt, dur - 0.25, dur), atCut ? clamp(1 - Math.abs(edge) / 0.25) * 0.8 : 0),
    glitch: lt > dur - 0.5 || (atCut && edge < 0.1) ? 0.8 : 0,
    vignette: 0.4,
  };
}
