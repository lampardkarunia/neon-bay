// random.js - Deterministic seeded RNG (mulberry32) for NEON BAY.
// Shot mode depends on this: same seed must always produce the same city.

export function hashSeed(input) {
  let h = 2166136261 >>> 0;
  const text = String(input);
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class SeededRandom {
  constructor(seed) {
    this.state = (typeof seed === "number" ? seed >>> 0 : hashSeed(seed)) || 1;
    this.seedValue = this.state;
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, maxInclusive) {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  pick(array) {
    return array[Math.floor(this.next() * array.length)];
  }

  chance(probability) {
    return this.next() < probability;
  }

  shuffle(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }
}

export function createRandom(seed) {
  return new SeededRandom(seed === undefined ? 1337 : seed);
}

export function randomFromSeed(seed) {
  const rng = new SeededRandom(seed);
  return () => rng.next();
}
