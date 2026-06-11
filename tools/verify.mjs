// Interaction verification: crank/pedal phases, steering+lean, brake squeeze.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, p === '/' ? 'index.html' : p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await page.waitForFunction(() => window.__app?.ready);
await page.waitForTimeout(400);

const shots = [
  // crank phases — pedals must stay level, chain phase advances
  ['crank-000', () => { window.__app.setView('drivetrain'); window.__app.setCrank(0); }],
  ['crank-090', () => { window.__app.setView('drivetrain'); window.__app.setCrank(-Math.PI / 2); }],
  ['crank-180', () => { window.__app.setView('drivetrain'); window.__app.setCrank(-Math.PI); }],
  // steering + lean from the front
  ['steer-left', () => { window.__app.setView('front'); window.__app.setSteer(0.45); window.__app.setLean(0.12); }],
  ['steer-right', () => { window.__app.setView('front'); window.__app.setSteer(-0.45); window.__app.setLean(-0.12); }],
  // brake open vs squeezed
  ['brake-open', () => { window.__app.setSteer(0); window.__app.setLean(0); window.__app.setView('brake'); window.__app.setBrake(0); }],
  ['brake-full', () => { window.__app.setView('brake'); window.__app.setBrake(1); }],
  // cockpit with levers pulled
  ['levers-pulled', () => { window.__app.setView('cockpit'); window.__app.setBrake(1); }],
  // ultra-closeup pad gap A/B
  ['pads-open', () => { window.__app.setBrake(0); window.__app.lookAt(-0.05, 0.70, 0.10, -0.185, 0.605, 0); }],
  ['pads-closed', () => { window.__app.setBrake(1); window.__app.lookAt(-0.05, 0.70, 0.10, -0.185, 0.605, 0); }],
  // lever blade pull A/B from outside the right grip
  ['lever-open', () => { window.__app.setBrake(0); window.__app.lookAt(0.78, 0.98, 0.42, 0.50, 0.87, 0.18); }],
  ['lever-pulled', () => { window.__app.setBrake(1); window.__app.lookAt(0.78, 0.98, 0.42, 0.50, 0.87, 0.18); }],
  // front derailleur cage
  ['fd-cage', () => { window.__app.setBrake(0); window.__app.lookAt(0.28, 0.52, 0.55, -0.02, 0.39, 0.04); }],
  // saddle closeups
  ['saddle-side', () => { window.__app.lookAt(-0.62, 1.02, 0.55, -0.20, 0.93, 0); }],
  ['saddle-rear34', () => { window.__app.lookAt(-0.75, 1.12, -0.35, -0.18, 0.92, 0); }],
];
for (const [name, fn] of shots) {
  await page.evaluate(fn);
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(root, 'shots', `verify-${name}.png`) });
  console.log(`verify-${name}.png`);
}
await browser.close();
server.close();
