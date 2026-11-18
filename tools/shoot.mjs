// shoot.mjs - Smoke test + screenshot capture for Neon Bay.
// Node built-ins only. Serves the repo, drives chrome-headless-shell over
// CDP, checks for fatal errors and blank canvases, and writes JPEG shots.

import http from "node:http";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chromePath = "/home/hatch/.cache/puppeteer/chrome-headless-shell/linux-157.0.8103.50/chrome-headless-shell-linux64/chrome-headless-shell";
const MAX_SHOT_BYTES = 262144;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".md": "text/plain; charset=utf-8",
};

function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (urlPath === "/favicon.ico") { res.writeHead(204); res.end(); return; }
      const rel = urlPath.replace(/^\/+/, "");
      const filePath = path.join(repoRoot, rel);
      if (!filePath.startsWith(repoRoot)) { res.writeHead(403); res.end(); return; }
      const data = await readFile(filePath);
      res.writeHead(200, { "content-type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404); res.end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForJson(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch { /* chrome not up yet */ }
    await sleep(150);
  }
  throw new Error(`timed out waiting for ${url}`);
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg.method, msg.params || {});
      }
    });
  }
  on(fn) { this.listeners.push(fn); }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error("evaluate failed: " + JSON.stringify(result.exceptionDetails).slice(0, 300));
    }
    return result.result ? result.result.value : undefined;
  }
  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

const CANVAS_COLOURS_EXPR = `(() => {
  const src = document.getElementById('game');
  if (!src) return -1;
  const off = document.createElement('canvas');
  off.width = 64; off.height = 36;
  const c = off.getContext('2d');
  c.drawImage(src, 0, 0, 64, 36);
  const data = c.getImageData(0, 0, 64, 36).data;
  const seen = new Set();
  for (let i = 0; i < data.length; i += 4) {
    seen.add(((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3));
  }
  return seen.size;
})()`;

async function loadAndCheck(cdp, state, url, waitForShot) {
  state.errors.length = 0;
  await cdp.send("Page.navigate", { url });
  const deadline = Date.now() + 25000;
  if (waitForShot) {
    let ready = false;
    while (Date.now() < deadline) {
      await sleep(200);
      try { ready = await cdp.evaluate("window.__shotReady === true"); } catch { ready = false; }
      if (ready) break;
    }
    if (!ready) throw new Error("window.__shotReady never became true");
  } else {
    await sleep(2200);
  }
  await sleep(250);
  const colours = await cdp.evaluate(CANVAS_COLOURS_EXPR);
  return { colours };
}

async function main() {
  if (!existsSync(chromePath)) throw new Error(`chrome-headless-shell not found at ${chromePath}`);
  const shots = JSON.parse(await readFile(path.join(repoRoot, "shots.json"), "utf8"));
  const { server, port } = await startServer();
  const debugPort = 9300 + Math.floor(Math.random() * 400);
  const chrome = spawn(chromePath, [
    "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    `--remote-debugging-port=${debugPort}`,
    "--window-size=1280,720",
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let chromeLog = "";
  chrome.stderr.on("data", (d) => { chromeLog += String(d); });

  const failures = [];
  try {
    const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`, 15000);
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    if (!pageTarget) throw new Error("no CDP page target; chrome log: " + chromeLog.slice(-400));
    const cdp = new Cdp(pageTarget.webSocketDebuggerUrl);
    await cdp.open();
    const state = { errors: [] };
    cdp.on((method, params) => {
      if (method === "Runtime.exceptionThrown") {
        const detail = params.exceptionDetails || {};
        state.errors.push("exception: " + ((detail.exception && detail.exception.description) || detail.text || "unknown"));
      }
      if (method === "Runtime.consoleAPICalled" && params.type === "error") {
        const text = (params.args || []).map((a) => a.value || a.description || "").join(" ");
        state.errors.push("console.error: " + text);
      }
    });
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
    });

    const base = `http://127.0.0.1:${port}`;

    // (a) Plain load, no query string.
    try {
      const { colours } = await loadAndCheck(cdp, state, `${base}/game/index.html`, false);
      if (state.errors.length) throw new Error("fatal errors: " + state.errors.join(" | "));
      if (!(colours > 40)) throw new Error(`canvas looks blank (${colours} unique colours)`);
      console.log(`plain load: OK (${colours} colours)`);
    } catch (err) {
      failures.push("plain");
      console.log(`plain load: FAIL - ${err.message}`);
    }

    // (b) Each shot in shots.json.
    await mkdir(path.join(repoRoot, "screenshots"), { recursive: true });
    for (const shot of shots) {
      const label = shot.name;
      try {
        const { colours } = await loadAndCheck(cdp, state, `${base}/game/index.html${shot.query}`, true);
        if (state.errors.length) throw new Error("fatal errors: " + state.errors.join(" | "));
        if (!(colours > 40)) throw new Error(`canvas looks blank (${colours} unique colours)`);
        const shotResult = await cdp.send("Page.captureScreenshot", {
          format: "jpeg", quality: 85, captureBeyondViewport: false,
        });
        const bytes = Buffer.from(shotResult.data, "base64");
        if (bytes.length > MAX_SHOT_BYTES) {
          throw new Error(`screenshot too large: ${bytes.length} > ${MAX_SHOT_BYTES} bytes`);
        }
        const outPath = path.join(repoRoot, "screenshots", label);
        await writeFile(outPath, bytes);
        const info = await stat(outPath);
        console.log(`${label}: OK (${colours} colours, ${info.size} bytes)`);
      } catch (err) {
        failures.push(label);
        console.log(`${label}: FAIL - ${err.message}`);
      }
    }
    cdp.close();
  } finally {
    chrome.kill("SIGKILL");
    server.close();
  }

  if (failures.length) {
    console.log(`FAILED: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("all shots OK");
}

main().catch((err) => {
  console.error("shoot failed:", err.message);
  process.exit(1);
});
