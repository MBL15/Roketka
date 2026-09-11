/** Один раз на сессию — стабильная «живая» лента для демо. */
let cachedMarquee: number[] | null = null;

/**
 * Генерирует правдоподобную ленту crash-игры: много низких, реже средние,
 * редкие высокие и несколько «джекпотных» множителей.
 */
export function marqueeMultipliers(count = 1000): number[] {
  if (cachedMarquee && cachedMarquee.length === count) {
    return cachedMarquee;
  }

  const values: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const roll = Math.random();
    let value: number;

    if (roll < 0.52) {
      // ранний крах
      value = 1 + Math.random() * 0.95;
    } else if (roll < 0.78) {
      value = 1.2 + Math.random() * 1.8;
    } else if (roll < 0.92) {
      value = 2 + Math.random() * 8;
    } else if (roll < 0.985) {
      value = 10 + Math.random() * 40;
    } else if (roll < 0.998) {
      value = 50 + Math.random() * 150;
    } else {
      // несколько очень высоких — «замануха»
      value = 200 + Math.random() * 800;
    }

    values.push(Math.round(value * 100) / 100);
  }

  // Гарантируем пару явных «монстров» в ленте
  const jackpots = [127.45, 312.8, 89.12, 456.33, 67.5];
  for (let j = 0; j < jackpots.length; j += 1) {
    const slot = Math.floor(Math.random() * values.length);
    values[slot] = jackpots[j] ?? values[slot];
  }

  cachedMarquee = values;
  return values;
}

export function multiplierTier(multiplier: number): 'low' | 'mid' | 'high' {
  if (multiplier >= 10) {
    return 'high';
  }
  if (multiplier >= 2) {
    return 'mid';
  }
  return 'low';
}
