import { useMemo, useState } from 'react';
import { Balloon } from '../components/Balloon';
import { CrashShell } from '../components/CrashShell';
import { FlexibleBetCard } from '../components/FlexibleBetCard';
import { LevelLadder } from '../components/LevelLadder';
import { PuzzleCard } from '../components/PuzzleCard';
import { RulesModal } from '../components/RulesModal';
import { TournamentModal } from '../components/TournamentModal';
import { audio } from '../audio/AudioEngine';
import { useGame } from '../state/GameContext';
import type { StartBetParams } from '../state/GameContext';
import { formatCountdown, formatMultiplier, formatNumber } from '../utils/format';

export type BetChoice =
  | { kind: 'preset'; optionId: number; cost: number; boostTier: number; boostValue: number }
  | { kind: 'custom'; amount: number }
  | { kind: 'full'; amount: number };

/**
 * Экран выбора ставки: шесть карточек (2×3) — четыре фиксированных фрагмента,
 * своя сумма и ставка на весь баланс.
 */
export function BetSelectScreen(): JSX.Element {
  const {
    setup,
    player,
    currentTheme: theme,
    startRound,
    switchTheme,
    goTo,
    notify,
    autoCashoutMultiplier,
    setAutoCashout,
  } = useGame();
  const [selected, setSelected] = useState<BetChoice | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [launching, setLaunching] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [tournamentOpen, setTournamentOpen] = useState(false);
  const [autoValue, setAutoValue] = useState(() => autoCashoutMultiplier?.toFixed(2) ?? '');

  if (!setup || !player || !theme) {
    return <></>;
  }

  const selectedCost = selected?.kind === 'preset' ? selected.cost : selected?.amount ?? 0;
  const canStart = selected !== null && selectedCost > 0 && player.bonusBalance >= selectedCost && !launching;
  const otherTheme = setup.themes.find((item) => item.key !== theme.key && item.active);

  const presetOption = selected?.kind === 'preset'
    ? theme.betOptions.find((item) => item.id === selected.optionId) ?? null
    : null;

  const selectPreset = (optionId: number, affordable: boolean, cost: number) => {
    if (!affordable) {
      audio.error();
      notify({
        tone: 'error',
        title: 'Не хватает бонусов',
        body: `Для этого фрагмента нужно ${formatNumber(cost)} баллов, у вас ${formatNumber(player.bonusBalance)}.`,
      });
      return;
    }
    audio.click();
    const option = theme.betOptions.find((item) => item.id === optionId);
    if (!option) {
      return;
    }
    setSelected({
      kind: 'preset',
      optionId,
      cost: option.cost,
      boostTier: option.boostTier,
      boostValue: option.boostValue,
    });
  };

  const selectCustom = () => {
    audio.click();
    const parsed = Number.parseInt(customAmount, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setSelected({ kind: 'custom', amount: 0 });
      return;
    }
    if (parsed > player.bonusBalance) {
      audio.error();
      notify({
        tone: 'error',
        title: 'Не хватает бонусов',
        body: `Для этой ставки нужно ${formatNumber(parsed)} баллов, у вас ${formatNumber(player.bonusBalance)}.`,
      });
      setSelected({ kind: 'custom', amount: parsed });
      return;
    }
    setSelected({ kind: 'custom', amount: parsed });
  };

  const selectFull = () => {
    if (player.bonusBalance <= 0) {
      audio.error();
      notify({ tone: 'error', title: 'Нет бонусов', body: 'На балансе нет баллов для ставки.' });
      return;
    }
    audio.click();
    setSelected({ kind: 'full', amount: player.bonusBalance });
  };

  const unlockMultiplier = theme.levelMultipliers[0] ?? 1.2;
  const autoPresets = theme.levelMultipliers.slice(0, Math.min(4, theme.levelCount));

  const applyAutoCashout = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setAutoCashout(null);
      return;
    }
    const parsed = Number.parseFloat(trimmed.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < unlockMultiplier) {
      setAutoCashout(null);
      return;
    }
    setAutoCashout(Math.min(parsed, theme.maxMultiplier));
  };

  const startBetParams = useMemo((): StartBetParams | null => {
    if (!selected || selectedCost <= 0 || player.bonusBalance < selectedCost) {
      return null;
    }
    if (selected.kind === 'preset') {
      return { betOptionId: selected.optionId };
    }
    return { betAmount: selected.amount };
  }, [player.bonusBalance, selected, selectedCost]);

  const start = () => {
    if (!canStart || !startBetParams) {
      return;
    }

    const trimmed = autoValue.trim();
    if (trimmed) {
      const parsed = Number.parseFloat(trimmed.replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed < unlockMultiplier) {
        notify({
          tone: 'error',
          title: 'Некорректный автозабор',
          body: `Укажите коэффициент от ${formatMultiplier(unlockMultiplier)}`,
        });
        return;
      }
      setAutoCashout(Math.min(parsed, theme.maxMultiplier));
    } else {
      setAutoCashout(null);
    }

    audio.unlock();
    audio.launch();
    setLaunching(true);
    window.setTimeout(() => {
      void startRound(startBetParams).finally(() => setLaunching(false));
    }, 620);
  };

  const rail = (
    <div className="panel panel--pad bet-rail__theme">
      <div className="row row--between">
        <div className="col" style={{ gap: 4 }}>
          <span className="eyebrow">Тема</span>
          <strong className="h2">{theme.gameName}</strong>
        </div>
        <Balloon
          from={theme.key === 'green' ? '#a7f3c3' : '#ffc2b4'}
          to={theme.key === 'green' ? '#128c4b' : '#c02626'}
          size={64}
          className="bet__theme-balloon"
        />
      </div>

      <div className="bet__facts">
        <Fact label="Уровней" value={String(theme.levelCount)} />
        <Fact label="Потолок" value={formatMultiplier(theme.maxMultiplier)} />
        <Fact label="«Забрать» с" value={formatMultiplier(theme.levelMultipliers[0] ?? 1.2)} />
        <Fact label="Очки/ур." value={`+${theme.points.perLine}`} />
      </div>

      <LevelLadder
        levels={theme.levelMultipliers}
        levelsPassed={0}
        boostChances={theme.boostLevelChances}
        boostValue={presetOption?.boostValue ?? 1}
        boostApplied={false}
        compact
      />
    </div>
  );

  return (
    <CrashShell fill rail={rail}>
      <div className={`bet-stage${launching ? ' bet--launching' : ''}`}>
        <div className="bet-toolbar">
          <h1 className="bet-toolbar__theme">{theme.gameName}</h1>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              audio.click();
              setSelected(null);
              goTo('theme');
            }}
          >
            ← Тема
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRulesOpen(true)}>
            Правила
          </button>
          {setup.tournament.enabled && (
            <button
              type="button"
              className="btn btn--ghost btn--sm trophy"
              onClick={() => setTournamentOpen(true)}
              aria-label="Турнирная таблица"
            >
              <TrophyIcon />
              <span className="trophy__text">
                Турнир
                {setup.tournament.active && (
                  <span className="trophy__timer num">{formatCountdown(setup.tournament.secondsLeft)}</span>
                )}
              </span>
            </button>
          )}
          {otherTheme && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                audio.waterDrop();
                switchTheme(otherTheme.key);
                setSelected(null);
              }}
            >
              «{otherTheme.gameName}»
            </button>
          )}
        </div>

        <div className="bet-cards bet-cards--six">
          {theme.betOptions.map((item, index) => (
            <PuzzleCard
              key={item.id}
              option={item}
              index={index}
              selected={selected?.kind === 'preset' && selected.optionId === item.id}
              balance={player.bonusBalance}
              levelCount={theme.levelCount}
              onSelect={() => selectPreset(item.id, player.bonusBalance >= item.cost, item.cost)}
            />
          ))}

          <FlexibleBetCard
            kind="custom"
            selected={selected?.kind === 'custom'}
            balance={player.bonusBalance}
            customAmount={customAmount}
            onCustomAmountChange={(value) => {
              setCustomAmount(value);
              if (selected?.kind === 'custom') {
                setSelected({ kind: 'custom', amount: Number.parseInt(value, 10) || 0 });
              }
            }}
            onSelect={selectCustom}
          />

          <FlexibleBetCard
            kind="full"
            selected={selected?.kind === 'full'}
            balance={player.bonusBalance}
            customAmount=""
            onCustomAmountChange={() => undefined}
            onSelect={selectFull}
          />
        </div>

        <div className="bet-panel">
          <div className="bet-panel__fields">
            <div className="bet-panel__field">
              <span className="bet-panel__label">Ставка</span>
              {selected && selectedCost > 0 ? (
                <>
                  <span className="bet-panel__value num">{formatNumber(selectedCost)}</span>
                  <span className="text-xs muted">
                    {selected.kind === 'preset' && presetOption && presetOption.boostTier > 1
                      ? `Бустер ×${presetOption.boostValue.toFixed(0)} · останется ${formatNumber(player.bonusBalance - selectedCost)}`
                      : selected.kind === 'full'
                        ? `Весь баланс · без усиления`
                        : selected.kind === 'custom'
                          ? `Своя сумма · останется ${formatNumber(player.bonusBalance - selectedCost)}`
                          : `Без усиления · останется ${formatNumber(player.bonusBalance - selectedCost)}`}
                  </span>
                </>
              ) : (
                <span className="text-sm muted">Выберите фрагмент или сумму</span>
              )}
            </div>

            <div className="bet-panel__field auto-cashout">
              <span className="bet-panel__label">Автозабор</span>
              <div className="auto-cashout__controls">
                <input
                  className="input input--compact num"
                  type="text"
                  inputMode="decimal"
                  placeholder="выкл."
                  value={autoValue}
                  onChange={(event) => {
                    setAutoValue(event.target.value);
                    applyAutoCashout(event.target.value);
                  }}
                  aria-label="Коэффициент автозабора"
                />
                <div className="auto-cashout__presets">
                  {autoPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="chip"
                      onClick={() => {
                        const text = preset.toFixed(2);
                        setAutoValue(text);
                        applyAutoCashout(text);
                      }}
                    >
                      {formatMultiplier(preset)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button type="button" className="btn btn--primary bet-panel__go" disabled={!canStart} onClick={start}>
            {launching ? 'Запуск…' : 'Старт'}
          </button>
        </div>
      </div>

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} setup={setup} theme={theme} />
      <TournamentModal open={tournamentOpen} onClose={() => setTournamentOpen(false)} />
    </CrashShell>
  );
}

function TrophyIcon(): JSX.Element {
  return (
    <svg className="trophy__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" fill="currentColor" opacity="0.9" />
      <path
        d="M7 5H4.5v1.5A3.5 3.5 0 0 0 8 10M17 5h2.5v1.5A3.5 3.5 0 0 1 16 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 14v3m-3 3h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Fact({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="fact">
      <span className="fact__label">{label}</span>
      <span className="fact__value num">{value}</span>
    </div>
  );
}
