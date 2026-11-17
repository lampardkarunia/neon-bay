// main.ts — make.fun entry builder for NEON BAY (gta6-01)
// Copies game/ + screenshots/ into the output directory, then builds the
// competition dossier with the vendor API and writes dossier.json there.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// @ts-ignore — vendor starter-kit module, returns dossier bytes
import { buildDossier } from "./vendor/makefun-game.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");

function makeWritableRecursive(target: string): void {
  try {
    const st = fs.statSync(target);
    fs.chmodSync(target, st.isDirectory() ? 0o755 : 0o644);
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(target)) makeWritableRecursive(path.join(target, name));
    }
  } catch {
    /* missing entries are fine */
  }
}

function cleanOutputContents(dir: string): void {
  // Never delete the output directory itself — only its contents, one by one.
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync(dir)) {
    const entry = path.join(dir, name);
    makeWritableRecursive(entry);
    fs.rmSync(entry, { recursive: true, force: true });
  }
}

function copyRecursiveDeterministic(src: string, dest: string): void {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const names = fs.readdirSync(src).sort();
    for (const name of names) copyRecursiveDeterministic(path.join(src, name), path.join(dest, name));
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function validateScreenshots(dir: string): number {
  // Revision hardening: fail loudly before building the dossier if any
  // screenshot is missing, empty, oversized, or there are too many of them.
  const shotsDir = path.join(dir, "screenshots");
  const names = fs.readdirSync(shotsDir).filter((n) => n.toLowerCase().endsWith(".jpg")).sort();
  if (names.length === 0) throw new Error("no screenshots found in " + shotsDir);
  if (names.length > 4) throw new Error(`too many screenshots: ${names.length} (cap is 4)`);
  for (const name of names) {
    const size = fs.statSync(path.join(shotsDir, name)).size;
    if (size <= 0) throw new Error("screenshot is empty: " + name);
    if (size > 262144) throw new Error(`screenshot ${name} exceeds 262144 bytes: ${size}`);
  }
  return names.length;
}

async function main(): Promise<void> {
  const shotCount = validateScreenshots(here);
  console.log(`validated ${shotCount} screenshot(s) against the 262144-byte cap`);
  cleanOutputContents(outputDir);
  copyRecursiveDeterministic(path.join(here, "game"), path.join(outputDir, "game"));
  copyRecursiveDeterministic(path.join(here, "screenshots"), path.join(outputDir, "screenshots"));

  const caps = {
    text_max_bytes: 163840,
    maxTextBytes: 163840,
    textMaxBytes: 163840,
    dossier_max_bytes: 1572864,
    maxDossierBytes: 1572864,
    dossierMaxBytes: 1572864,
    max_screenshots: 4,
    screenshot_max_count: 4,
    maxScreenshots: 4,
    maxScreenshotCount: 4,
    screenshot_max_bytes: 262144,
    maxScreenshotBytes: 262144,
    screenshotMaxBytes: 262144,
    long_side_max: 1280,
    max_long_side: 1280,
    maxLongSide: 1280,
    maxSideLong: 1280,
    short_side_min: 480,
    min_short_side: 480,
    minShortSide: 480,
    minSideShort: 480,
  };

  const dossierBytes: unknown = await buildDossier(here, caps);
  const bytes: Buffer = Buffer.isBuffer(dossierBytes)
    ? dossierBytes
    : typeof dossierBytes === "string"
      ? Buffer.from(dossierBytes, "utf8")
      : Buffer.from(dossierBytes as Uint8Array);

  const dossierPath = path.join(outputDir, "dossier.json");
  fs.writeFileSync(dossierPath, bytes);

  if (!fs.existsSync(dossierPath)) throw new Error("dossier.json was not written to " + dossierPath);
  const size = fs.statSync(dossierPath).size;
  if (size <= 0) throw new Error("dossier.json is empty");
  if (size > 1572864) throw new Error("dossier.json exceeds 1.5 MiB cap: " + size);
  console.log(`dossier.json written: ${size} bytes -> ${dossierPath}`);
}

main().catch((err) => {
  console.error("main.ts failed:", err);
  process.exit(1);
});
