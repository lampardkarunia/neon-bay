// render.js - Canvas drawing: city, entities, HUD and minimap for NEON BAY.
// Everything is drawn with plain canvas paths; no images or external assets.

import { COLORS, ROAD_WIDTH, BLOCK_SIZE, clamp } from "./config.js";
import { districtAt } from "./world.js";

export function drawWorld(ctx, game, viewW, viewH) {
  const cam = game.camera;
  const left = cam.x - viewW / 2;
  const top = cam.y - viewH / 2;
  ctx.fillStyle = "#241536";
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.save();
  ctx.translate(-left, -top);

  drawGround(ctx, game, left, top, viewW, viewH);
  drawRoads(ctx, game, left, top, viewW, viewH);
  drawProps(ctx, game);
  drawBuildings(ctx, game, left, top, viewW, viewH);
  drawMarker(ctx, game);
  drawRoadblocks(ctx, game);
  for (const ped of game.pedestrians) drawPedestrian(ctx, ped);
  for (const vehicle of game.vehicles) drawVehicle(ctx, game, vehicle);
  if (!game.player.vehicle) drawPlayer(ctx, game.player);
  drawBullets(ctx, game);
  drawParticles(ctx, game);
  if (game.police.helicopter) drawHelicopter(ctx, game.police.helicopter, game.time);
  ctx.restore();
}

function drawGround(ctx, game, left, top, viewW, viewH) {
  const district = districtAt(game.player.x, game.player.y);
  ctx.fillStyle = "#312244";
  ctx.fillRect(left - 20, top - 20, viewW + 40, viewH + 40);
  // District tint washes.
  ctx.fillStyle = "rgba(255,126,95,0.07)";
  ctx.fillRect(0, 0, game.world.width / 2, game.world.height / 2);
  ctx.fillStyle = "rgba(199,125,255,0.07)";
  ctx.fillRect(game.world.width / 2, 0, game.world.width / 2, game.world.height / 2);
  ctx.fillStyle = "rgba(255,159,28,0.07)";
  ctx.fillRect(0, game.world.height / 2, game.world.width / 2, game.world.height / 2);
  ctx.fillStyle = "rgba(46,196,182,0.08)";
  ctx.fillRect(game.world.width / 2, game.world.height / 2, game.world.width / 2, game.world.height / 2);
  void district;
  // Beach and water on the west edge.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(0, 0, 56, game.world.height);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(-260, 0, 260, game.world.height);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  for (let y = 30; y < game.world.height; y += 90) ctx.fillRect(-40, y, 34, 5);
}

function drawRoads(ctx, game, left, top, viewW, viewH) {
  ctx.fillStyle = COLORS.road;
  const centres = [];
  for (let c = BLOCK_SIZE / 2; c < game.world.width; c += BLOCK_SIZE) centres.push(c);
  for (const c of centres) {
    if (c + ROAD_WIDTH / 2 > left && c - ROAD_WIDTH / 2 < left + viewW) ctx.fillRect(c - ROAD_WIDTH / 2, 0, ROAD_WIDTH, game.world.height);
    if (c + ROAD_WIDTH / 2 > top && c - ROAD_WIDTH / 2 < top + viewH) ctx.fillRect(0, c - ROAD_WIDTH / 2, game.world.width, ROAD_WIDTH);
  }
  ctx.strokeStyle = COLORS.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 18]);
  ctx.beginPath();
  for (const c of centres) {
    ctx.moveTo(c, 0); ctx.lineTo(c, game.world.height);
    ctx.moveTo(0, c); ctx.lineTo(game.world.width, c);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Sidewalk borders.
  ctx.strokeStyle = COLORS.sidewalk;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (const c of centres) {
    ctx.moveTo(c - ROAD_WIDTH / 2, 0); ctx.lineTo(c - ROAD_WIDTH / 2, game.world.height);
    ctx.moveTo(c + ROAD_WIDTH / 2, 0); ctx.lineTo(c + ROAD_WIDTH / 2, game.world.height);
    ctx.moveTo(0, c - ROAD_WIDTH / 2); ctx.lineTo(game.world.width, c - ROAD_WIDTH / 2);
    ctx.moveTo(0, c + ROAD_WIDTH / 2); ctx.lineTo(game.world.width, c + ROAD_WIDTH / 2);
  }
  ctx.stroke();
}

function drawProps(ctx, game) {
  for (const tree of game.world.trees) {
    ctx.fillStyle = "#1d6f5c";
    ctx.beginPath(); ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2a9d8f";
    ctx.beginPath(); ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.62, 0, Math.PI * 2); ctx.fill();
  }
  for (const lamp of game.world.lamps) {
    ctx.fillStyle = "#ffd166";
    ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,209,102,0.16)";
    ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 20, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#8d6e63";
  for (const prop of game.world.props) {
    if (prop.kind === "pier") ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
  }
}

