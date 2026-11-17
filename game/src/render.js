// render.js — semua yang digambar ke canvas: kota dari atas, kendaraan, pejalan kaki,
// HUD, minimap, dialog, dan layar-layar penuh (judul, jeda, tertangkap, menang).
// Semuanya prosedural; tidak ada gambar eksternal yang dimuat.
import { CFG, NEON } from './config.js';
import { districtAt } from './world.js';

export function drawWorld(ctx, state) {
  const w = state.world;
  const cam = state.camera;
  const vx0 = cam.x - 40, vy0 = cam.y - 40, vx1 = cam.x + CFG.VIEW_W + 40, vy1 = cam.y + CFG.VIEW_H + 40;

  ctx.fillStyle = '#16161f';
  ctx.fillRect(cam.x, cam.y, CFG.VIEW_W, CFG.VIEW_H);

  for (const wa of w.water) {
    ctx.fillStyle = '#0b3550';
    ctx.fillRect(wa.x, wa.y, wa.w, wa.h);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.strokeRect(wa.x, wa.y, wa.w, wa.h);
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(wa.label, wa.x + 10, wa.y + 24);
  }

  for (const pk of w.parks) {
    if (pk.x > vx1 || pk.x + pk.w < vx0 || pk.y > vy1 || pk.y + pk.h < vy0) continue;
    ctx.fillStyle = '#14532d';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
  }

  ctx.fillStyle = '#2b2b33';
  for (const rx of w.xs) ctx.fillRect(rx - CFG.ROAD_W / 2, 0, CFG.ROAD_W, CFG.WORLD_H);
  for (const ry of w.ys) ctx.fillRect(0, ry - CFG.ROAD_W / 2, CFG.WORLD_W, CFG.ROAD_W);
  ctx.strokeStyle = '#3f3f4a';
  ctx.lineWidth = 3;
  for (const rx of w.xs) {
    ctx.beginPath(); ctx.moveTo(rx - CFG.ROAD_W / 2, 0); ctx.lineTo(rx - CFG.ROAD_W / 2, CFG.WORLD_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx + CFG.ROAD_W / 2, 0); ctx.lineTo(rx + CFG.ROAD_W / 2, CFG.WORLD_H); ctx.stroke();
  }
  for (const ry of w.ys) {
    ctx.beginPath(); ctx.moveTo(0, ry - CFG.ROAD_W / 2); ctx.lineTo(CFG.WORLD_W, ry - CFG.ROAD_W / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ry + CFG.ROAD_W / 2); ctx.lineTo(CFG.WORLD_W, ry + CFG.ROAD_W / 2); ctx.stroke();
  }
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const rx of w.xs) {
    ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, CFG.WORLD_H); ctx.stroke();
  }
  for (const ry of w.ys) {
    ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(CFG.WORLD_W, ry); ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const b of w.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    ctx.fillStyle = '#00000055';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = b.roof;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    ctx.fillStyle = '#fde68a';
    const cols = Math.max(1, Math.floor(b.w / 22));
    const rows = Math.max(1, Math.floor(b.h / 22));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if ((i * 7 + j * 13 + b.x) % 3 === 0) {
        ctx.fillRect(b.x + 6 + i * 22, b.y + 6 + j * 22, 8, 8);
      }
    }
    if (b.tall) {
      ctx.fillStyle = b.roof;
      ctx.font = 'bold 11px monospace';
      ctx.fillText('▲', b.x + b.w / 2 - 5, b.y + b.h / 2 + 4);
    }
  }

  for (const t of w.trees) {
    if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
    ctx.fillStyle = '#166534';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.beginPath(); ctx.arc(t.x - 2, t.y - 2, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }

  const m = state.mission.active;
  if (m) drawMarker(ctx, m.target.x, m.target.y, state.time);

  for (const b of state.roadblocks) {
    for (const c of b.cars) drawCar(ctx, c, true);
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('⚠ ROADBLOCK', b.x - 52, b.y - 34);
  }
}

function drawMarker(ctx, x, y, t) {
  const pulse = 1 + Math.sin(t * 4) * 0.15;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = NEON.yellow;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = NEON.yellow;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = NEON.yellow;
  ctx.font = 'bold 14px monospace';
  ctx.fillText('▼ TARGET', x - 34, y - 46);
}

