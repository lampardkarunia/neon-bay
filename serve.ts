// serve.ts - Tiny static server so Neon Bay can be played locally.
// Run: node serve.ts  ->  http://localhost:8080
// Node standard library only; the game itself is served from game/.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.join(root, "game");
const port = 8080;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function pickFile(urlPath: string): string | null {
  const rel = urlPath.replace(/^\/+/, "");
  const candidates = rel === ""
    ? [path.join(gameRoot, "index.html")]
    : [path.join(root, rel), path.join(gameRoot, rel)];
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(root)) continue;
    if (existsSync(resolved) && statSync(resolved).isFile()) return resolved;
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname);
    if (urlPath === "/favicon.ico") { res.writeHead(204); res.end(); return; }
    const file = pickFile(urlPath);
    if (!file) { res.writeHead(404, { "content-type": "text/plain" }); res.end("not found"); return; }
    const data = await readFile(file);
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("server error: " + (err as Error).message);
  }
});

server.listen(port, () => {
  console.log(`Neon Bay is live at http://localhost:${port}`);
});
