import type sharp from 'sharp';
import type { Raster, Size } from './decode.js';
import { rasterize } from './decode.js';

export interface Grid {
  cols: number;
  rows: number;
}

export interface FitOptions {
  width?: number;
  height?: number;
  /** Cell height divided by cell width. Terminal cells are about twice as tall as wide. */
  charAspect: number;
  /** Used when neither dimension is given and stdout has no width. */
  fallbackCols: number;
  terminalCols?: number;
}

/**
 * Characters are not square, so the row count has to be scaled by the cell
 * aspect or everything comes out stretched vertically.
 */
export function fitGrid(image: Size, opts: FitOptions): Grid {
  const aspect = image.height / image.width;
  const { width, height, charAspect } = opts;

  if (width && height) return clamp({ cols: width, rows: height });
  if (width) return clamp({ cols: width, rows: Math.round(width * aspect * charAspect) });
  if (height) return clamp({ cols: Math.round(height / aspect / charAspect), rows: height });

  const cols = opts.terminalCols ?? opts.fallbackCols;
  return clamp({ cols, rows: Math.round(cols * aspect * charAspect) });
}

function clamp(grid: Grid): Grid {
  return { cols: Math.max(1, grid.cols), rows: Math.max(1, grid.rows) };
}

/**
 * Samples the image at `sub` samples per cell in each direction. Character
 * selection needs sub-cell detail: gradients to find edges, and the half-block
 * and braille charsets address parts of a cell directly.
 */
export async function sampleGrid(img: sharp.Sharp, grid: Grid, sub: number): Promise<Raster> {
  return rasterize(
    img.resize(grid.cols * sub, grid.rows * sub, { fit: 'fill', kernel: 'lanczos3' }),
  );
}
