import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { RatingEntry, TournamentTable } from '../api/types';
import { useCountdown } from '../hooks/useCountdown';
import { formatCountdown, formatNumber } from '../utils/format';
import { Modal } from './Modal';

/**
 * Турнирная таблица.
 *
 * Постановка: топ-3 закреплены сверху, остальные — прокручиваемым списком,
 * текущий игрок закреплён внизу, если не виден в области прокрутки.
 */
export function TournamentModal({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const [table, setTable] = useState<TournamentTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverSecondsLeft, setServerSecondsLeft] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentInView, setCurrentInView] = useState(true);

  const secondsLeft = useCountdown(serverSecondsLeft, Boolean(table?.header.active));

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const data = await api.tournamentTable();
        if (cancelled) {
          return;
        }
        setTable(data);
        setServerSecondsLeft(data.header.secondsLeft);
        setError(null);
      } catch {
        if (!cancelled) {
          setError('Не удалось загрузить турнирную таблицу');
        }
      }
    };

    void load();
    const refresh = window.setInterval(load, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, [open]);

  const currentInTop = Boolean(table?.current && table.top.some((entry) => entry.current));

  useEffect(() => {
    if (!open || !table?.current || currentInTop) {
      setCurrentInView(true);
      return undefined;
    }

    const root = scrollRef.current;
    const target = root?.querySelector('[data-current-row="true"]');
    if (!root || !target) {
      setCurrentInView(false);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setCurrentInView(entry.isIntersecting),
      { root, threshold: 0.35 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [open, table, currentInTop]);

  const showPinned = Boolean(table?.current && !currentInTop && !currentInView);
  const podiumSlots = table ? [table.top[1], table.top[0], table.top[2]] : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={table?.header.name ?? 'Турнир'}
      subtitle={
        table
          ? table.header.active
            ? `До конца: ${formatCountdown(secondsLeft)} · участников: ${formatNumber(table.header.participants)}`
            : 'Турнир завершён'
          : 'Загружаем участников…'
      }
      width={640}
      tone="accent"
    >
      {error && <p className="text-sm negative">{error}</p>}

      {!table && !error && (
        <div className="tournament tournament--loading" aria-hidden="true">
          <div className="tournament__podium tournament__podium--skeleton">
            {[0, 1, 2].map((slot) => (
              <div key={slot} className="podium podium--skeleton" />
            ))}
          </div>
          <div className="tournament__scroll tournament__scroll--skeleton" />
        </div>
      )}

      {table && (
        <div className="tournament">
          {table.top.length > 0 ? (
            <div className="tournament__podium">
              {podiumSlots.map((entry, index) =>
                entry ? (
                  <PodiumCard key={entry.userId} entry={entry} />
                ) : (
                  <div key={`empty-${index}`} className="podium podium--empty" aria-hidden="true" />
                ),
              )}
            </div>
          ) : (
            <p className="text-sm muted tournament__empty">Пока нет участников — сыграйте раунд, чтобы попасть в таблицу.</p>
          )}

          <div className="tournament__list-wrap">
            <div ref={scrollRef} className="tournament__scroll">
              {table.rest.length > 0 ? (
                <ol className="tournament__list">
                  {table.rest.map((entry) => (
                    <TableRow
                      key={entry.userId}
                      entry={entry}
                      currentMarker={entry.current ? 'true' : undefined}
                    />
                  ))}
                </ol>
              ) : table.top.length > 3 ? null : (
                <p className="text-sm muted tournament__rest-empty">Остальные места появятся по мере роста рейтинга.</p>
              )}
            </div>

            {showPinned && table.current && (
              <div className="tournament__pinned">
                <span className="eyebrow">Ваша позиция</span>
                <ol className="tournament__list">
                  <TableRow entry={table.current} />
                </ol>
              </div>
            )}
          </div>

          <p className="text-xs muted tournament__note">
            Очки начисляются за пройденные уровни, фиксацию выигрыша и активацию бустера. Имена других
            участников деперсонализированы.
          </p>
        </div>
      )}
    </Modal>
  );
}

function PodiumCard({ entry }: { entry: RatingEntry }): JSX.Element {
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className={`podium podium--${entry.position}${entry.current ? ' podium--me' : ''}`}>
      <span className="podium__rank num">{entry.position}</span>
      <span className="podium__medal" aria-hidden="true">
        {medals[entry.position - 1] ?? entry.position}
      </span>
      <span className="podium__name">{entry.current ? 'Вы' : entry.displayName}</span>
      <span className="podium__points num">{formatNumber(entry.points)}</span>
    </div>
  );
}

function TableRow({
  entry,
  currentMarker,
}: {
  entry: RatingEntry;
  currentMarker?: 'true';
}): JSX.Element {
  return (
    <li
      className={`tournament__row${entry.current ? ' tournament__row--me' : ''}`}
      data-current-row={currentMarker}
    >
      <span className="tournament__position num">{entry.position}</span>
      <span className="grow">{entry.current ? 'Вы' : entry.displayName}</span>
      <span className="tournament__points num">{formatNumber(entry.points)}</span>
    </li>
  );
}
