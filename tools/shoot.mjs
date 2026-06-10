// Headless screenshot harness: serves the repo, loads the scene in chromium,
// captures each saved viewpoint to shots/, and archives the hero + side view
// to iterations/ for the time-lapse.
//
// Usage: node tools/shoot.mjs [iterationLabel]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const label = process.argv[2] || 'wip';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;

fs.mkdirSync(path.join(root, 'shots'), { recursive: true });
fs.mkdirSync(path.join(root, 'iterations'), { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE:', m.text()); });

await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => window.__app?.ready, { timeout: 20000 });
await page.waitForTimeout(600); // let env map + first frames settle

const views = ['hero', 'side', 'cockpit', 'drivetrain', 'derailleur', 'front'];
for (const v of views) {
  await page.evaluate((name) => {
    window.__app.setView(name);
    window.__app.setCrank(-0.6);
    window.__app.renderOnce();
  }, v);
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(root, 'shots', `${v}.png`) });
  console.log(`shot: shots/${v}.png`);
}

// Brake squeeze detail for verification
await page.evaluate(() => { window.__app.setView('front'); window.__app.setBrake(1); });
await page.waitForTimeout(100);
await page.screenshot({ path: path.join(root, 'shots', 'brake-squeezed.png') });

// Archive iteration frame (hero view) for the time-lapse
const existing = fs.readdirSync(path.join(root, 'iterations')).filter((f) => /^iter_\d+/.test(f));
const n = existing.length ? Math.max(...existing.map((f) => parseInt(f.match(/^iter_(\d+)/)[1], 10))) + 1 : 1;
const iterName = `iter_${String(n).padStart(3, '0')}_${label}.png`;
fs.copyFileSync(path.join(root, 'shots', 'hero.png'), path.join(root, 'iterations', iterName));
console.log(`iteration frame: iterations/${iterName}`);

await browser.close();
server.close();
