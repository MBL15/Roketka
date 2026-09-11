import { useEffect, useRef, useState } from 'react';
import type { GameSetup, Player, RatingEntry } from '../api/types';
import { FlightCanvas } from '../components/FlightCanvas';
import { LevelLadder } from '../components/LevelLadder';
import { LiveRating } from '../components/LiveRating';
import { useGame } from '../state/GameContext';
import { multiplierStage, type Flight } from '../state/flight';
import { useFlight } from '../state/useFlight';
import { formatMultiplier, formatNumber } from '../utils/format';

/**
 * Экран полёта.
 *
 * Кнопка «Забрать» присутствует с первой секунды, но остаётся неактивной до
 * прохождения первого уровня: игрок заранее видит, где она и что она делает,
 * и не ищет её в тот момент, когда решение нужно принимать за доли секунды.
 *
 * Оформление коэффициента меняется по мере подъёма — чёрный, жёлтый, жёлтый со
 * свечением, жёлтый со свечением и крупнее. Это тот же прогресс, что и в
 * лестнице уровней, но считываемый боковым зрением.
 */
export function GameScreen(): JSX.Element {
  const { flight, setup, player, rating, finishRound } = useGame();

  if (!flight || !setup || !player) {
    return <></>;
  }

  // key по раунду: новый полёт начинается с чистым состоянием хука, без
  // ручного сброса десятка полей.
  return (
    <Flying
      key={flight.roundId}
      flight={flight}
      setup={setup}
      player={player}
      rating={rating}
      onFinished={() => void finishRound(flight.roundId)}
    />
  );
}

interface FlyingProps {
  flight: Flight;
  setup: GameSetup;
  player: Player;
  rating: RatingEntry[];
  onFinished: () => void;
}

function Flying({ flight, setup, player, rating, onFinished }: FlyingProps): JSX.Element {
  const [hintVisible, setHintVisible] = useState(false);
  const state = useFlight(flight, onFinished);

  // Канвас читает состояние через ref и не зависит от перерисовок React.
  const stateRef = useRef(state);
  stateRef.current = state;

  const unlocked = state.levelsPassed >= 1;
  const stage = multiplierStage(state.levelsPassed);

  // Мини-онбординг: показывается один раз, живёт заданное конфигурацией время.
  useEffect(() => {
    if (!flight.showOnboarding) {
      return undefined;
    }
    setHintVisible(true);
    const timer = window.setTimeout(() => setHintVisible(false), setup.session.onboardingHintSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [flight.showOnboarding, setup.session.onboardingHintSeconds]);

  return (
    <div className={`game game--${flight.theme}${state.crashed ? ' game--crashed' : ''}`}>
      <FlightCanvas flight={flight} stateRef={stateRef} theme={flight.theme} />

      <div className="game__overlay">
        {setup.tournament.enabled && rating.length > 0 && (
          <LiveRating entries={rating} currentUserId={player.id} />
        )}

        <div className="game__center">
          <div className={`multiplier multiplier--${stage}${state.crashed ? ' multiplier--crashed' : ''}`}>
            <span className="multiplier__value num">{formatMultiplier(state.multiplier)}</span>
            {state.boostApplied && (
              <span className="multiplier__boost">
                бустер ×{flight.boostValue.toFixed(0)} · базовый {formatMultiplier(state.baseMultiplier)}
              </span>
            )}
            {state.crashed && <span className="multiplier__crashed-label">шар лопнул</span>}
          </div>

          <div className="game__popups" aria-hidden="true">
            {state.popups.map((popup) => (
              <span key={popup.id} className={`popup popup--${popup.kind}`}>
                {popup.text}
              </span>
            ))}
          </div>
        </div>

        <div className="game__side">
          <LevelLadder
            levels={flight.levelMultipliers}
            levelsPassed={state.levelsPassed}
            boostChances={flight.boostTier > 1 ? flight.boostLevelChances : []}
            boostLevel={state.boostLevel}
            boostValue={flight.boostValue}
            boostApplied={state.boostApplied}
            cashedOut={state.cashedOut}
            compact
          />
        </div>

        <div className="game__hud">
          <div className="hud-stat">
            <span className="hud-stat__label">Ставка</span>
            <span className="hud-stat__value num">{formatNumber(flight.betAmount)}</span>
          </div>
          <div className="hud-stat">
            <span className="hud-stat__label">Уровни</span>
            <span className="hud-stat__value num">
              {state.levelsPassed} / {flight.levelCount}
            </span>
          </div>
          <div className="hud-stat">
            <span className="hud-stat__label">Очки за раунд</span>
            <span className="hud-stat__value num">{formatNumber(state.points)}</span>
          </div>
          <div className="hud-stat hud-stat--wide">
            <span className="hud-stat__label">{state.cashedOut ? 'Забрано' : 'Сейчас можно забрать'}</span>
            <span className={`hud-stat__value num${state.cashedOut ? ' positive' : ''}`}>
              {formatNumber(
                state.cashedOut ? state.payout : Math.round(flight.betAmount * state.multiplier),
              )}
            </span>
          </div>
        </div>

        <div className="game__action">
          {state.cashedOut ? (
            <div className="cashed panel panel--pad">
              <span className="eyebrow">Выигрыш зафиксирован</span>
              <strong className="cashed__amount num">
                +{formatNumber(state.payout)} на {formatMultiplier(state.cashoutMultiplier)}
              </strong>
              <span className="text-sm muted">
                Могли бы забрать больше — шар ещё летит. Результат откроется, когда он лопнет.
              </span>
            </div>
          ) : (
            <div className="game__cashout-wrap">
              <button
                type="button"
                className={`btn btn--primary btn--lg cashout${unlocked ? ' cashout--live' : ''}`}
                disabled={!unlocked || state.crashed}
                onClick={state.cashout}
              >
                <span className="cashout__label">Забрать</span>
                <span className="cashout__amount num">
                  {formatNumber(Math.round(flight.betAmount * state.multiplier))}
                </span>
              </button>

              {!unlocked && !state.crashed && (
                <span className="text-xs muted game__lock-note">
                  Откроется после первого уровня — {formatMultiplier(flight.cashoutUnlockMultiplier)}
                </span>
              )}

              {hintVisible && (
                <div className="onboarding" role="note">
                  <span className="onboarding__arrow" aria-hidden="true">
                    ↓
                  </span>
                  <span className="onboarding__text">Нажми «Забрать» до того, как шар лопнет</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
