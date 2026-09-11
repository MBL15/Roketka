import type { HistoryEntry } from '../api/types';
import { formatMultiplier, formatNumber, formatTime } from '../utils/format';

/**
 * История завершённых раундов всех игроков прототипа.
 *
 * Обязательный элемент экрана выбора ставки. Кроме справочной функции он
 * работает на вовлечение: видно, на каких коэффициентах забирали другие и где
 * шар лопался, — это и есть тот самый эффект упущенной выгоды.
 */
export function HistoryFeed({ entries }: { entries: HistoryEntry[] }): JSX.Element {
  if (entries.length === 0) {
    return (
      <div className="history__empty text-sm muted">
        Ещё ни один раунд не завершён. Сделайте первую ставку — результат появится здесь.
      </div>
    );
  }

  return (
    <ul className="history">
      {entries.map((entry) => (
        <li key={entry.roundId} className={`history__row${entry.mine ? ' history__row--mine' : ''}`}>
          <span className={`history__theme history__theme--${entry.theme}`} aria-hidden="true" />

          <span className="history__who grow">
            <span className="history__name">{entry.mine ? 'Вы' : entry.nickname}</span>
            <span className="text-xs muted">
              {formatNumber(entry.betAmount)} б · {entry.levelsPassed} ур
              {entry.boostApplied ? ` · ×${entry.boostTier} сработал` : ''}
            </span>
          </span>

          <span className="history__numbers">
            <span
              className={`history__multiplier num ${entry.won ? 'positive' : 'negative'}`}
              title={entry.won ? 'Коэффициент, на котором забрали' : 'Коэффициент краха'}
            >
              {formatMultiplier(entry.won ? entry.cashoutMultiplier : entry.crashMultiplier)}
            </span>
            <span className="text-xs muted num">
              {entry.won ? `+${formatNumber(entry.payout)}` : `−${formatNumber(entry.betAmount)}`}
            </span>
          </span>

          <span className="history__time text-xs muted num">{formatTime(entry.finishedAt)}</span>
        </li>
      ))}
    </ul>
  );
}
