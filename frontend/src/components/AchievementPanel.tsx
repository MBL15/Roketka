import type { Achievement } from '../api/types';

interface AchievementPanelProps {
  achievements: Achievement[];
  variant?: 'profile' | 'compact';
}

const CATEGORY_LABELS: Record<Achievement['category'], string> = {
  flight: 'Полёт',
  collection: 'Коллекция',
  progression: 'Прогресс',
  milestone: 'Вехи',
};

export function AchievementPanel({ achievements, variant = 'profile' }: AchievementPanelProps): JSX.Element {
  const unlockedCount = achievements.filter((item) => item.unlocked).length;

  return (
    <section className={`achievement-panel achievement-panel--${variant}`}>
      <header className="achievement-panel__head">
        <div className="col" style={{ gap: 4 }}>
          <span className="eyebrow">Достижения</span>
          <strong className="achievement-panel__title">
            {unlockedCount} / {achievements.length}
          </strong>
        </div>
      </header>

      <div className="achievement-panel__grid">
        {achievements.map((achievement) => (
          <article
            key={achievement.id}
            className={`achievement-card${achievement.unlocked ? ' achievement-card--unlocked' : ''}`}
            title={achievement.unlocked ? achievement.description : 'Ещё не получено'}
          >
            <span className="achievement-card__icon" aria-hidden="true">
              {achievement.unlocked ? achievement.icon : '🔒'}
            </span>
            <div className="achievement-card__body">
              <strong className="achievement-card__title">{achievement.title}</strong>
              <span className="achievement-card__desc text-xs muted">
                {achievement.unlocked ? achievement.description : CATEGORY_LABELS[achievement.category]}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function AchievementBadgeList({ achievements }: { achievements: Achievement[] }): JSX.Element | null {
  if (achievements.length === 0) {
    return null;
  }

  return (
    <div className="achievement-badges">
      <span className="eyebrow">Новые достижения</span>
      <ul className="achievement-badges__list">
        {achievements.map((achievement) => (
          <li key={achievement.id} className="achievement-badges__item">
            <span className="achievement-badges__icon" aria-hidden="true">
              {achievement.icon}
            </span>
            <div className="col" style={{ gap: 2 }}>
              <strong>{achievement.title}</strong>
              <span className="text-xs muted">{achievement.description}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
