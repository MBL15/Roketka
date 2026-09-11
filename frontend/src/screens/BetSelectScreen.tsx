import { useState } from 'react';

import { Balloon } from '../components/Balloon';

import { CrashShell } from '../components/CrashShell';

import { LevelLadder } from '../components/LevelLadder';

import { PuzzleCard } from '../components/PuzzleCard';

import { RulesModal } from '../components/RulesModal';

import { TournamentModal } from '../components/TournamentModal';

import { audio } from '../audio/AudioEngine';

import { useGame } from '../state/GameContext';

import { formatCountdown, formatMultiplier, formatNumber } from '../utils/format';



/**

 * Экран выбора ставки.

 *

 * Собирает всё, что игрок должен увидеть до подтверждения: четыре фрагмента с

 * ценой и условием бустера, количество уровней темы, отдельный вход в правила

 * и историю завершённых раундов всех игроков.

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

  const [selected, setSelected] = useState<number | null>(null);

  const [launching, setLaunching] = useState(false);

  const [rulesOpen, setRulesOpen] = useState(false);

  const [tournamentOpen, setTournamentOpen] = useState(false);

  const [autoValue, setAutoValue] = useState(() => autoCashoutMultiplier?.toFixed(2) ?? '');



  if (!setup || !player || !theme) {

    return <></>;

  }



  const option = theme.betOptions.find((item) => item.id === selected) ?? null;

  const canStart = option !== null && player.bonusBalance >= option.cost && !launching;

  const otherTheme = setup.themes.find((item) => item.key !== theme.key && item.active);



  const select = (optionId: number, affordable: boolean, cost: number) => {

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

    setSelected(optionId);

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



  const start = () => {

    if (!canStart || !option) {

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

      void startRound(option.id).finally(() => setLaunching(false));

    }, 620);

  };



  const rail = (

    <>

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

          boostValue={option?.boostValue ?? 1}

          boostApplied={false}

          compact

        />

      </div>

    </>

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



        <div className="bet-cards">

          {theme.betOptions.map((item, index) => (

            <PuzzleCard

              key={item.id}

              option={item}

              index={index}

              selected={selected === item.id}

              balance={player.bonusBalance}

              levelCount={theme.levelCount}

              onSelect={() => select(item.id, player.bonusBalance >= item.cost, item.cost)}

            />

          ))}

        </div>



        <div className="bet-panel">

          <div className="bet-panel__fields">

            <div className="bet-panel__field">

              <span className="bet-panel__label">Ставка</span>

              {option ? (

                <>

                  <span className="bet-panel__value num">{formatNumber(option.cost)}</span>

                  <span className="text-xs muted">

                    {option.boostTier > 1

                      ? `Бустер ×${option.boostValue.toFixed(0)} · останется ${formatNumber(player.bonusBalance - option.cost)}`

                      : `Без усиления · останется ${formatNumber(player.bonusBalance - option.cost)}`}

                  </span>

                </>

              ) : (

                <span className="text-sm muted">Выберите фрагмент</span>

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



          <button

            type="button"

            className="btn btn--primary bet-panel__go"

            disabled={!canStart}

            onClick={start}

          >

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


