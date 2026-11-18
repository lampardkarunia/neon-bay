// render.js - Canvas drawing: city, vehicles, people, HUD and minimap.
// Sunset/neon look comes from layered colours, not image assets.

import { PALETTE, VIEW_WIDTH, VIEW_HEIGHT, districtAt } from "./config.js";
import { isRoad } from "./world.js";
import { vehicleDamageLevel } from "./vehicles.js";
import { objectiveText, missionProgressLabel, missionTarget } from "./missions.js";

export function createCamera() {
  return { x: 0, y: 0 };
}

export function updateCamera(camera, target, world, dt) {
  const desiredX = target.x - VIEW_WIDTH / 2;
  const desiredY = target.y - VIEW_HEIGHT / 2;
  const blend = Math.min(1, dt * 5 + 0.12);
  camera.x += (desiredX - camera.x) * blend;
  camera.y += (desiredY - camera.y) * blend;
  camera.x = Math.max(0, Math.min(world.width - VIEW_WIDTH, camera.x));
  camera.y = Math.max(0, Math.min(world.height - VIEW_HEIGHT, camera.y));
}

function drawWorld(ctx, game, camera) {
  const { world } = game;
  // Base ground split by district tint.
  for (const d of world.districts) {
    ctx.fillStyle = d.tint;
    ctx.fillRect(d.x - camera.x, d.y - camera.y, d.w, d.h);
  }
  // Water strip along the south / Portside edge and Marina bay.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(-camera.x, world.height - 90 - camera.y, world.width, 90);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(-camera.x, world.height - 112 - camera.y, world.width, 22);

  // Roads: draw grid bands.
  ctx.fillStyle = PALETTE.road;
  for (let x = 200 - 46; x < world.width; x += 400) {
    ctx.fillRect(x - camera.x, -camera.y, 92, world.height);
  }
  for (let y = 200 - 46; y < world.height; y += 400) {
    ctx.fillRect(-camera.x, y - camera.y, world.width, 92);
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (let x = 196; x < world.width; x += 400) {
    for (let y = 0; y < world.height; y += 56) ctx.fillRect(x - camera.x, y - camera.y, 6, 30);
  }
  for (let y = 196; y < world.height; y += 400) {
    for (let x = 0; x < world.width; x += 56) ctx.fillRect(x - camera.x, y - camera.y, 30, 6);
  }

  for (const tree of world.trees) {
    ctx.fillStyle = tree.colour;
    ctx.beginPath();
    ctx.arc(tree.x - camera.x, tree.y - camera.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const b of world.buildings) {
    ctx.fillStyle = "#00000055";
    ctx.fillRect(b.x - camera.x + 6, b.y - camera.y + 8, b.w, b.h);
    ctx.fillStyle = b.colour;
    ctx.fillRect(b.x - camera.x, b.y - camera.y, b.w, b.h);
    ctx.strokeStyle = b.trim;
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x - camera.x + 3, b.y - camera.y + 3, b.w - 6, b.h - 6);
    ctx.fillStyle = "#ffffffcc";
    const cols = Math.floor(b.w / 26);
    const rows = Math.floor(b.h / 26);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 13 + b.floors) % 3 === 0) {
          ctx.fillRect(b.x - camera.x + 10 + i * 24, b.y - camera.y + 10 + j * 24, 11, 9);
        }
      }
    }
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px system-ui, sans-serif";
  for (const d of world.districts) {
    ctx.fillText(d.name.toUpperCase(), d.x + 36 - camera.x, d.y + 52 - camera.y);
  }
  void isRoad;
}

