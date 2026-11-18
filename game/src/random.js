// random.js - Deterministic seeded RNG (mulberry32) plus small helpers.
// Shot mode relies on this: same seed must always build the same city.

export function createRng(seed) {
  let state = (Number(seed) >>> 0) || 1;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick(list) {
      if (!list || list.length === 0) return undefined;
      return list[Math.floor(next() * list.length)];
    },
    chance(probability) {
      return next() < probability;
    },
    sign() {
      return next() < 0.5 ? -1 : 1;
    },
  };
}

let activeRng = createRng(12345);

export function setSeed(seed) {
  activeRng = createRng(seed);
  return activeRng;
}

export function getRng() {
  return activeRng;
}

export function rand(min, max) {
  return activeRng.range(min, max);
}

export function randInt(min, max) {
  return activeRng.int(min, max);
}

export function pick(list) {
  return activeRng.pick(list);
}

export function chance(p) {
  return activeRng.chance(p);
}
