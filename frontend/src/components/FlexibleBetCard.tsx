import { formatNumber } from '../utils/format';

type FlexibleBetCardProps = {
  kind: 'custom' | 'full';
  selected: boolean;
  balance: number;
  customAmount: string;
  onCustomAmountChange: (value: string) => void;
  onSelect: () => void;
};

export function FlexibleBetCard({
  kind,
  selected,
  balance,
  customAmount,
  onCustomAmountChange,
  onSelect,
}: FlexibleBetCardProps): JSX.Element {
  const parsedCustom = Number.parseInt(customAmount, 10);
  const customValid = Number.isFinite(parsedCustom) && parsedCustom > 0 && parsedCustom <= balance;
  const fullValid = balance > 0;
  const affordable = kind === 'custom' ? customValid : fullValid;
  const amount = kind === 'custom' ? (customValid ? parsedCustom : 0) : balance;
  const shortfall = kind === 'custom' && parsedCustom > balance ? parsedCustom - balance : 0;

  const handleClick = () => {
    onSelect();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
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
        <span className="puzzle__index">{kind === 'custom' ? 'Своя сумма' : 'Весь баланс'}</span>
        <span className="chip puzzle__tier">×1 · без усиления</span>
      </span>

      {kind === 'custom' ? (
        <label className="puzzle__custom-field" onClick={(event) => event.stopPropagation()}>
          <span className="puzzle__cost-unit">Бонусных баллов</span>
          <input
            className="input input--num puzzle__custom-input"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="0"
            value={customAmount}
            onChange={(event) => onCustomAmountChange(event.target.value)}
            onFocus={onSelect}
            aria-label="Своя сумма ставки"
          />
        </label>
      ) : (
        <span className="puzzle__cost">
          <span className="puzzle__cost-value num">{formatNumber(balance)}</span>
          <span className="puzzle__cost-unit">бонусных баллов</span>
        </span>
      )}

      <span className="puzzle__note text-xs">
        {kind === 'custom'
          ? 'Укажите любую сумму от 1 до вашего баланса. Без бустера — коэффициент растёт только со временем полёта.'
          : 'Поставьте все доступные бонусы одним нажатием. Без бустера — чистая ставка на весь баланс.'}
      </span>

      <span className="puzzle__foot">
        {affordable ? (
          <span className={`chip ${selected ? 'chip--accent' : ''}`}>
            {selected ? 'выбрано' : kind === 'full' ? formatNumber(amount) : 'выбрать'}
          </span>
        ) : kind === 'custom' && shortfall > 0 ? (
          <span className="chip chip--negative">не хватает {formatNumber(shortfall)}</span>
        ) : (
          <span className="chip chip--negative">недоступно</span>
        )}
      </span>
    </button>
  );
}