export function drawCar(ctx, car, isPolice) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = 46, h = 24;
  ctx.fillStyle = '#00000066';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, -6, -h / 2 + 3, 14, h - 6, 4); ctx.fill();
  ctx.fillStyle = '#1e293b';
  roundRect(ctx, 8, -h / 2 + 4, 8, h - 8, 3); ctx.fill();
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(w / 2 - 2, -h / 2 + 2, 3, 5);
  ctx.fillRect(w / 2 - 2, h / 2 - 7, 3, 5);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-w / 2, -h / 2 + 2, 3, 5);
  ctx.fillRect(-w / 2, h / 2 - 7, 3, 5);
  if (isPolice) {
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('POLISI', -16, 3);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawEntities(ctx, state) {
  for (const ped of state.peds) {
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(ped.x, ped.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#00000088';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (ped.panic > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('!', ped.x - 3, ped.y - 12);
    }
  }
  for (const c of state.traffic) {
    if (c.disabled) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      drawCar(ctx, c, false);
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('✕', c.x - 5, c.y - 18);
    } else drawCar(ctx, c, false);
  }
  for (const c of state.police) {
    drawCar(ctx, { ...c, color: '#1d4ed8' }, true);
    const on = Math.floor(c.sirenPhase * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ef4444' : '#3b82f6';
    ctx.beginPath(); ctx.arc(c.x, c.y - 14, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = on ? '#3b82f6' : '#ef4444';
    ctx.beginPath(); ctx.arc(c.x, c.y + 14, 5, 0, Math.PI * 2); ctx.fill();
  }
  if (state.heli) {
    const h = state.heli;
    ctx.fillStyle = 'rgba(255, 255, 180, 0.10)';
    ctx.beginPath(); ctx.arc(state.player.x, state.player.y, 150, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 180, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(state.player.x, state.player.y, 150, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(h.x + 18, h.y + 18, 34, 16, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rotor);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.stroke();
    ctx.rotate(-h.rotor);
    ctx.fillStyle = '#334155';
    roundRect(ctx, -20, -10, 40, 20, 8); ctx.fill();
    ctx.fillStyle = '#7dd3fc';
    roundRect(ctx, 6, -7, 10, 14, 4); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('HELI POLISI', h.x - 34, h.y - 28);
  }
  const p = state.player;
  if (!p.onFoot && p.car) {
    drawCar(ctx, { ...p.car, color: NEON.pink }, false);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('JAX', p.x - 10, p.y - 20);
  }
  if (p.onFoot) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath(); ctx.arc(6, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(20, 0); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('JAX', p.x - 10, p.y - 18);
  }
  ctx.fillStyle = '#fde047';
  for (const b of state.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

export function drawHUD(ctx, state) {
  const p = state.player;
  const W = CFG.VIEW_W;
  ctx.fillStyle = 'rgba(2,6,23,0.72)';
  roundRect(ctx, 12, 12, 250, 64, 10); ctx.fill();
  ctx.fillStyle = NEON.green;
  ctx.font = 'bold 22px monospace';
  ctx.fillText('$' + p.money.toLocaleString('en-US'), 24, 40);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px monospace';
  ctx.fillText('JAX MARLOWE', 24, 60);
  ctx.fillStyle = '#334155';
  roundRect(ctx, 150, 26, 100, 12, 6); ctx.fill();
  ctx.fillStyle = p.health > 40 ? NEON.green : NEON.red;
  roundRect(ctx, 150, 26, 100 * (p.health / 100), 12, 6); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText('HP ' + Math.ceil(p.health), 150, 54);

  ctx.fillStyle = 'rgba(2,6,23,0.72)';
  roundRect(ctx, W - 232, 12, 220, 44, 10); ctx.fill();
  ctx.font = 'bold 24px monospace';
  for (let i = 0; i < CFG.MAX_WANTED; i++) {
    ctx.fillStyle = i < p.wanted ? '#facc15' : '#475569';
    ctx.fillText('★', W - 218 + i * 34, 42);
  }
  ctx.fillStyle = '#fca5a5';
  ctx.font = '12px monospace';
  ctx.fillText(p.wanted > 0 ? 'WANTED' : 'BERSIH', W - 218, 58);

  if (!p.onFoot) {
    ctx.fillStyle = 'rgba(2,6,23,0.72)';
    roundRect(ctx, 12, 84, 250, 30, 8); ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.fillText('MOBIL', 22, 103);
    ctx.fillStyle = '#334155';
    roundRect(ctx, 76, 92, 170, 12, 6); ctx.fill();
    ctx.fillStyle = p.carHealth > 40 ? NEON.cyan : NEON.red;
    roundRect(ctx, 76, 92, 170 * (p.carHealth / 100), 12, 6); ctx.fill();
  }

  const m = state.mission.active;
  if (m) {
    ctx.fillStyle = 'rgba(2,6,23,0.78)';
    roundRect(ctx, 12, CFG.VIEW_H - 66, 560, 54, 10); ctx.fill();
    ctx.fillStyle = NEON.yellow;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(m.title, 24, CFG.VIEW_H - 44);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px monospace';
    ctx.fillText(m.objective, 24, CFG.VIEW_H - 24);
  } else if (state.mission.pendingNext || state.mission.index === -1) {
    ctx.fillStyle = 'rgba(2,6,23,0.78)';
    roundRect(ctx, 12, CFG.VIEW_H - 66, 560, 54, 10); ctx.fill();
    ctx.fillStyle = NEON.cyan;
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Tekan ENTER untuk misi berikutnya', 24, CFG.VIEW_H - 44);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px monospace';
    const next = state.mission.index < 0 ? 'Misi 1: Roda Panas'
      : state.mission.index < 3 ? 'Misi ' + (state.mission.index + 1) : 'Semua misi selesai!';
    ctx.fillText(next, 24, CFG.VIEW_H - 24);
  }

  if (state.toast && state.toastTimer > 0) {
    ctx.fillStyle = 'rgba(2,6,23,0.85)';
    const tw = ctx.measureText(state.toast).width + 28;
    roundRect(ctx, (W - tw) / 2, 84, tw, 34, 8); ctx.fill();
    ctx.fillStyle = NEON.yellow;
    ctx.font = 'bold 15px monospace';
    ctx.fillText(state.toast, (W - tw) / 2 + 14, 106);
  }

  const d = state.mission.dialog;
  if (d && d.lineIdx < d.lines.length) {
    ctx.fillStyle = 'rgba(2,6,23,0.88)';
    roundRect(ctx, CFG.VIEW_W / 2 - 360, CFG.VIEW_H - 150, 720, 64, 10); ctx.fill();
    ctx.fillStyle = NEON.cyan;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(d.lines[d.lineIdx], CFG.VIEW_W / 2 - 344, CFG.VIEW_H - 124);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.fillText('ENTER — lanjut', CFG.VIEW_W / 2 - 344, CFG.VIEW_H - 100);
  }

  ctx.fillStyle = 'rgba(2,6,23,0.6)';
  roundRect(ctx, W - 472, 64, 460, 22, 6); ctx.fill();
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '11px monospace';
  ctx.fillText('WASD gerak · E mobil · F pukul · Spasi tembak · P jeda · M suara', W - 464, 79);

  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(239,68,68,${p.hurtFlash * 0.25})`;
    ctx.fillRect(0, 0, W, CFG.VIEW_H);
  }
  const dist = districtAt(p.x, p.y);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('📍 ' + dist.name + ' — Neon Bay', 16, CFG.VIEW_H - 76);
}

export function drawMinimap(ctx, state) {
  const mw = 190, mh = 138;
  const x0 = CFG.VIEW_W - mw - 14, y0 = CFG.VIEW_H - mh - 14;
  const sx = mw / CFG.WORLD_W, sy = mh / CFG.WORLD_H;
  ctx.fillStyle = 'rgba(2,6,23,0.8)';
  roundRect(ctx, x0 - 4, y0 - 4, mw + 8, mh + 8, 10); ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x0, y0, mw, mh);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  for (const rx of state.world.xs) {
    ctx.beginPath(); ctx.moveTo(x0 + rx * sx, y0); ctx.lineTo(x0 + rx * sx, y0 + mh); ctx.stroke();
  }
  for (const ry of state.world.ys) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + ry * sy); ctx.lineTo(x0 + mw, y0 + ry * sy); ctx.stroke();
  }
  ctx.fillStyle = '#0b3550';
  for (const wa of state.world.water) ctx.fillRect(x0 + wa.x * sx, y0 + wa.y * sy, wa.w * sx, wa.h * sy);
  const m = state.mission.active;
  if (m) {
    ctx.fillStyle = NEON.yellow;
    ctx.beginPath(); ctx.arc(x0 + m.target.x * sx, y0 + m.target.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#3b82f6';
  for (const c of state.police) {
    ctx.fillRect(x0 + c.x * sx - 2, y0 + c.y * sy - 2, 4, 4);
  }
  if (state.heli) {
    ctx.fillStyle = '#f97316';
    ctx.fillRect(x0 + state.heli.x * sx - 3, y0 + state.heli.y * sy - 3, 6, 6);
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x0 + state.player.x * sx, y0 + state.player.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px monospace';
  ctx.fillText('NEON BAY', x0 + 4, y0 + 12);
}

export function drawTitle(ctx, state) {
  ctx.fillStyle = '#0b0b14';
  ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
  for (let i = 0; i < 26; i++) {
    const bx = i * 52 + 8;
    const bh = 120 + ((i * 53) % 220);
    ctx.fillStyle = i % 3 === 0 ? '#1e1b4b' : '#111827';
    ctx.fillRect(bx, CFG.VIEW_H - bh - 90, 44, bh);
    ctx.fillStyle = i % 2 === 0 ? NEON.pink : NEON.cyan;
    for (let j = 0; j < 6; j++) ctx.fillRect(bx + 6 + j * 6, CFG.VIEW_H - bh - 70 + ((i + j) % 4) * 24, 4, 5);
  }
  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(0, CFG.VIEW_H - 60, CFG.VIEW_W, 60);
  ctx.fillStyle = 'rgba(2,6,23,0.85)';
  ctx.fillRect(0, 584, CFG.VIEW_W, 46);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 84px monospace';
  ctx.fillText('NEON BAY', 90, 190);
  ctx.fillStyle = NEON.pink;
  ctx.font = 'bold 30px monospace';
  ctx.fillText('— HEAT —', 96, 232);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '19px monospace';
  ctx.fillText('Jax Marlowe. Ex-pengemudi kabur. Satu malam, tiga misi,', 96, 300);
  ctx.fillText('dan seluruh polisi Neon Bay di belakangmu.', 96, 328);
  ctx.fillStyle = NEON.yellow;
  ctx.font = 'bold 20px monospace';
  ctx.fillText('ENTER — Mulai permainan' + (state.hasSave ? '    ·    C — Lanjutkan save' : ''), 96, 400);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px monospace';
  ctx.fillText('WASD/arrow gerak · E curi/masuk mobil · F pukul · Spasi tembak', 96, 448);
  ctx.fillText('P jeda · M suara · S simpan (di jeda)', 96, 474);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px monospace';
  ctx.fillText('Kota orisinal. Tanpa aset Rockstar / GTA. Semua gambar & suara prosedural.', 96, 604);
  ctx.fillText('Varian B — HEAT: wanted 1–5, patroli, roadblock, helikopter.', 96, 626);
}

export function drawPause(ctx, state) {
  ctx.fillStyle = 'rgba(2,6,23,0.78)';
  ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px monospace';
  ctx.fillText('JEDA', CFG.VIEW_W / 2 - 70, 260);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '18px monospace';
  ctx.fillText('P — lanjut    ·    S — simpan permainan    ·    R — mulai ulang', CFG.VIEW_W / 2 - 260, 320);
  ctx.fillText('Uang: $' + state.player.money + '   ·   Misi selesai: ' + state.mission.completed.length + '/3', CFG.VIEW_W / 2 - 200, 360);
}

export function drawBusted(ctx, state) {
  ctx.fillStyle = 'rgba(2,6,23,0.85)';
  ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
  ctx.fillStyle = NEON.red;
  ctx.font = 'bold 64px monospace';
  ctx.fillText('TERTANGKAP!', CFG.VIEW_W / 2 - 250, 300);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '18px monospace';
  ctx.fillText('Jax ditangkap polisi Neon Bay. Uangmu disita separuh.', CFG.VIEW_W / 2 - 260, 350);
  ctx.fillText('ENTER — coba lagi dari titik awal', CFG.VIEW_W / 2 - 220, 400);
}

export function drawWin(ctx, state) {
  ctx.fillStyle = 'rgba(2,6,23,0.85)';
  ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
  ctx.fillStyle = NEON.green;
  ctx.font = 'bold 56px monospace';
  ctx.fillText('KABUR!', CFG.VIEW_W / 2 - 130, 280);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '18px monospace';
  ctx.fillText(state.winText || '', CFG.VIEW_W / 2 - 300, 330);
  ctx.fillText('Total uang: $' + state.player.money + '   ·   ENTER — main bebas (free roam)', CFG.VIEW_W / 2 - 280, 380);
}
