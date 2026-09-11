import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { RatingEntry, TournamentTable } from '../api/types';
import { formatCountdown, formatNumber } from '../utils/format';
import { Modal } from './Modal';

/**
 * Турнирная таблица.
 *
 * Постановка задаёт конкретную раскладку: топ-3 закреплены сверху, остальные
 * участники — прокручиваемым списком, а текущий игрок закреплён внизу, если
 * не попал в видимую часть. Именно это здесь и сделано; серверная часть
 * отдаёт текущего игрока отдельным полем, чтобы клиенту не приходилось искать
 * его в длинном списке.
 */
export function TournamentModal({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const [table, setTable] = useState<TournamentTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const data = await api.tournamentTable();
        if (cancelled) return;
        setTable(data);
        setSecondsLeft(data.header.secondsLeft);
        setError(null);
      } catch {
        if (!cancelled) {
          setError('Не удалось загрузить турнирную таблицу');
        }
      }
    };

    void load();
    // Таблица обновляется, пока окно открыто: очки соперников идут в реальном времени.
    const refresh = window.setInterval(load, 2000);
    const tick = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);

    return () => {
      cancelled = true;
      window.clearInterval(refresh);
      window.clearInterval(tick);
    };
  }, [open]);

  const currentVisible =
    table?.current !== null &&
    table !== null &&
    [...table.top, ...table.rest.slice(0, 12)].some((entry) => entry.current);

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
      width={620}
    >
      {error && <p className="text-sm negative">{error}</p>}

      {table && (
        <div className="tournament">
          <div className="tournament__podium">
            {table.top.map((entry) => (
              <PodiumCard key={entry.userId} entry={entry} />
            ))}
          </div>

          <div className="tournament__scroll">
            <ol className="tournament__list">
              {table.rest.map((entry) => (
                <TableRow key={entry.userId} entry={entry} />
              ))}
            </ol>
          </div>

          {table.current && !currentVisible && (
            <div className="tournament__pinned">
              <span className="eyebrow">Ваша позиция</span>
              <ol className="tournament__list">
                <TableRow entry={table.current} />
              </ol>
            </div>
          )}

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
    <div className={`podium${entry.current ? ' podium--me' : ''} podium--${entry.position}`}>
      <span className="podium__medal" aria-hidden="true">
        {medals[entry.position - 1] ?? entry.position}
      </span>
      <span className="podium__name">{entry.current ? 'Вы' : entry.displayName}</span>
      <span className="podium__points num">{formatNumber(entry.points)}</span>
    </div>
  );
}

function TableRow({ entry }: { entry: RatingEntry }): JSX.Element {
  return (
    <li className={`tournament__row${entry.current ? ' tournament__row--me' : ''}`}>
      <span className="tournament__position num">{entry.position}</span>
      <span className="grow">{entry.current ? 'Вы' : entry.displayName}</span>
      {entry.bot && (
        <span className="chip text-xs" title="Симулированный соперник прототипа">
          бот
        </span>
      )}
      <span className="tournament__points num">{formatNumber(entry.points)}</span>
    </li>
  );
}
