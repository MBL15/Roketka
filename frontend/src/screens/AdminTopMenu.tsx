import { useEffect, useRef } from 'react';
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
    <header className="admin__topmenu">
      <div className="admin__topmenu-inner">
        <div className="admin__topmenu-brand">
          <span className="admin__topmenu-logo" aria-hidden="true">
            ◓
          </span>
          <span className="admin__topmenu-title">Админ-панель</span>
        </div>

        <nav className="admin__topmenu-nav" aria-label="Разделы настроек">
          {TAB_GROUPS.map((group) => (
            <div key={group.label} className="admin__topmenu-group">
              <span className="admin__topmenu-group-label">{group.label}</span>
              <div className="admin__topmenu-links">
                {group.tabs.map(([key, label]) => (
                  <button
                    key={key}
                    ref={tab === key ? activeRef : undefined}
                    type="button"
                    className={`admin__topmenu-link admin__topmenu-link--${themeTone(key)}${
                      tab === key ? ' admin__topmenu-link--active' : ''
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

        <div className="admin__topmenu-actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onReload} disabled={busy}>
            Обновить
          </button>
          <button type="button" className="btn btn--danger btn--sm" onClick={onReset} disabled={busy}>
            Сброс
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={onExit}>
            К игре
          </button>
        </div>
      </div>
    </header>
  );
}
