// missions.js — Rae's mission chain: getaway, repo, delivery, finale chase
import { dist } from "./config.js";

export function createMissionChain() {
  const missions = [
    {
      id: "getaway", title: "M1 · First Getaway",
      brief: "Rae: Meet me at the Marina marker, then lose the heat.",
      objective: "Drive to the Marina marker",
      target: { x: 300, y: 300 }, reward: 150, needsCar: false,
    },
    {
      id: "repo", title: "M2 · Repo Job",
      brief: "Rae: A pink sport car in Downtown owes us. Bring it to Portside.",
      objective: "Reach the Downtown sport car, then deliver it to Portside",
      target: { x: 1900, y: 500 }, reward: 300, needsCar: false,
      secondTarget: { x: 2500, y: 1700 }, secondObjective: "Deliver the car to the Portside dock",
    },
    {
      id: "delivery", title: "M3 · Cross-Town Package",
      brief: "Rae: Take this package from Barrio to the Marina, fast.",
      objective: "Pick up the package in Barrio",
      target: { x: 500, y: 1700 }, reward: 450, needsCar: false,
      secondTarget: { x: 700, y: 500 }, secondObjective: "Deliver the package to the Marina",
    },
    {
      id: "finale", title: "M4 · Neon Finale",
      brief: "Rae: One last run. Reach the Portside escape boat — everyone will chase you.",
      objective: "Escape to the Portside boat marker",
      target: { x: 2900, y: 2100 }, reward: 1000, needsCar: true, finaleHeat: 3,
    },
  ];
  return { list: missions, index: 0, stage: 0, active: true, complete: false, message: missions[0].brief, messageTimer: 8 };
}
export function currentMission(chain) {
  if (!chain || chain.complete) return null;
  return chain.list[chain.index];
}
export function currentTarget(chain) {
  const m = currentMission(chain);
  if (!m) return null;
  return chain.stage === 1 && m.secondTarget ? m.secondTarget : m.target;
}
export function currentObjectiveText(chain) {
  const m = currentMission(chain);
  if (!m) return "Free roam — explore Neon Bay";
  if (chain.stage === 1 && m.secondObjective) return m.secondObjective;
  return m.objective;
}
export function updateMissions(chain, state, dt) {
  if (!chain.active || chain.complete) return;
  if (chain.messageTimer > 0) chain.messageTimer -= dt;
  const m = currentMission(chain); if (!m) return;
  const pos = state.player.vehicle ? state.player.vehicle : state.player;
  const target = currentTarget(chain);
  if (dist(pos, target) < 64) {
    if (chain.stage === 0 && m.secondTarget) {
      chain.stage = 1; chain.message = "Rae: Got it. Now move — next marker is live."; chain.messageTimer = 5;
      if (m.id === "repo" && state.onRepoPickup) state.onRepoPickup();
      return;
    }
    state.player.money += m.reward;
    chain.message = `Rae: Done. +$${m.reward}. ${m.title} complete.`; chain.messageTimer = 6;
    chain.index += 1; chain.stage = 0;
    if (chain.index >= chain.list.length) { chain.complete = true; chain.message = "Rae: You did it, Jax. Neon Bay is ours tonight. Free roam!"; chain.messageTimer = 10; }
    else if (currentMission(chain).finaleHeat && state.onFinaleStart) state.onFinaleStart(currentMission(chain).finaleHeat);
  }
}
export function missionToSave(chain) { return { index: chain.index, stage: chain.stage, complete: chain.complete }; }
export function missionFromSave(chain, data) {
  if (!data) return;
  chain.index = Math.min(data.index || 0, chain.list.length);
  chain.stage = data.stage || 0; chain.complete = !!data.complete || chain.index >= chain.list.length;
  if (!chain.complete) { chain.message = currentMission(chain).brief; chain.messageTimer = 8; }
}
