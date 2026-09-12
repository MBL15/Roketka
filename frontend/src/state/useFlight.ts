import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { CashoutResult } from '../api/types';
import { gameSocket } from '../api/socket';
import { audio } from '../audio/AudioEngine';
import { baseMultiplierAt, levelsPassedAt, quantizeDown, type Flight } from './flight';

/**
 * Состояние летящего шара.
 *
 * Разделение обязанностей здесь такое же, как между сервером и клиентом:
 *
 *  - коэффициент клиент считает сам, каждый кадр, по той же формуле
 *    m(t) = exp(rate · t) и по времени старта раунда. Поэтому анимация идёт
 *    в 60 FPS независимо от частоты серверных тиков, а расхождение не
 *    накапливается: обе стороны опираются на одну точку отсчёта;
 *  - всё, что влияет на деньги и очки — прохождение уровней, срабатывание
 *    бустера, фиксация выигрыша, крах — приходит с сервера и только
 *    применяется. Локальный подсчёт уровней нужен лишь для мгновенной
 *    подсветки, начисленные очки берутся из события.
 *
 * Если WebSocket недоступен, включается опрос REST раз в 700 мс: механика
 * остаётся рабочей, теряется только плавность подсветки.
 */

export interface FlightState {
  baseMultiplier: number;
  multiplier: number;
  levelsPassed: number;
  boostApplied: boolean;
  boostLevel: number | null;
  points: number;
  cashedOut: boolean;
  cashoutMultiplier: number | null;
  payout: number;
  crashed: boolean;
  crashMultiplier: number | null;
  /** Всплывающие «+X» над коэффициентом. */
  popups: Popup[];
  /** Вспышка при срабатывании бустера. */
  boostFlash: number;
}

export interface Popup {
  id: number;
  text: string;
  kind: 'points' | 'boost';
}

const POLL_INTERVAL_MS = 700;
const POPUP_LIFETIME_MS = 1400;

