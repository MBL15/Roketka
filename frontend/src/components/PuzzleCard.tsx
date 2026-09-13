import type { KeyboardEvent } from 'react';
import type { BetOption } from '../api/types';
import { formatNumber } from '../utils/format';
import { PuzzleShell } from './PuzzleShell';

/**
 * Вариант ставки — «фрагмент пазла».
 *
 * Карточка обязана ответить на три вопроса до подтверждения ставки: сколько
 * стоит, какое усиление даёт и при каком условии усиление срабатывает.
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <PuzzleShell
      shapeIndex={index}
      selected={selected}
      locked={!affordable}
      boosted={hasBoost}
      as="div"
      ariaPressed={selected}
      ariaLabel={`${hasBoost ? `бустер ×${option.boostValue.toFixed(0)}` : 'без усиления'}, ${formatNumber(option.cost)} бонусных баллов`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <span className="puzzle__head">
        {hasBoost ? (
          <span className="chip chip--boost puzzle__tier">бустер ×{option.boostValue.toFixed(0)}</span>
        ) : (
          <span className="chip puzzle__tier">×1 · без усиления</span>
        )}
      </span>

      <span className="puzzle__cost">
        <span className="puzzle__cost-value num">{formatNumber(option.cost)}</span>
        <span className="puzzle__cost-unit">бонусных баллов</span>
      </span>

      <span className="puzzle__note text-xs">
        {hasBoost
          ? `Бустер на одном из ${levelCount} уровней — успейте до «Забрать».`
          : 'Чистая ставка без усиления.'}
      </span>

      <span className="puzzle__foot">
        {affordable ? (
          <span className={`chip ${selected ? 'chip--accent' : ''}`}>{selected ? 'выбрано' : 'выбрать'}</span>
        ) : (
          <span className="chip chip--negative">не хватает {formatNumber(shortfall)}</span>
        )}
      </span>
    </PuzzleShell>
  );
}
