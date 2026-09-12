import { useId } from 'react';

import { PUZZLE_PATHS, PUZZLE_VIEWBOX, type PuzzleVisualTone, puzzleTint } from './puzzleShapes';

interface PuzzlePieceGraphicProps {
  shapeIndex: number;
  selected?: boolean;
  boosted?: boolean;
  visualTone?: PuzzleVisualTone;
}

const SELECTED: Record<PuzzleVisualTone, { top: string; bottom: string; stroke: string }> = {
  pastel: { top: '#daf0e4', bottom: '#c8e8d4', stroke: '#38a060' },
  pale: { top: '#f4f0ea', bottom: '#eae6de', stroke: '#b0a898' },
  soft: { top: '#3a6854', bottom: '#2c5240', stroke: '#62d0a0' },
  deep: { top: '#245a44', bottom: '#184030', stroke: '#42e090' },
};

const SHINE: Record<PuzzleVisualTone, string> = {
  pastel: 'rgba(255,255,255,0.52)',
  pale: 'rgba(255,255,255,0.62)',
  soft: 'rgba(255,255,255,0.16)',
  deep: 'rgba(255,255,255,0.10)',
};

const BOOST_ORB: Record<PuzzleVisualTone, string> = {
  pastel: 'rgba(140, 100, 210, 0.28)',
  pale: 'rgba(120, 120, 130, 0.22)',
  soft: 'rgba(150, 110, 220, 0.32)',
  deep: 'rgba(140, 100, 210, 0.34)',
};

/** SVG-фрагмент пазла с классическими круглыми «ушками». */
export function PuzzlePieceGraphic({
  shapeIndex,
  selected = false,
  boosted = false,
  visualTone = 'deep',
}: PuzzlePieceGraphicProps): JSX.Element {
  const uid = useId().replace(/:/g, '');
  const path = PUZZLE_PATHS[shapeIndex] ?? PUZZLE_PATHS[0]!;
  const tint = puzzleTint(shapeIndex, visualTone);
  const gradId = `puzzle-grad-${uid}`;
  const shineId = `puzzle-shine-${uid}`;
  const selectedTint = SELECTED[visualTone];

  const fillTop = selected ? selectedTint.top : tint.fill;
  const fillBottom = selected ? selectedTint.bottom : tint.fillDeep;
  const stroke = selected ? selectedTint.stroke : tint.stroke;

  return (
    <svg
      className="puzzle__graphic"
      viewBox={PUZZLE_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradId} x1="12%" y1="8%" x2="88%" y2="92%">
          <stop offset="0%" stopColor={fillTop} />
          <stop offset="100%" stopColor={fillBottom} />
        </linearGradient>
        <radialGradient id={shineId} cx="28%" cy="22%" r="55%">
          <stop offset="0%" stopColor={SHINE[visualTone]} />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      <path
        className="puzzle__shape"
        d={path}
        fill={`url(#${gradId})`}
        stroke={stroke}
        strokeWidth={selected ? 2.2 : 1.8}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      <path className="puzzle__shape-shine" d={path} fill={`url(#${shineId})`} pointerEvents="none" />

      {boosted && (
        <circle className="puzzle__boost-orb" cx="72" cy="72" r="9" fill={BOOST_ORB[visualTone]} />
      )}
    </svg>
  );
}
