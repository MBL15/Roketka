import { useEffect, useMemo, useRef, useState } from 'react';
import type { RatingEntry } from '../api/types';
import { formatNumber } from '../utils/format';

/**
 * Живой рейтинг над игровым экраном (п. 1.6).
 *
 * Участники отсортированы по очкам слева направо; текущий игрок подсвечен
 * цветом темы. При изменении очков — короткая вспышка; при смене позиции —
 * длинная с подсветкой.
 */

interface LiveRatingProps {
  entries: RatingEntry[];
  currentUserId: number;
}

type FlashKind = 'short' | 'long';

export function LiveRating({ entries, currentUserId }: LiveRatingProps): JSX.Element | null {
  const [flashes, setFlashes] = useState<Record<number, FlashKind>>({});
  const previous = useRef<Map<number, { points: number; position: number }>>(new Map());
  const timers = useRef<number[]>([]);

  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return a.position - b.position;
      }),
    [entries],
  );

  useEffect(() => {
    const next = new Map<number, { points: number; position: number }>();
    const triggered: Record<number, FlashKind> = {};

    sorted.forEach((entry) => {
      next.set(entry.userId, { points: entry.points, position: entry.position });
      const before = previous.current.get(entry.userId);
      if (before && before.points !== entry.points) {
        triggered[entry.userId] = before.position === entry.position ? 'short' : 'long';
      }
    });

    previous.current = next;
    if (Object.keys(triggered).length === 0) {
      return undefined;
    }

    setFlashes((current) => ({ ...current, ...triggered }));

    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = Object.entries(triggered).map(([userId, kind]) =>
      window.setTimeout(
        () => {
          setFlashes((current) => {
            if (!current[Number(userId)]) {
              return current;
            }
            const cleaned = { ...current };
            delete cleaned[Number(userId)];
            return cleaned;
          });
        },
        kind === 'short' ? 450 : 1100,
      ),
    );

    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
  }, [sorted]);

  if (sorted.length === 0) {
    return null;
  }

  return (
    <div className="rating rating--live" aria-label="Живой рейтинг турнира">
      <span className="rating__label eyebrow">Турнир</span>
      <ol className="rating__list">
        {sorted.map((entry) => {
          const isCurrent = entry.userId === currentUserId;
          const flash = flashes[entry.userId];
          return (
            <li
              key={entry.userId}
              className={[
                'rating__item',
                isCurrent ? 'rating__item--me' : '',
                flash === 'short' ? 'rating__item--flash-short' : '',
                flash === 'long' ? 'rating__item--flash-long' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              title={`${entry.displayName} — ${formatNumber(entry.points)} очков, место ${entry.position}`}
            >
              <span className="rating__position num" aria-hidden="true">
                {entry.position}
              </span>
              <span className="rating__points num">{formatNumber(entry.points)}</span>
              {isCurrent && <span className="rating__you">вы</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
