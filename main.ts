// main.ts - make.fun entry builder for NEON BAY (gta6-01).
// Validates screenshots, copies game/ + screenshots/ into the output
// directory, then builds the competition dossier with the vendor API.
// Vendor API: buildDossier(dir, caps) returns the dossier bytes.
// Caps use snake_case keys. Run: MAKEFUN_OUTPUT_DIR=out node main.ts

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// @ts-ignore - vendor module ships with the starter kit
import { buildDossier } from "./vendor/makefun-game.ts";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");

const MAX_SCREENSHOT_BYTES = 262144;
const MAX_SCREENSHOTS = 4;

function fail(message) {
  console.error("ERROR: " + message);
  process.exit(1);
}

function validateScreenshots(dir) {
  if (!fs.existsSync(dir)) fail("screenshots/ directory is missing - run node tools/shoot.mjs first");
  const files = fs.readdirSync(dir).filter((name) => /\.(jpe?g|png)$/i.test(name)).sort();
  if (files.length === 0) fail("no screenshots found in screenshots/");
  if (files.length > MAX_SCREENSHOTS) fail(`too many screenshots: ${files.length} > ${MAX_SCREENSHOTS}`);
  let totalBytes = 0;
  for (const name of files) {
    const full = path.join(dir, name);
    const size = fs.statSync(full).size;
    if (size === 0) fail(`screenshot ${name} is empty`);
    if (size > MAX_SCREENSHOT_BYTES) fail(`screenshot ${name} is ${size} bytes, over the ${MAX_SCREENSHOT_BYTES} byte limit`);
    // Revision pass: reject files that are not really JPEG/PNG images,
    // so a truncated or misnamed capture can never slip into a dossier.
    const header = Buffer.alloc(8);
    const fd = fs.openSync(full, "r");
    fs.readSync(fd, header, 0, 8, 0);
    fs.closeSync(fd);
    const isJpeg = header[0] === 0xff && header[1] === 0xd8;
    const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
    if (/\.jpe?g$/i.test(name) && !isJpeg) fail(`screenshot ${name} does not start with a JPEG header`);
    if (/\.png$/i.test(name) && !isPng) fail(`screenshot ${name} does not start with a PNG header`);
    totalBytes += size;
    console.log(`screenshot ok: ${name} (${size} bytes)`);
  }
  console.log(`screenshots validated: ${files.length} file(s), ${totalBytes} bytes total`);
  return files;
}

function makeWritable(target) {
  try { fs.chmodSync(target, 0o755); } catch { /* best effort */ }
}

// Clean the output directory contents one by one without ever
// removing the output directory itself (it may be a mount point).
function cleanOutputDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    makeWritable(full);
    fs.rmSync(full, { recursive: true, force: true });
  }
}

function copyTreeDeterministic(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  const entries = fs.readdirSync(source, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyTreeDeterministic(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

async function main() {
  const gameDir = path.join(rootDir, "game");
  const screenshotsDir = path.join(rootDir, "screenshots");
  if (!fs.existsSync(path.join(gameDir, "index.html"))) fail("game/index.html is missing");

  validateScreenshots(screenshotsDir);

  cleanOutputDir(outputDir);
  copyTreeDeterministic(gameDir, path.join(outputDir, "game"));
  copyTreeDeterministic(screenshotsDir, path.join(outputDir, "screenshots"));
  // The dossier builder reads the staged tree from the repo root layout:
  // also stage copies at the output root's parent expectation by building
  // from rootDir, which contains game/ and screenshots/ side by side.
  console.log("output staged at " + outputDir);

  const caps = {
    text_max_bytes: 163840,
    max_text_bytes: 163840,
    dossier_max_bytes: 1572864,
    max_dossier_bytes: 1572864,
    dossier_max_size_bytes: 1572864,
    screenshot_max_count: 4,
    max_screenshots: 4,
    screenshot_max_files: 4,
    screenshot_max_bytes: 262144,
    max_screenshot_bytes: 262144,
    screenshot_max_file_bytes: 262144,
    image_max_bytes: 262144,
    screenshot_max_long_side: 1280,
    max_long_side: 1280,
    image_max_long_side: 1280,
    screenshot_max_width: 1280,
    screenshot_min_short_side: 480,
    min_short_side: 480,
    image_min_short_side: 480,
    screenshot_min_width: 480,
  };

  let dossierBytes;
  try {
    dossierBytes = await buildDossier(rootDir, caps);
  } catch (error) {
    fail("buildDossier failed: " + (error && error.message ? error.message : String(error)));
  }
  if (!dossierBytes || dossierBytes.length === 0) fail("buildDossier returned no bytes");

  const bytes = Buffer.isBuffer(dossierBytes) ? dossierBytes : Buffer.from(dossierBytes);
  const dossierPath = path.join(outputDir, "dossier.json");
  fs.writeFileSync(dossierPath, bytes);

  if (!fs.existsSync(dossierPath)) fail("dossier.json was not written");
  const size = fs.statSync(dossierPath).size;
  if (size === 0) fail("dossier.json is empty");
  console.log(`dossier.json written: ${dossierPath} (${size} bytes)`);
}

main().catch((error) => fail(error && error.message ? error.message : String(error)));
