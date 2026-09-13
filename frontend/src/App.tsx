import { useEffect, useRef, useState } from 'react';
import { LoginRulesModal } from './components/LoginRulesModal';
import { Sky } from './components/Sky';
import { Toasts } from './components/Toasts';
import { TopBar } from './components/TopBar';
import { audio } from './audio/AudioEngine';
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
import { isLoginRulesDismissed } from './utils/loginRules';

export function App(): JSX.Element {
  const { phase, theme, player, notify, setup, themeOf } = useGame();
  const { isLight } = useColorScheme();
  const [adminOpen, setAdminOpen] = useState(() => window.location.hash.startsWith('#admin'));
  const [loginRulesOpen, setLoginRulesOpen] = useState(false);
  const [skySeed, setSkySeed] = useState(() => Date.now());
  const loginRulesShownForRef = useRef<number | null>(null);

  useEffect(() => {
    setSkySeed(Date.now());
  }, [phase]);

  useEffect(() => {
    const ambientPhases = new Set(['theme', 'bet', 'result', 'profile']);
    if (ambientPhases.has(phase)) {
      audio.startAmbient();
      return () => audio.stopAmbient();
    }
    audio.stopAmbient();
    return undefined;
  }, [phase]);

  useEffect(() => {
    const onHashChange = () => setAdminOpen(window.location.hash.startsWith('#admin'));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('app--bet-scroll', phase === 'bet');
    return () => document.documentElement.classList.remove('app--bet-scroll');
  }, [phase]);

  useEffect(() => {
    if (!player || !setup) {
      return;
    }
    if (phase === 'login' || phase === 'boot') {
      loginRulesShownForRef.current = null;
      setLoginRulesOpen(false);
      return;
    }
    if (phase === 'game') {
      return;
    }
    if (isLoginRulesDismissed(player.id)) {
      return;
    }
    if (loginRulesShownForRef.current === player.id) {
      return;
    }
    loginRulesShownForRef.current = player.id;
    setLoginRulesOpen(true);
  }, [phase, player, setup]);

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
    <div className={`app app--${phase} app--sky`}>
      <div className="app__sky-layer" aria-hidden="true">
        <Sky theme={theme} seed={skySeed} fullPage stars={!isLight} />
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

      {player && setup && (
        <LoginRulesModal
          open={loginRulesOpen}
          playerId={player.id}
          setup={setup}
          theme={themeOf(theme) ?? setup.themes[0]!}
          onClose={() => setLoginRulesOpen(false)}
        />
      )}

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
