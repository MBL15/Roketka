import type { BetOption } from '../api/types';
import { formatNumber } from '../utils/format';

/**
 * Вариант ставки — «фрагмент пазла».
 *
 * Карточка обязана ответить на три вопроса до подтверждения ставки: сколько
 * стоит, какое усиление даёт и при каком условии усиление срабатывает.
 * Поэтому условие активации бустера написано прямо в карточке, а не спрятано
 * во всплывающей подсказке: подсказку пришлось бы искать, а решение
 * принимается именно здесь.
 *
 * Недоступный по балансу вариант не исчезает и не становится «мёртвым»: он
 * остаётся видимым, помечен нехваткой и при нажатии объясняет причину.
 */

interface PuzzleCardProps {
  option: BetOption;
  index: number;
  selected: boolean;
  balance: number;
  levelCount: number;
  onSelect: () => void;
}

export function PuzzleCard({
  option,
  index,
  selected,
  balance,
  levelCount,
  onSelect,
}: PuzzleCardProps): JSX.Element {
  const affordable = balance >= option.cost;
  const hasBoost = option.boostTier > 1;
  const shortfall = option.cost - balance;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        'puzzle',
        selected ? 'puzzle--selected' : '',
        affordable ? '' : 'puzzle--locked',
        hasBoost ? 'puzzle--boosted' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="puzzle__glow" aria-hidden="true" />

      <span className="puzzle__head">
        <span className="puzzle__index">Фрагмент {index + 1}</span>
        {hasBoost ? (
          <span className="chip chip--boost puzzle__tier">бустер ×{option.boostValue.toFixed(0)}</span>
        ) : (
          /* Постановка перечисляет множители как ×1…×4, поэтому ×1 назван
             явно, а не только словами «без усиления». */
          <span className="chip puzzle__tier">×1 · без усиления</span>
        )}
      </span>

      <span className="puzzle__cost">
        <span className="puzzle__cost-value num">{formatNumber(option.cost)}</span>
        <span className="puzzle__cost-unit">бонусных баллов</span>
      </span>

      <span className="puzzle__note text-xs">
        {hasBoost
          ? `Бустер спрятан на одном из ${levelCount} уровней. Долетите до него раньше, чем нажмёте «Забрать», — коэффициент умножится на ${option.boostValue.toFixed(0)}. Шар с грузом бустера лопается охотнее.`
          : 'Чистая ставка: коэффициент растёт только со временем полёта.'}
      </span>

      <span className="puzzle__foot">
        {affordable ? (
          <span className={`chip ${selected ? 'chip--accent' : ''}`}>{selected ? 'выбрано' : 'выбрать'}</span>
        ) : (
          <span className="chip chip--negative">не хватает {formatNumber(shortfall)}</span>
        )}
      </span>
    </button>
  );
}
