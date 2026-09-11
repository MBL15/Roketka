import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Модальное окно.
 *
 * Закрывается щелчком вне окна, клавишей Escape и свайпом вниз на сенсорных
 * экранах — постановка требует именно этих способов для турнирной таблицы.
 * Пока окно открыто, прокрутка страницы под ним блокируется, иначе на
 * мобильных фон «уезжает» вместе с жестом.
 */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  tone?: 'default' | 'accent';
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 620,
  tone = 'default',
}: ModalProps): JSX.Element | null {
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={sheetRef}
        className={`modal__sheet panel panel--strong${tone === 'accent' ? ' modal__sheet--accent' : ''}`}
        style={{ maxWidth: width }}
        onTouchStart={(event) => {
          touchStartY.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartY.current;
          const end = event.changedTouches[0]?.clientY;
          if (start !== null && end !== undefined && end - start > 90) {
            onClose();
          }
          touchStartY.current = null;
        }}
      >
        <header className="modal__head">
          <div className="modal__grip" aria-hidden="true" />
          <div className="grow">
            <h2 className="h2">{title}</h2>
            {subtitle && <p className="text-sm muted modal__subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="btn btn--icon btn--ghost" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </header>

        <div className="modal__body">{children}</div>

        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  );
}
