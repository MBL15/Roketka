import { useEffect, useState } from 'react';
import { Sky } from './components/Sky';
import { Toasts } from './components/Toasts';
import { TopBar } from './components/TopBar';
import { AdminScreen } from './screens/AdminScreen';
import { BetSelectScreen } from './screens/BetSelectScreen';
import { GameScreen } from './screens/GameScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ResultScreen } from './screens/ResultScreen';
import { ThemeSelectScreen } from './screens/ThemeSelectScreen';
import { useGame } from './state/GameContext';

/**
 * Оболочка приложения.
 *
 * Вместо маршрутизатора — конечный автомат фаз в GameContext: экранов шесть,
 * переходы между ними строго заданы игровым циклом, а адресная строка в
 * бонусной игре внутри личного кабинета всё равно не нужна. Единственное
 * исключение — админка: она открывается по якорю #admin, чтобы проверяющий
 * мог попасть в неё напрямую по ссылке.
 *
 * Тема (зелёная или красная) задаётся атрибутом data-theme на корне: все цвета
 * живут в CSS-переменных, поэтому смена темы не требует перерисовки логики.
 */
export function App(): JSX.Element {
  const { phase, theme, player } = useGame();
  const [adminOpen, setAdminOpen] = useState(() => window.location.hash === '#admin');
  const [skySeed, setSkySeed] = useState(() => Date.now());

  useEffect(() => {
    const onHashChange = () => setAdminOpen(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Небо перерисовывается заново при каждой смене экрана: набор птиц и облаков
  // не повторяется, и возврат на экран не выглядит возвратом к той же картинке.
  useEffect(() => setSkySeed(Date.now()), [phase]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const closeAdmin = () => {
    window.location.hash = '';
    setAdminOpen(false);
  };

  if (adminOpen && player) {
    return (
      <div className="app app--admin">
        <div className="app__content">
          <AdminScreen onExit={closeAdmin} />
        </div>
        <Toasts />
      </div>
    );
  }

  return (
    <div className={`app app--${phase}`} data-theme={theme}>
      {/* На игровом экране своё небо внутри Canvas полёта — второе было бы лишним слоем. */}
      {phase !== 'game' && phase !== 'theme' && <Sky seed={skySeed} />}

      <div className="app__content">
        {player && phase !== 'boot' && phase !== 'login' && <TopBar />}

        {phase === 'boot' && <BootScreen />}
        {phase === 'login' && <LoginScreen />}
        {phase === 'theme' && <ThemeSelectScreen />}
        {phase === 'bet' && <BetSelectScreen />}
        {phase === 'game' && <GameScreen />}
        {phase === 'result' && <ResultScreen />}
      </div>

      <Toasts />
    </div>
  );
}

function BootScreen(): JSX.Element {
  return (
    <div className="boot">
      <div className="boot__balloon" aria-hidden="true" />
      <p className="text-sm muted">Готовим небо…</p>
    </div>
  );
}
