import type { Frame, RGB } from '../pipeline/charmap.js';
import type { Run } from './runs.js';
import { rowRuns } from './runs.js';

export type ColorMode = 'true' | '256' | 'mono';

const RESET = '\x1b[0m';
const DEFAULT_BG = '\x1b[49m';

export function renderAnsi(frame: Frame, mode: ColorMode): string {
  const lines: string[] = [];
  for (let y = 0; y < frame.rows; y++) {
    const runs = visibleRuns(frame, y);
    lines.push(mode === 'mono' ? runs.map((run) => run.text).join('') : colorLine(runs, mode));
  }
  return lines.join('\n') + '\n';
}

/** Trailing blanks paint nothing, so they are dropped rather than padded out. */
function visibleRuns(frame: Frame, y: number): Run[] {
  const runs = rowRuns(frame, y);
  while (runs.length > 0 && runs[runs.length - 1].blank) runs.pop();
  const last = runs[runs.length - 1];
  if (last && last.bg === null) last.text = last.text.replace(/ +$/, '');
  return runs;
}

function colorLine(runs: Run[], mode: ColorMode): string {
  let out = '';
  let fg: string | null = null;
  let bg: string | null = null;
  let dirty = false;

  for (const run of runs) {
    if (run.text === '') continue;
    const wantFg = run.fg ? fgCode(run.fg, mode) : null;
    const wantBg = run.bg ? bgCode(run.bg, mode) : null;
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
    out += run.text;
  }

  // Reset unconditionally once anything was coloured: a pipe truncated mid-line
  // must not leave the terminal painted.
  return dirty ? out + RESET : out;
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
  const ri = nearestCubeIndex(r);
  const gi = nearestCubeIndex(g);
  const bi = nearestCubeIndex(b);
  const cubeDistance = distance(r, g, b, CUBE[ri], CUBE[gi], CUBE[bi]);

  const grey = Math.max(0, Math.min(23, Math.round(((r + g + b) / 3 - 8) / 10)));
  const level = 8 + 10 * grey;
  const greyDistance = distance(r, g, b, level, level, level);

  return greyDistance < cubeDistance ? 232 + grey : 16 + 36 * ri + 6 * gi + bi;
}

function nearestCubeIndex(v: number): number {
  let best = 0;
  for (let i = 1; i < CUBE.length; i++) {
    if (Math.abs(CUBE[i] - v) < Math.abs(CUBE[best] - v)) best = i;
  }
  return best;
}

function distance(r: number, g: number, b: number, r2: number, g2: number, b2: number): number {
  return (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
}
