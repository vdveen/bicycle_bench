// Material isolation experiment on the cassette, zoomed camera.
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
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await page.waitForFunction(() => window.__app?.ready);
await page.waitForTimeout(400);

const variants = [
  ['v1-baseline', {}],
  ['v2-darkcolor', { color: 0x4a4f54 }],
  ['v3-metal05', { metalness: 0.5 }],
  ['v4-standard-swap', { swap: true }],
  ['v5-nolights', { kill: true }],
];
for (const [name, opts] of variants) {
  await page.evaluate((o) => {
    // zoom onto the cassette from drive side
    window.__app.lookAt(-0.30, 0.34, 0.35, -0.422, 0.31, 0.03);
    const scene = window.__appScene;
    const THREEColorHack = null;
    scene.traverse((obj) => {
      if (obj.isMesh && obj.material?.userData?.tag === 'brushedAlu') {
        if (o.swap) {
          // brand-new plain standard material
          const nm = new obj.material.constructor.prototype.constructor.__proto__.constructor();
          // (fallback below if that fails)
        }
        const m = obj.material;
        if (o.color !== undefined) m.color.setHex(o.color);
        if (o.metalness !== undefined) m.metalness = o.metalness;
        m.needsUpdate = true;
      }
      if (o.kill && obj.isLight) obj.intensity = 0;
    });
    if (o.kill) scene.environmentIntensity = 0;
    window.__app.renderOnce();
  }, opts);
  await page.waitForTimeout(80);
  await page.screenshot({ path: path.join(root, 'shots', `probe-${name}.png`) });
  console.log(`probe-${name}.png`);
}
await browser.close();
server.close();
