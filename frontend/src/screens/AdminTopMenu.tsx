import { useEffect, useRef } from 'react';
import { HomeIcon } from '../components/HomeButton';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { TAB_GROUPS, type AdminTab } from './adminSettingsSearch';

function themeTone(tab: AdminTab): 'green' | 'red' | 'global' {
  if (tab.startsWith('green-')) return 'green';
  if (tab.startsWith('red-')) return 'red';
  return 'global';
}

function groupTone(label: string): 'green' | 'red' | 'global' {
  if (label.includes('Зелёный')) return 'green';
  if (label.includes('Красный')) return 'red';
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
  let tabCounter = 0;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [tab]);

  return (
    <aside className="admin-sidebar" aria-label="Навигация админ-панели">
      <div className="admin-sidebar__brand">
        <span className="admin-sidebar__mark" aria-hidden="true">
          ◓
        </span>
        <span className="admin-sidebar__title">Воздушный шар</span>
        <span className="admin-sidebar__tag">панель управления · v1</span>
        <span className="admin-sidebar__status">
          <span className="admin-sidebar__status-dot" aria-hidden="true" />
          live
        </span>
      </div>

      <nav className="admin-sidebar__nav" aria-label="Разделы настроек">
        {TAB_GROUPS.map((group) => (
          <div
            key={group.label}
            className={`admin-sidebar__group admin-sidebar__group--${groupTone(group.label)}`}
          >
            <span className="admin-sidebar__group-label">{group.label}</span>
            <div className="admin-sidebar__tabs">
              {group.tabs.map(([key, label]) => {
                tabCounter += 1;
                const num = tabCounter;
                return (
                  <button
                    key={key}
                    ref={tab === key ? activeRef : undefined}
                    type="button"
                    className={`admin-sidebar__tab admin-sidebar__tab--${themeTone(key)}${
                      tab === key ? ' admin-sidebar__tab--active' : ''
                    }`}
                    onClick={() => onTabChange(key)}
                    aria-current={tab === key ? 'page' : undefined}
                  >
                    <span className="admin-sidebar__tab-num">{String(num).padStart(2, '0')}</span>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="admin-sidebar__foot">
        <div className="admin-sidebar__actions">
          <button type="button" className="btn btn--ghost" onClick={onReload} disabled={busy}>
            Обновить
          </button>
          <button type="button" className="btn btn--danger" onClick={onReset} disabled={busy}>
            Сброс
          </button>
        </div>
        <div className="admin-sidebar__actions-row">
          <ThemeToggleButton />
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onExit}
            aria-label="К игре"
            title="К игре"
          >
            <HomeIcon />
            <span style={{ marginLeft: 6 }}>К игре</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
