import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { RatingEntry, TournamentTable } from '../api/types';
import { formatCountdown, formatNumber } from '../utils/format';

/** Компактный топ рейтинга для боковой колонки профиля. */
export function RatingPanel(): JSX.Element {
  const [table, setTable] = useState<TournamentTable | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      void api.tournamentTable().then((data) => {
        if (cancelled) {
          return;
        }
        setTable(data);
        setSecondsLeft(data.header.secondsLeft);
      });
    };

    load();
    const refresh = window.setInterval(load, 4000);
    const tick = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);

    return () => {
      cancelled = true;
      window.clearInterval(refresh);
      window.clearInterval(tick);
    };
  }, []);

  if (!table) {
    return (
      <div className="panel panel--pad rating-panel">
        <span className="eyebrow">Топ рейтинга</span>
        <p className="text-sm muted">Загрузка…</p>
      </div>
    );
  }

  if (!table.header.enabled) {
    return (
      <div className="panel panel--pad rating-panel">
        <span className="eyebrow">Топ рейтинга</span>
        <p className="text-sm muted">Турнир сейчас не проводится.</p>
      </div>
    );
  }

  const visible = [...table.top, ...table.rest.slice(0, 12)];
  const currentVisible = visible.some((entry) => entry.current);

  return (
    <div className="panel panel--pad rating-panel">
      <header className="rating-panel__head">
        <div className="col" style={{ gap: 2 }}>
          <span className="eyebrow">Топ рейтинга</span>
          <strong className="rating-panel__title">{table.header.name}</strong>
        </div>
        {table.header.active && (
          <span className="chip num rating-panel__timer">{formatCountdown(secondsLeft)}</span>
        )}
      </header>

      <ol className="rating-panel__list">
        {visible.map((entry) => (
          <RatingRow key={entry.userId} entry={entry} />
        ))}
      </ol>

      {table.current && !currentVisible && (
        <div className="rating-panel__pinned">
          <span className="eyebrow">Вы</span>
          <ol className="rating-panel__list">
            <RatingRow entry={table.current} />
          </ol>
        </div>
      )}
    </div>
  );
}

function RatingRow({ entry }: { entry: RatingEntry }): JSX.Element {
  const medal = entry.position <= 3 ? ['🥇', '🥈', '🥉'][entry.position - 1] : null;

  return (
    <li className={`rating-panel__row${entry.current ? ' rating-panel__row--me' : ''}`}>
      <span className="rating-panel__pos num">{medal ?? entry.position}</span>
      <span className="rating-panel__name grow">{entry.current ? 'Вы' : entry.displayName}</span>
      <span className="rating-panel__pts num">{formatNumber(entry.points)}</span>
    </li>
  );
}
