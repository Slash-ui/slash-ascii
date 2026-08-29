import type { Frame, RGB, RenderCell } from '../pipeline/charmap.js';

export type ColorMode = 'true' | '256' | 'mono';

const RESET = '\x1b[0m';
const DEFAULT_BG = '\x1b[49m';

export function renderAnsi(frame: Frame, mode: ColorMode): string {
  const lines: string[] = [];
  for (let y = 0; y < frame.rows; y++) {
    const row = frame.cells.slice(y * frame.cols, (y + 1) * frame.cols);
    lines.push(mode === 'mono' ? monoLine(row) : colorLine(row, mode));
  }
  return lines.join('\n') + '\n';
}

function monoLine(row: RenderCell[]): string {
  return trimBlanks(row)
    .map((cell) => cell.ch)
    .join('');
}

function colorLine(row: RenderCell[], mode: ColorMode): string {
  let out = '';
  let fg: string | null = null;
  let bg: string | null = null;
  let dirty = false;

  for (const cell of trimBlanks(row)) {
    const wantFg = cell.fg ? fgCode(cell.fg, mode) : null;
    const wantBg = cell.bg ? bgCode(cell.bg, mode) : null;
    if (wantFg && wantFg !== fg) {
      out += wantFg;
      fg = wantFg;
      dirty = true;
    }
    if (wantBg !== bg) {
      // Dropping a background needs an explicit default, not just a new colour.
      out += wantBg ?? DEFAULT_BG;
      bg = wantBg;
      dirty = true;
    }
    out += cell.ch;
  }

  // Reset unconditionally once anything was coloured: a pipe truncated mid-line
  // must not leave the terminal painted.
  return dirty ? out + RESET : out;
}

function trimBlanks(row: RenderCell[]): RenderCell[] {
  let end = row.length;
  while (end > 0 && row[end - 1].ch === ' ' && !row[end - 1].bg) end--;
  return row.slice(0, end);
}

function fgCode(color: RGB, mode: ColorMode): string {
  const [r, g, b] = color;
  return mode === 'true' ? `\x1b[38;2;${r};${g};${b}m` : `\x1b[38;5;${to256(r, g, b)}m`;
}

function bgCode(color: RGB, mode: ColorMode): string {
  const [r, g, b] = color;
  return mode === 'true' ? `\x1b[48;2;${r};${g};${b}m` : `\x1b[48;5;${to256(r, g, b)}m`;
}

const CUBE = [0, 95, 135, 175, 215, 255];

/**
 * The 256-colour palette has a 6x6x6 cube plus a 24-step grey ramp. The ramp is
 * much finer than the cube's grey diagonal, so near-neutral colours are worth
 * checking against both.
 */
export function to256(r: number, g: number, b: number): number {
  const cube = [r, g, b].map(nearestCubeIndex);
  const cubeColor: [number, number, number] = [CUBE[cube[0]], CUBE[cube[1]], CUBE[cube[2]]];
  const cubeIndex = 16 + 36 * cube[0] + 6 * cube[1] + cube[2];

  const grey = Math.max(0, Math.min(23, Math.round(((r + g + b) / 3 - 8) / 10)));
  const greyLevel = 8 + 10 * grey;

  const cubeDist = distance([r, g, b], cubeColor);
  const greyDist = distance([r, g, b], [greyLevel, greyLevel, greyLevel]);
  return greyDist < cubeDist ? 232 + grey : cubeIndex;
}

function nearestCubeIndex(v: number): number {
  let best = 0;
  for (let i = 1; i < CUBE.length; i++) {
    if (Math.abs(CUBE[i] - v) < Math.abs(CUBE[best] - v)) best = i;
  }
  return best;
}

function distance(a: [number, number, number], b: [number, number, number]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}
