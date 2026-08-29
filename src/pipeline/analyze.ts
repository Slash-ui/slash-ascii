import type { Raster } from './decode.js';

export interface Cell {
  /** Alpha-weighted mean luminance, 0..1. */
  lum: number;
  /** Alpha-weighted mean colour, 0..255. */
  r: number;
  g: number;
  b: number;
  /** Mean coverage, 0..1. */
  alpha: number;
  /** Mean gradient magnitude, 0..1. */
  edge: number;
  /** How consistently the gradients inside the cell point the same way, 0..1. */
  coherence: number;
  /** Dominant edge orientation in radians, [0, PI). */
  angle: number;
}

export interface AnalysedGrid {
  cols: number;
  rows: number;
  /** Samples per cell along each axis. */
  sub: number;
  detail: Raster;
  /** Per-sample luminance, 0..1, in detail-raster order. */
  lum: Float32Array;
  cells: Cell[];
}

/** Rec. 709 luminance from 8-bit sRGB, without linearising. */
function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function analyze(detail: Raster, cols: number, rows: number, sub: number): AnalysedGrid {
  const { width: w, height: h, data } = detail;
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    lum[i] = luminance(data[p], data[p + 1], data[p + 2]);
  }

  const cells: Cell[] = new Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      cells[cy * cols + cx] = analyzeCell(detail, lum, cx * sub, cy * sub, sub);
    }
  }
  return { cols, rows, sub, detail, lum, cells };
}

function analyzeCell(detail: Raster, lum: Float32Array, x0: number, y0: number, sub: number): Cell {
  const { width: w, height: h, data } = detail;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let sa = 0;
  let sl = 0;
  let magSum = 0;
  // Orientation is modulo PI, so gradients are averaged at double angle. Two
  // edges 90 degrees apart then cancel instead of averaging to 45 degrees, and
  // the length of the sum relative to magSum measures how much they agree.
  let ox = 0;
  let oy = 0;

  for (let dy = 0; dy < sub; dy++) {
    const y = y0 + dy;
    for (let dx = 0; dx < sub; dx++) {
      const x = x0 + dx;
      const p = (y * w + x) * 4;
      const a = data[p + 3] / 255;
      sr += data[p] * a;
      sg += data[p + 1] * a;
      sb += data[p + 2] * a;
      sl += lum[y * w + x] * a;
      sa += a;

      const gx = sobelX(lum, w, h, x, y);
      const gy = sobelY(lum, w, h, x, y);
      const mag = Math.min(1, Math.hypot(gx, gy) / 4);
      if (mag > 0) {
        // Edge orientation is perpendicular to the gradient.
        const phi = Math.atan2(gy, gx) + Math.PI / 2;
        ox += mag * Math.cos(2 * phi);
        oy += mag * Math.sin(2 * phi);
        magSum += mag;
      }
    }
  }

  const n = sub * sub;
  const weight = sa > 0 ? sa : 1;
  let angle = 0.5 * Math.atan2(oy, ox);
  if (angle < 0) angle += Math.PI;

  return {
    lum: sl / weight,
    r: sr / weight,
    g: sg / weight,
    b: sb / weight,
    alpha: sa / n,
    edge: magSum / n,
    coherence: magSum > 0 ? Math.hypot(ox, oy) / magSum : 0,
    angle,
  };
}

function at(lum: Float32Array, w: number, h: number, x: number, y: number): number {
  const cx = x < 0 ? 0 : x >= w ? w - 1 : x;
  const cy = y < 0 ? 0 : y >= h ? h - 1 : y;
  return lum[cy * w + cx];
}

function sobelX(lum: Float32Array, w: number, h: number, x: number, y: number): number {
  return (
    at(lum, w, h, x + 1, y - 1) + 2 * at(lum, w, h, x + 1, y) + at(lum, w, h, x + 1, y + 1) -
    at(lum, w, h, x - 1, y - 1) - 2 * at(lum, w, h, x - 1, y) - at(lum, w, h, x - 1, y + 1)
  );
}

function sobelY(lum: Float32Array, w: number, h: number, x: number, y: number): number {
  return (
    at(lum, w, h, x - 1, y + 1) + 2 * at(lum, w, h, x, y + 1) + at(lum, w, h, x + 1, y + 1) -
    at(lum, w, h, x - 1, y - 1) - 2 * at(lum, w, h, x, y - 1) - at(lum, w, h, x + 1, y - 1)
  );
}
