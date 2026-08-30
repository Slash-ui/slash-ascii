import type { Sharp } from 'sharp';
import type { Raster, Size } from '../raster.js';
import { rasterize } from './decode.js';

export interface Grid {
  cols: number;
  rows: number;
  /** The cell geometry this grid was fitted for, carried so renderers need not be told again. */
  charAspect: number;
}

export interface FitOptions {
  width?: number;
  height?: number;
  /** Cell width divided by cell height. Terminal cells are about twice as tall as wide. */
  charAspect: number;
  terminalCols?: number;
}

/** Used when no width is given and there is no terminal to measure. */
export const FALLBACK_COLS = 80;

/**
 * Characters are not square, so the row count has to be scaled by the cell
 * aspect or everything comes out stretched vertically.
 */
export function fitGrid(image: Size, opts: FitOptions): Grid {
  const aspect = image.height / image.width;
  const { width, height, charAspect } = opts;

  if (width && height) return clamp(width, height, charAspect);
  if (width) return clamp(width, Math.round(width * aspect * charAspect), charAspect);
  if (height) return clamp(Math.round(height / aspect / charAspect), height, charAspect);

  const cols = opts.terminalCols ?? FALLBACK_COLS;
  return clamp(cols, Math.round(cols * aspect * charAspect), charAspect);
}

function clamp(cols: number, rows: number, charAspect: number): Grid {
  return { cols: Math.max(1, cols), rows: Math.max(1, rows), charAspect };
}

/** Bounds an image to a maximum edge length without enlarging it. */
export function limit(img: Sharp, maxEdge: number): Sharp {
  return img.resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true });
}

/**
 * Samples the image at `sub` samples per cell in each direction. Character
 * selection needs sub-cell detail: gradients to find edges, and the half-block
 * and braille charsets address parts of a cell directly.
 */
export async function sampleGrid(img: Sharp, grid: Grid, sub: number): Promise<Raster> {
  return rasterize(
    img.resize(grid.cols * sub, grid.rows * sub, { fit: 'fill', kernel: 'lanczos3' }),
  );
}
