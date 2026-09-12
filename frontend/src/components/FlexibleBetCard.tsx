import type { KeyboardEvent } from 'react';
import { formatNumber } from '../utils/format';

type FlexibleBetCardProps = {
  kind: 'custom' | 'full';
  selected: boolean;
  balance: number;
  customAmount: string;
  onCustomAmountChange: (value: string) => void;
  onSelect: () => void;
  onCustomSubmit?: () => void;
};

export function FlexibleBetCard({
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
  const amount = kind === 'custom' ? (customValid ? parsedCustom : 0) : balance;
  const shortfall = kind === 'custom' && parsedCustom > balance ? parsedCustom - balance : 0;

  const handleCustomKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      onSelect();
      if (customValid) {
        onCustomSubmit?.();
      }
    }
  };

  if (kind === 'custom') {
    return (
      <div
        className={[
          'puzzle',
          'puzzle--flex',
          'puzzle--custom',
          selected ? 'puzzle--selected' : '',
          affordable ? '' : 'puzzle--locked',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        role="group"
        aria-label="Своя сумма ставки"
      >
        <span className="puzzle__glow" aria-hidden="true" />

        <span className="puzzle__head">
          <span className="puzzle__index">Своя сумма</span>
          <span className="chip puzzle__tier">×1 · без усиления</span>
        </span>

        <label className="puzzle__custom-field" onClick={(event) => event.stopPropagation()}>
          <span className="puzzle__cost-unit">Бонусных баллов</span>
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
            onKeyDown={handleCustomKeyDown}
            aria-label="Своя сумма ставки"
          />
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
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        'puzzle',
        'puzzle--flex',
        selected ? 'puzzle--selected' : '',
        affordable ? '' : 'puzzle--locked',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="puzzle__glow" aria-hidden="true" />

      <span className="puzzle__head">
        <span className="puzzle__index">Весь баланс</span>
        <span className="chip puzzle__tier">×1 · без усиления</span>
      </span>

      <span className="puzzle__cost">
        <span className="puzzle__cost-value num">{formatNumber(balance)}</span>
        <span className="puzzle__cost-unit">бонусных баллов</span>
      </span>

      <span className="puzzle__note text-xs">
        Поставьте все доступные бонусы одним нажатием. Без бустера — чистая ставка на весь баланс.
      </span>

      <span className="puzzle__foot">
        {affordable ? (
          <span className={`chip ${selected ? 'chip--accent' : ''}`}>
            {selected ? 'выбрано' : formatNumber(amount)}
          </span>
        ) : (
          <span className="chip chip--negative">недоступно</span>
        )}
      </span>
    </button>
  );
}
