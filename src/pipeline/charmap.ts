import type { AnalysedGrid } from './analyze.js';
import { regionMean } from './analyze.js';

export type RGB = readonly [number, number, number];

export interface RenderCell {
  ch: string;
  fg: RGB | null;
  bg: RGB | null;
}

export interface Frame {
  cols: number;
  rows: number;
  /** Cell width divided by cell height, for renderers that lay out their own grid. */
  charAspect: number;
  cells: RenderCell[];
}

export type Charset = 'ascii' | 'blocks' | 'braille';

export const RAMPS = {
  /** Ten steps. Reads well at small sizes and in most fonts. */
  standard: ' .:-=+*#%@',
  /** Sorted by ink coverage. More tonal range, needs a bigger canvas to pay off. */
  detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  /** Unicode shade blocks, used when half-block mode has no colour to work with. */
  shades: ' ░▒▓█',
} as const;

/** Ordered by orientation: 0, 45, 90, 135 degrees, with y pointing down. */
const EDGE_CHARS = ['-', '\\', '|', '/'] as const;

/**
 * Floor on mean gradient magnitude. Stops a photograph of a wall from being
 * drawn entirely out of its own faint texture.
 */
const EDGE_FLOOR = 0.09;

/**
 * Share of cells that stay tonal. A fixed magnitude cutoff cannot serve both a
 * line drawing and a photograph, so the working cutoff is drawn from the image's
 * own distribution and only floored by EDGE_FLOOR.
 */
const EDGE_QUANTILE = 0.85;

/** How much the gradients in a cell must agree before its angle is trusted. */
const EDGE_COHERENCE = 0.5;

/** Cells with less coverage than this become blanks. */
const ALPHA_CUTOFF = 0.5;

const BLANK: RenderCell = { ch: ' ', fg: null, bg: null };

/**
 * The one definition of "this cell paints nothing", shared by every renderer.
 * They each used to re-derive it by sniffing the character, which would quietly
 * stop working the day a charset picks a different empty glyph.
 */
export function isBlank(cell: RenderCell): boolean {
  return cell.bg === null && cell.ch === ' ';
}

export interface CharmapOptions {
  charset: Charset;
  ramp: string;
  invert: boolean;
  color: boolean;
  /** Edge-aware character selection. Requires a grid analysed with gradients. */
  edges: boolean;
}

export function mapGrid(grid: AnalysedGrid, opts: CharmapOptions): Frame {
  const cutoff = opts.edges ? edgeCutoff(grid) : Infinity;
  const cells: RenderCell[] = new Array(grid.cols * grid.rows);
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      const i = y * grid.cols + x;
      cells[i] =
        opts.charset === 'blocks'
          ? blockCell(grid, x, y, opts)
          : opts.charset === 'braille'
            ? brailleCell(grid, x, y, opts)
            : asciiCell(grid, i, opts, cutoff);
    }
  }
  return { cols: grid.cols, rows: grid.rows, charAspect: grid.charAspect, cells };
}

function edgeCutoff(grid: AnalysedGrid): number {
  const sorted = grid.cells.map((cell) => cell.edge).sort((a, b) => a - b);
  return Math.max(EDGE_FLOOR, sorted[Math.floor(EDGE_QUANTILE * (sorted.length - 1))]);
}

function asciiCell(
  grid: AnalysedGrid,
  index: number,
  opts: CharmapOptions,
  cutoff: number,
): RenderCell {
  const cell = grid.cells[index];
  if (cell.alpha < ALPHA_CUTOFF) return BLANK;

  const isEdge = cell.edge >= cutoff && cell.coherence >= EDGE_COHERENCE;
  const ch = isEdge ? edgeChar(cell.angle) : rampChar(cell.lum, opts.ramp, opts.invert);
  if (ch === ' ') return BLANK;
  return { ch, fg: opts.color ? rgb(cell.r, cell.g, cell.b) : null, bg: null };
}

