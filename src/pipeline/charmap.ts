import type { AnalysedGrid } from './analyze.js';
import type { Raster } from './decode.js';

export type RGB = readonly [number, number, number];

export interface RenderCell {
  ch: string;
  fg: RGB | null;
  bg: RGB | null;
}

export interface Frame {
  cols: number;
  rows: number;
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

const BLANK: RenderCell = { ch: ' ', fg: null, bg: null };

export interface CharmapOptions {
  charset: Charset;
  ramp: string;
  invert: boolean;
  color: boolean;
  /** Edge-aware character selection. */
  edges: boolean;
  /**
   * Floor on mean gradient magnitude. Stops a photograph of a wall from being
   * drawn entirely out of its own faint texture.
   */
  edgeThreshold: number;
  /**
   * Share of cells that stay tonal. A fixed magnitude cutoff cannot serve both a
   * line drawing and a photograph, so the working cutoff is drawn from the
   * image's own distribution and only floored by `edgeThreshold`.
   */
  edgeQuantile: number;
  /** How much the gradients in a cell must agree before its angle is trusted. */
  edgeCoherence: number;
  /** Cells with less coverage than this become blanks. */
  alphaCutoff: number;
}

export const CHARMAP_DEFAULTS = {
  charset: 'ascii',
  ramp: RAMPS.standard,
  invert: false,
  color: true,
  edges: true,
  edgeThreshold: 0.09,
  edgeQuantile: 0.85,
  edgeCoherence: 0.5,
  alphaCutoff: 0.5,
} as const satisfies CharmapOptions;

export function mapGrid(grid: AnalysedGrid, opts: CharmapOptions): Frame {
  const cutoff = opts.edges ? edgeCutoff(grid, opts) : Infinity;
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
  return { cols: grid.cols, rows: grid.rows, cells };
}

function edgeCutoff(grid: AnalysedGrid, opts: CharmapOptions): number {
  const sorted = grid.cells.map((cell) => cell.edge).sort((a, b) => a - b);
  const quantile = sorted[Math.floor(opts.edgeQuantile * (sorted.length - 1))];
  return Math.max(opts.edgeThreshold, quantile);
}

function asciiCell(
  grid: AnalysedGrid,
  index: number,
  opts: CharmapOptions,
  cutoff: number,
): RenderCell {
  const cell = grid.cells[index];
  if (cell.alpha < opts.alphaCutoff) return BLANK;

  const isEdge = cell.edge >= cutoff && cell.coherence >= opts.edgeCoherence;
  const ch = isEdge ? edgeChar(cell.angle) : rampChar(cell.lum, opts);
  if (ch === ' ') return BLANK;
  return { ch, fg: opts.color ? rgb(cell.r, cell.g, cell.b) : null, bg: null };
}

function edgeChar(angle: number): string {
  return EDGE_CHARS[Math.round(angle / (Math.PI / 4)) % 4];
}

function rampChar(lum: number, opts: CharmapOptions): string {
  const level = opts.invert ? 1 - lum : lum;
  const i = Math.floor(level * opts.ramp.length);
  return opts.ramp[Math.min(opts.ramp.length - 1, Math.max(0, i))];
}

/**
 * Half blocks give a cell two independently coloured halves, which doubles
 * vertical resolution. Without colour there are no halves to distinguish, so
 * the shade ramp stands in.
 */
function blockCell(grid: AnalysedGrid, x: number, y: number, opts: CharmapOptions): RenderCell {
  if (!opts.color) {
    const cell = grid.cells[y * grid.cols + x];
    if (cell.alpha < opts.alphaCutoff) return BLANK;
    const ch = rampChar(cell.lum, { ...opts, ramp: RAMPS.shades });
    return ch === ' ' ? BLANK : { ch, fg: null, bg: null };
  }

  const sub = grid.sub;
  const half = Math.max(1, Math.floor(sub / 2));
  const x0 = x * sub;
  const y0 = y * sub;
  const top = regionMean(grid.detail, x0, y0, sub, half);
  const bottom = regionMean(grid.detail, x0, y0 + half, sub, sub - half);

  const topVisible = top.alpha >= opts.alphaCutoff;
  const bottomVisible = bottom.alpha >= opts.alphaCutoff;
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

function brailleCell(grid: AnalysedGrid, x: number, y: number, opts: CharmapOptions): RenderCell {
  const cell = grid.cells[y * grid.cols + x];
  if (cell.alpha < opts.alphaCutoff) return BLANK;

  const sub = grid.sub;
  const x0 = x * sub;
  const y0 = y * sub;
  // Dot bits are numbered 1,2,3,7 down the left column and 4,5,6,8 down the right.
  const bits = [0x01, 0x02, 0x04, 0x40, 0x08, 0x10, 0x20, 0x80];
  let pattern = 0;

  for (let dx = 0; dx < 2; dx++) {
    for (let dy = 0; dy < 4; dy++) {
      const sx = x0 + Math.floor((dx * sub) / 2);
      const sy = y0 + Math.floor((dy * sub) / 4);
      const w = Math.max(1, Math.floor(sub / 2));
      const h = Math.max(1, Math.floor(sub / 4));
      const region = regionMean(grid.detail, sx, sy, w, h);
      if (region.alpha < opts.alphaCutoff) continue;
      const level = opts.invert ? 1 - region.lum : region.lum;
      if (level > BAYER4[(dy % 4) * 4 + ((x * 2 + dx) % 4)]) pattern |= bits[dx * 4 + dy];
    }
  }

  if (pattern === 0) return BLANK;
  return {
    ch: String.fromCharCode(0x2800 + pattern),
    fg: opts.color ? rgb(cell.r, cell.g, cell.b) : null,
    bg: null,
  };
}

interface RegionMean {
  r: number;
  g: number;
  b: number;
  alpha: number;
  lum: number;
}

function regionMean(detail: Raster, x0: number, y0: number, w: number, h: number): RegionMean {
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let sa = 0;
  let n = 0;
  for (let y = y0; y < y0 + h && y < detail.height; y++) {
    for (let x = x0; x < x0 + w && x < detail.width; x++) {
      const p = (y * detail.width + x) * 4;
      const a = detail.data[p + 3] / 255;
      sr += detail.data[p] * a;
      sg += detail.data[p + 1] * a;
      sb += detail.data[p + 2] * a;
      sa += a;
      n++;
    }
  }
  if (n === 0) return { r: 0, g: 0, b: 0, alpha: 0, lum: 0 };
  const weight = sa > 0 ? sa : 1;
  const r = sr / weight;
  const g = sg / weight;
  const b = sb / weight;
  return { r, g, b, alpha: sa / n, lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 };
}

function rgb(r: number, g: number, b: number): RGB {
  return [Math.round(r), Math.round(g), Math.round(b)];
}
