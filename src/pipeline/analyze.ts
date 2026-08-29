import type { Grid } from './resize.js';
import type { Raster } from '../raster.js';

export interface Cell extends RegionMean {
  /** Mean gradient magnitude, 0..1. Zero when edge detection was not requested. */
  edge: number;
  /** How consistently the gradients inside the cell point the same way, 0..1. */
  coherence: number;
  /** Dominant edge orientation in radians, [0, PI). */
  angle: number;
}

export interface AnalysedGrid extends Grid {
  /** Samples per cell along each axis. */
  sub: number;
  detail: Raster;
  cells: Cell[];
}

export interface RegionMean {
  /** Alpha-weighted mean colour, 0..255. */
  r: number;
  g: number;
  b: number;
  /** Mean coverage, 0..1. */
  alpha: number;
  /** Luminance of the mean colour, 0..1. */
  lum: number;
}

/** Rec. 709 luminance from 8-bit sRGB, without linearising. */
export function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Alpha-weighted mean over a rectangle. Weighting by coverage keeps a masked-out
 * background from dragging the colour of the cell that sits on its edge.
 */
export function regionMean(detail: Raster, x0: number, y0: number, w: number, h: number): RegionMean {
  const { width, height, data } = detail;
  const maxX = Math.min(x0 + w, width);
  const maxY = Math.min(y0 + h, height);
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let sa = 0;
  let n = 0;

  for (let y = y0; y < maxY; y++) {
    for (let x = x0; x < maxX; x++) {
      const p = (y * width + x) * 4;
      const a = data[p + 3] / 255;
      sr += data[p] * a;
      sg += data[p + 1] * a;
      sb += data[p + 2] * a;
      sa += a;
      n++;
    }
  }

  if (n === 0) return { r: 0, g: 0, b: 0, alpha: 0, lum: 0 };
  const weight = sa > 0 ? sa : 1;
  const r = sr / weight;
  const g = sg / weight;
  const b = sb / weight;
  return { r, g, b, alpha: sa / n, lum: luminance(r, g, b) };
}

/**
 * `edges` is passed through rather than assumed because the gradient pass is
 * most of the cost here, and the block and braille charsets never look at it.
 */
export function analyze(detail: Raster, grid: Grid, sub: number, edges: boolean): AnalysedGrid {
  const lum = edges ? luminancePlane(detail) : null;
  const cells: Cell[] = new Array(grid.cols * grid.rows);

  for (let cy = 0; cy < grid.rows; cy++) {
    for (let cx = 0; cx < grid.cols; cx++) {
      const mean = regionMean(detail, cx * sub, cy * sub, sub, sub);
      cells[cy * grid.cols + cx] = lum
        ? { ...mean, ...gradients(detail, lum, cx * sub, cy * sub, sub) }
        : { ...mean, edge: 0, coherence: 0, angle: 0 };
    }
  }
  return { ...grid, sub, detail, cells };
}

function luminancePlane(detail: Raster): Float32Array {
  const { data } = detail;
  const lum = new Float32Array(detail.width * detail.height);
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    lum[i] = luminance(data[p], data[p + 1], data[p + 2]);
  }
  return lum;
}

interface Gradients {
  edge: number;
  coherence: number;
  angle: number;
}

function gradients(
  detail: Raster,
  lum: Float32Array,
  x0: number,
  y0: number,
  sub: number,
): Gradients {
  const { width: w, height: h } = detail;
  let magSum = 0;
  // Orientation is modulo PI, so gradients are averaged at double angle. Two
  // edges 90 degrees apart then cancel instead of averaging to 45 degrees, and
  // the length of the sum relative to magSum measures how much they agree.
  let ox = 0;
  let oy = 0;

  for (let dy = 0; dy < sub; dy++) {
    const y = y0 + dy;
    const above = (y > 0 ? y - 1 : 0) * w;
    const middle = y * w;
    const below = (y < h - 1 ? y + 1 : h - 1) * w;

    for (let dx = 0; dx < sub; dx++) {
      const x = x0 + dx;
      const left = x > 0 ? x - 1 : 0;
      const right = x < w - 1 ? x + 1 : w - 1;

      // The 3x3 neighbourhood, read once and shared between both Sobel kernels.
      const tl = lum[above + left];
      const tm = lum[above + x];
      const tr = lum[above + right];
      const ml = lum[middle + left];
      const mr = lum[middle + right];
      const bl = lum[below + left];
      const bm = lum[below + x];
      const br = lum[below + right];

      const gx = tr + 2 * mr + br - tl - 2 * ml - bl;
      const gy = bl + 2 * bm + br - tl - 2 * tm - tr;
      const square = gx * gx + gy * gy;
      if (square === 0) continue;

      const mag = Math.min(1, Math.sqrt(square) / 4);
      magSum += mag;
      // Closed form for mag * cos(2*phi) and mag * sin(2*phi) where phi is the
      // gradient angle turned 90 degrees onto the edge. Cheaper than a trip
      // through atan2 and back, per sample.
      const scale = mag / square;
      ox -= scale * (gx * gx - gy * gy);
      oy -= scale * 2 * gx * gy;
    }
  }

  let angle = 0.5 * Math.atan2(oy, ox);
  if (angle < 0) angle += Math.PI;

  return {
    edge: magSum / (sub * sub),
    coherence: magSum > 0 ? Math.hypot(ox, oy) / magSum : 0,
    angle,
  };
}
