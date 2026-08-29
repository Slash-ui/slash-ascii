import type { Frame } from '../pipeline/charmap.js';

/** Characters only. Colour is dropped rather than encoded. */
export function renderText(frame: Frame): string {
  const lines: string[] = [];
  for (let y = 0; y < frame.rows; y++) {
    const row = frame.cells.slice(y * frame.cols, (y + 1) * frame.cols);
    lines.push(row.map((cell) => cell.ch).join('').replace(/\s+$/, ''));
  }
  return lines.join('\n') + '\n';
}
