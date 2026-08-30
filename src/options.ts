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

/**
 * What a vector source implies on its own. It carries no sensor noise for the
 * median to remove, so the filter is all cost. Still only a default: a config
 * file or a flag saying otherwise wins.
 */
const VECTOR_PRESET: Partial<ConvertOptions> = { denoise: false };

/**
 * Settles every option for one run. Three layers, each beating the one above
 * it: the defaults, what the source format implies, and whatever the caller
 * actually asked for. Keeping the preset underneath the caller is what makes it
 * a preset rather than a mode.
 */
export function resolveOptions(
  options: Partial<ConvertOptions>,
  vector: boolean,
): ConvertOptions {
  return {
    ...CONVERT_DEFAULTS,
    ...(vector ? VECTOR_PRESET : {}),
    ...defined(options),
  };
}

/**
 * Spreading an object with explicit `undefined` values wipes out the layers
 * underneath it, which is exactly what a CLI passing `{ width: flags.width }`
 * ends up doing for every flag the user left off.
 */
function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/** Returns a saliency map, one value per pixel of the raster, in 0..1. */
export type MaskProvider = (raster: Raster) => Promise<Float32Array>;

export interface ConvertDeps {
  mask?: MaskProvider;
  warn?: (message: string) => void;
}
