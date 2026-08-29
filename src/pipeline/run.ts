import type { ConvertDeps, ConvertOptions } from '../options.js';
import type { Size } from '../raster.js';
import { CONVERT_DEFAULTS } from '../options.js';
import { analyze } from './analyze.js';
import { cutout } from '../segment/cutout.js';
import { denoise } from './denoise.js';
import { FALLBACK_COLS, fitGrid, limit, sampleGrid } from './resize.js';
import { fromRaster, open, orientedSize, rasterize } from './decode.js';
import { mapGrid } from './charmap.js';
import { renderAnsi } from '../render/ansi.js';
import { renderHtml } from '../render/html.js';
import { renderSvg } from '../render/svg.js';
import { renderText } from '../render/txt.js';

/** Samples per cell along each axis. Enough for 2x4 braille dots and useful gradients. */
export const SUB = 4;

/** Segmentation work happens at this size at most; the model only sees 320x320 anyway. */
const SEGMENT_MAX_DIM = 1024;

export async function convert(
  input: Buffer,
  options: Partial<ConvertOptions> = {},
  deps: ConvertDeps = {},
): Promise<string> {
  const opts = { ...CONVERT_DEFAULTS, ...defined(options) };
  // Plain text has no way to carry colour. Deciding that here rather than in the
  // CLI is what keeps a library caller and the command line on the same output.
  const color = opts.format === 'txt' ? 'mono' : opts.color;
  // Only the ascii charset consults gradients, and computing them is most of the
  // cost of analysis.
  const edges = opts.edges && opts.charset === 'ascii';

  let image = open(input);
  if (opts.denoise) image = denoise(image);
  let size: Size;

  if (deps.mask) {
    const working = await rasterize(limit(image, Math.max(SEGMENT_MAX_DIM, estimateCols(opts) * SUB)));
    const subject = cutout(working, await deps.mask(working), opts.threshold);
    if (!subject) deps.warn?.('no subject found in the mask; converting the whole image');
    const chosen = subject ?? working;
    image = fromRaster(chosen);
    size = { width: chosen.width, height: chosen.height };
  } else {
    size = await orientedSize(input);
  }

  const grid = fitGrid(size, {
    width: opts.width,
    height: opts.height,
    charAspect: opts.charAspect,
    terminalCols: opts.terminalCols,
  });

  const detail = await sampleGrid(image, grid, SUB);
  const frame = mapGrid(analyze(detail, grid, SUB, edges), {
    charset: opts.charset,
    ramp: opts.ramp,
    invert: opts.invert,
    color: color !== 'mono',
    edges,
  });

  switch (opts.format) {
    case 'txt':
      return renderText(frame);
    case 'html':
      return renderHtml(frame);
    case 'svg':
      return renderSvg(frame);
    default:
      return renderAnsi(frame, color);
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
