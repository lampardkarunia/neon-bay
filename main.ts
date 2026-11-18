// main.ts - Entry builder for the make.fun gta6-01 competition.
// Validates the screenshots, copies game/ + screenshots/ into the output
// directory deterministically, then builds the dossier with the vendor
// library and writes it to <output>/dossier.json. Fails hard on any
// problem before a dossier is produced.

import {
  copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync,
  statSync, writeFileSync, chmodSync, rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const root = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");

const MAX_SCREENSHOTS = 4;
const MAX_SCREENSHOT_BYTES = 262144;
const MAX_TEXT_BYTES = 163840;
const MAX_DOSSIER_BYTES = 1572864; // 1.5 MiB competition gate
const MAX_LONG_SIDE = 1280;
const MIN_SHORT_SIDE = 480;

function fail(message: string): never {
  console.error(`main: ERROR - ${message}`);
  process.exit(1);
}

function listFilesSorted(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string, prefix: string): void => {
    const entries = readdirSync(current, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(current, entry.name), rel);
      else if (entry.isFile()) out.push(rel);
    }
  };
  walk(dir, "");
  return out;
}

function imageSize(bytes: Buffer): { width: number; height: number; kind: string } | null {
  // PNG: signature + IHDR width/height.
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { kind: "png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  // JPEG: scan markers for a Start Of Frame segment.
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { kind: "jpeg", height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { offset += 2; continue; }
      const segmentLength = bytes.readUInt16BE(offset + 2);
      if (segmentLength < 2) break;
      offset += 2 + segmentLength;
    }
    return { kind: "jpeg", width: 0, height: 0 };
  }
  return null;
}

function validateScreenshots(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    fail(`screenshots directory is missing: ${dir}`);
  }
  const names = readdirSync(dir).filter((n) => !n.startsWith(".")).sort();
  if (names.length === 0) fail("screenshots/ is empty - run tools/shoot.mjs first");
  if (names.length > MAX_SCREENSHOTS) {
    fail(`screenshots/ holds ${names.length} files, over the max of ${MAX_SCREENSHOTS}`);
  }
  for (const name of names) {
    const file = path.join(dir, name);
    const bytes = readFileSync(file);
    if (bytes.length === 0) fail(`screenshot ${name} is empty`);
    if (bytes.length > MAX_SCREENSHOT_BYTES) {
      fail(`screenshot ${name} is ${bytes.length} bytes, over ${MAX_SCREENSHOT_BYTES}`);
    }
    const info = imageSize(bytes);
    if (!info) fail(`screenshot ${name} has no JPEG/PNG magic header`);
    if (info && info.width > 0) {
      const longSide = Math.max(info.width, info.height);
      const shortSide = Math.min(info.width, info.height);
      if (longSide > MAX_LONG_SIDE) fail(`screenshot ${name} long side ${longSide} over ${MAX_LONG_SIDE}`);
      if (shortSide < MIN_SHORT_SIDE) fail(`screenshot ${name} short side ${shortSide} under ${MIN_SHORT_SIDE}`);
    }
    console.log(`main: screenshot ${name} OK (${bytes.length} bytes, ${info ? info.kind : "?"})`);
  }
  return names as string[];
}

function makeWritableRecursive(target: string): void {
  try { chmodSync(target, 0o755); } catch { /* best effort */ }
  if (existsSync(target) && statSync(target).isDirectory()) {
    for (const entry of readdirSync(target)) makeWritableRecursive(path.join(target, entry));
    try { chmodSync(target, 0o755); } catch { /* best effort */ }
  } else {
    try { chmodSync(target, 0o644); } catch { /* best effort */ }
  }
}

function clearDirectoryContents(dir: string): void {
  // Never remove the output directory itself; empty it entry by entry.
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir)) {
    const target = path.join(dir, entry);
    makeWritableRecursive(target);
    // rm via recursive copy-free removal using fs rmSync equivalent:
    removeRecursive(target);
  }
}

function removeRecursive(target: string): void {
  // Entries are visited one by one (never the output root itself) and made
  // writable by clearDirectoryContents before this runs, so a single
  // recursive rmSync per top-level entry is both safe and sufficient.
  if (!existsSync(target)) return;
  rmSync(target, { recursive: true, force: true });
}

function copyTreeSorted(sourceDir: string, destDir: string): void {
  const files = listFilesSorted(sourceDir);
  for (const rel of files) {
    const from = path.join(sourceDir, rel);
    const to = path.join(destDir, rel);
    mkdirSync(path.dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
  console.log(`main: copied ${files.length} files from ${path.basename(sourceDir)}/`);
}

function main(): void {
  const gameDir = path.join(root, "game");
  const shotsDir = path.join(root, "screenshots");
  if (!existsSync(path.join(gameDir, "index.html"))) {
    fail("game/index.html is missing");
  }
  validateScreenshots(shotsDir);

  clearDirectoryContents(outputDir);
  copyTreeSorted(gameDir, path.join(outputDir, "game"));
  copyTreeSorted(shotsDir, path.join(outputDir, "screenshots"));

  const bytes = buildDossier(outputDir, {
    text_max_bytes: MAX_TEXT_BYTES,
    screenshots: { max: MAX_SCREENSHOTS, max_bytes: MAX_SCREENSHOT_BYTES },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  if (!bytes || bytes.length === 0) fail("buildDossier returned no bytes");
  if (bytes.length > MAX_DOSSIER_BYTES) {
    fail(`dossier is ${bytes.length} bytes, over the ${MAX_DOSSIER_BYTES} gate`);
  }
  const dossierPath = path.join(outputDir, "dossier.json");
  writeFileSync(dossierPath, bytes);
  if (!existsSync(dossierPath) || statSync(dossierPath).size === 0) {
    fail("dossier.json was not written to the output directory");
  }
  console.log(`main: dossier.json written (${statSync(dossierPath).size} bytes) to ${dossierPath}`);
}

main();
