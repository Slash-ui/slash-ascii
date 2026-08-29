import type { Frame, RGB } from '../pipeline/charmap.js';
import { isBlank } from '../pipeline/charmap.js';

export interface Run {
  /** Column the run starts at. */
  start: number;
  text: string;
  fg: RGB | null;
  bg: RGB | null;
  /** True when every cell in the run paints nothing. */
  blank: boolean;
}

const same = (a: RGB | null, b: RGB | null): boolean =>
  a === b || (a !== null && b !== null && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]);

/** Groups a row into stretches sharing a colour, so markup emits one element per stretch. */
export function rowRuns(frame: Frame, y: number): Run[] {
  const runs: Run[] = [];
  for (let x = 0; x < frame.cols; x++) {
    const cell = frame.cells[y * frame.cols + x];
    const last = runs[runs.length - 1];
    if (last && same(last.fg, cell.fg) && same(last.bg, cell.bg)) {
      last.text += cell.ch;
      last.blank &&= isBlank(cell);
    } else {
      runs.push({ start: x, text: cell.ch, fg: cell.fg, bg: cell.bg, blank: isBlank(cell) });
    }
  }
  return runs;
}

export function hex(color: RGB): string {
  return '#' + color.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** Shared by the html and svg renderers, whose escaping rules are the same. */
export function escapeMarkup(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
