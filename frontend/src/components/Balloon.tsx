import { useId, type CSSProperties } from 'react';

/**
 * Воздушный шар — главный образ игры.
 *
 * Нарисован вектором, а не растровой картинкой: масштабируется без потери
 * качества от 320 до 1920 px, весит меньше килобайта и перекрашивается
 * переменными темы, поэтому красная и зелёная версии используют один компонент.
 *
 * Идентификаторы градиентов обязаны быть уникальными на весь документ: ссылка
 * url(#id) разрешается глобально, поэтому два шара с одинаковым id получили бы
 * одну заливку — на экране выбора темы красный шар выглядел бы зелёным.
 */

interface BalloonProps {
  /** Цвета берутся из темы, если не заданы явно. */
  from?: string;
  to?: string;
  size?: number;
  /** Сдувающийся шар на экране проигрыша. */
  deflated?: boolean;
  className?: string;
  title?: string;
  /** Используется для передачи параметров анимации через CSS-переменные. */
  style?: CSSProperties;
}

export function Balloon({
  from = 'var(--balloon-a)',
  to = 'var(--balloon-b)',
  size = 120,
  deflated = false,
  className,
  title,
  style,
}: BalloonProps): JSX.Element {
  // useId возвращает значение с двоеточиями (:r1:), недопустимыми в ссылке
  // url(#...) — убираем их.
  const gradientId = `balloon-${useId().replace(/:/g, '')}`;

  return (
    <svg
      className={className}
      width={size}
      height={size * 1.32}
      viewBox="0 0 100 132"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      style={{ overflow: 'visible', ...style }}
    >
      <defs>
        <radialGradient id={gradientId} cx="35%" cy="28%" r="78%">
          <stop offset="0%" stopColor={from} />
          <stop offset="62%" stopColor={to} />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0.55)" />
        </radialGradient>
        <linearGradient id={`${gradientId}-basket`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c58a4a" />
          <stop offset="100%" stopColor="#6b4423" />
        </linearGradient>
      </defs>

      {/* Купол: при проигрыше сплющивается и обвисает */}
      <path
        d={
          deflated
            ? 'M50 6c26 0 40 14 40 30 0 18-18 26-40 26S10 54 10 36C10 20 24 6 50 6z'
            : 'M50 2c25 0 42 19 42 43 0 25-19 40-30 52-5 5-7 8-12 8s-7-3-12-8C27 85 8 70 8 45 8 21 25 2 50 2z'
        }
        fill={`url(#${gradientId})`}
        style={{ transition: 'd 420ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      />

      {/* Меридианы: без них купол читается как плоское пятно */}
      {!deflated && (
        <g stroke="rgba(255, 255, 255, 0.28)" strokeWidth="1.4" fill="none">
          <path d="M50 2c-14 22-14 62 0 95" />
          <path d="M50 2c14 22 14 62 0 95" />
          <path d="M8 45c28 10 56 10 84 0" />
        </g>
      )}

      {/* Блик */}
      {!deflated && (
        <ellipse cx="34" cy="30" rx="12" ry="17" fill="rgba(255, 255, 255, 0.3)" transform="rotate(-18 34 30)" />
      )}

      {/* Стропы и гондола */}
      <g stroke="rgba(20, 14, 8, 0.6)" strokeWidth="1.2">
        <line x1="41" y1={deflated ? 60 : 100} x2="43" y2={deflated ? 70 : 110} />
        <line x1="59" y1={deflated ? 60 : 100} x2="57" y2={deflated ? 70 : 110} />
      </g>
      <rect
        x="38"
        y={deflated ? 70 : 110}
        width="24"
        height="16"
        rx="4"
        fill={`url(#${gradientId}-basket)`}
        style={{ transition: 'y 420ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      />
    </svg>
  );
}
