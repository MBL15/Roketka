import type { KeyboardEvent, ReactNode } from 'react';
import { useColorScheme } from '../hooks/useColorScheme';
import { PuzzlePieceGraphic } from './PuzzlePieceGraphic';
import {
  type PuzzleVisualTone,
  puzzleContentInsets,
  puzzleContentOffsetX,
  puzzleStackOrder,
} from './puzzleShapes';

interface PuzzleShellProps {
  shapeIndex: number;
  selected?: boolean;
  locked?: boolean;
  boosted?: boolean;
  flex?: boolean;
  custom?: boolean;
  children: ReactNode;
  className?: string;
  as?: 'button' | 'div';
  ariaLabel?: string;
  ariaPressed?: boolean;
  onClick?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * Оболочка фрагмента пазла: SVG-форма с «ушками» и содержимое карточки.
 */
export function PuzzleShell({
  shapeIndex,
  selected = false,
  locked = false,
  boosted = false,
  flex = false,
  custom = false,
  children,
  className = '',
  as = 'button',
  ariaLabel,
  ariaPressed,
  onClick,
  onKeyDown,
}: PuzzleShellProps): JSX.Element {
  const { isLight } = useColorScheme();
  // Светлая тема: пастель + светлые flex-карточки. Тёмная — без изменений.
  const visualTone: PuzzleVisualTone = isLight ? (flex ? 'pale' : 'pastel') : flex ? 'deep' : 'soft';
  const insets = puzzleContentInsets(shapeIndex);
  const offsetX = puzzleContentOffsetX(shapeIndex);
  const stackOrder = puzzleStackOrder(shapeIndex);
  const classes = [
    'puzzle',
    `puzzle--shape-${shapeIndex}`,
    selected ? 'puzzle--selected' : '',
    locked ? 'puzzle--locked' : '',
    boosted ? 'puzzle--boosted' : '',
    flex ? 'puzzle--flex' : '',
    custom ? 'puzzle--custom' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <PuzzlePieceGraphic
        shapeIndex={shapeIndex}
        selected={selected}
        boosted={boosted}
        visualTone={visualTone}
      />
      <span
        className="puzzle__content"
        style={{
          paddingTop: insets.top,
          paddingRight: insets.right,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          transform: offsetX ? `translateX(${offsetX}px)` : undefined,
        }}
      >
        {children}
      </span>
    </>
  );

  if (as === 'div') {
    return (
      <div
        className={classes}
        data-puzzle-tone={visualTone}
        style={{ zIndex: selected ? stackOrder + 10 : stackOrder }}
        onClick={onClick}
        onKeyDown={onKeyDown}
        role={onClick ? 'button' : 'group'}
        tabIndex={onClick && !locked ? 0 : undefined}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      data-puzzle-tone={visualTone}
      style={{ zIndex: selected ? stackOrder + 10 : stackOrder }}
      onClick={onClick}
      aria-pressed={ariaPressed}
      aria-label={ariaLabel}
    >
      {content}
    </button>
  );
}
