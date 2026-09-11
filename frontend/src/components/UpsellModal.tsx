import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { UpsellOffer } from '../api/types';
import { audio } from '../audio/AudioEngine';
import { formatNumber, pluralize } from '../utils/format';
import { Modal } from './Modal';

/**
 * Апсейл «Закрепи успех».
 *
 * Показывается один раз за сессию после достаточно крупного выигрыша. Все
 * условия показа проверяет сервер — клиент получает уже готовое предложение
 * и не может «переоткрыть» его перезагрузкой страницы.
 *
 * Окно закрывается по таймеру: предложение не должно превращаться в
 * препятствие между игроком и кнопкой «Играть снова».
 */

interface UpsellModalProps {
  offer: UpsellOffer;
  balance: number;
  onClose: () => void;
  onPurchased: (tickets: number, balance: number) => void;
}

export function UpsellModal({ offer, balance, onClose, onPurchased }: UpsellModalProps): JSX.Element {
  const [secondsLeft, setSecondsLeft] = useState(offer.popupTimeoutSeconds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          onClose();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [done, onClose]);

  const totalCost = offer.tickets * offer.price;
  const balanceAfter = Math.max(0, balance - totalCost);

  const buy = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.purchaseTickets(offer.tickets);
      audio.reward();
      setDone(true);
      onPurchased(response.totalTickets, response.balance);
      window.setTimeout(onClose, 1900);
    } catch {
      setError('Не удалось оформить покупку. Попробуйте ещё раз.');
      setBusy(false);
    }
  };

  const progress = offer.popupTimeoutSeconds > 0 ? secondsLeft / offer.popupTimeoutSeconds : 0;

  return (
    <Modal
      open
      onClose={onClose}
      tone="accent"
      title={done ? 'Билеты ваши' : 'Закрепи успех'}
      subtitle={done ? undefined : 'Обменяйте часть выигрыша на лотерейные билеты'}
      width={520}
      footer={
        done ? null : (
          <div className="upsell__foot">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
              Не сейчас
            </button>
            <button
              type="button"
              className="btn btn--primary btn--lg grow"
              onClick={() => void buy()}
              disabled={busy}
            >
              {busy ? 'Оформляем…' : `Взять за ${formatNumber(totalCost)} бонусов`}
            </button>
          </div>
        )
      }
    >
      {done ? (
        <div className="upsell__done">
          <span className="upsell__done-mark" aria-hidden="true">
            🎟
          </span>
          <p className="text-sm">
            {offer.tickets} {pluralize(offer.tickets, 'билет', 'билета', 'билетов')} добавлены в профиль.
            В прототипе покупка имитируется: тираж не проводится.
          </p>
        </div>
      ) : (
        <div className="upsell">
          <div className="upsell__tickets" aria-hidden="true">
            {Array.from({ length: Math.min(offer.tickets, 8) }, (_, index) => (
              <span key={index} className="upsell__ticket" style={{ animationDelay: `${index * 70}ms` }}>
                🎟
              </span>
            ))}
            {offer.tickets > 8 && <span className="upsell__more num">+{offer.tickets - 8}</span>}
          </div>

          <p className="text-sm">
            Удачный раунд стоит закрепить: возьмите{' '}
            <strong>
              {offer.tickets} {pluralize(offer.tickets, 'билет', 'билета', 'билетов')}
            </strong>{' '}
            из выигранных бонусов. Количество подобрано под размер вашего выигрыша и остаток баланса.
          </p>

          <dl className="upsell__terms">
            <div>
              <dt>Билетов</dt>
              <dd className="num">{offer.tickets}</dd>
            </div>
            <div>
              <dt>Цена билета</dt>
              <dd className="num">{formatNumber(offer.price)} б</dd>
            </div>
            <div>
              <dt>Итого</dt>
              <dd className="num">{formatNumber(totalCost)} б</dd>
            </div>
            <div>
              <dt>Останется</dt>
              <dd className="num">{formatNumber(balanceAfter)} б</dd>
            </div>
          </dl>

          {error && <p className="text-sm negative">{error}</p>}

          <div className="upsell__timer">
            <span className="upsell__timer-bar" style={{ transform: `scaleX(${progress})` }} />
            <span className="text-xs muted">Предложение закроется через {secondsLeft} с</span>
          </div>
        </div>
      )}
    </Modal>
  );
}
