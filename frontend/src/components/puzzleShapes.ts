/** Классические контуры пазла: tab — полукруглый выступ, slot — полукруглый паз. */



export const PUZZLE_SHAPE_COUNT = 6;

export const PUZZLE_VIEWBOX = '-14 -14 128 128';



export type PuzzleEdge = 'flat' | 'tab' | 'slot';



export interface PuzzleEdges {

  top: PuzzleEdge;

  right: PuzzleEdge;

  bottom: PuzzleEdge;

  left: PuzzleEdge;

}



export interface PuzzleInsets {

  top: string;

  right: string;

  bottom: string;

  left: string;

}



/**

 * Сетка 3×2.

 * Вертикаль: верх slot↓, низ tab↑.

 * Горизонталь: средняя колонка [1][4] — tab← slot→ (как на разметке пользователя).

 * [0 slot→ slot↓] [1 tab← slot→ slot↓] [2 tab← slot↓]

 * [3 tab↑ slot→] [4 tab↑ tab← slot→] [5 tab↑ tab←]

 */

export const PUZZLE_EDGES: readonly PuzzleEdges[] = [

  { top: 'flat', right: 'slot', bottom: 'slot', left: 'flat' },

  { top: 'flat', right: 'slot', bottom: 'slot', left: 'tab' },

  { top: 'flat', right: 'flat', bottom: 'slot', left: 'tab' },

  { top: 'tab', right: 'slot', bottom: 'flat', left: 'flat' },

  { top: 'tab', right: 'slot', bottom: 'flat', left: 'tab' },

  { top: 'tab', right: 'flat', bottom: 'flat', left: 'tab' },

];



const M = 12;

const F = 88;

const R = 11;



function mid(a: number, b: number): number {

  return (a + b) / 2;

}



/** Верхняя грань: слева направо. */

function topEdge(edge: PuzzleEdge): string {

  if (edge === 'flat') return `L ${F} ${M}`;

  const c = mid(M, F);

  const sweep = edge === 'tab' ? 0 : 1;

  return `L ${c - R} ${M} A ${R} ${R} 0 0 ${sweep} ${c + R} ${M} L ${F} ${M}`;

}



/** Правая грань: сверху вниз. */

function rightEdge(edge: PuzzleEdge): string {

  if (edge === 'flat') return `L ${F} ${F}`;

  const c = mid(M, F);

  const sweep = edge === 'tab' ? 1 : 0;

  return `L ${F} ${c - R} A ${R} ${R} 0 0 ${sweep} ${F} ${c + R} L ${F} ${F}`;

}



/** Нижняя грань: справа налево. */

function bottomEdge(edge: PuzzleEdge): string {

  if (edge === 'flat') return `L ${M} ${F}`;

  const c = mid(M, F);

  const sweep = edge === 'tab' ? 0 : 1;

  return `L ${c + R} ${F} A ${R} ${R} 0 0 ${sweep} ${c - R} ${F} L ${M} ${F}`;

}



/** Левая грань: снизу вверх. */

function leftEdge(edge: PuzzleEdge): string {

  if (edge === 'flat') return `L ${M} ${M}`;

  const c = mid(M, F);

  const sweep = edge === 'tab' ? 0 : 1;

  return `L ${M} ${c + R} A ${R} ${R} 0 0 ${sweep} ${M} ${c - R} L ${M} ${M}`;

}



export function buildPuzzlePath(edges: PuzzleEdges): string {

  return [

    `M ${M} ${M}`,

    topEdge(edges.top),

    rightEdge(edges.right),

    bottomEdge(edges.bottom),

    leftEdge(edges.left),

    'Z',

  ].join(' ');

}



export const PUZZLE_PATHS: readonly string[] = PUZZLE_EDGES.map(buildPuzzlePath);



export const PUZZLE_OVERLAP_X = '14.5%';

export const PUZZLE_OVERLAP_Y = '14.5%';



/** Отступ текста от «ушек» и пазов — % от ячейки карточки. */
function edgeInset(edge: PuzzleEdge): number {
  return edge === 'flat' ? 17 : 28;
}