function edgeChar(angle: number): string {
  return EDGE_CHARS[Math.round(angle / (Math.PI / 4)) % 4];
}

function rampChar(lum: number, ramp: string, invert: boolean): string {
  const level = invert ? 1 - lum : lum;
  const i = Math.floor(level * ramp.length);
  return ramp[Math.min(ramp.length - 1, Math.max(0, i))];
}

/**
 * Half blocks give a cell two independently coloured halves, which doubles
 * vertical resolution. Without colour there are no halves to distinguish, so
 * the shade ramp stands in.
 */
function blockCell(grid: AnalysedGrid, x: number, y: number, opts: CharmapOptions): RenderCell {
  const sub = grid.sub;
  const x0 = x * sub;
  const y0 = y * sub;

  if (!opts.color) {
    const cell = grid.cells[y * grid.cols + x];
    if (cell.alpha < ALPHA_CUTOFF) return BLANK;
    const ch = rampChar(cell.lum, RAMPS.shades, opts.invert);
    return ch === ' ' ? BLANK : { ch, fg: null, bg: null };
  }

  const half = Math.max(1, Math.floor(sub / 2));
  const top = regionMean(grid.detail, x0, y0, sub, half);
  const bottom = regionMean(grid.detail, x0, y0 + half, sub, sub - half);

  const topVisible = top.alpha >= ALPHA_CUTOFF;
  const bottomVisible = bottom.alpha >= ALPHA_CUTOFF;
  if (!topVisible && !bottomVisible) return BLANK;
  if (topVisible && !bottomVisible) return { ch: '▀', fg: rgb(top.r, top.g, top.b), bg: null };
  if (!topVisible && bottomVisible) return { ch: '▄', fg: rgb(bottom.r, bottom.g, bottom.b), bg: null };
  return {
    ch: '▀',
    fg: rgb(top.r, top.g, top.b),
    bg: rgb(bottom.r, bottom.g, bottom.b),
  };
}

/**
 * 4x4 ordered dither. Braille is one bit per dot, so tone has to come from dot
 * density. Thresholds are spread over 1/17..16/17 rather than 0..1 so that black
 * stays fully empty and white stays fully filled; the usual (i + 0.5)/16 form
 * speckles a dot into every dark cell.
 */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 1) / 17);

/** Dot bits are numbered 1,2,3,7 down the left column and 4,5,6,8 down the right. */
const BRAILLE_BITS = [0x01, 0x02, 0x04, 0x40, 0x08, 0x10, 0x20, 0x80];

function brailleCell(grid: AnalysedGrid, x: number, y: number, opts: CharmapOptions): RenderCell {
  const cell = grid.cells[y * grid.cols + x];
  if (cell.alpha < ALPHA_CUTOFF) return BLANK;

  const sub = grid.sub;
  const x0 = x * sub;
  const y0 = y * sub;
  const dotW = Math.max(1, Math.floor(sub / 2));
  const dotH = Math.max(1, Math.floor(sub / 4));
  let pattern = 0;

  for (let dx = 0; dx < 2; dx++) {
    for (let dy = 0; dy < 4; dy++) {
      const region = regionMean(
        grid.detail,
        x0 + Math.floor((dx * sub) / 2),
        y0 + Math.floor((dy * sub) / 4),
        dotW,
        dotH,
      );
      if (region.alpha < ALPHA_CUTOFF) continue;
      const level = opts.invert ? 1 - region.lum : region.lum;
      if (level > BAYER4[dy * 4 + ((x * 2 + dx) % 4)]) pattern |= BRAILLE_BITS[dx * 4 + dy];
    }
  }

  if (pattern === 0) return BLANK;
  return {
    ch: String.fromCharCode(0x2800 + pattern),
    fg: opts.color ? rgb(cell.r, cell.g, cell.b) : null,
    bg: null,
  };
}

function rgb(r: number, g: number, b: number): RGB {
  return [Math.round(r), Math.round(g), Math.round(b)];
}
