import { useEffect, useState } from 'react';
import { Sky } from './components/Sky';
import { Toasts } from './components/Toasts';
import { TopBar } from './components/TopBar';
import { APP_SKY_SEED } from './utils/skySeed';
import { AdminScreen } from './screens/AdminScreen';
import { BetSelectScreen } from './screens/BetSelectScreen';
import { GameScreen } from './screens/GameScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { ResultScreen } from './screens/ResultScreen';
import { ThemeSelectScreen } from './screens/ThemeSelectScreen';
import { useColorScheme } from './hooks/useColorScheme';
import { useGame } from './state/GameContext';
import { isExpertAccount } from './utils/access';

export function App(): JSX.Element {
  const { phase, theme, player, notify } = useGame();
  const { isLight } = useColorScheme();
  const [adminOpen, setAdminOpen] = useState(() => window.location.hash === '#admin');

  useEffect(() => {
    const onHashChange = () => setAdminOpen(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!adminOpen || !player) {
      return;
    }
    if (!isExpertAccount(player.nickname)) {
      window.location.hash = '';
      setAdminOpen(false);
      notify({ tone: 'error', title: 'Нет доступа', body: 'Настройки доступны только аккаунту expert' });
    }
  }, [adminOpen, notify, player]);

  const closeAdmin = () => {
    window.location.hash = '';
    setAdminOpen(false);
  };

  if (adminOpen && player && isExpertAccount(player.nickname)) {
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
    <div className={`app app--${phase} app--sky`} data-theme={theme}>
      <div className="app__sky-layer" aria-hidden="true">
        <Sky seed={APP_SKY_SEED} fullPage stars={!isLight} />
      </div>
      <div className="app__content">
        {player && phase !== 'boot' && phase !== 'login' && <TopBar />}

        {phase === 'boot' && <BootScreen />}
        {phase === 'login' && <LoginScreen />}
        {phase === 'theme' && <ThemeSelectScreen />}
        {phase === 'bet' && <BetSelectScreen />}
        {phase === 'game' && <GameScreen />}
        {phase === 'result' && <ResultScreen />}
        {phase === 'profile' && <ProfileScreen />}
      </div>

      <Toasts />
    </div>
  );
}

function BootScreen(): JSX.Element {
  return (
    <div className="boot">
      <div className="boot__balloon" aria-hidden="true" />
      <p className="text-sm muted">Загрузка…</p>
    </div>
  );
}
