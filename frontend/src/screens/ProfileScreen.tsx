import { CollectionStrip } from '../components/CollectionStrip';
import { CrashShell } from '../components/CrashShell';
import { RatingPanel } from '../components/RatingPanel';
import { useGame } from '../state/GameContext';
import { formatNumber } from '../utils/format';

export function ProfileScreen(): JSX.Element {
  const { player, setup, topUp } = useGame();

  if (!player || !setup) {
    return <></>;
  }

  const initial = player.nickname.slice(0, 1).toUpperCase();

  return (
    <CrashShell rail={<RatingPanel />}>
      <div className="profile">
        <div className="profile-hero panel panel--pad">
          <div className="profile-hero__main">
            <span className="profile-hero__avatar" aria-hidden="true">
              {initial}
            </span>
            <div className="profile-hero__info">
              <h1 className="profile-hero__name">{player.nickname}</h1>
              <div className="profile-hero__meta">
                <span className="chip chip--accent num">#{player.tournamentPosition} в турнире</span>
                <span className="text-sm muted">{player.roundsPlayed} раундов</span>
              </div>
            </div>
          </div>

          <div className="profile-hero__stats">
            <StatCard label="Бонусы" value={formatNumber(player.bonusBalance)} accent />
            <StatCard label="Очки" value={formatNumber(player.gamePoints)} />
            <StatCard label="Билеты" value={formatNumber(player.lotteryTickets)} />
            <StatCard label="Коллекция" value={`ур. ${player.collectionLevel}`} />
          </div>

          {player.bonusBalance < 500 && (
            <button type="button" className="btn btn--sm btn--primary profile-hero__topup" onClick={() => void topUp()}>
              Пополнить +2000
            </button>
          )}
        </div>

        {setup.reward.enabled && (
          <div className="panel panel--pad profile__collection-panel">
            <CollectionStrip reward={setup.reward} variant="profile" />
          </div>
        )}
      </div>
    </CrashShell>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }): JSX.Element {
  return (
    <div className={`profile-stat${accent ? ' profile-stat--accent' : ''}`}>
      <span className="profile-stat__label">{label}</span>
      <span className="profile-stat__value num">{value}</span>
    </div>
  );
}
