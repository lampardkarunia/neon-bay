// tools/shoot.mjs — memotret gim dengan Chrome headless (Node 22, bawaan saja).
//
// Menyajikan root repo di port lokal, mengendalikan chrome-headless-shell bawaan lewat
// WebSocket DevTools-nya, dan untuk tiap shot di shots.json memuat
// game/index.html?<query>, menunggu window.__shotReady, menolak shot bila ada error
// konsol fatal / exception tak tertangkap / canvas kosong, lalu menyimpan JPEG
// 1280x720 (kualitas ~0.85) ke screenshots/<name>. Juga memuat gim tanpa query
// sebagai pemeriksaan asap bahwa gim bisa boot di luar mode shot.
// Pakai: node tools/shoot.mjs   (dari root repo; keluar non-nol bila ada kegagalan)

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const HTTP_PORT = 8129;
const DEBUG_PORT = 9339;
const CHROME = '/home/hatch/.cache/puppeteer/chrome-headless-shell/linux-157.0.8103.50/chrome-headless-shell-linux64/chrome-headless-shell';
const SHOTS = JSON.parse(readFileSync(join(ROOT, 'shots.json'), 'utf8'));
const SHOT_DIR = join(ROOT, 'screenshots');
const MAX_BYTES = 262144;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serve() {
  return new Promise((resolvePromise, reject) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        if (rel === '') rel = 'game/index.html';
        const file = resolve(ROOT, rel);
        if (!file.startsWith(ROOT + '/') || !existsSync(file) || !statSync(file).isFile()) {
          res.writeHead(404, { 'content-type': 'text/plain' });
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
        createReadStream(file).pipe(res);
      } catch {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('server error');
      }
    });
    server.once('error', reject);
    server.listen(HTTP_PORT, '127.0.0.1', () => resolvePromise(server));
  });
}

async function httpJson(url, { method = 'GET' } = {}) {
  const res = await fetch(url, { method });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function waitFor(fn, timeoutMs, label) {
  const start = Date.now();
  for (;;) {
    const value = await fn().catch(() => null);
    if (value) return value;
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

// Klien CDP minimal di atas WebSocket global milik Node.
class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: res, reject: rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) rej(new Error(`CDP ${msg.error.code}: ${msg.error.message}`));
        else res(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    };
    this.open = new Promise((res, rej) => {
      this.ws.onopen = res;
      this.ws.onerror = () => rej(new Error('WebSocket failed to open'));
    });
  }

  async call(method, params = {}) {
    await this.open;
    const id = this.nextId++;
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const r = await this.call('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`page exception: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`);
    return r.result?.value;
  }

  fatalEvents() {
    return this.events.filter((e) => {
      if (e.method === 'Runtime.exceptionThrown') return true;
      if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') return true;
      return false;
    });
  }
}

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true });
  const server = await serve();
  console.log(`serving ${ROOT} on http://127.0.0.1:${HTTP_PORT}`);

  const profile = `/tmp/neon-bay-shoot-profile-${process.pid}`;
  const chrome = spawn(CHROME, [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--hide-scrollbars',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=1280,720',
    'about:blank',
  ], { stdio: 'ignore' });

  const failures = [];
  try {
    const targets = await waitFor(
      async () => {
        const list = await httpJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        const page = list.find((t) => t.type === 'page');
        return page ?? null;
      },
      30000,
      'chrome DevTools page target',
    );
    const cdp = new Cdp(targets.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

    async function loadAndCheck(url, { waitReady }) {
      await cdp.call('Page.navigate', { url });
      if (waitReady) {
        await waitFor(async () => (await cdp.evaluate('window.__shotReady === true')) || null, 20000, '__shotReady');
      } else {
        await new Promise((r) => setTimeout(r, 2500));
      }
      const colours = await cdp.evaluate(`(() => {
        const c = document.querySelector('canvas');
        if (!c) return -1;
        const t = document.createElement('canvas');
        t.width = 160; t.height = 90;
        const x = t.getContext('2d');
        x.drawImage(c, 0, 0, 160, 90);
        const d = x.getImageData(0, 0, 160, 90).data;
        const seen = new Set();
        for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        return seen.size;
      })()`);
      return { colours, fatal: cdp.fatalEvents() };
    }

    const plain = await loadAndCheck(`http://127.0.0.1:${HTTP_PORT}/game/index.html`, { waitReady: false });
    console.log(`plain load: canvas colours=${plain.colours} fatal=${plain.fatal.length}`);
    if (plain.colours <= 40) failures.push(`plain load: canvas looks blank (colours=${plain.colours})`);
    if (plain.fatal.length) failures.push(`plain load: fatal events ${JSON.stringify(plain.fatal).slice(0, 500)}`);

    for (const shot of SHOTS) {
      const url = `http://127.0.0.1:${HTTP_PORT}/game/index.html${shot.query}`;
      const before = cdp.events.length;
      const { colours } = await loadAndCheck(url, { waitReady: true });
      const fatal = cdp.fatalEvents().slice(before);
      console.log(`${shot.name}: colours=${colours} fatal=${fatal.length}`);
      if (colours <= 40) {
        failures.push(`${shot.name}: canvas looks blank (colours=${colours})`);
        continue;
      }
      if (fatal.length) {
        failures.push(`${shot.name}: fatal events ${JSON.stringify(fatal).slice(0, 500)}`);
        continue;
      }
      const shot64 = await cdp.call('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 85,
        captureBeyondViewport: true,
      });
      const buf = Buffer.from(shot64.data, 'base64');
      const dest = join(SHOT_DIR, shot.name);
      writeFileSync(dest, buf);
      console.log(`${shot.name}: ${buf.length} bytes`);
      if (buf.length > MAX_BYTES) failures.push(`${shot.name}: ${buf.length} bytes exceeds ${MAX_BYTES}`);
    }
  } finally {
    chrome.kill('SIGKILL');
    server.close();
  }

  if (failures.length) {
    for (const f of failures) console.error('FAIL:', f);
    process.exit(1);
  }
  console.log('all shots OK');
}

main().catch((err) => {
  console.error('shoot failed:', err.message);
  process.exit(1);
});
