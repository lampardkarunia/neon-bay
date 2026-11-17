// shoot.mjs - Screenshot + smoke test harness for NEON BAY.
// Node built-ins only. Serves the repo, drives chrome-headless-shell over
// CDP (WebSocket), checks for fatal errors and blank canvases, and writes
// deterministic JPEG screenshots listed in shots.json.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/home/hatch/.cache/puppeteer/chrome-headless-shell/linux-157.0.8103.50/chrome-headless-shell-linux64/chrome-headless-shell";
const MAX_SHOT_BYTES = 262144;
const SCREENSHOT_DIR = path.join(ROOT, "screenshots");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, "http://127.0.0.1");
        let filePath = path.join(ROOT, decodeURIComponent(url.pathname));
        if (url.pathname.endsWith("/")) filePath = path.join(filePath, "index.html");
        if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end("forbidden"); return; }
        fs.readFile(filePath, (err, data) => {
          if (err) { res.writeHead(404); res.end("not found"); return; }
          res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-store" });
          res.end(data);
        });
      } catch (err) {
        res.writeHead(500); res.end(String(err));
      }
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function waitForChromeWs(proc) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for DevTools websocket")), 20000);
    proc.stderr.on("data", (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    proc.on("exit", (code) => { clearTimeout(timeout); reject(new Error(`Chrome exited early with code ${code}: ${buffer}`)); });
  });
}

class CdpClient {
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
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  onEvent(fn) { this.listeners.push(fn); }
  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

async function evaluate(client, sessionId, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error("Page evaluation failed: " + JSON.stringify(result.exceptionDetails).slice(0, 500));
  }
  return result.result ? result.result.value : undefined;
}

async function waitFor(client, sessionId, expression, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(client, sessionId, expression)) return true;
    } catch { /* page still loading */ }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const CANVAS_COLOURS_EXPR = `(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas || !canvas.width) return 0;
  const small = document.createElement('canvas');
  small.width = 64; small.height = 36;
  const c = small.getContext('2d');
  c.drawImage(canvas, 0, 0, 64, 36);
  const data = c.getImageData(0, 0, 64, 36).data;
  const seen = new Set();
  for (let i = 0; i < data.length; i += 4) seen.add(data[i] + ',' + data[i+1] + ',' + data[i+2]);
  return seen.size;
})()`;

async function runPage(client, baseUrl, query, options) {
  const target = await client.send("Target.createTarget", { url: "about:blank" });
  const attached = await client.send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
  const sessionId = attached.sessionId;
  const errors = [];
  client.onEvent((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Runtime.exceptionThrown") {
      errors.push("exception: " + JSON.stringify(msg.params.exceptionDetails).slice(0, 400));
    }
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      const text = (msg.params.args || []).map((a) => a.value || a.description || "").join(" ");
      errors.push("console.error: " + text.slice(0, 400));
    }
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      const t = msg.params.entry.text || "";
      if (!t.includes("favicon")) errors.push("log: " + t.slice(0, 400));
    }
  });
  await client.send("Page.enable", {}, sessionId);
  await client.send("Runtime.enable", {}, sessionId);
  await client.send("Log.enable", {}, sessionId);
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  }, sessionId);
  const url = baseUrl + "/game/index.html" + (query || "");
  await client.send("Page.navigate", { url }, sessionId);
  if (options.waitShotReady) {
    await waitFor(client, sessionId, "window.__shotReady === true", 20000, "__shotReady for " + (query || "plain"));
  } else {
    await waitFor(client, sessionId, "!!document.querySelector('canvas')", 15000, "canvas element");
    await new Promise((r) => setTimeout(r, 1800));
  }
  await new Promise((r) => setTimeout(r, 350));
  const colours = await evaluate(client, sessionId, CANVAS_COLOURS_EXPR);
  let screenshotBytes = null;
  if (options.screenshotName) {
    const shot = await client.send("Page.captureScreenshot", {
      format: "jpeg", quality: 85, captureBeyondViewport: false, fromSurface: true,
    }, sessionId);
    screenshotBytes = Buffer.from(shot.data, "base64");
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, options.screenshotName), screenshotBytes);
  }
  await client.send("Target.closeTarget", { targetId: target.targetId }).catch(() => {});
  return { errors, colours, screenshotBytes };
}

async function main() {
  if (!fs.existsSync(CHROME)) throw new Error("chrome-headless-shell not found at " + CHROME);
  const shots = JSON.parse(fs.readFileSync(path.join(ROOT, "shots.json"), "utf8"));
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const profileDir = fs.mkdtempSync(path.join("/tmp", "neon-bay-chrome-"));
  const chrome = spawn(CHROME, [
    "--headless", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
    "--remote-debugging-port=0", "--window-size=1280,720",
    `--user-data-dir=${profileDir}`, "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let failures = 0;
  let client = null;
  try {
    const wsUrl = await waitForChromeWs(chrome);
    client = new CdpClient(wsUrl);
    await client.open();

    // (a) Plain load smoke test.
    try {
      const plain = await runPage(client, baseUrl, "", {});
      const ok = plain.errors.length === 0 && plain.colours > 40;
      if (!ok) failures += 1;
      console.log(`plain load: colours=${plain.colours} errors=${plain.errors.length} ${ok ? "OK" : "FAIL " + plain.errors.join(" | ")}`);
    } catch (err) {
      failures += 1;
      console.log(`plain load: FAIL ${err.message}`);
    }

    // (b) Each screenshot in shots.json.
    for (const entry of shots) {
      try {
        const result = await runPage(client, baseUrl, entry.query, { waitShotReady: true, screenshotName: entry.name });
        const size = result.screenshotBytes ? result.screenshotBytes.length : 0;
        const ok = result.errors.length === 0 && result.colours > 40 && size > 0 && size <= MAX_SHOT_BYTES;
        if (!ok) failures += 1;
        console.log(`${entry.name}: colours=${result.colours} bytes=${size} errors=${result.errors.length} ${ok ? "OK" : "FAIL " + result.errors.join(" | ")}`);
      } catch (err) {
        failures += 1;
        console.log(`${entry.name}: FAIL ${err.message}`);
      }
    }
  } finally {
    if (client) client.close();
    chrome.kill("SIGKILL");
    server.close();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
  if (failures > 0) {
    console.log(`${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("all shots OK");
}

main().catch((err) => { console.error(err); process.exit(1); });
