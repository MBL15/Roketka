import { audio } from '../audio/AudioEngine';
import { useGame } from '../state/GameContext';

interface HomeButtonProps {
  className?: string;
  /** Иконка в шапке или текстовая кнопка на экране. */
  variant?: 'icon' | 'text';
  /** Вызывается перед переходом на главную (например, сброс выбора ставки). */
  onNavigate?: () => void;
}

export function HomeButton({ className = '', variant = 'text', onNavigate }: HomeButtonProps): JSX.Element {
  const { goTo } = useGame();

  const goHome = () => {
    audio.click();
    onNavigate?.();
    goTo('theme');
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        className={`btn btn--icon btn--ghost${className ? ` ${className}` : ''}`}
        onClick={goHome}
        aria-label="На главную"
        title="На главную"
      >
        <HomeIcon />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`btn btn--ghost btn--sm home-button${className ? ` ${className}` : ''}`}
      onClick={goHome}
    >
      ← Главная
    </button>
  );
}

export function HomeIcon(): JSX.Element {
  return (
    <svg className="home-button__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6h-6v6H5.5A1.5 1.5 0 0 1 4 19v-8.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