/** Симметричные отступы — контент по центру прямоугольника фрагмента. */
export function puzzleContentInsets(shapeIndex: number): PuzzleInsets {
  const edges = PUZZLE_EDGES[Math.max(0, Math.min(PUZZLE_SHAPE_COUNT - 1, shapeIndex))]!;
  const padY = Math.max(edgeInset(edges.top), edgeInset(edges.bottom));
  const padX = Math.max(edgeInset(edges.left), edgeInset(edges.right));
  return {
    top: `${padY}%`,
    bottom: `${padY}%`,
    left: `${padX}%`,
    right: `${padX}%`,
  };
}

/** Лёгкий сдвиг для оптического центра (tab← slot→). */
export function puzzleContentOffsetX(shapeIndex: number): number {
  if (shapeIndex === 1 || shapeIndex === 4) return 5;
  return 0;
}



export interface PuzzleTintSet {
  fill: string;
  fillDeep: string;
  stroke: string;
}

/**
 * pastel / pale — светлая тема (мягкие пастели и нейтральные flex-карточки).
 * soft / deep — тёмная тема (без изменений).
 */
export type PuzzleVisualTone = 'pastel' | 'pale' | 'soft' | 'deep';

export const PUZZLE_TINTS: readonly {
  pastel: PuzzleTintSet;
  pale: PuzzleTintSet;
  soft: PuzzleTintSet;
  deep: PuzzleTintSet;
}[] = [
  {
    pastel: { fill: '#cce8d8', fillDeep: '#b8dec8', stroke: '#4a9468' },
    pale: { fill: '#cce8d8', fillDeep: '#b8dec8', stroke: '#4a9468' },
    soft: { fill: '#2f5644', fillDeep: '#254436', stroke: '#58c492' },
    deep: { fill: '#183d30', fillDeep: '#122e24', stroke: '#4ed898' },
  },
  {
    pastel: { fill: '#c8e2f4', fillDeep: '#b4d8f0', stroke: '#4a88b0' },
    pale: { fill: '#c8e2f4', fillDeep: '#b4d8f0', stroke: '#4a88b0' },
    soft: { fill: '#284860', fillDeep: '#203a4e', stroke: '#58aad8' },
    deep: { fill: '#163248', fillDeep: '#102638', stroke: '#62b8e8' },
  },
  {
    pastel: { fill: '#dcd4f0', fillDeep: '#ccc0e8', stroke: '#7868a8' },
    pale: { fill: '#dcd4f0', fillDeep: '#ccc0e8', stroke: '#7868a8' },
    soft: { fill: '#403458', fillDeep: '#322a46', stroke: '#9888c8' },
    deep: { fill: '#2c2348', fillDeep: '#201834', stroke: '#a890e8' },
  },
  {
    pastel: { fill: '#f0d0e0', fillDeep: '#e8c0d4', stroke: '#b06888' },
    pale: { fill: '#f0d0e0', fillDeep: '#e8c0d4', stroke: '#b06888' },
    soft: { fill: '#523040', fillDeep: '#402634', stroke: '#c880a0' },
    deep: { fill: '#402030', fillDeep: '#301824', stroke: '#e090b0' },
  },
  {
    pastel: { fill: '#f0e4c8', fillDeep: '#e8d8b4', stroke: '#b08838' },
    pale: { fill: '#ece6da', fillDeep: '#e2dcd0', stroke: '#a89888' },
    soft: { fill: '#443828', fillDeep: '#342c20', stroke: '#c8a858' },
    deep: { fill: '#342c1c', fillDeep: '#262014', stroke: '#d8b060' },
  },
  {
    pastel: { fill: '#cce8ec', fillDeep: '#b8dee4', stroke: '#4898a0' },
    pale: { fill: '#dce8ec', fillDeep: '#d0dfe4', stroke: '#88a0a8' },
    soft: { fill: '#244048', fillDeep: '#1a3238', stroke: '#58c0d0' },
    deep: { fill: '#143038', fillDeep: '#0e242a', stroke: '#60d0e0' },
  },
];

export function puzzleTint(shapeIndex: number, tone: PuzzleVisualTone): PuzzleTintSet {
  const palette = PUZZLE_TINTS[Math.max(0, Math.min(PUZZLE_SHAPE_COUNT - 1, shapeIndex))]!;
  return palette[tone];
}



/** z-index: правее/ниже — выступ накрывает паз соседа. */

export function puzzleStackOrder(shapeIndex: number): number {

  const col = shapeIndex % 3;

  const row = Math.floor(shapeIndex / 3);

  return col + row * 3;

}


