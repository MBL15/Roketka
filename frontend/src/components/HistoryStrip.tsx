import { useMemo } from 'react';
import type { HistoryEntry } from '../api/types';
import { formatMultiplier } from '../utils/format';
import { marqueeMultipliers, multiplierTier } from '../utils/marqueeMultipliers';

interface HistoryStripProps {
  entries: HistoryEntry[];
  limit?: number;
  /** Бегущая лента — дублирует pills для бесшовной прокрутки. */
  marquee?: boolean;
}

const MARQUEE_COUNT = 1000;

/**
 * Лента последних коэффициентов: pills по величине множителя.
 */
export function HistoryStrip({ entries, limit = 24, marquee = false }: HistoryStripProps): JSX.Element {
  const marqueeValues = useMemo(() => {
    if (!marquee) {
      return [];
    }
    const generated = marqueeMultipliers(MARQUEE_COUNT);
    const real = entries.slice(0, 12).map((entry) => {
      return (entry.won ? entry.cashoutMultiplier : entry.crashMultiplier) ?? 1;
    });
    return [...real, ...generated.slice(0, MARQUEE_COUNT - real.length)];
  }, [entries, marquee]);

  if (marquee) {
    if (marqueeValues.length === 0) {
      return <></>;
    }

    const pills = marqueeValues.map((value, index) => (
      <Pill key={`m-${index}`} value={value} />
    ));

    return (
      <div className="round-strip round-strip--marquee" aria-label="История коэффициентов">
        <div className="round-strip__track round-strip__track--long">
          {pills}
          {marqueeValues.map((value, index) => (
            <Pill key={`m-dup-${index}`} value={value} hidden />
          ))}
        </div>
      </div>
    );
  }

  const recent = entries.slice(0, limit);
  if (recent.length === 0) {
    return <></>;
  }

  return (
    <div className="round-strip" aria-label="История коэффициентов">
      {recent.map((entry) => {
        const value = (entry.won ? entry.cashoutMultiplier : entry.crashMultiplier) ?? 1;
        return (
          <Pill
            key={entry.roundId}
            value={value}
            title={entry.mine ? 'Ваш раунд' : entry.nickname}
            mine={entry.mine}
          />
        );
      })}
    </div>
  );
}

function Pill({
  value,
  title,
  mine = false,
  hidden = false,
}: {
  value: number;
  title?: string;
  mine?: boolean;
  hidden?: boolean;
}): JSX.Element {
  return (
    <span
      className={`round-strip__pill round-strip__pill--${multiplierTier(value)}${mine ? ' round-strip__pill--mine' : ''}`}
      title={title}
      aria-hidden={hidden || undefined}
    >
      {formatMultiplier(value)}
    </span>
  );
}
