import { useGame } from '../state/GameContext';

/**
 * Уведомления.
 *
 * Используются там, где постановка требует явной обратной связи на
 * невозможное действие — например, сообщение «Не хватает бонусов» при попытке
 * выбрать недоступный по балансу фрагмент.
 */
export function Toasts(): JSX.Element {
  const { toasts, dismissToast } = useGame();

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`toast toast--${toast.tone} animate-in`}
          onClick={() => dismissToast(toast.id)}
        >
          <span className="toast__mark" aria-hidden="true">
            {toast.tone === 'error' ? '!' : toast.tone === 'success' ? '✓' : toast.tone === 'boost' ? '×' : 'i'}
          </span>
          <span className="grow">
            <strong className="toast__title">{toast.title}</strong>
            {toast.body && <span className="toast__body">{toast.body}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
