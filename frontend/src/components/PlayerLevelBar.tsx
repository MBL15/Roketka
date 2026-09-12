import type { Player } from '../api/types';

interface PlayerLevelBarProps {
  player: Pick<Player, 'playerLevel' | 'playerXp' | 'xpToNextLevel' | 'displayProfitBonus'>;
  compact?: boolean;
}

export function PlayerLevelBar({ player, compact = false }: PlayerLevelBarProps): JSX.Element {
  const progress = player.xpToNextLevel > 0 ? (player.playerXp / player.xpToNextLevel) * 100 : 0;
  const bonusLabel = `+${player.displayProfitBonus.toFixed(2)}×`;

  return (
    <div className={`player-level${compact ? ' player-level--compact' : ''}`}>
      <div className="player-level__head">
        <span className="player-level__title">
          Уровень <strong className="num">{player.playerLevel}</strong>
        </span>
        <span className="player-level__bonus text-sm" title="Отображается для мотивации, на выплату не влияет">
          Ваш профит {bonusLabel}
        </span>
      </div>
      <div className="player-level__track" role="progressbar" aria-valuenow={player.playerXp} aria-valuemin={0} aria-valuemax={player.xpToNextLevel}>
        <div className="player-level__fill" style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
      {!compact && (
        <p className="player-level__meta text-xs muted">
          {player.playerXp} / {player.xpToNextLevel} опыта · ×2 на зелёном +1, на красном +2
        </p>
      )}
    </div>
  );
}
