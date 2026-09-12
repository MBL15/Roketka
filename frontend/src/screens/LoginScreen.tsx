import { useState, type FormEvent } from 'react';
import { CrashShell } from '../components/CrashShell';
import { useGame } from '../state/GameContext';

const DEMO_ACCOUNTS = [
  { login: 'demo', password: 'demo', note: 'демо · 5000 баллов, пополнение' },
  { login: 'judge', password: 'judge', note: 'судья · 500 баллов, без пополнения' },
  { login: 'expert', password: 'expert', note: 'админ · игра + настройки' },
];

export function LoginScreen(): JSX.Element {
  const { login, register } = useGame();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [nickname, setNickname] = useState('demo');
  const [password, setPassword] = useState('demo');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(nickname.trim(), password);
      } else {
        await register(nickname.trim(), password);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrashShell hideSidebar>
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-card__logo" aria-hidden="true">
            ◓
          </div>
          <span className="eyebrow">Столото · бонусная игра</span>
          <h1 className="h1 login__title">Воздушный&nbsp;Шар</h1>
          <p className="text-sm muted login__lead">
            Поставьте бонусные баллы, следите за коэффициентом и успейте забрать выигрыш до краха.
          </p>

          <div className="login__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={`login__tab${mode === 'login' ? ' login__tab--active' : ''}`}
              onClick={() => setMode('login')}
            >
              Вход
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={`login__tab${mode === 'register' ? ' login__tab--active' : ''}`}
              onClick={() => {
                setMode('register');
                if (nickname === 'demo' || nickname === 'judge' || nickname === 'expert') {
                  setNickname('');
                  setPassword('');
                }
              }}
            >
              Регистрация
            </button>
          </div>

          <form className="login__form" onSubmit={(event) => void submit(event)}>
            <label className="field">
              <span className="field__label">Никнейм</span>
              <input
                className="input"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                autoComplete="username"
                minLength={3}
                maxLength={24}
                required
              />
            </label>

            <label className="field">
              <span className="field__label">Пароль</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={4}
                required
              />
            </label>

            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
              {busy ? 'Проверяем…' : mode === 'login' ? 'Войти и играть' : 'Создать профиль'}
            </button>
          </form>

          <div className="login__demo">
            <span className="eyebrow">Демо-аккаунты</span>
            <div className="login__demo-list">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.login}
                  type="button"
                  className="login__demo-item"
                  onClick={() => {
                    setMode('login');
                    setNickname(account.login);
                    setPassword(account.password);
                  }}
                >
                  <strong>
                    {account.login} / {account.password}
                  </strong>
                  <span className="text-xs muted">{account.note}</span>
                </button>
              ))}
            </div>
            <p className="text-xs muted">
              Регистрация создаёт обычный игровой профиль. Демо и admin можно пополнять, судья — нет.
            </p>
          </div>
        </div>
      </div>
    </CrashShell>
  );
}

