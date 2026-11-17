// serve.ts - Tiny static server to play NEON BAY locally.
// Run with: node serve.ts   then open http://localhost:8080
// Uses only Node.js built-ins (written in TypeScript-flavoured plain JS
// style so plain `node serve.ts` works on modern Node without a build step).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(rootDir, "game");
const port = Number(process.env.PORT || 8080);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = http.createServer((request, response) => {
  try {
    const url = new URL(request.url || "/", `http://localhost:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    const filePath = path.join(gameDir, pathname);
    if (!filePath.startsWith(gameDir)) {
      response.writeHead(403, { "Content-Type": "text/plain" });
      response.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404, { "Content-Type": "text/plain" });
        response.end("Not found: " + pathname);
        return;
      }
      response.writeHead(200, {
        "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(data);
    });
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain" });
    response.end(String(error));
  }
});

server.listen(port, () => {
  console.log(`NEON BAY running at http://localhost:${port}`);
  console.log("Controls: WASD move/drive, E enter car, F punch, Space shoot, P pause, M mute");
});
