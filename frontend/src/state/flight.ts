import type { PointsRules, RoundState, StartedRound, ThemeKey } from '../api/types';

/**
 * Данные, которых достаточно, чтобы отрисовать полёт.
 *
 * Экран игры не различает «только что начатый раунд» и «раунд, в который
 * игрок вернулся после перезагрузки страницы»: оба случая приводятся к этой
 * структуре. Поэтому восстановление полёта не требует отдельного экрана и
 * отдельной ветки логики.
 */
export interface Flight {
  roundId: number;
  theme: ThemeKey;
  betAmount: number;
  boostTier: number;
  boostValue: number;
  /** Известен только после срабатывания бустера — сервер не раскрывает его раньше. */
  boostLevel: number | null;
  /** Вероятность бустера по уровням: по ней подсвечивается лестница. */
  boostLevelChances: number[];
  levelMultipliers: number[];
  levelCount: number;
  growthRate: number;
  delta: number;
  maxMultiplier: number;
  cashoutUnlockMultiplier: number;
  startedAtMillis: number;
  /** Поправка часов: серверное время минус локальное на момент получения данных. */
  clockOffsetMillis: number;
  serverSeedHash: string | null;
  showOnboarding: boolean;
  points: PointsRules;
  resumed: boolean;
  initialLevelsPassed: number;
  initialBoostApplied: boolean;
  initialPoints: number;
  initialCashoutMultiplier: number | null;
  initialPayout: number;
}

export function flightFromStart(round: StartedRound): Flight {
  return {
    roundId: round.roundId,
    theme: round.theme,
    betAmount: round.betAmount,
    boostTier: round.boostTier,
    boostValue: round.boostValue,
    boostLevel: null,
    boostLevelChances: round.boostLevelChances,
    levelMultipliers: round.levelMultipliers,
    levelCount: round.levelCount,
    growthRate: round.growthRate,
    delta: round.delta,
    maxMultiplier: round.maxMultiplier,
    cashoutUnlockMultiplier: round.cashoutUnlockMultiplier,
    startedAtMillis: round.startedAtMillis,
    clockOffsetMillis: round.serverTimeMillis - Date.now(),
    serverSeedHash: round.serverSeedHash,
    showOnboarding: round.showOnboarding,
    points: round.points,
    resumed: false,
    initialLevelsPassed: 0,
    initialBoostApplied: false,
    initialPoints: 0,
    initialCashoutMultiplier: null,
    initialPayout: 0,
  };
}

export function flightFromState(state: RoundState, points: PointsRules): Flight {
  return {
    roundId: state.roundId,
    theme: state.theme,
    betAmount: state.betAmount,
    boostTier: state.boostTier,
    boostValue: state.boostValue,
    boostLevel: state.boostLevel,
    boostLevelChances: state.boostLevelChances,
    levelMultipliers: state.levelMultipliers,
    levelCount: state.levelCount,
    growthRate: state.growthRate,
    delta: state.delta,
    maxMultiplier: state.maxMultiplier,
    cashoutUnlockMultiplier: cashoutUnlockMultiplier(state.delta),
    startedAtMillis: state.startedAtMillis,
    clockOffsetMillis: state.serverTimeMillis - Date.now(),
    serverSeedHash: null,
    showOnboarding: false,
    points,
    resumed: true,
    initialLevelsPassed: state.levelsPassed,
    initialBoostApplied: state.boostApplied,
    initialPoints: state.points,
    initialCashoutMultiplier: state.cashoutMultiplier,
    initialPayout: state.payout,
  };
}

/**
 * Коэффициент в момент {@code nowMillis} по той же формуле, что на сервере:
 * m(t) = exp(growthRate * t) - 1, старт с нуля. Клиент считает её локально
 * на каждом кадре, поэтому анимация идёт в 60 FPS независимо от частоты
 * серверных тиков, а расхождение с сервером не накапливается — обе стороны
 * исходят из времени старта раунда.
 */
export function baseMultiplierAt(flight: Flight, nowMillis: number): number {
  const elapsedSeconds = Math.max(0, nowMillis + flight.clockOffsetMillis - flight.startedAtMillis) / 1000;
  const raw = Math.exp(flight.growthRate * elapsedSeconds) - 1;
  return quantizeDown(Math.min(Math.max(raw, 0), flight.maxMultiplier), flight.delta);
}

/** Минимальный коэффициент для «Забрать»: с ×1 включительно. */
export function cashoutUnlocked(multiplier: number): boolean {
  return multiplier + 1e-9 >= 1;
}

export function cashoutUnlockMultiplier(_delta: number): number {
  return 1;
}

export function quantizeDown(value: number, delta: number): number {
  if (delta <= 0) {
    return value;
  }
  return Math.floor(value / delta + 1e-9) * delta;
}

export function levelsPassedAt(multiplier: number, levels: number[]): number {
  let passed = 0;
  for (const threshold of levels) {
    if (multiplier + 1e-9 >= threshold) {
      passed += 1;
    } else {
      break;
    }
  }
  return passed;
}

/** Стадия оформления коэффициента: цвет и размер растут вместе с прогрессом. */
export type MultiplierStage = 'base' | 'warm' | 'hot' | 'blazing';

export function multiplierStage(levelsPassed: number): MultiplierStage {
  if (levelsPassed <= 0) {
    return 'base';
  }
  if (levelsPassed === 1) {
    return 'warm';
  }
  if (levelsPassed === 2) {
    return 'hot';
  }
  return 'blazing';
}
