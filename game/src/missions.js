// missions.js - Rae's mission chain for Jax: four linked jobs with rewards.
// Each mission is data + a check function; main.js owns rendering the marker.

import { districtNameAt } from "./world.js";

export const MISSION_DEFS = [
  {
    id: "getaway",
    title: "First Wheels",
    giver: "Rae",
    brief: "Rae: Grab any car near the Marina and shake the heat, Jax.",
    objective: "Steal a car in Marina, then lose your wanted level",
    reward: 150,
    target: { x: 600, y: 600 },
    targetLabel: "Marina car",
  },
  {
    id: "repo",
    title: "Repo Run",
    giver: "Rae",
    brief: "Rae: A pink sport coupe in Downtown owes us. Bring it to Portside.",
    objective: "Take the marked sport coupe to the Portside drop-off",
    reward: 300,
    target: { x: 2400, y: 600 },
    targetLabel: "Sport coupe",
    drop: { x: 2600, y: 1800 },
  },
  {
    id: "package",
    title: "Cross-Town Package",
    giver: "Rae",
    brief: "Rae: Small package, long drive. Barrio pickup, Marina delivery.",
    objective: "Pick up the package in Barrio and deliver it to Marina",
    reward: 420,
    target: { x: 600, y: 1800 },
    targetLabel: "Barrio pickup",
    drop: { x: 700, y: 500 },
  },
  {
    id: "finale",
    title: "Neon Getaway",
    giver: "Rae",
    brief: "Rae: Last job. Reach the Portside pier with the heat on your tail.",
    objective: "Reach the Portside pier while wanted, then escape",
    reward: 800,
    target: { x: 2800, y: 2000 },
    targetLabel: "Portside pier",
  },
];

export function createMissionState() {
  return {
    index: 0,
    phase: "goto", // goto | deliver | escape | done
    active: true,
    completed: [],
    message: MISSION_DEFS[0].brief,
    messageTimer: 6,
    totalEarned: 0,
  };
}

export function currentMission(state) {
  if (!state || state.index >= MISSION_DEFS.length) return null;
  return MISSION_DEFS[state.index];
}

export function missionTarget(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  if (state.phase === "deliver" && mission.drop) return { ...mission.drop, label: "Drop-off" };
  return { ...mission.target, label: mission.targetLabel };
}

export function objectiveText(state) {
  const mission = currentMission(state);
  if (!mission) return "Free roam Neon Bay — all jobs done. Nice work, Jax.";
  if (state.phase === "deliver") return `${mission.title}: reach the drop-off`;
  if (state.phase === "escape") return `${mission.title}: lose the heat!`;
  return `${mission.title}: ${mission.objective}`;
}

function completeMission(state, player, audio) {
  const mission = currentMission(state);
  if (!mission) return;
  player.money += mission.reward;
  state.totalEarned += mission.reward;
  state.completed.push(mission.id);
  state.index += 1;
  state.phase = "goto";
  const next = currentMission(state);
  state.message = next
    ? `+$${mission.reward} — ${next.brief}`
    : `+$${mission.reward} — Chain complete. Neon Bay is yours tonight.`;
  state.messageTimer = 6;
  if (audio) audio.playCash();
}

export function updateMissions(state, player, pos, heat, dt, context) {
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  const mission = currentMission(state);
  if (!mission || player.dead) return;

  const target = missionTarget(state);
  const dist = target ? Math.hypot(pos.x - target.x, pos.y - target.y) : 9999;

  if (mission.id === "getaway") {
    if (state.phase === "goto" && player.vehicle) state.phase = "escape";
    else if (state.phase === "escape" && heat.wanted === 0 && player.vehicle) {
      completeMission(state, player, context && context.audio);
    } else if (state.phase === "goto" && dist < 90 && player.vehicle) {
      state.phase = "escape";
    }
  } else if (mission.id === "repo") {
    if (state.phase === "goto" && dist < 110) state.phase = "deliver";
    else if (state.phase === "deliver" && dist < 110) completeMission(state, player, context && context.audio);
  } else if (mission.id === "package") {
    if (state.phase === "goto" && dist < 100) {
      state.phase = "deliver";
      state.message = "Package picked up. Get it to Marina, fast.";
      state.messageTimer = 4;
    } else if (state.phase === "deliver" && dist < 110) {
      completeMission(state, player, context && context.audio);
    }
  } else if (mission.id === "finale") {
    if (state.phase === "goto" && dist < 130) {
      if (heat.wanted >= 1) state.phase = "escape";
      else completeMission(state, player, context && context.audio);
    } else if (state.phase === "escape" && heat.wanted === 0) {
      completeMission(state, player, context && context.audio);
    }
  }
  void districtNameAt;
}

export function missionProgressLabel(state) {
  return `Job ${Math.min(state.index + 1, MISSION_DEFS.length)} / ${MISSION_DEFS.length}`;
}
