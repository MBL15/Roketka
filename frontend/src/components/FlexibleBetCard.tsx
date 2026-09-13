import type { KeyboardEvent } from 'react';
import { formatNumber } from '../utils/format';
import { PuzzleShell } from './PuzzleShell';

type FlexibleBetCardProps = {
  shapeIndex: number;
  kind: 'custom' | 'full';
  selected: boolean;
  balance: number;
  customAmount: string;
  onCustomAmountChange: (value: string) => void;
  onSelect: () => void;
  onCustomSubmit?: () => void;
};

export function FlexibleBetCard({
  shapeIndex,
  kind,
  selected,
  balance,
  customAmount,
  onCustomAmountChange,
  onSelect,
  onCustomSubmit,
}: FlexibleBetCardProps): JSX.Element {
  const parsedCustom = Number.parseInt(customAmount, 10);
  const customValid = Number.isFinite(parsedCustom) && parsedCustom > 0 && parsedCustom <= balance;
  const fullValid = balance > 0;
  const affordable = kind === 'custom' ? customValid : fullValid;
  const shortfall = kind === 'custom' && parsedCustom > balance ? parsedCustom - balance : 0;

  const submitCustom = () => {
    onSelect();
    if (customValid) {
      onCustomSubmit?.();
    }
  };

  const handleCustomKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      submitCustom();
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      submitCustom();
    }
  };

  if (kind === 'custom') {
    return (
      <PuzzleShell
        shapeIndex={shapeIndex}
        selected={selected}
        locked={!affordable && !customAmount}
        flex
        custom
        as="div"
        ariaLabel="Своя сумма ставки"
        onClick={onSelect}
        onKeyDown={handleCustomKeyDown}
      >
        <span className="puzzle__head">
          <span className="chip puzzle__tier">Своя сумма</span>
        </span>

        <label className="puzzle__cost puzzle__cost--custom" onClick={(event) => event.stopPropagation()}>
          <input
            className="input input--num puzzle__custom-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="0"
            value={customAmount}
            onChange={(event) => onCustomAmountChange(event.target.value.replace(/[^\d]/g, ''))}
            onFocus={onSelect}
            onKeyDown={handleInputKeyDown}
            aria-label="Своя сумма ставки"
          />
          <span className="puzzle__cost-unit">бонусных баллов</span>
        </label>

        <span className="puzzle__note text-xs">
          Введите сумму с клавиатуры (Enter — выбрать). От 1 до {formatNumber(balance)} баллов, без бустера.
        </span>

        <span className="puzzle__foot">
          {affordable ? (
            <span className={`chip ${selected ? 'chip--accent' : ''}`}>{selected ? 'выбрано' : 'выбрать'}</span>
          ) : customValid === false && parsedCustom > balance ? (
            <span className="chip chip--negative">не хватает {formatNumber(shortfall)}</span>
          ) : (
            <span className="chip chip--negative">{customAmount ? 'укажите сумму' : 'введите сумму'}</span>
          )}
        </span>
      </PuzzleShell>
    );
  }

  const handleFullKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <PuzzleShell
      shapeIndex={shapeIndex}
      selected={selected}
      locked={!affordable}
      flex
      as="div"
      ariaPressed={selected}
      ariaLabel={`Весь баланс, ${formatNumber(balance)} бонусных баллов`}
      onClick={onSelect}
      onKeyDown={handleFullKeyDown}
    >
      <span className="puzzle__head">
        <span className="chip puzzle__tier">Весь баланс</span>
      </span>

      <span className="puzzle__cost">
        <span className="puzzle__cost-value num">{formatNumber(balance)}</span>
      </span>

      <span className="puzzle__note text-xs">
        Поставьте все доступные бонусы одним нажатием. Без бустера — чистая ставка на весь баланс.
      </span>

      <span className="puzzle__foot">
        {affordable ? (
          <span className={`chip ${selected ? 'chip--accent' : ''}`}>
            {selected ? 'выбрано' : 'выбрать'}
          </span>
        ) : (
          <span className="chip chip--negative">недоступно</span>
        )}
      </span>
    </PuzzleShell>
  );
}
