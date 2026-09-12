import { useId, type CSSProperties } from 'react';

/**
 * Воздушный шар — главный образ игры.
 *
 * Векторная графика: масштабируется без потери качества, перекрашивается
 * через from/to. id градиентов уникальны на документ (useId).
 */

interface BalloonProps {
  from?: string;
  to?: string;
  size?: number;
  deflated?: boolean;
  className?: string;
  title?: string;
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
  const uid = useId().replace(/:/g, '');
  const gradId = `balloon-${uid}`;
  const shineId = `balloon-shine-${uid}`;
  const basketId = `balloon-basket-${uid}`;
  const rimId = `balloon-rim-${uid}`;

  const envelope = deflated ? ENVELOPE_DEFLATED : ENVELOPE;
  const neckY = deflated ? 68 : 100;
  const ropeTop = deflated ? 66 : 98;
  const basketY = deflated ? 72 : 108;
  const basketH = deflated ? 12 : 16;

  return (
    <svg
      className={className ? `balloon-art ${className}` : 'balloon-art'}
      width={size}
      height={size * 1.32}
      viewBox="0 0 100 132"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      style={{ overflow: 'visible', ...style }}
    >
      <defs>
        <radialGradient id={gradId} cx="32%" cy="24%" r="82%" fx="28%" fy="20%">
          <stop offset="0%" stopColor={from} />
          <stop offset="48%" stopColor={to} />
          <stop offset="88%" stopColor={to} />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0.38)" />
        </radialGradient>
        <radialGradient id={shineId} cx="30%" cy="22%" r="38%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.72)" />
          <stop offset="55%" stopColor="rgba(255, 255, 255, 0.18)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
        </radialGradient>
        <linearGradient id={basketId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4a068" />
          <stop offset="45%" stopColor="#a87240" />
          <stop offset="100%" stopColor="#5c3a1e" />
        </linearGradient>
        <linearGradient id={rimId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a5a30" />
          <stop offset="100%" stopColor="#4a3018" />
        </linearGradient>
        <filter id={`${gradId}-shadow`} x="-30%" y="-10%" width="160%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000" floodOpacity="0.22" />
        </filter>
      </defs>

      <ellipse cx="50" cy={deflated ? 88 : 128} rx={deflated ? 16 : 14} ry="3" fill="rgba(0,0,0,0.14)" />

      <g filter={`url(#${gradId}-shadow)`}>
        <path d={envelope} fill={`url(#${gradId})`} style={{ transition: 'd 420ms cubic-bezier(0.16, 1, 0.3, 1)' }} />
        {!deflated && <path d={envelope} fill={`url(#${shineId})`} pointerEvents="none" />}

        {!deflated && (
          <g stroke="rgba(255, 255, 255, 0.32)" strokeWidth="1.15" fill="none" strokeLinecap="round">
            <path d="M50 4 C38 28 38 72 50 98" />
            <path d="M50 4 C62 28 62 72 50 98" />
            <path d="M50 4 C28 32 16 52 12 58" />
            <path d="M50 4 C72 32 84 52 88 58" />
            <path d="M14 48 C36 58 64 58 86 48" />
            <path d="M22 68 C38 74 62 74 78 68" opacity="0.65" />
          </g>
        )}

        {!deflated && (
          <>
            <path
              d={`M46 ${neckY} Q50 ${neckY + 6} 54 ${neckY} Q50 ${neckY + 3} 46 ${neckY}`}
              fill={to}
              opacity="0.85"
            />
            <ellipse cx="50" cy={neckY + 2} rx="3.2" ry="1.6" fill="rgba(0,0,0,0.18)" />
          </>
        )}

        <g stroke="rgba(35, 22, 12, 0.55)" strokeWidth="1.05" fill="none" strokeLinecap="round">
          <path d={`M43 ${ropeTop} Q44 ${ropeTop + 6} 41 ${basketY + 2}`} />
          <path d={`M47 ${ropeTop + 1} Q48 ${ropeTop + 7} 44 ${basketY + 1}`} />
          <path d={`M53 ${ropeTop + 1} Q52 ${ropeTop + 7} 56 ${basketY + 1}`} />
          <path d={`M57 ${ropeTop} Q56 ${ropeTop + 6} 59 ${basketY + 2}`} />
        </g>

        <path
          d={`M${deflated ? 40 : 36} ${basketY} L${deflated ? 60 : 64} ${basketY} L${deflated ? 58 : 60} ${basketY + basketH} L${deflated ? 42 : 40} ${basketY + basketH} Z`}
          fill={`url(#${basketId})`}
          style={{ transition: 'd 420ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
        <rect
          x={deflated ? 40 : 36}
          y={basketY}
          width={deflated ? 20 : 28}
          height="2.5"
          rx="1"
          fill={`url(#${rimId})`}
        />
        {!deflated &&
          [0, 1, 2, 3].map((i) => (
            <line
              key={i}
              x1={38}
              y1={basketY + 4 + i * 3.5}
              x2={62}
              y2={basketY + 4 + i * 3.5}
              stroke="rgba(0,0,0,0.14)"
              strokeWidth="0.8"
            />
          ))}
      </g>
    </svg>
  );
}

/** Классический купол с лёгким сужением к горловине. */
const ENVELOPE =
  'M50 3 C76 3 93 24 93 47 C93 68 84 84 70 93 C62 98 55 100 50 100 C45 100 38 98 30 93 C16 84 7 68 7 47 C7 24 24 3 50 3 Z';

/** Сплюснутый купол после краша. */
const ENVELOPE_DEFLATED =
  'M50 18 C72 18 84 32 84 46 C84 58 76 66 66 68 C58 70 54 70 50 70 C46 70 42 70 34 68 C24 66 16 58 16 46 C16 32 28 18 50 18 Z';
