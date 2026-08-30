import type { Charset } from './pipeline/charmap.js';
import type { ColorMode } from './render/ansi.js';
import type { Raster } from './raster.js';
import { ALPHA_CUTOFF, LINE_ART_ALPHA_CUTOFF, RAMPS } from './pipeline/charmap.js';

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
  /** Coverage a cell needs before it paints, 0..1. */
  alphaCutoff: number;
  /**
   * Treat the source as line art: keep hairlines that the ordinary settings
   * average away. A preset over the options below, not a mode of its own.
   */
  lineArt: boolean;
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
  alphaCutoff: ALPHA_CUTOFF,
  lineArt: false,
};

/**
 * What `lineArt` stands for. Applied over the defaults and under anything the
 * caller actually asked for, so `--line-art --alpha-cutoff 0.3` is the user's
 * number and not this one.
 */
export const LINE_ART_PRESET: Partial<ConvertOptions> = {
  // A median filter is a majority vote among neighbours, which a stroke thinner
  // than the 3x3 window always loses.
  denoise: false,
  alphaCutoff: LINE_ART_ALPHA_CUTOFF,
};

/**
 * What a vector source implies on its own. It carries no sensor noise for the
 * median to remove, so the filter is all cost. Still only a default: a config
 * file or a flag saying otherwise wins.
 */
const VECTOR_PRESET: Partial<ConvertOptions> = { denoise: false };

/**
 * Settles every option for one run. Four layers, each beating the one above it:
 * the defaults, what the source format implies, what `lineArt` stands for, and
 * whatever the caller actually asked for. Keeping the presets underneath the
 * caller is what makes them presets rather than modes.
 */
export function resolveOptions(
  options: Partial<ConvertOptions>,
  vector: boolean,
): ConvertOptions {
  return {
    ...CONVERT_DEFAULTS,
    ...(vector ? VECTOR_PRESET : {}),
    ...(options.lineArt ? LINE_ART_PRESET : {}),
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
