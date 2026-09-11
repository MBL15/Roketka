import { useEffect, useMemo, useState } from 'react';
import { Balloon } from '../components/Balloon';
import { Sky } from '../components/Sky';
import { audio } from '../audio/AudioEngine';
import { useGame } from '../state/GameContext';
import type { ThemeSetup } from '../api/types';
import { formatMultiplier } from '../utils/format';

/**
 * Выбор темы.
 *
 * Анимированное небо перерисовывается при каждом заходе на экран: набор птиц и
 * облаков, их траектории и скорости генерируются заново (за это отвечает
 * сменный seed). Оба шара покачиваются с разными периодами, поэтому движение
 * не выглядит зациклённым.
 *
 * Фоновая звуковая среда с редкими криками птиц запускается только после
 * первого действия пользователя — иначе браузер заблокирует автозапуск звука.
 */
export function ThemeSelectScreen(): JSX.Element {
  const { setup, chooseTheme } = useGame();
  const [seed, setSeed] = useState(() => Date.now());
  const [hovered, setHovered] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    // Новый рисунок неба на каждый визит.
    setSeed(Date.now());
    audio.startAmbient();
    return () => audio.stopAmbient();
  }, []);

  const themes = useMemo(() => setup?.themes.filter((theme) => theme.active) ?? [], [setup]);

  if (!setup) {
    return <></>;
  }

  const pick = (theme: ThemeSetup) => {
    if (leaving) {
      return;
    }
    audio.unlock();
    audio.waterDrop();
    setLeaving(theme.key);
    // Даём отыграть каплю и анимации ухода, затем переходим к ставке.
    window.setTimeout(() => chooseTheme(theme.key), 460);
  };

  return (
    <div className={`themes${leaving ? ' themes--leaving' : ''}`}>
      <Sky seed={seed} />

      <header className="themes__head">
        <span className="eyebrow">Шаг 1 из 2</span>
        <h1 className="h1">Выберите небо</h1>
        <p className="text-sm muted">
          Тема задаёт не только внешний вид, но и сложность: количество уровней, темп роста коэффициента и
          его потолок.
        </p>
      </header>

      <div className="themes__grid">
        {themes.map((theme) => (
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
            onMouseEnter={() => setHovered(theme.key)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(theme.key)}
            onBlur={() => setHovered(null)}
            onClick={() => pick(theme)}
          >
            <span className="theme-card__balloon">
              <Balloon
                from={theme.key === 'green' ? '#a7f3c3' : '#ffc2b4'}
                to={theme.key === 'green' ? '#128c4b' : '#c02626'}
                size={170}
                className={`theme-card__balloon-art theme-card__balloon-art--${theme.key}`}
                title={theme.gameName}
              />
            </span>

            <span className="theme-card__body">
              <span className="theme-card__name h2">{theme.gameName}</span>
              <span className="theme-card__levels chip">{theme.levelCount} уровней</span>

              <span className="theme-card__facts">
                <Fact label="Потолок" value={formatMultiplier(theme.maxMultiplier)} />
                <Fact label="Темп роста" value={`${theme.growthRate.toFixed(2)}/с`} />
                <Fact label="Очки за уровень" value={`+${theme.points.perLine}`} />
              </span>

              <span className="text-sm theme-card__note">
                {theme.key === 'green'
                  ? 'Спокойный подъём и частые уровни. Хороший выбор, чтобы почувствовать ритм игры.'
                  : 'Резкий рост и высокий потолок. Уровней больше, но и лопается шар охотнее.'}
              </span>

              <span className="theme-card__cta chip chip--accent">Выбрать тему</span>
            </span>
          </button>
        ))}
      </div>

      <p className="themes__hint text-xs muted">
        Тему можно сменить в любой момент на экране выбора ставки.
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <span className="fact">
      <span className="fact__label">{label}</span>
      <span className="fact__value num">{value}</span>
    </span>
  );
}
