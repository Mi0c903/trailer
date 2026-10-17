// 2:17 — "Deploying to the Overworld": pixelates into Minecraft.
import { W, H, F, C, text, drawEye, aiLines, bar, scanlines, corners } from '../draw.js';
import { drawBlock } from '../blocks.js';
import { clamp, ease, prog, hash1 } from '../util.js';

export function draw(ctx, S) {
  const { lt, frame, tr } = S;
  tr.stars.draw(ctx, S.t, { alpha: 0.5, vx: -4 });
  const talk = aiLines(ctx, tr.script.deploy, lt, frame, { y: 640, size: 44 });
  drawEye(ctx, W / 2, 330, 95, S.t, { talk, alpha: clamp(lt / 0.3) });

  const pa = clamp((lt - 2.2) / 0.3);
  if (pa > 0) {
    const p = prog(lt, 2.4, 4.0, ease.inOutCubic);
    text(ctx, 'TARGET', 560, 760, { font: F.mono(24), color: '#7f94a8', alpha: pa, spacing: 3 });
    text(ctx, 'MINECRAFT  //  OVERWORLD', 1360, 760, { font: F.mono(24), color: '#5dff7a', alpha: pa, align: 'right', spacing: 3 });
    bar(ctx, 560, 785, 800, 36, p, '#5dff7a', pa, 32);
    text(ctx, p < 1 ? `UPLOADING ARSENAL ... ${Math.round(p * 100)}%` : 'DEPLOYED', W / 2, 875, { font: F.mono(26), color: p < 1 ? C.cyan : '#5dff7a', align: 'center', alpha: pa, spacing: 3 });
    corners(ctx, 520, 720, 880, 180, 24, '#5dff7a', pa * 0.6, 2);
  }
  // blocks raining in as the world loads
  if (lt > 3.6) {
    for (let i = 0; i < 40; i++) {
      const d = hash1(i * 3) * 0.8;
      const k = clamp((lt - 3.6 - d) / 0.9);
      if (k <= 0) continue;
      const x = hash1(i * 7) * W, y = -100 + ease.inQuad(k) * (H + 200);
      drawBlock(ctx, x, y, 50 + hash1(i) * 60, k * 4 + i, i % 3 ? 'grass' : 'stone', 1);
    }
  }
  scanlines(ctx, 0.06);
  const px = lt > 4.1 ? 1 + ease.inExpo(prog(lt, 4.1, 4.95)) * 110 : 0;
  return { pixel: px, glitch: lt > 4.0 && lt < 4.3 ? 0.6 : 0, flash: prog(lt, 4.75, 5.0), flashColor: '#ffffff' };
}
