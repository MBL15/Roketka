import { useState } from 'react';
import { audio } from '../audio/AudioEngine';
import { useGame } from '../state/GameContext';
import { formatNumber } from '../utils/format';
import { isExpertAccount } from '../utils/access';

export function TopBar(): JSX.Element {
  const { player, socketStatus, logout, topUp, phase, goTo } = useGame();
  const [soundOn, setSoundOn] = useState(audio.isEnabled);

  if (!player) {
    return <></>;
  }

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    audio.setEnabled(next);
    if (next) {
      audio.unlock();
      audio.click();
    }
  };

  const openProfile = () => {
    audio.click();
    if (phase === 'profile') {
      goTo('bet');
      return;
    }
    goTo('profile');
  };

  const connection =
    socketStatus === 'open'
      ? { label: 'онлайн', tone: 'positive' as const }
      : socketStatus === 'connecting'
        ? { label: 'связь…', tone: 'warning' as const }
        : { label: 'опрос', tone: 'negative' as const };

  const expert = isExpertAccount(player.nickname);
  const onProfile = phase === 'profile';

  return (
    <header className="crash-header">
      <div className="crash-header__brand">
        <span className="crash-header__logo" aria-hidden="true">
          ◓
        </span>
        <span className="col" style={{ gap: 0 }}>
          <span className="crash-header__name">Воздушный шар</span>
          <span className="crash-header__tag">бонусная игра</span>
        </span>
      </div>

      <div className="crash-header__balance">
        <span className="crash-header__balance-label">Баланс</span>
        <span className="crash-header__balance-value num">{formatNumber(player.bonusBalance)}</span>
      </div>

      <div className="crash-header__stats">
        <Stat label="Очки" value={formatNumber(player.gamePoints)} />
        <Stat label="Билеты" value={formatNumber(player.lotteryTickets)} />
        <Stat label="Турнир" value={`#${player.tournamentPosition}`} />
      </div>

      <div className="crash-header__actions">
        <span className={`crash-header__status chip chip--${connection.tone}`} title="Статус соединения">
          <span className="crash-header__dot" aria-hidden="true" />
          {connection.label}
        </span>

        {player.bonusBalance < 500 && phase !== 'game' && (
          <button type="button" className="btn btn--sm btn--primary" onClick={() => void topUp()}>
            +2000
          </button>
        )}

        <button
          type="button"
          className="btn btn--icon btn--ghost"
          onClick={toggleSound}
          aria-label={soundOn ? 'Выключить звук' : 'Включить звук'}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>

        {phase !== 'game' && phase !== 'result' && (
          <button
            type="button"
            className={`btn btn--icon btn--ghost${onProfile ? ' btn--icon-active' : ''}`}
            onClick={openProfile}
            aria-label="Профиль"
            title="Профиль"
          >
            <ProfileIcon />
          </button>
        )}

        {expert && (
          <a className="btn btn--icon btn--ghost" href="#admin" title="Настройки" aria-label="Настройки">
            ⚙
          </a>
        )}

        <button type="button" className="btn btn--sm btn--ghost" onClick={() => void logout()}>
          Выйти
        </button>
      </div>
    </header>
  );
}

function ProfileIcon(): JSX.Element {
  return (
    <svg className="topbar__profile-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="crash-header__stat">
      <span className="crash-header__stat-label">{label}</span>
      <span className="crash-header__stat-value num">{value}</span>
    </div>
  );
}