function drawVehicle(ctx, car, camera, time) {
  const x = car.x - camera.x;
  const y = car.y - camera.y;
  if (x < -80 || y < -80 || x > VIEW_WIDTH + 80 || y > VIEW_HEIGHT + 80) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);
  ctx.fillStyle = "#00000066";
  ctx.fillRect(-car.width / 2 + 3, -car.height / 2 + 5, car.width, car.height);
  ctx.fillStyle = car.exploded ? "#222222" : car.colour;
  ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);
  ctx.fillStyle = car.isPolice ? "#ffffff" : "#bfefff";
  ctx.fillRect(-8, -car.height / 2 + 3, 18, car.height - 6);
  if (car.isPolice) {
    ctx.fillStyle = "#111111";
    ctx.font = "bold 8px system-ui";
    ctx.fillText("POLICE", -18, 3);
    const flash = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = flash ? "#ff0044" : "#0066ff";
    ctx.fillRect(-4, -5, 9, 9);
  }
  ctx.fillStyle = "#111111";
  ctx.fillRect(-car.width / 2 + 4, -car.height / 2 - 3, 10, 6);
  ctx.fillRect(-car.width / 2 + 4, car.height / 2 - 3, 10, 6);
  ctx.fillRect(car.width / 2 - 14, -car.height / 2 - 3, 10, 6);
  ctx.fillRect(car.width / 2 - 14, car.height / 2 - 3, 10, 6);
  const dmg = vehicleDamageLevel(car);
  if (dmg >= 2 && !car.exploded) {
    ctx.fillStyle = "#ccccccaa";
    ctx.beginPath();
    ctx.arc(10, 0, 9 + Math.sin(time * 9) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (car.exploded) {
    ctx.fillStyle = "#ff7b00cc";
    ctx.beginPath();
    ctx.arc(x, y, 24 + Math.sin(time * 11) * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPerson(ctx, x, y, shirt, angle, down, isPlayer, time, stepPhase) {
  if (down) {
    ctx.fillStyle = "#7f1d1d";
    ctx.fillRect(x - 13, y - 5, 26, 10);
    return;
  }
  ctx.fillStyle = "#00000055";
  ctx.beginPath(); ctx.ellipse(x, y + 8, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
  const bob = isPlayer ? Math.sin(stepPhase) * 1.6 : Math.sin(time * 5 + x) * 1.2;
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(x, y + bob, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffcf9f";
  ctx.beginPath(); ctx.arc(x + Math.cos(angle) * 4, y + bob + Math.sin(angle) * 4, 6, 0, Math.PI * 2); ctx.fill();
  if (isPlayer) {
    ctx.strokeStyle = "#ffe600";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + bob, 15, 0, Math.PI * 2); ctx.stroke();
  }
}

export function drawMarker(ctx, target, camera, time) {
  if (!target) return;
  const x = target.x - camera.x;
  const y = target.y - camera.y;
  const bounce = Math.sin(time * 4) * 6;
  ctx.fillStyle = "#ffe600";
  ctx.beginPath();
  ctx.moveTo(x, y - 44 + bounce);
  ctx.lineTo(x - 13, y - 68 + bounce);
  ctx.lineTo(x + 13, y - 68 + bounce);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#ffe600";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, 26 + Math.sin(time * 4) * 4, 0, Math.PI * 2); ctx.stroke();
}

export function renderGame(ctx, game, time) {
  const { world, player, vehicles, police, camera, missions, heat, combat, heli, roadblocks } = game;
  ctx.fillStyle = PALETTE.sky;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  drawWorld(ctx, game, camera);

  const target = missionTarget(missions);
  if (target) drawMarker(ctx, target, camera, time);

  for (const block of roadblocks || []) {
    ctx.save();
    ctx.translate(block.x - camera.x, block.y - camera.y);
    ctx.rotate(block.angle || 0);
    ctx.fillStyle = "#ff8c1a";
    ctx.fillRect(-34, -8, 68, 16);
    ctx.fillStyle = "#ffffff";
    for (let i = -28; i < 30; i += 16) ctx.fillRect(i, -8, 8, 16);
    ctx.restore();
  }

  for (const car of vehicles) drawVehicle(ctx, car, camera, time);
  for (const unit of police) drawVehicle(ctx, unit, camera, time);

  for (const ped of world.pedestrians) {
    drawPerson(ctx, ped.x - camera.x, ped.y - camera.y, ped.shirt, ped.angle, ped.down, false, time, 0);
  }

  if (!player.vehicle) {
    drawPerson(ctx, player.x - camera.x, player.y - camera.y, "#111827", player.angle, player.dead, true, time, player.steps);
    // Facing gun / fist indicator.
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x - camera.x, player.y - camera.y);
    ctx.lineTo(player.x - camera.x + Math.cos(player.angle) * 24, player.y - camera.y + Math.sin(player.angle) * 24);
    ctx.stroke();
  }

  for (const bullet of combat.bullets) {
    ctx.fillStyle = "#fff200";
    ctx.beginPath();
    ctx.arc(bullet.x - camera.x, bullet.y - camera.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const effect of combat.effects) {
    if (effect.type === "explosion") {
      ctx.fillStyle = "#ff5e00cc";
      ctx.beginPath(); ctx.arc(effect.x - camera.x, effect.y - camera.y, 46, 0, Math.PI * 2); ctx.fill();
    }
  }

  if (heli && heli.active) {
    const x = heli.x - camera.x;
    const y = heli.y - camera.y;
    ctx.fillStyle = "#ffeebbaa";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 90, y + 190); ctx.lineTo(x + 90, y + 190); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#101828";
    ctx.beginPath(); ctx.ellipse(x, y, 30, 14, heli.angle, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#111111"; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(heli.rotor) * 44, y - Math.sin(heli.rotor) * 44);
    ctx.lineTo(x + Math.cos(heli.rotor) * 44, y + Math.sin(heli.rotor) * 44);
    ctx.stroke();
  }

  if (player.hurtFlash > 0) {
    ctx.fillStyle = "#ff000044";
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }
  void districtAt;
}

export function drawMinimap(miniCtx, game) {
  const w = miniCtx.canvas.width;
  const h = miniCtx.canvas.height;
  const sx = w / game.world.width;
  const sy = h / game.world.height;
  miniCtx.fillStyle = "#1a1033";
  miniCtx.fillRect(0, 0, w, h);
  for (const d of game.world.districts) {
    miniCtx.fillStyle = d.tint;
    miniCtx.fillRect(d.x * sx, d.y * sy, d.w * sx, d.h * sy);
  }
  miniCtx.fillStyle = "#2f3542";
  for (let x = 154; x < game.world.width; x += 400) miniCtx.fillRect(x * sx, 0, 92 * sx, h);
  for (let y = 154; y < game.world.height; y += 400) miniCtx.fillRect(0, y * sy, w, 92 * sy);
  const target = missionTarget(game.missions);
  if (target) {
    miniCtx.fillStyle = "#ffe600";
    miniCtx.beginPath(); miniCtx.arc(target.x * sx, target.y * sy, 6, 0, Math.PI * 2); miniCtx.fill();
  }
  for (const unit of game.police) {
    miniCtx.fillStyle = "#2e6bff";
    miniCtx.fillRect(unit.x * sx - 3, unit.y * sy - 3, 6, 6);
  }
  for (const car of game.vehicles) {
    miniCtx.fillStyle = "#ffffff";
    miniCtx.fillRect(car.x * sx - 2, car.y * sy - 2, 4, 4);
  }
  const pos = game.player.vehicle || game.player;
  miniCtx.fillStyle = "#ff0044";
  miniCtx.beginPath(); miniCtx.arc(pos.x * sx, pos.y * sy, 5, 0, Math.PI * 2); miniCtx.fill();
  miniCtx.strokeStyle = "#ffffff";
  miniCtx.strokeRect(0, 0, w, h);
}

export function drawHud(dom, game) {
  const { player, heat, missions } = game;
  dom.healthFill.style.width = `${Math.max(0, player.health)}%`;
  dom.healthFill.style.background = player.health > 35 ? "#2bff88" : "#ff3355";
  dom.money.textContent = `$${player.money}`;
  dom.stars.textContent = "★".repeat(heat.wanted) + "☆".repeat(5 - heat.wanted);
  dom.stars.style.color = heat.wanted > 0 ? "#ffd32a" : "#888888";
  dom.objective.textContent = objectiveText(missions);
  dom.missionLabel.textContent = missionProgressLabel(missions);
  const pos = player.vehicle || player;
  dom.district.textContent = districtAt(pos.x, pos.y).name;
  if (missions.messageTimer > 0) {
    dom.message.textContent = missions.message;
    dom.message.style.opacity = "1";
  } else {
    dom.message.style.opacity = "0";
  }
  dom.vehicleLabel.textContent = player.vehicle
    ? `${player.vehicle.spec.label} · HP ${Math.ceil(player.vehicle.health)}${player.vehicle.stolen ? " · STOLEN" : ""}`
    : "On foot — E to enter a car";
}
