import type { RewardSetup } from '../api/types';
import { formatNumber } from '../utils/format';

/**
 * Прогресс коллекции «Карта неба» — дополнительной игровой награды.
 *
 * Показан на экране выбора ставки специально: незакрытые ячейки видны до
 * ставки, и именно они дают повод сыграть ещё раз. Без визуального прогресса
 * награда воспринималась бы как случайная иконка на экране результата.
 */
export function CollectionStrip({
  reward,
  highlight,
}: {
  reward: RewardSetup;
  /** Только что полученный фрагмент подсвечивается отдельно. */
  highlight?: number | null;
}): JSX.Element | null {
  if (!reward.enabled || reward.collectionSize === 0) {
    return null;
  }

  const owned = new Set(reward.ownedFragments);
  const cells = Array.from({ length: reward.collectionSize }, (_, index) => index + 1);

  return (
    <div className="collection">
      <div className="row row--between collection__head">
        <div className="col collection__title">
          <span className="eyebrow">Награда · коллекция {reward.collectionLevel}</span>
          <strong className="h3">{reward.collectionName}</strong>
        </div>
        <span className="chip num">
          {owned.size} / {reward.collectionSize}
        </span>
      </div>

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

      <p className="text-xs muted collection__note">
        Каждый раунд — и выигрышный, и проигрышный — даёт один фрагмент. Дубликат обменивается на игровые
        очки. Собранная коллекция приносит {formatNumber(reward.completionBonusBalance)} бонусных баллов и{' '}
        {formatNumber(reward.completionBonusPoints)} очков, после чего открывается следующая.
      </p>
    </div>
  );
}