function drawBuildings(ctx, game, left, top, viewW, viewH) {
  for (const b of game.world.buildings) {
    if (b.x + b.w < left || b.x > left + viewW || b.y + b.h < top || b.y > top + viewH) continue;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(b.x, b.y, b.w, 9);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    const cols = Math.max(2, Math.floor(b.w / 22));
    const rows = Math.max(2, Math.floor(b.h / 22));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 13 + b.floors) % 3 === 0) continue;
        ctx.fillRect(b.x + 8 + i * 20, b.y + 14 + j * 19, 9, 7);
      }
    }
    if (b.neon) {
      ctx.fillStyle = COLORS.neonPink;
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.fillText(b.name.toUpperCase(), b.x + 6, b.y - 5 < top ? b.y + 13 : b.y - 5 + 13);
    }
  }
}

function drawMarker(ctx, game) {
  const marker = game.missions.marker;
  if (!marker) return;
  const pulse = 1 + Math.sin(game.time * 5) * 0.18;
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(marker.x, marker.y, 30 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "rgba(255,209,102,0.22)";
  ctx.beginPath(); ctx.arc(marker.x, marker.y, 30 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffd166";
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("▼", marker.x, marker.y - 42 - Math.sin(game.time * 5) * 5);
  ctx.textAlign = "left";
}

function drawRoadblocks(ctx, game) {
  for (const block of game.police.roadblocks) {
    ctx.save();
    ctx.translate(block.x, block.y);
    ctx.rotate(block.angle);
    ctx.fillStyle = "#f1faee";
    ctx.fillRect(-38, -11, 34, 22);
    ctx.fillRect(6, -11, 34, 22);
    ctx.fillStyle = "#1d3557";
    ctx.fillRect(-38, -4, 34, 8);
    ctx.fillRect(6, -4, 34, 8);
    ctx.fillStyle = "#e63946";
    ctx.fillRect(-4, -14, 8, 28);
    ctx.restore();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.fillText("ROADBLOCK", block.x - 32, block.y - 24);
  }
}

export function drawVehicle(ctx, game, vehicle) {
  ctx.save();
  ctx.translate(vehicle.x, vehicle.y);
  ctx.rotate(vehicle.angle);
  const w = vehicle.width;
  const h = vehicle.height;
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  let body = vehicle.color;
  if (vehicle.isPolice) body = "#f8f9fa";
  if (vehicle.destroyed) body = "#343a40";
  ctx.fillStyle = body;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();
  if (vehicle.isPolice) {
    ctx.fillStyle = "#1d3557";
    ctx.fillRect(-w * 0.18, -h / 2, w * 0.36, h);
    ctx.fillStyle = "#e63946";
    ctx.fillRect(-6, -h / 2 - 3, 12, 5);
    ctx.fillStyle = "#4361ee";
    ctx.fillRect(-6, h / 2 - 2, 12, 5);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 8px system-ui, sans-serif";
    ctx.fillText("POLICE", -16, 3);
  }
  if (vehicle.isMissionTarget) {
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 3;
    roundRect(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 8); ctx.stroke();
  }
  // Windshield and rear window.
  ctx.fillStyle = "rgba(10,20,40,0.82)";
  ctx.fillRect(w * 0.08, -h * 0.36, w * 0.2, h * 0.72);
  ctx.fillRect(-w * 0.32, -h * 0.34, w * 0.13, h * 0.68);
  // Wheels.
  ctx.fillStyle = "#111111";
  ctx.fillRect(-w * 0.36, -h / 2 - 3, 11, 5);
  ctx.fillRect(w * 0.22, -h / 2 - 3, 11, 5);
  ctx.fillRect(-w * 0.36, h / 2 - 2, 11, 5);
  ctx.fillRect(w * 0.22, h / 2 - 2, 11, 5);
  // Damage smoke / fire.
  if (vehicle.health < vehicle.maxHealth * 0.35 && !vehicle.destroyed) {
    ctx.fillStyle = "rgba(120,120,120,0.55)";
    ctx.beginPath(); ctx.arc(w * 0.3, 0, 7 + Math.sin(game.time * 9) * 2, 0, Math.PI * 2); ctx.fill();
  }
  if (vehicle.destroyed && vehicle.burning > 0) {
    ctx.fillStyle = "#ff8500";
    ctx.beginPath(); ctx.arc(0, 0, 13 + Math.sin(game.time * 13) * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Health bar over badly damaged cars.
  if (vehicle.health < vehicle.maxHealth && !vehicle.destroyed) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(vehicle.x - 20, vehicle.y - vehicle.height - 14, 40, 5);
    ctx.fillStyle = vehicle.health > 40 ? "#06d6a0" : "#e63946";
    ctx.fillRect(vehicle.x - 20, vehicle.y - vehicle.height - 14, 40 * clamp(vehicle.health / vehicle.maxHealth, 0, 1), 5);
  }
}

function drawPedestrian(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.down) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = "#6c757d";
    ctx.fillRect(-10, -5, 20, 10);
    ctx.restore();
    return;
  }
  ctx.rotate(ped.angle);
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(0, 0, ped.radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.hostile ? "#370617" : "#ffe5d9";
  ctx.beginPath(); ctx.arc(3, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  if (ped.hostile) {
    ctx.fillStyle = "#111111";
    ctx.fillRect(6, -2, 13, 4);
  }
  ctx.restore();
}

function drawPlayer(ctx, player) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  const bob = Math.sin(player.walkCycle) * 1.6;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath(); ctx.ellipse(2, 3, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ff2e88";
  ctx.beginPath(); ctx.arc(0, bob * 0.2, player.radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffd6a5";
  ctx.beginPath(); ctx.arc(4, 0, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#00f5d4";
  ctx.fillRect(-9, -player.radius - 2, 16, 5);
  ctx.restore();
  if (player.hurtFlash > 0) {
    ctx.strokeStyle = "rgba(230,57,70,0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 6, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawBullets(ctx, game) {
  ctx.fillStyle = "#ffe66d";
  for (const b of game.bullets) ctx.fillRect(b.x - 3, b.y - 1.5, 6, 3);
}

function drawParticles(ctx, game) {
  for (const p of game.particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawHelicopter(ctx, heli, time) {
  ctx.save();
  ctx.translate(heli.x, heli.y);
  ctx.fillStyle = "rgba(255,255,200,0.10)";
  ctx.beginPath(); ctx.arc(0, 0, 105, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(heli.angle);
  ctx.fillStyle = "#f8f9fa";
  roundRect(ctx, -24, -11, 48, 22, 9); ctx.fill();
  ctx.fillStyle = "#1d3557";
  ctx.fillRect(14, -7, 14, 14);
  ctx.fillRect(-44, -3, 22, 6);
  ctx.strokeStyle = "#dee2e6";
  ctx.lineWidth = 4;
  const r = Math.sin(time * 28) * 4;
  ctx.beginPath(); ctx.moveTo(-34 - r, 0); ctx.lineTo(34 + r, 0); ctx.stroke();
  ctx.fillStyle = "#e63946";
  ctx.beginPath(); ctx.arc(-4, -6, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#4361ee";
  ctx.beginPath(); ctx.arc(-4, 6, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.fillText("POLICE", heli.x - 20, heli.y - 30);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawHUD(ctx, game, viewW, viewH) {
  const player = game.player;
  // Top-left panel: health, money, district.
  ctx.fillStyle = "rgba(10,8,28,0.68)";
  roundRect(ctx, 14, 14, 292, 104, 10); ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 17px system-ui, sans-serif";
  ctx.fillText("NEON BAY", 26, 38);
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillStyle = "#ffd166";
  ctx.fillText(districtAt(player.x, player.y).name + " District", 118, 38);
  // Health bar.
  ctx.fillStyle = "#3a0ca3";
  ctx.fillRect(26, 48, 200, 15);
  ctx.fillStyle = player.health > 30 ? "#06d6a0" : "#e63946";
  ctx.fillRect(26, 48, 200 * clamp(player.health / player.maxHealth, 0, 1), 15);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.fillText(`HP ${Math.ceil(player.health)}`, 232, 60);
  ctx.font = "bold 19px system-ui, sans-serif";
  ctx.fillStyle = "#ffd166";
  ctx.fillText(`$${player.money}`, 26, 90);
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  const vehicleLabel = player.vehicle ? `Driving: ${player.vehicle.label}  HP ${Math.ceil(player.vehicle.health)}` : "On foot - E to enter a car";
  ctx.fillText(vehicleLabel, 110, 90);
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillStyle = "#adb5bd";
  ctx.fillText("WASD drive/walk - F punch - Space shoot - P pause - M mute", 26, 110);

  drawWantedStars(ctx, game, viewW);
  drawObjective(ctx, game, viewW);
  drawMinimap(ctx, game, viewW, viewH);

  if (game.missions.messageTimer > 0 && game.missions.message) {
    ctx.fillStyle = "rgba(10,8,28,0.78)";
    roundRect(ctx, viewW / 2 - 340, viewH - 92, 680, 52, 10); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "15px system-ui, sans-serif";
    wrapText(ctx, game.missions.message, viewW / 2 - 324, viewH - 66, 648, 19, 2);
  }
  if (game.bustedTimer > 0.15) {
    ctx.fillStyle = "#e63946";
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BUSTED?", viewW / 2, 120);
    ctx.textAlign = "left";
  }
  if (player.vehicle && player.vehicle.isPolice) void 0;
}

function drawWantedStars(ctx, game, viewW) {
  ctx.fillStyle = "rgba(10,8,28,0.68)";
  roundRect(ctx, viewW - 238, 14, 224, 58, 10); ctx.fill();
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("HEAT", viewW - 224, 36);
  for (let i = 0; i < 5; i++) {
    ctx.font = "26px system-ui, sans-serif";
    ctx.fillStyle = i < game.wanted ? "#ffd166" : "rgba(255,255,255,0.22)";
    ctx.fillText("★", viewW - 224 + i * 30, 64);
  }
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillStyle = game.police.seenNow ? "#ff5964" : "#06d6a0";
  ctx.fillText(game.wanted === 0 ? "Clean" : (game.police.seenNow ? "PURSUIT!" : "Hiding... heat cooling"), viewW - 130, 36);
}

function drawObjective(ctx, game, viewW) {
  const state = game.missions;
  const def = state.index < 4 ? ["First Wheels", "Repo Run", "Cross-Bay Package", "Neon Finale"][state.index] : null;
  ctx.fillStyle = "rgba(10,8,28,0.68)";
  roundRect(ctx, viewW / 2 - 300, 14, 600, 56, 10); ctx.fill();
  ctx.fillStyle = "#ffd166";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.fillText(def ? `MISSION: ${def}` : "FREE ROAM", viewW / 2 - 284, 34);
  ctx.fillStyle = "#ffffff";
  ctx.font = "14px system-ui, sans-serif";
  wrapText(ctx, state.objectiveText || "", viewW / 2 - 284, 54, 568, 17, 2);
  if (!state.active && !state.complete) {
    ctx.fillStyle = "#00f5d4";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.fillText("Press ENTER to start job", viewW / 2 + 130, 34);
  }
}

export function drawMinimap(ctx, game, viewW, viewH) {
  const size = 168;
  const x0 = viewW - size - 14;
  const y0 = viewH - size - 14;
  const scale = size / game.world.width;
  ctx.fillStyle = "rgba(10,8,28,0.82)";
  roundRect(ctx, x0 - 4, y0 - 4, size + 8, size + 8, 8); ctx.fill();
  ctx.fillStyle = "#241536";
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = "#2b2d42";
  for (let c = BLOCK_SIZE / 2; c < game.world.width; c += BLOCK_SIZE) {
    ctx.fillRect(x0 + (c - ROAD_WIDTH / 2) * scale, y0, ROAD_WIDTH * scale, size);
    ctx.fillRect(x0, y0 + (c - ROAD_WIDTH / 2) * scale, size, ROAD_WIDTH * scale);
  }
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  for (const b of game.world.buildings) ctx.fillRect(x0 + b.x * scale, y0 + b.y * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.h * scale));
  if (game.missions.marker) {
    ctx.fillStyle = "#ffd166";
    ctx.beginPath(); ctx.arc(x0 + game.missions.marker.x * scale, y0 + game.missions.marker.y * scale, 5, 0, Math.PI * 2); ctx.fill();
  }
  for (const unit of game.police.units) {
    ctx.fillStyle = "#4361ee";
    ctx.fillRect(x0 + unit.vehicle.x * scale - 2.5, y0 + unit.vehicle.y * scale - 2.5, 5, 5);
  }
  for (const vehicle of game.vehicles) {
    if (vehicle.isMissionTarget) {
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(x0 + vehicle.x * scale - 2.5, y0 + vehicle.y * scale - 2.5, 5, 5);
    }
  }
  const pos = game.player.vehicle || game.player;
  ctx.fillStyle = "#ff2e88";
  ctx.beginPath(); ctx.arc(x0 + pos.x * scale, y0 + pos.y * scale, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x0 + pos.x * scale, y0 + pos.y * scale, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.fillText("MAP - NEON BAY", x0 + 4, y0 - 8 + 4);
}

export function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text).split(" ");
  let line = "";
  let lines = 0;
  for (const word of words) {
    const trial = line ? line + " " + word : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      if (lines >= (maxLines || 3)) return;
      line = word;
    } else {
      line = trial;
    }
  }
  if (line && lines < (maxLines || 3)) ctx.fillText(line, x, y + lines * lineHeight);
}
