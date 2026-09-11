import { formatMultiplier, formatPercent } from '../utils/format';

/**
 * Лестница уровней.
 *
 * Показывает, сколько уровней у выбранной темы (9 у зелёной, 12 у красной),
 * на каком коэффициенте открывается каждый и насколько вероятно встретить там
 * бустер. Используется и на экране выбора ставки — как объяснение устройства
 * темы, и в полёте — как индикатор прогресса.
 *
 * Точный уровень бустера до срабатывания неизвестен даже клиенту: сервер его
 * не присылает. Вместо этого ступени подсвечиваются по вероятности — игрок
 * видит «горячую зону» и решает, докуда тянуть, но не знает наверняка. Как
 * только бустер срабатывает, ступень раскрывается.
 */

interface LevelLadderProps {
  levels: number[];
  levelsPassed: number;
  /** Вероятности бустера по уровням; пустой массив — вариант без усиления. */
  boostChances?: number[];
  /** Заполняется только после срабатывания. */
  boostLevel?: number | null;
  boostValue: number;
  boostApplied: boolean;
  cashedOut?: boolean;
  compact?: boolean;
  orientation?: 'vertical' | 'horizontal';
}

export function LevelLadder({
  levels,
  levelsPassed,
  boostChances = [],
  boostLevel = null,
  boostValue,
  boostApplied,
  cashedOut = false,
  compact = false,
  orientation = 'vertical',
}: LevelLadderProps): JSX.Element {
  const items = orientation === 'vertical' ? [...levels].reverse() : levels;
  const hasBoost = boostValue > 1 && boostChances.length > 0;
  const peakChance = hasBoost ? Math.max(...boostChances) : 0;

  return (
    <ol
      className={['ladder', `ladder--${orientation}`, compact ? 'ladder--compact' : '']
        .filter(Boolean)
        .join(' ')}
      aria-label={`Уровни темы: ${levels.length}`}
    >
      {items.map((threshold, visualIndex) => {
        const level = orientation === 'vertical' ? levels.length - visualIndex : visualIndex + 1;
        const passed = levelsPassed >= level;
        const chance = hasBoost ? (boostChances[level - 1] ?? 0) : 0;
        const revealed = boostApplied && boostLevel === level;
        // Насыщенность подсветки пропорциональна вероятности, а не абсолютна:
        // так «горячая зона» читается при любом распределении весов.
        const heat = peakChance > 0 ? chance / peakChance : 0;

        return (
          <li
            key={level}
            className={[
              'ladder__step',
              passed ? 'ladder__step--passed' : '',
              levelsPassed + 1 === level ? 'ladder__step--next' : '',
              revealed ? 'ladder__step--boost-hit' : '',
              hasBoost && !boostApplied && !passed ? 'ladder__step--boost-zone' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={hasBoost ? ({ '--heat': heat.toFixed(3) } as React.CSSProperties) : undefined}
            title={
              revealed
                ? `Бустер ×${boostValue.toFixed(0)} сработал здесь`
                : hasBoost
                  ? `Уровень ${level} · ${formatMultiplier(threshold)} · шанс бустера ${formatPercent(chance, 0)}`
                  : `Уровень ${level} · ${formatMultiplier(threshold)}`
            }
          >
            <span className="ladder__dot" aria-hidden="true" />
            <span className="ladder__level num">{level}</span>
            <span className="ladder__threshold num">{formatMultiplier(threshold)}</span>

            {revealed && <span className="ladder__boost">×{boostValue.toFixed(0)}</span>}
            {!revealed && hasBoost && chance > 0 && (
              <span className="ladder__chance num" aria-hidden="true">
                {formatPercent(chance, 0)}
              </span>
            )}
          </li>
        );
      })}

      {hasBoost && !boostApplied && (
        <li className="ladder__legend text-xs muted">
          {cashedOut
            ? `Выигрыш зафиксирован — бустер ×${boostValue.toFixed(0)} больше не сработает`
            : `Бустер ×${boostValue.toFixed(0)} ждёт на одном из уровней, чаще — в подсвеченной зоне`}
        </li>
      )}
    </ol>
  );
}
