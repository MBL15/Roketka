import { audio } from '../audio/AudioEngine';
import { useColorScheme } from '../hooks/useColorScheme';

type ThemeToggleButtonProps = {
  className?: string;
};

export function ThemeToggleButton({ className = '' }: ThemeToggleButtonProps): JSX.Element {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  const toggleTheme = () => {
    audio.click();
    toggleColorScheme();
  };

  return (
    <button
      type="button"
      className={`btn btn--icon btn--ghost${className ? ` ${className}` : ''}`}
      onClick={toggleTheme}
      aria-label={colorScheme === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему'}
      title={colorScheme === 'light' ? 'Переключить на тёмную тему' : 'Переключить на светлую тему'}
    >
      {colorScheme === 'light' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon(): JSX.Element {
  return (
    <svg className="topbar__theme-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.5 12h2.2M17.3 12h2.2M6.2 6.2l1.55 1.55M16.25 16.25l1.55 1.55M17.8 6.2l-1.55 1.55M7.75 16.25l-1.55 1.55"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon(): JSX.Element {
  return (
    <svg className="topbar__theme-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M18.5 14.2a7.2 7.2 0 0 1-9.7-9.7A7.2 7.2 0 1 0 18.5 14.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
