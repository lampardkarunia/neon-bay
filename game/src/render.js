// render.js — HUD, minimap, menus, objective markers
import { CONFIG } from "./config.js";
import { currentObjectiveText, currentTarget, currentMission } from "./missions.js";

export function drawObjectiveMarker(ctx, target, time) {
  if (!target) return;
  const bob = Math.sin(time * 4) * 6;
  ctx.save(); ctx.translate(target.x, target.y + bob);
  ctx.fillStyle = "rgba(255,230,0,0.25)"; ctx.beginPath(); ctx.arc(0, -bob, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffe600"; ctx.beginPath();
  ctx.moveTo(0, 18); ctx.lineTo(-13, -8); ctx.lineTo(13, -8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#111"; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center"; ctx.fillText("!", 0, 4);
  ctx.restore();
}
export function drawHUD(ctx, state) {
  const { player, heat, missions } = state;
  ctx.fillStyle = "rgba(5,8,16,0.72)"; ctx.beginPath(); ctx.roundRect(14, 14, 300, 92, 10); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "left";
  ctx.fillText(player.vehicle ? `Driving · ${player.vehicle.spec.label}` : "On foot · Jax Marlowe", 26, 38);
  ctx.fillStyle = "#333"; ctx.fillRect(26, 48, 180, 14);
  ctx.fillStyle = player.health > 30 ? "#2ecc71" : "#e74c3c"; ctx.fillRect(26, 48, 180 * Math.max(0, player.health) / player.maxHealth, 14);
  ctx.strokeStyle = "#fff"; ctx.strokeRect(26, 48, 180, 14);
  ctx.fillStyle = "#ffe600"; ctx.font = "bold 18px sans-serif";
  ctx.fillText(`$${player.money}`, 26, 88);
  ctx.fillStyle = "#fff"; ctx.font = "13px sans-serif";
  ctx.fillText(state.world.districtAt(player.vehicle || player).name, 110, 88);
  // wanted stars
  ctx.font = "26px sans-serif"; ctx.textAlign = "right";
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < heat.wanted ? "#ffd700" : "rgba(255,255,255,0.28)";
    ctx.fillText("★", CONFIG.canvasWidth - 22 - (4 - i) * 30, 42);
  }
  if (heat.wanted > 0) {
    ctx.fillStyle = heat.seenTimer > 0 ? "#ff5252" : "#80d8ff"; ctx.font = "bold 12px sans-serif";
    ctx.fillText(heat.seenTimer > 0 ? "POLICE IN PURSUIT" : "LOSING THEM… hide or swap cars", CONFIG.canvasWidth - 22, 64);
  }
  // objective banner
  const mission = currentMission(missions);
  ctx.fillStyle = "rgba(5,8,16,0.78)"; ctx.beginPath(); ctx.roundRect(340, 14, 600, 58, 10); ctx.fill();
  ctx.fillStyle = "#00e5ff"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left";
  ctx.fillText(mission ? mission.title : "NEON BAY · Free Roam", 356, 36);
  ctx.fillStyle = "#fff"; ctx.font = "14px sans-serif";
  ctx.fillText(currentObjectiveText(missions), 356, 58);
  if (missions.messageTimer > 0 && missions.message) {
    ctx.fillStyle = "rgba(40,10,50,0.85)"; ctx.beginPath(); ctx.roundRect(340, CONFIG.canvasHeight - 64, 600, 44, 10); ctx.fill();
    ctx.fillStyle = "#f8bbd0"; ctx.font = "13px sans-serif";
    wrapText(ctx, missions.message, 356, CONFIG.canvasHeight - 38, 570, 16);
  }
  if (state.toast) {
    ctx.fillStyle = "#ffe600"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(state.toast, CONFIG.canvasWidth / 2, 110);
  }
  ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = "12px sans-serif"; ctx.textAlign = "left";
  ctx.fillText("WASD drive/walk · E car · F punch · Space shoot · P pause · M mute", 16, CONFIG.canvasHeight - 14);
}
function wrapText(ctx, text, x, y, maxW) {
  if (ctx.measureText(text).width <= maxW) { ctx.fillText(text, x, y); return; }
  ctx.fillText(text.slice(0, 68) + "…", x, y);
}
export function drawMinimap(mm, state) {
  const mctx = mm.getContext("2d");
  const W = mm.width, H = mm.height, sx = W / CONFIG.worldWidth, sy = H / CONFIG.worldHeight;
  mctx.fillStyle = "#0b1622"; mctx.fillRect(0, 0, W, H);
  for (const d of CONFIG.districts) { mctx.fillStyle = d.color; mctx.fillRect(d.x * sx, d.y * sy, d.w * sx, d.h * sy); }
  mctx.strokeStyle = "#4b5a6a"; mctx.lineWidth = 1;
  for (const rx of state.world.roadsX) { mctx.beginPath(); mctx.moveTo(rx * sx, 0); mctx.lineTo(rx * sx, H); mctx.stroke(); }
  for (const ry of state.world.roadsY) { mctx.beginPath(); mctx.moveTo(0, ry * sy); mctx.lineTo(W, ry * sy); mctx.stroke(); }
  const target = currentTarget(state.missions);
  if (target) { mctx.fillStyle = "#ffe600"; mctx.beginPath(); mctx.arc(target.x * sx, target.y * sy, 5, 0, Math.PI * 2); mctx.fill(); }
  mctx.fillStyle = "#2196f3";
  for (const cop of state.heat.cops) { mctx.fillRect(cop.vehicle.x * sx - 2, cop.vehicle.y * sy - 2, 5, 5); }
  mctx.fillStyle = "#ff2e88";
  for (const v of state.vehicles) { if (!v.exploded) mctx.fillRect(v.x * sx - 1, v.y * sy - 1, 3, 3); }
  const p = state.player.vehicle || state.player;
  mctx.fillStyle = "#fff"; mctx.beginPath(); mctx.arc(p.x * sx, p.y * sy, 4, 0, Math.PI * 2); mctx.fill();
  mctx.strokeStyle = "#00e5ff"; mctx.stroke();
  mctx.fillStyle = "#fff"; mctx.font = "9px sans-serif"; mctx.fillText("NEON BAY", 5, 11);
}
export function drawStartScreen(ctx, state) {
  const g = ctx.createLinearGradient(0, 0, 0, CONFIG.canvasHeight);
  g.addColorStop(0, "#12082e"); g.addColorStop(0.6, "#5c1049"); g.addColorStop(1, "#0d3b4d");
  ctx.fillStyle = g; ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  ctx.fillStyle = "#ffb347"; ctx.beginPath(); ctx.arc(640, 470, 120, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#0d2b3d"; ctx.fillRect(0, 500, 1280, 220);
  ctx.fillStyle = "#00e5ff"; for (let i = 0; i < 26; i++) ctx.fillRect(20 + i * 50, 500 + (i % 4) * 12, 26, 4);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ff2e88"; ctx.font = "900 92px sans-serif"; ctx.fillText("NEON BAY", 640, 220);
  ctx.fillStyle = "#00e5ff"; ctx.font = "bold 26px sans-serif"; ctx.fillText("HEAT · A getaway in a sunset city", 640, 268);
  ctx.fillStyle = "#fff"; ctx.font = "18px sans-serif";
  ctx.fillText("Jax Marlowe is back in town. Rae has work. The police have radios.", 640, 316);
  ctx.fillText("Steal cars, run missions across Marina, Downtown, Barrio and Portside — and lose the heat.", 640, 344);
  drawButton(ctx, 490, 392, 300, 54, "▶  START GAME", "#ff2e88");
  if (state.hasSave) drawButton(ctx, 490, 458, 300, 46, "LOAD SAVE", "#37474f");
  ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.font = "14px sans-serif";
  ctx.fillText("WASD move · E enter car · F punch · Space shoot · P pause · M mute", 640, 560);
}
export function drawButton(ctx, x, y, w, h, label, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = "bold 19px sans-serif"; ctx.textAlign = "center"; ctx.fillText(label, x + w / 2, y + h / 2 + 7);
}
export function drawPause(ctx) {
  ctx.fillStyle = "rgba(0,0,0,0.62)"; ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  ctx.fillStyle = "#fff"; ctx.font = "bold 44px sans-serif"; ctx.textAlign = "center"; ctx.fillText("PAUSED", 640, 280);
  ctx.font = "18px sans-serif"; ctx.fillText("P — resume", 640, 330);
  drawButton(ctx, 490, 360, 300, 50, "SAVE GAME", "#2e7d32");
  drawButton(ctx, 490, 424, 300, 50, "RESUME", "#37474f");
}
export function drawBusted(ctx) {
  ctx.fillStyle = "rgba(20,0,0,0.66)"; ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  ctx.fillStyle = "#ff5252"; ctx.font = "bold 58px sans-serif"; ctx.textAlign = "center"; ctx.fillText("BUSTED / WASTED", 640, 320);
  ctx.fillStyle = "#fff"; ctx.font = "19px sans-serif"; ctx.fillText("Click START to try again — your cash fine was paid from your wallet.", 640, 366);
  drawButton(ctx, 490, 392, 300, 54, "▶  TRY AGAIN", "#c62828");
}
