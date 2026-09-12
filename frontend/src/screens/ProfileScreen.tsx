import { AchievementPanel } from '../components/AchievementPanel';
import { CollectionStrip } from '../components/CollectionStrip';
import { CrashShell } from '../components/CrashShell';
import { PlayerLevelBar } from '../components/PlayerLevelBar';
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
    <CrashShell fill rail={<RatingPanel />}>
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
              </div>
            </div>
          </div>

          <div className="profile-hero__stats">
            <StatCard label="Бонусы" value={formatNumber(player.bonusBalance)} accent />
            <StatCard label="Очки" value={formatNumber(player.gamePoints)} />
            <StatCard label="Билеты" value={formatNumber(player.lotteryTickets)} />
            <StatCard label="Коллекция" value={`ур. ${player.collectionLevel}`} />
          </div>

          <div className="profile-hero__stats profile-hero__stats--secondary">
            <StatCard label="Игры" value={formatNumber(player.roundsPlayed)} />
            <StatCard label="Побед" value={formatNumber(player.roundsWon ?? 0)} accent />
            <StatCard label="Поражений" value={formatNumber(player.roundsLost ?? 0)} />
          </div>

          {player.bonusBalance < 500 && (
            <button type="button" className="btn btn--sm btn--primary profile-hero__topup" onClick={() => void topUp()}>
              Пополнить +2000
            </button>
          )}
        </div>

        <div className="panel panel--pad profile__level-panel">
          <PlayerLevelBar player={player} />
        </div>

        <div className="panel panel--pad profile__achievements-panel">
          <AchievementPanel achievements={player.achievements ?? []} />
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