export function useFlight(
  flight: Flight,
  onFinished: () => void,
  autoCashoutMultiplier: number | null = null,
  onCashout?: (result: CashoutResult) => void,
): FlightState & { cashout: () => void } {
  const [state, setState] = useState<FlightState>(() => initialState(flight));

  const finishedRef = useRef(false);
  const popupSeq = useRef(0);
  // Сколько уровней уже озвучено локально: не даёт повторить звук на том же
  // уровне, когда серверный тик и локальная экстраполяция расходятся на кадр.
  const announcedLevel = useRef(flight.initialLevelsPassed);

  const pushPopup = useCallback((text: string, kind: Popup['kind']) => {
    popupSeq.current += 1;
    const id = popupSeq.current;
    setState((current) => ({ ...current, popups: [...current.popups, { id, text, kind }] }));
    window.setTimeout(() => {
      setState((current) => ({ ...current, popups: current.popups.filter((popup) => popup.id !== id) }));
    }, POPUP_LIFETIME_MS);
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    onFinished();
  }, [onFinished]);

  // --- локальная экстраполяция коэффициента -------------------------------
  useEffect(() => {
    let frame = 0;

    const render = () => {
      setState((current) => {
        if (current.crashed) {
          return current;
        }
        const base = baseMultiplierAt(flight, Date.now());
        const displayed = current.boostApplied
          ? quantizeDown(base * flight.boostValue, flight.delta)
          : base;
        const passed = Math.max(current.levelsPassed, levelsPassedAt(base, flight.levelMultipliers));

        if (base === current.baseMultiplier && passed === current.levelsPassed) {
          return current;
        }
        return { ...current, baseMultiplier: base, multiplier: displayed, levelsPassed: passed };
      });
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [flight]);

  // --- события сервера ----------------------------------------------------
  useEffect(() => {
    const unsubscribe = gameSocket.onMessage((message) => {
      if ('roundId' in message && message.roundId !== flight.roundId) {
        return;
      }

      switch (message.type) {
        case 'round.tick':
          setState((current) =>
            current.crashed
              ? current
              : {
                  ...current,
                  points: Math.max(current.points, message.points),
                  levelsPassed: Math.max(current.levelsPassed, message.levelsPassed),
                  boostApplied: current.boostApplied || message.boostApplied,
                },
          );
          break;

        case 'round.level':
          if (message.level > announcedLevel.current) {
            announcedLevel.current = message.level;
            audio.levelUp(message.level, message.levelCount);
            if (message.pointsAwarded > 0) {
              pushPopup(`+${message.pointsAwarded}`, 'points');
            }
          }
          setState((current) => ({
            ...current,
            levelsPassed: Math.max(current.levelsPassed, message.level),
            points: Math.max(current.points, message.totalPoints),
          }));
          break;

        case 'round.boost':
          audio.boost(flight.boostTier);
          pushPopup(`×${message.boostValue.toFixed(0)}`, 'boost');
          setState((current) => ({
            ...current,
            boostApplied: true,
            boostLevel: message.level,
            points: Math.max(current.points, message.totalPoints),
            boostFlash: current.boostFlash + 1,
          }));
          break;

        case 'round.cashout':
          setState((current) => ({
            ...current,
            cashedOut: true,
            cashoutMultiplier: message.multiplier,
            payout: message.payout,
            points: Math.max(current.points, message.totalPoints),
          }));
          break;

        case 'round.crash':
          audio.crash();
          setState((current) => ({
            ...current,
            crashed: true,
            crashMultiplier: message.crashMultiplier,
            multiplier: message.crashMultiplier,
          }));
          // Даём доиграть анимации хлопка, затем открываем результат.
          window.setTimeout(finish, 900);
          break;

        default:
          break;
      }
    });

    return unsubscribe;
  }, [flight, finish, pushPopup]);

  // --- резервный опрос, если сокет недоступен -----------------------------
  useEffect(() => {
    let timer = 0;
    let cancelled = false;

    const poll = async () => {
      if (cancelled || gameSocket.currentStatus === 'open') {
        return;
      }
      try {
        const snapshot = await api.roundState(flight.roundId);
        if (cancelled || !snapshot) {
          return;
        }
        if (snapshot.status === 'FLYING' || snapshot.status === 'CASHED_OUT') {
          setState((current) => ({
            ...current,
            levelsPassed: Math.max(current.levelsPassed, snapshot.levelsPassed),
            points: Math.max(current.points, snapshot.points),
            boostApplied: current.boostApplied || snapshot.boostApplied,
            boostLevel: snapshot.boostLevel ?? current.boostLevel,
            cashedOut: current.cashedOut || snapshot.status === 'CASHED_OUT',
            cashoutMultiplier: snapshot.cashoutMultiplier ?? current.cashoutMultiplier,
            payout: snapshot.payout || current.payout,
          }));
        } else {
          setState((current) => ({
            ...current,
            crashed: true,
            crashMultiplier: snapshot.baseMultiplier,
            multiplier: snapshot.baseMultiplier,
          }));
          window.setTimeout(finish, 600);
        }
      } catch {
        /* сеть моргнула — следующая попытка через интервал */
      }
    };

    timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [flight.roundId, finish]);

  // --- предохранитель -----------------------------------------------------
  useEffect(() => {
    // Если и сокет, и опрос молчат, раунд всё равно не может длиться вечно:
    // сервер ограничивает полёт maxFlightSeconds. Берём заведомо больший срок
    // и уводим игрока на экран результата, чтобы он не завис в полёте.
    const elapsed = Date.now() + flight.clockOffsetMillis - flight.startedAtMillis;
    const timer = window.setTimeout(finish, Math.max(5_000, 120_000 - elapsed));
    return () => window.clearTimeout(timer);
  }, [flight, finish]);

  const autoTriggered = useRef(false);

  const cashout = useCallback(() => {
    setState((current) => {
      if (current.cashedOut || current.crashed) {
        return current;
      }
      // Оптимистично гасим кнопку, но сумму показываем только ту, что вернёт
      // сервер: расчёт выплаты — не дело клиента.
      return { ...current, cashedOut: true };
    });

    void api
      .cashout(flight.roundId)
      .then((result) => {
        audio.cashout();
        onCashout?.(result);
        setState((current) => ({
          ...current,
          cashedOut: true,
          cashoutMultiplier: result.multiplier,
          payout: result.payout,
          points: Math.max(current.points, result.totalPoints),
        }));
      })
      .catch(() => {
        // Сервер отказал (шар уже лопнул или уровень 1 не пройден) —
        // возвращаем кнопку, состояние всё равно придёт событием.
        setState((current) => (current.cashoutMultiplier === null ? { ...current, cashedOut: false } : current));
      });
  }, [flight.roundId, onCashout]);

  // Автозабор: срабатывает после первого уровня, когда коэффициент достиг цели.
  useEffect(() => {
    if (autoCashoutMultiplier === null || autoTriggered.current) {
      return;
    }
    if (state.cashedOut || state.crashed || state.levelsPassed < 1) {
      return;
    }
    if (state.multiplier >= autoCashoutMultiplier) {
      autoTriggered.current = true;
      cashout();
    }
  }, [
    autoCashoutMultiplier,
    cashout,
    state.cashedOut,
    state.crashed,
    state.levelsPassed,
    state.multiplier,
  ]);

  return { ...state, cashout };
}

function initialState(flight: Flight): FlightState {
  const base = baseMultiplierAt(flight, Date.now());
  return {
    baseMultiplier: base,
    multiplier: flight.initialBoostApplied ? quantizeDown(base * flight.boostValue, flight.delta) : base,
    levelsPassed: flight.initialLevelsPassed,
    boostApplied: flight.initialBoostApplied,
    boostLevel: flight.boostLevel,
    points: flight.initialPoints,
    cashedOut: flight.initialCashoutMultiplier !== null,
    cashoutMultiplier: flight.initialCashoutMultiplier,
    payout: flight.initialPayout,
    crashed: false,
    crashMultiplier: null,
    popups: [],
    boostFlash: 0,
  };
}
