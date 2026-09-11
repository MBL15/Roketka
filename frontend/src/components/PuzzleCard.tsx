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

/**
 * Каждый фрагмент имеет свой силуэт: набор читается как собираемый пазл.
 *
 * Глубина выреза задана в пикселях, а не в процентах, и совпадает с
 * вертикальным отступом карточки (см. --puzzle-notch в components.css).
 * Так вырез гарантированно попадает в поле отступа: clip-path обрезает не
 * только фон, но и содержимое, и при глубине в процентах вырез съедал шапку
 * карточки — у третьего фрагмента исчезала плашка бустера, у четвёртого
 * номер фрагмента.
 */
const NOTCH = 'var(--puzzle-notch)';
const FRAGMENT_SHAPES = [
  `polygon(0 0, 100% 0, 100% calc(100% - ${NOTCH}), 62% calc(100% - ${NOTCH}), 62% 100%, 0 100%)`,
  `polygon(0 0, 100% 0, 100% 100%, 38% 100%, 38% calc(100% - ${NOTCH}), 0 calc(100% - ${NOTCH}))`,
  `polygon(0 0, 62% 0, 62% ${NOTCH}, 100% ${NOTCH}, 100% 100%, 0 100%)`,
  `polygon(38% 0, 100% 0, 100% 100%, 0 100%, 0 ${NOTCH}, 38% ${NOTCH})`,
];

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
      style={{ clipPath: FRAGMENT_SHAPES[index % FRAGMENT_SHAPES.length] }}
    >
      <span className="puzzle__glow" aria-hidden="true" />

      <span className="puzzle__head">
        <span className="puzzle__index">Фрагмент {index + 1}</span>
        {hasBoost ? (
          <span className="chip chip--boost puzzle__tier">бустер ×{option.boostValue.toFixed(0)}</span>
        ) : (
          <span className="chip puzzle__tier">без усиления</span>
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
