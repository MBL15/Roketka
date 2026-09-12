import { useEffect, useRef, useState } from 'react';
import type { GameSetup, Player, RatingEntry } from '../api/types';
import { CrashShell } from '../components/CrashShell';
import { FlightCanvas } from '../components/FlightCanvas';
import { LevelLadder } from '../components/LevelLadder';
import { LiveRating } from '../components/LiveRating';
import { useGame } from '../state/GameContext';
import { multiplierStage, type Flight } from '../state/flight';
import { useFlight } from '../state/useFlight';
import { formatMultiplier, formatNumber } from '../utils/format';

/** Экран полёта — кнопка «Забрать» активна после первого уровня. */
export function GameScreen(): JSX.Element {
  const { flight, setup, player, rating, finishRound } = useGame();

  if (!flight || !setup || !player) {
    return <></>;
  }

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
  const { autoCashoutMultiplier, applyCashoutProgression } = useGame();
  const [hintVisible, setHintVisible] = useState(false);
  const state = useFlight(flight, onFinished, autoCashoutMultiplier, applyCashoutProgression);

  const stateRef = useRef(state);
  stateRef.current = state;

  const unlocked = state.levelsPassed >= 1;
  const stage = multiplierStage(state.levelsPassed);

  useEffect(() => {
    if (!flight.showOnboarding) {
      return undefined;
    }
    setHintVisible(true);
    const timer = window.setTimeout(() => setHintVisible(false), setup.session.onboardingHintSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [flight.showOnboarding, setup.session.onboardingHintSeconds]);

  const rail = (
    <>
      {setup.tournament.enabled && rating.length > 0 && (
        <div className="panel panel--pad game-rail__rating">
          <LiveRating entries={rating} currentUserId={player.id} />
        </div>
      )}
      <div className="panel panel--pad game-rail__ladder">
        <span className="eyebrow">Уровни</span>
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
    </>
  );

  return (
    <CrashShell bleed rail={rail}>
      <div className={`game game--${flight.theme}${state.crashed ? ' game--crashed' : ''}`}>
        <FlightCanvas flight={flight} stateRef={stateRef} theme={flight.theme} />

        <div className="game__overlay game__overlay--crash">
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
              <span className="hud-stat__label">Очки</span>
              <span className="hud-stat__value num">{formatNumber(state.points)}</span>
            </div>
            <div className="hud-stat hud-stat--wide">
              <span className="hud-stat__label">{state.cashedOut ? 'Забрано' : 'Можно забрать'}</span>
              <span className={`hud-stat__value num${state.cashedOut ? ' positive' : ''}`}>
                {formatNumber(state.cashedOut ? state.payout : Math.round(flight.betAmount * state.multiplier))}
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
                <span className="text-sm muted">Шар ещё летит — результат откроется после краха.</span>
              </div>
            ) : (
              <div className="game__cashout-wrap">
                <button
                  type="button"
                  className={`cashout btn--lg${unlocked ? ' cashout--live' : ''}`}
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
                    Откроется после {formatMultiplier(flight.cashoutUnlockMultiplier)}
                  </span>
                )}

                {autoCashoutMultiplier !== null && !state.cashedOut && !state.crashed && (
                  <span className="text-xs muted game__lock-note">
                    Автозабор на {formatMultiplier(autoCashoutMultiplier)}
                  </span>
                )}

                {hintVisible && (
                  <div className="onboarding" role="note">
                    <span className="onboarding__arrow" aria-hidden="true">
                      ↓
                    </span>
                    <span className="onboarding__text">Нажми «Забрать» до краха</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </CrashShell>
  );
}
