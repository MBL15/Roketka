import { useEffect, useRef, useState } from 'react';
import type { RatingEntry } from '../api/types';
import { formatNumber } from '../utils/format';

/**
 * Строка живого рейтинга над игровым экраном.
 *
 * Элементы отсортированы по убыванию очков слева направо, текущий игрок
 * выделен цветом темы. Постановка различает два вида подсветки при изменении
 * очков: короткую, если позиция не изменилась, и длинную со свечением, если
 * игрок сдвинулся в таблице. Это разделение здесь и реализовано — оно даёт
 * игроку понять не только «мне начислили», но и «я обогнал соперника».
 */

interface LiveRatingProps {
  entries: RatingEntry[];
  currentUserId: number;
}

type FlashKind = 'short' | 'long';

export function LiveRating({ entries, currentUserId }: LiveRatingProps): JSX.Element | null {
  const [flashes, setFlashes] = useState<Record<number, FlashKind>>({});
  const previous = useRef<Map<number, { points: number; position: number }>>(new Map());

  useEffect(() => {
    const next = new Map<number, { points: number; position: number }>();
    const triggered: Record<number, FlashKind> = {};

    entries.forEach((entry) => {
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
    const timer = window.setTimeout(() => {
      setFlashes((current) => {
        const cleaned = { ...current };
        Object.keys(triggered).forEach((key) => delete cleaned[Number(key)]);
        return cleaned;
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [entries]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="rating" aria-label="Живой рейтинг турнира">
      <span className="rating__label eyebrow">Турнир</span>
      <ol className="rating__list">
        {entries.map((entry) => {
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
              <span className="rating__position num">{entry.position}</span>
              <span className="rating__points num">{formatNumber(entry.points)}</span>
              {isCurrent && <span className="rating__you">вы</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
