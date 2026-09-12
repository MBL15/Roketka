import { useEffect, useRef } from 'react';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { TAB_GROUPS, type AdminTab } from './adminSettingsSearch';

function themeTone(tab: AdminTab): 'green' | 'red' | 'global' {
  if (tab.startsWith('green-')) return 'green';
  if (tab.startsWith('red-')) return 'red';
  return 'global';
}

interface AdminTopMenuProps {
  tab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onReload: () => void;
  onReset: () => void;
  onExit: () => void;
  busy: boolean;
}

export function AdminTopMenu({
  tab,
  onTabChange,
  onReload,
  onReset,
  onExit,
  busy,
}: AdminTopMenuProps): JSX.Element {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [tab]);

  return (
    <div className="admin-header-wrap">
      <header className="crash-header admin-header">
        <div className="crash-header__brand">
          <span className="crash-header__logo" aria-hidden="true">
            ◓
          </span>
          <span className="col" style={{ gap: 0 }}>
            <span className="crash-header__name">Воздушный шар</span>
            <span className="crash-header__tag">админ-панель</span>
          </span>
        </div>

        <nav className="admin-header__nav" aria-label="Разделы настроек">
          {TAB_GROUPS.map((group) => (
            <div key={group.label} className="admin-header__group">
              <span className="admin-header__group-label">{group.label}</span>
              <div className="admin-header__tabs">
                {group.tabs.map(([key, label]) => (
                  <button
                    key={key}
                    ref={tab === key ? activeRef : undefined}
                    type="button"
                    className={`admin-header__tab admin-header__tab--${themeTone(key)}${
                      tab === key ? ' admin-header__tab--active' : ''
                    }`}
                    onClick={() => onTabChange(key)}
                    aria-current={tab === key ? 'page' : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="crash-header__actions">
          <span className="crash-header__status chip chip--positive" title="Режим администратора">
            <span className="crash-header__dot" aria-hidden="true" />
            админ
          </span>

          <button type="button" className="btn btn--ghost btn--sm" onClick={onReload} disabled={busy}>
            Обновить
          </button>
          <button type="button" className="btn btn--danger btn--sm" onClick={onReset} disabled={busy}>
            Сброс
          </button>

          <ThemeToggleButton />

          <button type="button" className="btn btn--primary btn--sm" onClick={onExit}>
            К игре
          </button>
        </div>
      </header>
    </div>
  );
}
