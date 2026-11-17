// missions.js — rangkaian tiga misi cerita Jax Marlowe untuk varian HEAT.
// Rae memberi perintah lewat telepon: curi mobil, kabur ke Marina, lalu tembus ke kapal.
import { CFG, MISSION_REWARDS } from './config.js';
import { addWanted } from './player.js';

export const MISSIONS = [
  {
    id: 'm1',
    title: 'MISI 1 — Roda Panas',
    giver: 'Rae (di telepon)',
    lines: [
      'Rae: "Jax, utangmu jatuh tempo malam ini."',
      'Jax: "Aku butuh roda. Cepat."',
      'Rae: "Curi mobil apa saja di jalan. Tombol E. Jangan ketahuan."',
    ],
    objective: 'Curi sebuah mobil (E), lalu antar ke tanda kuning Downtown.',
    target: { x: 1500, y: 1000 },
    radius: 90,
  },
  {
    id: 'm2',
    title: 'MISI 2 — Kabur dari Sirene',
    giver: 'Rae (di telepon)',
    lines: [
      'Rae: "Polisi sudah mengendusmu. Wanted 3 bintang."',
      'Jax: "Mereka tidak akan menangkapku hidup-hidup."',
      'Rae: "Tembus ke Marina. Jangan berhenti. JANGAN berhenti."',
    ],
    objective: 'Lolos dari kejaran polisi — capai tanda kuning di Marina.',
    target: { x: 340, y: 500 },
    radius: 100,
    wantedOnStart: 3,
  },
  {
    id: 'm3',
    title: 'MISI 3 — Tembus Blokade',
    giver: 'Rae (di telepon)',
    lines: [
      'Rae: "Mereka pasang roadblock di semua jalan ke pelabuhan."',
      'Jax: "Kalau begitu kita tabrak saja blokadenya."',
      'Rae: "Sampai di kapal, utangmu lunas. Gas, Jax!"',
    ],
    objective: 'Tembus roadblock — capai kapal di Portside.',
    target: { x: CFG.WORLD_W - 260, y: CFG.WORLD_H - 420 },
    radius: 110,
    wantedOnStart: 4,
  },
];

export function createMissionState() {
  return {
    index: -1,
    active: null,
    dialog: null,
    objectiveDone: false,
    completed: [],
  };
}

export function startMission(state, idx) {
  const def = MISSIONS[idx];
  if (!def) return false;
  state.mission.index = idx;
  state.mission.active = { ...def, startedAt: state.time };
  state.mission.dialog = { lines: def.lines, lineIdx: 0, timer: 0 };
  state.mission.objectiveDone = false;
  if (def.wantedOnStart) {
    const p = state.player;
    p.wanted = Math.max(p.wanted, def.wantedOnStart);
    p.hiddenTimer = 0;
  }
  return true;
}

export function advanceDialog(state) {
  const d = state.mission.dialog;
  if (!d) return;
  d.lineIdx++;
  d.timer = 0;
  if (d.lineIdx >= d.lines.length) state.mission.dialog = null;
}

export function updateMission(state, dt) {
  const m = state.mission;
  if (!m.active) return;
  const p = state.player;
  const def = m.active;

  // Misi pertama menuntut Jax tiba dengan mobil; dua misi berikutnya cukup tiba di target.
  if (def.id === 'm1') {
    if (!p.onFoot && Math.hypot(p.x - def.target.x, p.y - def.target.y) < def.radius) {
      completeMission(state);
      return;
    }
  } else {
    if (Math.hypot(p.x - def.target.x, p.y - def.target.y) < def.radius) {
      completeMission(state);
      return;
    }
  }
}

function completeMission(state) {
  const m = state.mission;
  const def = m.active;
  const reward = MISSION_REWARDS[def.id] || 0;
  state.player.money += reward;
  m.completed.push(def.id);
  state.toast = def.title + ' SELESAI! +$' + reward;
  state.cashSound = true;
  m.active = null;
  m.index = MISSIONS.findIndex((x) => x.id === def.id) + 1;
  if (m.index >= MISSIONS.length) {
    state.mode = 'win';
    state.winText = 'Jax lunas utangnya. Neon Bay masih miliknya — untuk malam ini.';
  } else {
    state.mission.pendingNext = true;
  }
}

export function nextMissionAvailable(state) {
  return state.mission.index >= 0 && state.mission.index < MISSIONS.length && !state.mission.active;
}
