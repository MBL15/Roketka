import { useState } from 'react';
import { Balloon } from '../components/Balloon';
import { CollectionStrip } from '../components/CollectionStrip';
import { HistoryFeed } from '../components/HistoryFeed';
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
 *
 * Кнопка «Начать» активируется только после выбора варианта, который игрок
 * может оплатить. Нажатие запускает короткую анимацию сборки пазла — она
 * закрывает сетевую задержку и делает списание баллов заметным событием, а не
 * бесшумным изменением числа в шапке.
 */
export function BetSelectScreen(): JSX.Element {
  const { setup, player, currentTheme: theme, history, startRound, switchTheme, goTo, notify } = useGame();
  const [selected, setSelected] = useState<number | null>(null);
  const [launching, setLaunching] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [tournamentOpen, setTournamentOpen] = useState(false);

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

  const start = () => {
    if (!canStart || !option) {
      return;
    }
    audio.unlock();
    audio.launch();
    setLaunching(true);
    // Анимация активации фрагмента; запрос уходит параллельно с ней.
    window.setTimeout(() => {
      void startRound(option.id).finally(() => setLaunching(false));
    }, 620);
  };

  return (
    <div className={`bet${launching ? ' bet--launching' : ''}`}>
      <section className="bet__main">
        <header className="bet__head">
          <div className="col">
            <span className="eyebrow">Шаг 2 из 2 · {theme.gameName}</span>
            <h1 className="h1">Соберите ставку</h1>
          </div>

          <div className="bet__head-actions">
            {/* Возврат на стартовый экран, а не смена темы на месте: экран
                выбора темы показывает обе версии рядом и их различия. */}
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                audio.click();
                setSelected(null);
                goTo('theme');
              }}
            >
              ← К выбору темы
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRulesOpen(true)}>
              Правила игры
            </button>
            {setup.tournament.enabled && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setTournamentOpen(true)}>
                Турнир
                {setup.tournament.active && (
                  <span className="text-xs muted"> · {formatCountdown(setup.tournament.secondsLeft)}</span>
                )}
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
                Сменить на «{otherTheme.gameName}»
              </button>
            )}
          </div>
        </header>

        <div className="bet__puzzle">
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

        <div className="bet__confirm panel panel--pad">
          <div className="bet__confirm-info">
            {option ? (
              <>
                <span className="eyebrow">К списанию</span>
                <span className="bet__confirm-cost num">{formatNumber(option.cost)} бонусных баллов</span>
                <span className="text-sm muted">
                  {option.boostTier > 1
                    ? `С бустером ×${option.boostValue.toFixed(0)}. Останется ${formatNumber(player.bonusBalance - option.cost)} баллов.`
                    : `Без усиления. Останется ${formatNumber(player.bonusBalance - option.cost)} баллов.`}
                </span>
              </>
            ) : (
              <>
                <span className="eyebrow">Ставка не выбрана</span>
                <span className="text-sm muted">
                  Выберите один из четырёх фрагментов — он определит стоимость раунда и силу бустера.
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            className="btn btn--primary btn--lg bet__start"
            disabled={!canStart}
            onClick={start}
          >
            {launching ? 'Наполняем шар…' : 'Начать'}
          </button>
        </div>

        <div className="bet__history panel panel--pad">
          <div className="row row--between">
            <div className="col">
              <span className="eyebrow">История раундов</span>
              <span className="text-sm muted">Все игроки прототипа, последние {setup.session.historySize}</span>
            </div>
          </div>
          <HistoryFeed entries={history} />
        </div>
      </section>

      <aside className="bet__aside">
        <div className="panel panel--pad bet__theme-card">
          <div className="row row--between">
            <div className="col">
              <span className="eyebrow">Тема</span>
              <strong className="h2">{theme.gameName}</strong>
            </div>
            <Balloon
              from={theme.key === 'green' ? '#a7f3c3' : '#ffc2b4'}
              to={theme.key === 'green' ? '#128c4b' : '#c02626'}
              size={74}
              className="bet__theme-balloon"
            />
          </div>

          <div className="bet__facts">
            <Fact label="Уровней" value={String(theme.levelCount)} />
            <Fact label="Потолок" value={formatMultiplier(theme.maxMultiplier)} />
            <Fact label="Разблокировка «Забрать»" value={formatMultiplier(theme.levelMultipliers[0] ?? 1.2)} />
            <Fact label="Очки за уровень" value={`+${theme.points.perLine}`} />
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

        {setup.reward.enabled && (
          <div className="panel panel--pad">
            <CollectionStrip reward={setup.reward} />
          </div>
        )}
      </aside>

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} setup={setup} theme={theme} />
      <TournamentModal open={tournamentOpen} onClose={() => setTournamentOpen(false)} />
    </div>
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
