// Generates Chrome Web Store screenshots (1280x800) into docs/screenshots/.
//
// The viewer is served over http rather than loaded as an extension so the run
// is headless and repeatable. chrome.permissions is stubbed for the same
// reason: on http there is no extension origin to grant anything to.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME_PATH
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8799;
const DEBUG_PORT = 9399;
const WIDTH = 1280;
const HEIGHT = 800;

const root = process.cwd();
const dist = resolve(root, 'dist');
const fixtures = resolve(root, 'test/fixtures');
const outDir = resolve(root, 'docs/screenshots');
const FIXTURE = 'calendar-invite.eml';

const STUB = `window.chrome = { permissions: { contains: async () => true, request: async () => true } };`;

// The store's small promo tile is a fixed 440x280 marquee, not a screenshot.
const PROMO = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;height:100%}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
       background:linear-gradient(160deg,#f8fafc 0%,#eef2ff 100%);
       font:15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a}
  svg{width:72px;height:72px;fill:#2f6fed}
  h1{margin:0;font-size:27px;letter-spacing:-0.02em}
  p{margin:0;color:#475569;font-size:14px}
</style>
<svg viewBox="0 -960 960 960"><path d="M638-80 468-250l56-56 114 114 226-226 56 56L638-80ZM480-520l320-200H160l320 200Zm0 80L160-640v400h206l80 80H160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v174l-80 80v-174L480-440Zm0 0Zm0-80Zm0 80Z"/></svg>
<h1>EML Preview</h1>
<p>Read .eml files in Chrome. Nothing is uploaded.</p>`;

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.eml': 'message/rfc822', '.json': 'application/json',
};

try {
  await access(dist);
} catch {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    if (path === '/promo.html') {
      res.writeHead(200, { 'content-type': 'text/html' }).end(PROMO);
      return;
    }
    if (path === '/stub.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' }).end(STUB);
      return;
    }
    if (path.endsWith('.eml')) {
      res.writeHead(200, { 'content-type': 'message/rfc822' })
        .end(await readFile(resolve(fixtures, path.slice(1))));
      return;
    }
    let body = await readFile(resolve(dist, path.replace(/^\//, '') || 'viewer.html'));
    if (path === '/viewer.html' || path === '/') {
      body = Buffer.from(
        body.toString().replace('<script type="module"', `<script src="/stub.js"></script>\n<script type="module"`)
      );
    }
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((r) => server.listen(PORT, r));
await mkdir(outDir, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--window-size=${WIDTH},${HEIGHT}`,
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${resolve(root, 'node_modules/.cache/screenshot-profile')}`,
  'about:blank',
], { stdio: 'ignore' });

const cdpBase = `http://127.0.0.1:${DEBUG_PORT}`;
let targets = [];
for (let i = 0; i < 60 && targets.length === 0; i += 1) {
  try {
    targets = (await (await fetch(`${cdpBase}/json/list`)).json()).filter((t) => t.type === 'page');
  } catch { /* chrome still starting */ }
  if (!targets.length) await new Promise((r) => setTimeout(r, 250));
}

const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
await new Promise((r) => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise((res) => {
  const next = ++id;
  pending.set(next, res);
  ws.send(JSON.stringify({ id: next, method, params }));
});
const evaluate = (expression) => send('Runtime.evaluate', { expression, returnByValue: true });

await send('Page.enable');
await send('Runtime.enable');
// --window-size sets the outer window, which leaves the viewport short of the
// store's required dimensions. Override the metrics so the capture is exact.
await send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: 1,
  mobile: false,
});

const viewer = `http://localhost:${PORT}/viewer.html?src=http://localhost:${PORT}/${FIXTURE}`;
const home = `http://localhost:${PORT}/viewer.html`;

const shots = [
  { file: '01-message.png', url: viewer, tab: null },
  { file: '02-security.png', url: viewer, tab: 'security' },
  { file: '03-structure.png', url: viewer, tab: 'structure' },
  { file: '04-home.png', url: home, tab: null },
];

for (const { file, url, tab } of shots) {
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 2200));
  if (tab) {
    await evaluate(`document.querySelector('[data-tab-id="${tab}"]').click()`);
    await new Promise((r) => setTimeout(r, 500));
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(resolve(outDir, file), Buffer.from(shot.result.data, 'base64'));
  console.log(`  wrote docs/screenshots/${file}`);
}

// Small promo tile: fixed 440x280, required dimensions if supplied at all.
await send('Emulation.setDeviceMetricsOverride', { width: 440, height: 280, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://localhost:${PORT}/promo.html` });
await new Promise((r) => setTimeout(r, 900));
const promo = await send('Page.captureScreenshot', { format: 'png' });
await writeFile(resolve(outDir, 'promo-440x280.png'), Buffer.from(promo.result.data, 'base64'));
console.log('  wrote docs/screenshots/promo-440x280.png');

chrome.kill();
server.close();
console.log(`Done — ${shots.length} screenshots at ${WIDTH}x${HEIGHT}, plus a 440x280 promo tile.`);
process.exit(0);
