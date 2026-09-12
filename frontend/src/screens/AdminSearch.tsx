import { useEffect, useId, useRef, useState } from 'react';
import { adminTabLabel, searchAdminSettings, type AdminSearchEntry, type AdminTab } from './adminSettingsSearch';

interface AdminSearchProps {
  onNavigate: (entry: AdminSearchEntry) => void;
}

export function AdminSearch({ onNavigate }: AdminSearchProps): JSX.Element {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = searchAdminSettings(query, 10);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const pick = (entry: AdminSearchEntry) => {
    onNavigate(entry);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!results.length) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const entry = results[activeIndex];
      if (entry) {
        pick(entry);
      }
    }
  };

  return (
    <div className="admin-search" ref={rootRef}>
      <label className="admin-search__field">
        <span className="admin-search__icon" aria-hidden="true">
          ⌕
        </span>
        <input
          ref={inputRef}
          className="input admin-search__input"
          type="search"
          value={query}
          placeholder="RTP, бустер, alpha, демо-баланс — ищем всё"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button
            type="button"
            className="admin-search__clear"
            aria-label="Очистить поиск"
            onClick={() => {
              setQuery('');
              setOpen(false);
              inputRef.current?.focus();
            }}
          >
            ✕
          </button>
        )}
      </label>

      {open && query.trim() && (
        <div className="admin-search__panel" id={listId} role="listbox">
          {results.length === 0 ? (
            <p className="admin-search__empty text-sm muted">Ничего не найдено. Попробуйте код поля или русское название.</p>
          ) : (
            results.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`admin-search__item${index === activeIndex ? ' admin-search__item--active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(entry)}
              >
                <span className="admin-search__item-label">{entry.label}</span>
                <span className="admin-search__item-meta text-xs muted">
                  {adminTabLabel(entry.tab)}
                  {entry.code ? ` · ${entry.code}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export type { AdminTab };
