// End-to-end input test: drag the pedal with synthetic mouse events and
// assert the crank turns, the chain advances, and the wheels spin at the
// gear ratio. Also tests steering and brake inputs.
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
await page.waitForTimeout(500);

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`);
  ok ? pass++ : fail++;
};

// --- Pedal drag: grab the pedal, sweep it through ~quarter turn
await page.evaluate(() => { window.__app.setView('side'); window.__app.setCrank(-0.5); });
await page.waitForTimeout(150);
const before = await page.evaluate(() => window.__app.getState());
const pp = await page.evaluate(() => window.__app.pedalScreenPos());
await page.mouse.move(pp.x, pp.y);
await page.mouse.down();
// sweep along an arc around the BB's screen position
const bbScreen = await page.evaluate(() => {
  const THREE_BB = { x: 0, y: 0.274, z: 0 };
  return { x: 500, y: 0 }; // placeholder, we just drag downward-back
});
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(pp.x - i * 6, pp.y + i * 7, { steps: 2 });
  await page.waitForTimeout(25);
}
await page.mouse.up();
await page.waitForTimeout(150);
const after = await page.evaluate(() => window.__app.getState());
check('pedal drag turns crank', Math.abs(after.crankAngle - before.crankAngle) > 0.15,
  `Δcrank=${(after.crankAngle - before.crankAngle).toFixed(3)} rad`);
check('chain advances with crank', Math.abs(after.chainOffset - before.chainOffset) > 0.01,
  `Δchain=${(after.chainOffset - before.chainOffset).toFixed(4)} m`);

// --- Gear ratio: spin up via autopedal from rest, compare velocities once
// the crank has settled at its target cadence (engaged, not coasting)
await page.evaluate(() => { window.__app.resetMotion(); window.__app.autopedal(true); });
await page.waitForTimeout(6000);
const spin = await page.evaluate(() => window.__app.getState());
const ratio = spin.wheelVel / spin.crankVel;
check('freehub drives wheel at 50/17', Math.abs(ratio - 50 / 17) < 0.15, `ratio=${ratio.toFixed(2)} (want 2.94)`);

// --- Coasting: stop pedalling — chain/cassette must freeze, wheel keeps going
await page.evaluate(() => window.__app.autopedal(false));
await page.waitForFunction(() => window.__app.getState().crankVel === 0, { timeout: 20000 });
const c1 = await page.evaluate(() => window.__app.getState());
await page.waitForTimeout(1500);
const c2 = await page.evaluate(() => window.__app.getState());
// decoupling is the point: wheel rolls on while the chain barely creeps
check('chain freezes while coasting', Math.abs(c2.chainOffset - c1.chainOffset) < 0.006,
  `Δchain=${(c2.chainOffset - c1.chainOffset).toFixed(4)} m`);
check('wheel keeps spinning while coasting', Math.abs(c2.wheelAngle - c1.wheelAngle) > 0.3,
  `Δwheel=${(c2.wheelAngle - c1.wheelAngle).toFixed(2)} rad`);

// re-engage for the brake test
await page.evaluate(() => window.__app.autopedal(true));
await page.waitForTimeout(2000);
const respin = await page.evaluate(() => window.__app.getState());

// --- Brake: hold B, wheel must decelerate hard, levers/calipers squeeze
await page.keyboard.down('b');
await page.waitForTimeout(2500);
const braked = await page.evaluate(() => window.__app.getState());
await page.keyboard.up('b');
check('brake decelerates wheel', Math.abs(braked.wheelVel) < Math.abs(respin.wheelVel) * 0.6,
  `wheelVel ${respin.wheelVel.toFixed(2)} -> ${braked.wheelVel.toFixed(2)}`);
check('brake state engages', braked.brake > 0.85, `brake=${braked.brake.toFixed(2)}`);

// --- Steering: shift+mouse move steers; releasing Shift self-centres
await page.keyboard.down('Shift');
await page.mouse.move(200, 350);
await page.mouse.move(180, 350);
await page.waitForTimeout(700);
const steered = await page.evaluate(() => window.__app.getState());
check('shift+mouse steers', Math.abs(steered.steerAngle) > 0.15, `steer=${steered.steerAngle.toFixed(2)} rad`);
await page.keyboard.up('Shift');
await page.waitForTimeout(3000);
const centred = await page.evaluate(() => window.__app.getState());
check('bars self-centre on Shift release', Math.abs(centred.steerAngle) < 0.06,
  `steer=${centred.steerAngle.toFixed(3)} rad`);

// --- No phantom steering: right-click-drag (brake) must not steer
await page.evaluate(() => window.__app.setView('side'));
await page.keyboard.down('Shift');
await page.mouse.move(500, 350);
await page.mouse.down({ button: 'right' });
await page.mouse.move(250, 350, { steps: 5 });   // big sideways drag while braking
await page.mouse.up({ button: 'right' });
await page.keyboard.up('Shift');
await page.waitForTimeout(300);
const phantom = await page.evaluate(() => window.__app.getState());
check('no steering during right-drag brake', Math.abs(phantom.steerTarget) < 0.01,
  `steerTarget=${phantom.steerTarget.toFixed(3)}`);

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
