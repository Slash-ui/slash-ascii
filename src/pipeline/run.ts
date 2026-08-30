import type sharp from 'sharp';
import type { ConvertDeps, ConvertOptions } from '../options.js';
import type { Grid } from './resize.js';
import { resolveOptions } from '../options.js';
import { analyze } from './analyze.js';
import { cutout } from '../segment/cutout.js';
import { denoise } from './denoise.js';
import { FALLBACK_COLS, fitGrid, limit, sampleGrid } from './resize.js';
import { densityFor, fromRaster, isVector, open, probe, rasterize } from './decode.js';
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
  // Read the header first: whether the source is a vector decides some of the
  // defaults, and its nominal size decides how large to render it.
  const probed = await probe(input);
  const vector = isVector(probed);
  const opts = resolveOptions(options, vector);
  // Plain text has no way to carry colour. Deciding that here rather than in the
  // CLI is what keeps a library caller and the command line on the same output.
  const color = opts.format === 'txt' ? 'mono' : opts.color;
  // Only the ascii charset consults gradients, and computing them is most of the
  // cost of analysis.
  const edges = opts.edges && opts.charset === 'ascii';

  /** Renders the source at whatever width the next stage is about to sample. */
  const load = (targetWidth: number): sharp.Sharp => {
    const img = open(input, vector ? densityFor(probed.size.width, targetWidth) : undefined);
    return opts.denoise ? denoise(img) : img;
  };

  let image: sharp.Sharp;
  let grid: Grid;

  if (deps.mask) {
    // The grid cannot be fitted until the subject has been cut out, so the
    // render width is the one the segmentation stage works at.
    const target = Math.max(SEGMENT_MAX_DIM, estimateCols(opts) * SUB);
    const working = await rasterize(limit(load(target), target));
    const subject = cutout(working, await deps.mask(working), opts.threshold);
    if (!subject) deps.warn?.('no subject found in the mask; converting the whole image');
    const chosen = subject ?? working;
    image = fromRaster(chosen);
    grid = fit(opts, { width: chosen.width, height: chosen.height });
  } else {
    grid = fit(opts, probed.size);
    image = load(grid.cols * SUB);
  }

  const detail = await sampleGrid(image, grid, SUB);
  const frame = mapGrid(analyze(detail, grid, SUB, edges), {
    charset: opts.charset,
    ramp: opts.ramp,
    invert: opts.invert,
    color: color !== 'mono',
    edges,
    alphaCutoff: opts.alphaCutoff,
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

function fit(opts: ConvertOptions, size: { width: number; height: number }): Grid {
  return fitGrid(size, {
    width: opts.width,
    height: opts.height,
    charAspect: opts.charAspect,
    terminalCols: opts.terminalCols,
  });
}

function estimateCols(opts: ConvertOptions): number {
  return opts.width ?? opts.terminalCols ?? FALLBACK_COLS;
}
