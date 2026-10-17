// Save still frames as JPEGs, e.g. to check a change: npm run stills -- out/stills 12 92.5 178
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { startServer } from './serve.mjs';

const [outDir, ...times] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const { server, port } = await startServer();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[page error]', e.message));
await page.goto(`http://127.0.0.1:${port}/render.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
for (const t of times) {
  const t0 = Date.now();
  await page.evaluate((t) => window.drawAt(t), Number(t));
  const ms = Date.now() - t0;
  const data = await page.evaluate(() => window.grab(0.85));
  writeFileSync(`${outDir}/t${String(t).padStart(6, '0')}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`t=${t} ${ms}ms`);
}
await browser.close();
server.close();
