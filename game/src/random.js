// random.js — deterministic seeded RNG (mulberry32) + helpers
export function createRng(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(a, b) { return a + next() * (b - a); },
    int(a, b) { return Math.floor(a + next() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(next() * arr.length) % arr.length]; },
    chance(p) { return next() < p; },
  };
}
export function seedFromQuery(search) {
  const params = new URLSearchParams(search || "");
  const raw = parseInt(params.get("seed") || "1", 10);
  return Number.isFinite(raw) ? raw : 1;
}
export function shotNameFromQuery(search) {
  const params = new URLSearchParams(search || "");
  return params.get("shot") || null;
}
