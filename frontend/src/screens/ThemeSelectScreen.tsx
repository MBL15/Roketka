import { useMemo, useState, type CSSProperties } from 'react';
import { Balloon } from '../components/Balloon';
import { CrashShell } from '../components/CrashShell';
import { audio } from '../audio/AudioEngine';
import { useGame } from '../state/GameContext';
import type { ThemeSetup } from '../api/types';
import { formatMultiplier } from '../utils/format';

export function ThemeSelectScreen(): JSX.Element {
  const { setup, chooseTheme } = useGame();
  const [hovered, setHovered] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);

  const themes = useMemo(() => setup?.themes.filter((theme) => theme.active) ?? [], [setup]);

  const float = useMemo(
    () =>
      new Map(
        themes.map((theme) => [
          theme.key,
          {
            '--float-duration': `${(5.4 + Math.random() * 3.8).toFixed(2)}s`,
            '--float-delay': `${(-Math.random() * 6).toFixed(2)}s`,
          } as CSSProperties,
        ]),
      ),
    [themes],
  );

  if (!setup) {
    return <></>;
  }

  const pick = (theme: ThemeSetup) => {
    if (leaving) {
      return;
    }
    audio.unlock();
    setLeaving(theme.key);
    window.setTimeout(() => chooseTheme(theme.key), 460);
  };

  return (
    <CrashShell hideSidebar>
      <div className={`theme-pick${leaving ? ' theme-pick--leaving' : ''}`}>
        <header className="themes__head">
          <span className="theme-pick__step">Шаг 1 из 2</span>
          <h1 className="h1 theme-pick__title">Выберите небо</h1>
          <p className="text-sm theme-pick__lead">
            Тема задаёт сложность: число уровней, темп роста коэффициента и его потолок.
          </p>
        </header>

        <div className="theme-pick__grid">
          {themes.map((theme, index) => {
            const isGreen = theme.key === 'green';
            return (
              <button
                key={theme.key}
                type="button"
                className={[
                  'theme-card',
                  `theme-card--${theme.key}`,
                  hovered === theme.key ? 'theme-card--hover' : '',
                  leaving === theme.key ? 'theme-card--chosen' : '',
                  leaving && leaving !== theme.key ? 'theme-card--dimmed' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--theme-enter-delay': `${index * 90}ms` } as CSSProperties}
                onMouseEnter={() => setHovered(theme.key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(theme.key)}
                onBlur={() => setHovered(null)}
                onClick={() => pick(theme)}
              >
                <span className="theme-card__atmosphere" aria-hidden="true" />
                <span className="theme-card__stars" aria-hidden="true" />
                <span className="theme-card__horizon" aria-hidden="true" />

                <span className={`theme-card__badge theme-card__badge--${theme.key}`}>
                  {isGreen ? 'Спокойный полёт' : 'Высокий риск'}
                </span>

                <span className="theme-card__balloon">
                  <span className="theme-card__balloon-glow" aria-hidden="true" />
                  <Balloon
                    from={isGreen ? '#a7f3c3' : '#ffc2b4'}
                    to={isGreen ? '#128c4b' : '#c02626'}
                    size={168}
                    className={`theme-card__balloon-art theme-card__balloon-art--${theme.key}`}
                    title={theme.gameName}
                    style={float.get(theme.key)}
                  />
                </span>

                <span className="theme-card__body">
                  <span className="theme-card__title-row">
                    <span className="theme-card__name h2">{theme.gameName}</span>
                    <span className="theme-card__levels-pill">{theme.levelCount} уровней</span>
                  </span>

                  <span className="theme-card__facts">
                    <Fact label="Потолок" value={formatMultiplier(theme.maxMultiplier)} highlight />
                    <Fact label="Темп" value={`${theme.growthRate.toFixed(2)}/с`} />
                    <Fact label="Очки за уровень" value={`+${theme.points.perLine}`} />
                  </span>

                  <span className="theme-card__ladder" aria-hidden="true">
                    {Array.from({ length: theme.levelCount }, (_, i) => (
                      <span key={i} className="theme-card__ladder-dot" />
                    ))}
                  </span>

                  <span className="text-sm theme-card__note">
                    {isGreen ? 'Спокойный подъём и частые уровни — идеально для старта.' : 'Резкий рост и высокий потолок — для смелых.'}
                  </span>

                  <span className="theme-card__cta">
                    <span className="theme-card__cta-label">Выбрать</span>
                    <span className="theme-card__cta-arrow" aria-hidden="true">
                      →
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs theme-pick__hint">Тему можно сменить на экране ставки.</p>
      </div>
    </CrashShell>
  );
}

function Fact({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }): JSX.Element {
  return (
    <span className={`fact${highlight ? ' fact--highlight' : ''}`}>
      <span className="fact__label">{label}</span>
      <span className="fact__value num">{value}</span>
    </span>
  );
}
