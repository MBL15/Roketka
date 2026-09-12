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

      <div className={`theme-pick${leaving ? ' themes--leaving' : ''}`}>
        <header className="themes__head">

          <span className="eyebrow">Шаг 1 из 2</span>

          <h1 className="h1">Выберите небо</h1>

          <p className="text-sm muted">

            Тема задаёт сложность: число уровней, темп роста коэффициента и его потолок.

          </p>

        </header>



        <div className="theme-pick__grid">

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

                  size={150}

                  className={`theme-card__balloon-art theme-card__balloon-art--${theme.key}`}

                  title={theme.gameName}

                  style={float.get(theme.key)}

                />

              </span>



              <span className="theme-card__body">

                <span className="theme-card__name h2">{theme.gameName}</span>

                <span className="theme-card__levels chip">{theme.levelCount} уровней</span>



                <span className="theme-card__facts">

                  <Fact label="Потолок" value={formatMultiplier(theme.maxMultiplier)} />

                  <Fact label="Темп" value={`${theme.growthRate.toFixed(2)}/с`} />

                  <Fact label="Очки" value={`+${theme.points.perLine}`} />

                </span>



                <span className="text-sm theme-card__note">

                  {theme.key === 'green' ? 'Спокойный подъём и частые уровни.' : 'Резкий рост и высокий потолок.'}

                </span>



                <span className="theme-card__cta chip chip--accent">Выбрать</span>

              </span>

            </button>

          ))}

        </div>



        <p className="themes__hint text-xs muted">Тему можно сменить на экране ставки.</p>

      </div>

    </CrashShell>

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


