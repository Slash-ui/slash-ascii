import type { Charset } from './pipeline/charmap.js';
import type { ColorMode } from './render/ansi.js';
import type { Raster } from './raster.js';
import { RAMPS } from './pipeline/charmap.js';

export type Format = 'ansi' | 'txt' | 'html' | 'svg';

export interface ConvertOptions {
  width?: number;
  height?: number;
  /** Cell width divided by cell height. Terminal cells are about twice as tall as wide. */
  charAspect: number;
  charset: Charset;
  ramp: string;
  invert: boolean;
  color: ColorMode;
  format: Format;
  denoise: boolean;
  /** Mask cutoff, only used when a mask provider is supplied. */
  threshold: number;
  edges: boolean;
  /** Used when no width is given. */
  terminalCols?: number;
}

export const CONVERT_DEFAULTS: ConvertOptions = {
  charAspect: 0.5,
  charset: 'ascii',
  ramp: RAMPS.standard,
  invert: false,
  color: 'true',
  format: 'ansi',
  denoise: true,
  threshold: 0.5,
  edges: true,
};

/** Returns a saliency map, one value per pixel of the raster, in 0..1. */
export type MaskProvider = (raster: Raster) => Promise<Float32Array>;

export interface ConvertDeps {
  mask?: MaskProvider;
  warn?: (message: string) => void;
}
