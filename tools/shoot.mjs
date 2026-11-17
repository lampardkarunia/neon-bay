// shoot.mjs — smoke test + deterministic screenshots via headless Chrome CDP
// Node built-ins only. Serves the repo, loads the game, counts canvas colours,
// captures each shots.json scene and enforces the 256 KiB JPEG limit.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/home/hatch/.cache/puppeteer/chrome-headless-shell/linux-157.0.8103.50/chrome-headless-shell-linux64/chrome-headless-shell";
const PORT = 8931;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".jpg": "image/jpeg", ".css": "text/css" };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const file = path.join(root, urlPath === "/" ? "game/index.html" : urlPath);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}
async function waitJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("chrome devtools did not come up: " + url);
}
function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0; const pending = new Map(); const listeners = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); }
      else if (msg.method) listeners.forEach((fn) => fn(msg));
    };
    ws.onerror = reject;
    ws.onopen = () => resolve({
      send(method, params = {}) { const mid = ++id; ws.send(JSON.stringify({ id: mid, method, params })); return new Promise((res2, rej2) => pending.set(mid, { resolve: res2, reject: rej2 })); },
      on(fn) { listeners.push(fn); },
      close() { ws.close(); },
    });
  });
}
async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("page exception: " + JSON.stringify(r.exceptionDetails).slice(0, 500));
  return r.result ? r.result.value : undefined;
}
async function loadAndCheck(cdp, errors, url, waitShot) {
  errors.length = 0;
  await cdp.send("Page.navigate", { url });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const ready = await evaluate(cdp, "document.readyState").catch(() => "");
    if (ready === "complete" || ready === "interactive") break;
    await new Promise((r) => setTimeout(r, 200));
  }
  if (waitShot) {
    let ok = false;
    while (Date.now() < deadline) {
      ok = await evaluate(cdp, "window.__shotReady === true").catch(() => false);
      if (ok) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!ok) throw new Error("__shotReady timeout for " + url);
  } else {
    await new Promise((r) => setTimeout(r, 1800));
  }
  const fatal = errors.filter((e) => /error|exception/i.test(e));
  if (fatal.length) throw new Error("console errors: " + fatal.join(" | ").slice(0, 600));
  const colours = await evaluate(cdp, `(() => {
    const c = document.getElementById('game'); if (!c) return -1;
    const t = document.createElement('canvas'); t.width = 160; t.height = 90;
    const x = t.getContext('2d'); x.drawImage(c, 0, 0, 160, 90);
    const d = x.getImageData(0, 0, 160, 90).data; const s = new Set();
    for (let i = 0; i < d.length; i += 16) s.add(d[i] + ',' + d[i+1] + ',' + d[i+2]);
    return s.size;
  })()`);
  if (!(colours > 40)) throw new Error("canvas looks blank, unique colours=" + colours);
  return colours;
}
async function main() {
  const server = await serve();
  const chrome = spawn(CHROME, ["--headless", "--disable-gpu", "--no-sandbox", `--remote-debugging-port=${PORT + 1}`, "--window-size=1280,720", "about:blank"], { stdio: "ignore" });
  let cdp = null; const failures = [];
  try {
    const targets = await waitJson(`http://127.0.0.1:${PORT + 1}/json/list`);
    const page = targets.find((t) => t.type === "page") || targets[0];
    cdp = await connectCdp(page.webSocketDebuggerUrl);
    const errors = [];
    cdp.on((msg) => {
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args.map((a) => a.value || a.description || "").join(" "));
      if (msg.method === "Runtime.exceptionThrown") errors.push("exception: " + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
      if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") errors.push(msg.params.entry.text);
    });
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Log.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    // (a) plain load
    try {
      const colours = await loadAndCheck(cdp, errors, `http://127.0.0.1:${PORT}/game/index.html`, false);
      console.log(`plain load: OK colours=${colours}`);
    } catch (e) { failures.push("plain: " + e.message); console.log("plain load: FAIL " + e.message); }
    // (b) shots
    const shots = JSON.parse(fs.readFileSync(path.join(root, "shots.json"), "utf8"));
    fs.mkdirSync(path.join(root, "screenshots"), { recursive: true });
    for (const shot of shots) {
      try {
        const colours = await loadAndCheck(cdp, errors, `http://127.0.0.1:${PORT}/game/index.html${shot.query}`, true);
        const shotRes = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 85, captureBeyondViewport: false });
        const buf = Buffer.from(shotRes.data, "base64");
        if (buf.length > 262144) throw new Error(`screenshot too large: ${buf.length} bytes`);
        fs.writeFileSync(path.join(root, "screenshots", shot.name), buf);
        console.log(`${shot.name}: OK colours=${colours} bytes=${buf.length}`);
      } catch (e) { failures.push(shot.name + ": " + e.message); console.log(`${shot.name}: FAIL ${e.message}`); }
    }
  } finally {
    if (cdp) cdp.close();
    chrome.kill("SIGKILL");
    server.close();
  }
  if (failures.length) { console.error("FAILURES:\n" + failures.join("\n")); process.exit(1); }
  console.log("all shots OK");
}
main().catch((e) => { console.error(e); process.exit(1); });
