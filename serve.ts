// serve.ts — tiny static server so NEON BAY can be played locally.
// Run: node serve.ts  →  http://localhost:8080
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.join(root, "game");
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".css": "text/css",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost:8080");
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const file = path.join(gameRoot, rel);
  if (!file.startsWith(gameRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

server.listen(8080, () => {
  console.log("NEON BAY running at http://localhost:8080");
});
