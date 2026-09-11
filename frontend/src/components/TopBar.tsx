import { useState } from 'react';
import { audio } from '../audio/AudioEngine';
import { useGame } from '../state/GameContext';
import { formatNumber } from '../utils/format';

/**
 * Верхняя панель: состояние игрока и сервисные действия.
 *
 * Три валюты показаны рядом и подписаны, потому что они принципиально разные:
 * бонусные баллы тратятся на ставки, игровые очки идут в турнир, билеты —
 * результат апсейла. Если не подписать, игрок будет считать их одним и тем же.
 */
export function TopBar(): JSX.Element {
  const { player, socketStatus, logout, topUp, phase } = useGame();
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

  const connection =
    socketStatus === 'open'
      ? { label: 'реальное время', tone: 'positive' as const }
      : socketStatus === 'connecting'
        ? { label: 'подключение', tone: 'warning' as const }
        : { label: 'резервный опрос', tone: 'negative' as const };

  return (
    <header className="topbar panel panel--pad">
      <div className="topbar__brand">
        <span className="topbar__logo" aria-hidden="true">
          ◓
        </span>
        <span className="col topbar__title">
          <strong>Воздушный Шар</strong>
          <span className="text-xs muted">бонусная игра · Столото</span>
        </span>
      </div>

      <div className="topbar__stats">
        <Stat label="Бонусные баллы" value={formatNumber(player.bonusBalance)} accent />
        <Stat label="Игровые очки" value={formatNumber(player.gamePoints)} />
        <Stat label="Билеты" value={formatNumber(player.lotteryTickets)} />
        <Stat label="Место в турнире" value={`#${player.tournamentPosition}`} />
      </div>

      <div className="topbar__actions">
        <span
          className={`chip chip--${connection.tone} topbar__connection`}
          title="Коэффициент приходит по WebSocket; при обрыве интерфейс переходит на опрос REST"
        >
          <span className="topbar__dot" aria-hidden="true" />
          {connection.label}
        </span>

        {player.bonusBalance < 500 && phase !== 'game' && (
          <button type="button" className="btn btn--sm" onClick={() => void topUp()}>
            +2000 бонусов
          </button>
        )}

        <button
          type="button"
          className="btn btn--icon btn--ghost"
          onClick={toggleSound}
          aria-label={soundOn ? 'Выключить звук' : 'Включить звук'}
          title={soundOn ? 'Выключить звук' : 'Включить звук'}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>

        <a
          className="btn btn--icon btn--ghost"
          href="#admin"
          title="Административная панель: игровые параметры и симулятор"
          aria-label="Административная панель"
        >
          ⚙
        </a>

        <button type="button" className="btn btn--sm btn--ghost" onClick={() => void logout()}>
          {player.nickname} · выйти
        </button>
      </div>
    </header>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }): JSX.Element {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className={`stat__value num${accent ? ' stat__value--accent' : ''}`}>{value}</span>
    </div>
  );
}
