/** Детерминированный генератор для перегенерации неба по seed. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function randomBetween(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}
