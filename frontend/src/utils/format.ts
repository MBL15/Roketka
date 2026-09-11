/** Форматирование чисел и времени для интерфейса. */

const numberFormat = new Intl.NumberFormat('ru-RU');

export function formatNumber(value: number): string {
  return numberFormat.format(Math.round(value));
}

export function formatSigned(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value))}`;
}

/** Коэффициент всегда с двумя знаками: 2.5 -> «2.50x». */
export function formatMultiplier(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${value.toFixed(2)}x`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** Остаток времени турнира: «20 дн 04:31» либо «04:31:07». */
export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return 'завершён';
  }
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (value: number) => String(value).padStart(2, '0');

  if (days > 0) {
    return `${days} ${pluralize(days, 'день', 'дня', 'дней')} ${pad(hours)}:${pad(minutes)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function pluralize(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) {
    return many;
  }
  if (mod10 === 1) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return few;
  }
  return many;
}

export function formatPoints(value: number): string {
  return `${formatNumber(value)} ${pluralize(value, 'очко', 'очка', 'очков')}`;
}
