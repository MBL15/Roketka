import { useEffect, useMemo, useState } from 'react';
import { AchievementBadgeList } from '../components/AchievementPanel';
import { Balloon } from '../components/Balloon';
import { CrashShell } from '../components/CrashShell';
import { UpsellModal } from '../components/UpsellModal';
import { audio } from '../audio/AudioEngine';
import { useGame } from '../state/GameContext';
import { formatMultiplier, formatNumber, formatPoints } from '../utils/format';

export function ResultScreen(): JSX.Element {
  const { result, setup, player, repeatBet, goTo, applyPurchase } = useGame();
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState(0);

  const idleLimit = setup?.session.resultIdleTimeoutSeconds ?? 10;

  useEffect(() => {
    if (!result) {
      return undefined;
    }
    audio.unlock();
    if (result.won) {
      audio.reward();
    }
    if (result.upsell.available) {
      const timer = window.setTimeout(() => setUpsellOpen(true), 1100);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [result]);

  useEffect(() => {
    if (upsellOpen) {
      return undefined;
    }
    const reset = () => setIdleSeconds(0);
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));

    const timer = window.setInterval(() => setIdleSeconds((value) => value + 1), 1000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, reset));
      window.clearInterval(timer);
    };
  }, [upsellOpen]);

  useEffect(() => {
    if (idleSeconds >= idleLimit) {
      goTo('theme');
    }
  }, [idleSeconds, idleLimit, goTo]);

  const breakdown = useMemo(() => {
    if (!result) {
      return [];
    }
    return [
      { label: 'За пройденные уровни', value: result.points.fromLevels },
      { label: 'За фиксацию выигрыша', value: result.points.fromCashout },
      { label: 'За бустер', value: result.points.fromBoost },
      { label: 'За награду', value: result.points.fromReward },
    ].filter((item) => item.value > 0);
  }, [result]);

  if (!result || !setup || !player) {
    return <></>;
  }

  const missed = result.potentialMaxMultiplier;

  const rail = (
    <>
      <div className="panel panel--pad result__points">
        <span className="eyebrow">Игровые очки</span>
        <strong className="result__points-total num">+{formatNumber(result.points.total)}</strong>
        <ul className="result__breakdown">
          {breakdown.map((item) => (
            <li key={item.label}>
              <span className="grow text-sm">{item.label}</span>
              <span className="num">+{formatNumber(item.value)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs muted">
          Очки идут в турнир: сейчас {formatPoints(result.gamePoints)}, место #{result.tournamentPosition}.
        </p>
      </div>

      {result.newAchievements?.length > 0 && (
        <div className="panel panel--pad result__achievements">
          <AchievementBadgeList achievements={result.newAchievements} />
        </div>
      )}

      {result.reward.enabled && result.reward.fragmentIndex !== null && (
        <div className={`panel panel--pad result__reward${result.reward.collectionCompleted ? ' result__reward--complete' : ''}`}>
          <span className="eyebrow">Награда · {result.reward.collectionName}</span>

          <div className="result__fragment">
            <span className="result__fragment-mark num">{result.reward.fragmentIndex}</span>
            <div className="col" style={{ gap: 4 }}>
              <strong>
                {result.reward.duplicate ? 'Повторный фрагмент' : `Новый фрагмент ${result.reward.fragmentIndex}`}
              </strong>
              <span className="text-sm muted">
                {result.reward.duplicate
                  ? `Обменян на ${formatPoints(result.reward.pointsAwarded)}`
                  : `Собрано ${result.reward.ownedAfter} из ${result.reward.collectionSize}`}
              </span>
            </div>
          </div>

          <div className="result__fragment-grid">
            {Array.from({ length: result.reward.collectionSize }, (_, index) => index + 1).map((index) => (
              <span
                key={index}
                className={[
                  'result__fragment-cell',
                  index <= result.reward.ownedAfter ? 'result__fragment-cell--owned' : '',
                  index === result.reward.fragmentIndex ? 'result__fragment-cell--new' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            ))}
          </div>

          {result.reward.collectionCompleted && (
            <p className="text-sm positive">
              Коллекция собрана: +{formatNumber(result.reward.bonusAwarded)} бонусов и{' '}
              {formatPoints(result.reward.pointsAwarded)}.
            </p>
          )}
        </div>
      )}

      <details className="panel panel--pad result__fairness">
        <summary className="text-sm">Проверить честность</summary>
        <p className="text-xs muted">Точка краха была зафиксирована до старта.</p>
        <dl className="result__fairness-list text-xs">
          <div>
            <dt>Зерно сервера</dt>
            <dd className="mono">{result.fairness.serverSeed}</dd>
          </div>
          <div>
            <dt>SHA-256</dt>
            <dd className="mono">{result.fairness.serverSeedHash}</dd>
          </div>
          <div>
            <dt>Клиент / nonce</dt>
            <dd className="mono">
              {result.fairness.clientSeed} / {result.fairness.nonce}
            </dd>
          </div>
        </dl>
        <a className="btn btn--sm btn--ghost" href={result.fairness.verifyUrl} target="_blank" rel="noreferrer">
          Открыть проверку
        </a>
      </details>
    </>
  );

  return (
    <CrashShell fill rail={rail}>
      <div className={`result result--${result.won ? 'win' : 'loss'}`}>
        <section className="panel panel--strong panel--pad result__main">
          <header className="result__head">
            <Balloon
              from={result.theme === 'green' ? '#a7f3c3' : '#ffc2b4'}
              to={result.theme === 'green' ? '#128c4b' : '#c02626'}
              size={88}
              deflated={!result.won}
              className="result__balloon"
            />
            <div className="col" style={{ gap: 6 }}>
              <span className="eyebrow">{result.won ? 'Выигрыш забран' : 'Шар лопнул'}</span>
              <h1 className="h1 result__title">
                {result.won ? `+${formatNumber(result.payout)}` : `−${formatNumber(result.betAmount)}`}
                <span className="result__title-unit">бонусных баллов</span>
              </h1>
              <p className="text-sm muted">
                {result.won
                  ? `Зафиксировали ${formatMultiplier(result.cashoutMultiplier)} при ставке ${formatNumber(result.betAmount)}.`
                  : `Ставка ${formatNumber(result.betAmount)} не вернулась.`}
              </p>
            </div>
          </header>

          <div className="result__numbers">
            <Metric label="Крах" value={formatMultiplier(result.crashMultiplier)} tone="negative" />
            <Metric
              label={result.won ? 'Ваш ×' : 'Уровни'}
              value={
                result.won
                  ? formatMultiplier(result.cashoutMultiplier)
                  : `${result.levelsPassed} / ${result.levelCount}`
              }
              tone={result.won ? 'positive' : 'neutral'}
            />
            <Metric label="Максимум" value={formatMultiplier(missed)} />
            <Metric
              label="Бустер"
              value={
                result.boostTier > 1
                  ? result.boostApplied
                    ? `×${result.boostValue.toFixed(0)} на ур. ${result.boostLevel}`
                    : `×${result.boostValue.toFixed(0)} не сработал`
                  : '—'
              }
              tone={result.boostApplied ? 'boost' : 'neutral'}
            />
          </div>

          {result.won && (
            <p className="result__missed text-sm">
              Максимум раунда — {formatMultiplier(missed)},{' '}
              <strong className="num">{formatNumber(Math.round(result.betAmount * missed))}</strong> баллов.
            </p>
          )}

          <div className="result__actions">
            <button
              type="button"
              className="btn btn--primary btn--lg grow"
              disabled={player.bonusBalance < result.betAmount}
              onClick={() => {
                audio.click();
                void repeatBet();
              }}
            >
              Повторить {formatNumber(result.betAmount)}
            </button>
            <button
              type="button"
              className="btn btn--lg"
              onClick={() => {
                audio.click();
                goTo('theme');
              }}
            >
              Выйти
            </button>
          </div>

          <p className="text-xs muted result__idle">
            Через {Math.max(0, idleLimit - idleSeconds)} с вернёмся к выбору темы.
          </p>
        </section>
      </div>

      {upsellOpen && result.upsell.available && (
        <UpsellModal
          offer={result.upsell}
          balance={player.bonusBalance}
          onClose={() => setUpsellOpen(false)}
          onPurchased={(tickets, balance) => applyPurchase(tickets, balance)}
        />
      )}
    </CrashShell>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'boost';
}): JSX.Element {
  return (
    <div className={`metric metric--${tone}`}>
      <span className="metric__label">{label}</span>
      <span className="metric__value num">{value}</span>
    </div>
  );
}
