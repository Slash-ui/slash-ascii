import type { Frame } from '../pipeline/charmap.js';
import { hex, isInvisible, rowRuns } from './runs.js';

export interface SvgOptions {
  /** Cell width divided by cell height, matching the grid the frame was built for. */
  charAspect: number;
  fontSize: number;
  background: string | null;
  foreground: string;
}

export const SVG_DEFAULTS: SvgOptions = {
  charAspect: 0.5,
  fontSize: 16,
  background: '#0b0b0b',
  foreground: '#d4d4d4',
};

/** Monospace advance width as a fraction of the font size, close enough for every common face. */
const ADVANCE_RATIO = 0.6;

export function renderSvg(frame: Frame, opts: SvgOptions): string {
  const cellW = opts.fontSize * ADVANCE_RATIO;
  const cellH = cellW / opts.charAspect;
  const width = round(frame.cols * cellW);
  const height = round(frame.rows * cellH);

  const rects: string[] = [];
  const texts: string[] = [];

  for (let y = 0; y < frame.rows; y++) {
    const runs = rowRuns(frame, y).filter((run) => !isInvisible(run));
    if (runs.length === 0) continue;

    const spans: string[] = [];
    for (const run of runs) {
      const x = round(run.start * cellW);
      if (run.bg) {
        rects.push(
          `<rect x="${x}" y="${round(y * cellH)}" width="${round(run.text.length * cellW)}" height="${round(cellH)}" fill="${hex(run.bg)}"/>`,
        );
      }
      if (run.text.trim() === '') continue;
      const fill = run.fg ? ` fill="${hex(run.fg)}"` : '';
      // textLength pins each run to the grid even if the font's advance is not 0.6em.
      spans.push(
        `<tspan x="${x}" textLength="${round(run.text.length * cellW)}" lengthAdjust="spacingAndGlyphs"${fill}>${escapeXml(run.text)}</tspan>`,
      );
    }
    if (spans.length === 0) continue;
    // Cap height is roughly 0.7em, so half of that below the cell centre sits the text right.
    const baseline = round(y * cellH + cellH / 2 + opts.fontSize * 0.35);
    texts.push(`<text y="${baseline}">${spans.join('')}</text>`);
  }

  const background = opts.background
    ? `<rect width="100%" height="100%" fill="${opts.background}"/>\n`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="${opts.fontSize}" fill="${opts.foreground}" xml:space="preserve">
${background}${rects.join('\n')}${rects.length ? '\n' : ''}${texts.join('\n')}
</svg>
`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
