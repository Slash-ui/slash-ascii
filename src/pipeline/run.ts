import type { Charset } from './charmap.js';
import type { ColorMode } from '../render/ansi.js';
import type { Raster } from './decode.js';
import { CHARMAP_DEFAULTS, mapGrid, RAMPS } from './charmap.js';
import { analyze } from './analyze.js';
import { denoise } from './denoise.js';
import { fitGrid, sampleGrid } from './resize.js';
import { fromRaster, open, orientedSize, rasterize } from './decode.js';
import { HTML_DEFAULTS, renderHtml } from '../render/html.js';
import { SVG_DEFAULTS, renderSvg } from '../render/svg.js';
import { renderAnsi } from '../render/ansi.js';
import { renderText } from '../render/txt.js';
import {
  boundingBox,
  close,
  largestComponent,
  open as morphOpen,
  padBox,
  threshold,
} from '../segment/morphology.js';

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

/** Samples per cell along each axis. Enough for 2x4 braille dots and useful gradients. */
export const SUB = 4;

/** Segmentation work happens at this size at most; the model only sees 320x320 anyway. */
const SEGMENT_MAX_DIM = 1024;

const FALLBACK_COLS = 80;

export async function convert(
  input: Buffer,
  options: Partial<ConvertOptions> = {},
  deps: ConvertDeps = {},
): Promise<string> {
  const opts = { ...CONVERT_DEFAULTS, ...defined(options) };
  let image = open(input);
  if (opts.denoise) image = denoise(image);

  let size = await orientedSize(input);

  if (deps.mask) {
    const cap = Math.max(SEGMENT_MAX_DIM, estimateCols(opts) * SUB);
    const working = await rasterize(
      image.resize(cap, cap, { fit: 'inside', withoutEnlargement: true }),
    );
    const subject = cutOut(working, await deps.mask(working), opts.threshold);
    if (subject) {
      image = fromRaster(subject);
      size = { width: subject.width, height: subject.height };
    } else {
      deps.warn?.('no subject found in the mask; converting the whole image');
      image = fromRaster(working);
      size = { width: working.width, height: working.height };
    }
  }

  const grid = fitGrid(size, {
    width: opts.width,
    height: opts.height,
    charAspect: opts.charAspect,
    fallbackCols: FALLBACK_COLS,
    terminalCols: opts.terminalCols,
  });

  const detail = await sampleGrid(image, grid, SUB);
  const analysed = analyze(detail, grid.cols, grid.rows, SUB);
  const frame = mapGrid(analysed, {
    ...CHARMAP_DEFAULTS,
    charset: opts.charset,
    ramp: opts.ramp,
    invert: opts.invert,
    color: opts.color !== 'mono',
    edges: opts.edges,
  });

  switch (opts.format) {
    case 'txt':
      return renderText(frame);
    case 'html':
      return renderHtml(frame, { ...HTML_DEFAULTS, charAspect: opts.charAspect });
    case 'svg':
      return renderSvg(frame, { ...SVG_DEFAULTS, charAspect: opts.charAspect });
    default:
      return renderAnsi(frame, opts.color);
  }
}

/**
 * Spreading an object with explicit `undefined` values wipes out the defaults
 * underneath it, which is exactly what a caller passing `{ width: flags.width }`
 * ends up doing for every flag the user left off.
 */
function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

function estimateCols(opts: ConvertOptions): number {
  return opts.width ?? opts.terminalCols ?? FALLBACK_COLS;
}

/**
 * Turns a saliency map into an alpha channel and crops to what survives. The
 * crop is what stops a segmented subject from ending up as a small figure
 * adrift in a frame of blanks.
 */
function cutOut(raster: Raster, mask: Float32Array, level: number): Raster | null {
  const { width: w, height: h } = raster;
  const radius = Math.max(1, Math.round(Math.min(w, h) / 256));

  let binary = threshold(mask, level);
  binary = morphOpen(binary, w, h, radius);
  binary = close(binary, w, h, radius);
  binary = largestComponent(binary, w, h);

  const found = boundingBox(binary, w, h);
  if (!found) return null;
  const box = padBox(found, w, h, 0.02);

  const out = new Uint8ClampedArray(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const src = ((y + box.y) * w + (x + box.x)) * 4;
      const dst = (y * box.width + x) * 4;
      const i = (y + box.y) * w + (x + box.x);
      out[dst] = raster.data[src];
      out[dst + 1] = raster.data[src + 1];
      out[dst + 2] = raster.data[src + 2];
      // Keep the soft mask value inside the kept component so edges stay feathered
      // instead of stair-stepping along the threshold.
      out[dst + 3] = binary[i] ? Math.round(Math.min(1, mask[i]) * 255) : 0;
    }
  }
  return { width: box.width, height: box.height, data: out };
}
