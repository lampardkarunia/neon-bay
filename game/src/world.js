// world.js — Neon Bay city layout: road grid, blocks, props, collision helpers
import { CONFIG } from "./config.js";

export function createWorld(rng) {
  const roadsX = [];
  const roadsY = [];
  for (let x = 100; x < CONFIG.worldWidth; x += CONFIG.tileRoad) roadsX.push(x);
  for (let y = 100; y < CONFIG.worldHeight; y += CONFIG.tileRoad) roadsY.push(y);
  const buildings = [];
  const palms = [];
  const lamps = [];
  for (let bx = 0; bx < CONFIG.worldWidth; bx += CONFIG.tileRoad) {
    for (let by = 0; by < CONFIG.worldHeight; by += CONFIG.tileRoad) {
      const w = 130, h = 130, x = bx + 35, y = by + 35;
      const palette = ["#26324a", "#33244d", "#4d2c33", "#24403a", "#3a3f5c", "#513252", "#2e4a5c"];
      buildings.push({ x, y, w, h, color: rng.pick(palette), floors: rng.int(2, 9), neon: rng.pick(["#ff2e88", "#00e5ff", "#ffe600", "#7c4dff", "#00ff9d", "#ff6d00"]) });
      if (rng.chance(0.6)) palms.push({ x: bx + rng.range(10, 180), y: by + rng.range(10, 180) });
      if (rng.chance(0.8)) lamps.push({ x: bx + 100, y: by + 100 });
    }
  }
  function isOnRoad(pos) {
    const near = (v, arr) => arr.some((r) => Math.abs(v - r) < 34);
    return near(pos.x, roadsX) || near(pos.y, roadsY);
  }
  function collidesBuilding(pos, radius) {
    for (const b of buildings) {
      if (pos.x + radius > b.x && pos.x - radius < b.x + b.w && pos.y + radius > b.y && pos.y - radius < b.y + b.h) return b;
    }
    return null;
  }
  function clampToWorld(pos, radius) {
    pos.x = Math.max(radius, Math.min(CONFIG.worldWidth - radius, pos.x));
    pos.y = Math.max(radius, Math.min(CONFIG.worldHeight - radius, pos.y));
  }
  function districtAt(pos) {
    for (const d of CONFIG.districts) if (pos.x >= d.x && pos.x < d.x + d.w && pos.y >= d.y && pos.y < d.y + d.h) return d;
    return CONFIG.districts[0];
  }
  function nearestRoadPoint(pos) {
    let best = { x: pos.x, y: pos.y }, bestD = Infinity;
    for (const rx of roadsX) { const d = Math.abs(pos.x - rx); if (d < bestD) { bestD = d; best = { x: rx, y: pos.y }; } }
    for (const ry of roadsY) { const d = Math.abs(pos.y - ry); if (d < bestD) { bestD = d; best = { x: pos.x, y: ry }; } }
    return best;
  }
  return { roadsX, roadsY, buildings, palms, lamps, isOnRoad, collidesBuilding, clampToWorld, districtAt, nearestRoadPoint };
}
export function drawWorldBase(ctx, world, camera) {
  const g = ctx.createLinearGradient(0, 0, 0, CONFIG.canvasHeight);
  g.addColorStop(0, "#1a1033"); g.addColorStop(0.55, "#3d1e4d"); g.addColorStop(1, "#0d2b3d");
  ctx.fillStyle = g; ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  ctx.save(); ctx.translate(-camera.x, -camera.y);
  for (const d of CONFIG.districts) { ctx.fillStyle = d.color; ctx.fillRect(d.x, d.y, d.w, d.h); }
  ctx.fillStyle = "#f7c873";
  ctx.fillRect(0, 0, CONFIG.worldWidth, 26);
  ctx.fillStyle = "#2ec4e6"; ctx.fillRect(0, 26, CONFIG.worldWidth, 14);
  ctx.fillStyle = "#20242e";
  for (const rx of world.roadsX) ctx.fillRect(rx - 32, 0, 64, CONFIG.worldHeight);
  for (const ry of world.roadsY) ctx.fillRect(0, ry - 32, CONFIG.worldWidth, 64);
  ctx.strokeStyle = "#ffe98a"; ctx.lineWidth = 3; ctx.setLineDash([18, 16]);
  ctx.beginPath();
  for (const rx of world.roadsX) { ctx.moveTo(rx, 0); ctx.lineTo(rx, CONFIG.worldHeight); }
  for (const ry of world.roadsY) { ctx.moveTo(0, ry); ctx.lineTo(CONFIG.worldWidth, ry); }
  ctx.stroke(); ctx.setLineDash([]);
  for (const b of world.buildings) {
    ctx.fillStyle = "#0c0e14"; ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = b.neon; ctx.lineWidth = 2; ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    ctx.fillStyle = "rgba(255,235,150,0.85)";
    const cols = 4, rows = Math.max(2, Math.floor(b.floors / 2));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if ((i * 7 + j * 13 + b.floors) % 3 !== 0) ctx.fillRect(b.x + 14 + i * 28, b.y + 14 + j * 24, 12, 9);
    }
  }
  for (const p of world.palms) {
    ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 4, p.y - 16); ctx.stroke();
    ctx.strokeStyle = "#2ecc71"; ctx.lineWidth = 3;
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(p.x + 4, p.y - 16); ctx.lineTo(p.x + 4 + Math.cos(a) * 15, p.y - 16 + Math.sin(a) * 8 - 4); ctx.stroke(); }
  }
  for (const l of world.lamps) {
    const glow = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 42);
    glow.addColorStop(0, "rgba(255,180,80,0.5)"); glow.addColorStop(1, "rgba(255,180,80,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(l.x, l.y, 42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffd54f"; ctx.beginPath(); ctx.arc(l.x, l.y, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
