import type { RewardSetup } from '../api/types';
import { formatNumber } from '../utils/format';

const HELP_TEXT =
  'Каждый раунд — и выигрышный, и проигрышный — даёт один фрагмент. Дубликат обменивается на игровые очки. Собранная коллекция приносит бонусные баллы и очки, после чего открывается следующая.';

interface CollectionStripProps {
  reward: RewardSetup;
  highlight?: number | null;
  variant?: 'compact' | 'profile';
}

/** Прогресс коллекции «Карта неба». */
export function CollectionStrip({
  reward,
  highlight,
  variant = 'compact',
}: CollectionStripProps): JSX.Element | null {
  if (!reward.enabled || reward.collectionSize === 0) {
    return null;
  }

  const owned = new Set(reward.ownedFragments);
  const cells = Array.from({ length: reward.collectionSize }, (_, index) => index + 1);
  const progress = Math.round((owned.size / reward.collectionSize) * 100);

  const helpDetail = `${HELP_TEXT} Награда за сбор: ${formatNumber(reward.completionBonusBalance)} бонусов и ${formatNumber(reward.completionBonusPoints)} очков.`;

  return (
    <div className={`collection${variant === 'profile' ? ' collection--profile' : ''}`}>
      <button
        type="button"
        className="collection__help"
        title={helpDetail}
        aria-label="Как работает коллекция"
      >
        ?
      </button>

      <div className="row row--between collection__head">
        <div className="col collection__title">
          <span className="eyebrow">Награда · коллекция {reward.collectionLevel}</span>
          <strong className="h3">{reward.collectionName}</strong>
        </div>
        <span className="chip num">
          {owned.size} / {reward.collectionSize}
        </span>
      </div>

      {variant === 'profile' && (
        <>
          <div className="collection__progress" aria-hidden="true">
            <span className="collection__progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm muted collection__rewards">
            За полную сборку: <strong className="num">{formatNumber(reward.completionBonusBalance)}</strong> бонусов
            и <strong className="num">{formatNumber(reward.completionBonusPoints)}</strong> очков
          </p>
        </>
      )}

      <div className="collection__grid">
        {cells.map((index) => (
          <span
            key={index}
            className={[
              'collection__cell',
              owned.has(index) ? 'collection__cell--owned' : '',
              highlight === index ? 'collection__cell--new' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            title={owned.has(index) ? `Фрагмент ${index} получен` : `Фрагмент ${index} ещё не найден`}
          >
            <span className="collection__cell-index num">{index}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
