import { useEffect, useState } from 'react';

/** Локальный обратный отсчёт — сервер отдаёт secondsLeft только при загрузке. */
export function useCountdown(initialSeconds: number, active: boolean): number {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const tick = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [active]);

  return active ? secondsLeft : 0;
}
