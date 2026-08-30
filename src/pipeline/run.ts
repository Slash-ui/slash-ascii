import type sharp from 'sharp';
import type { ConvertDeps, ConvertOptions } from '../options.js';
import type { Grid } from './resize.js';
import type { Size } from '../raster.js';
import { resolveOptions } from '../options.js';
import { analyze } from './analyze.js';
import { cutout } from '../segment/cutout.js';
import { denoise } from './denoise.js';
import { fitGrid, limit, sampleGrid } from './resize.js';
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

  /** Renders the source at whatever the next stage is about to sample. */
  const load = (target: Size): sharp.Sharp => {
    const img = open(input, vector ? densityFor(probed.size, target) : undefined);
    return opts.denoise ? denoise(img) : img;
  };

  let image: sharp.Sharp;
  let grid: Grid;

  if (deps.mask) {
    // The grid cannot be fitted until the subject has been cut out, so the
    // render size is the one the segmentation stage works at. It needs headroom
    // beyond the sample count: `cutout` crops this raster, and the crop is what
    // the grid is then sampled from.
    const edge = Math.max(SEGMENT_MAX_DIM, fit(opts, probed.size).cols * SUB);
    const working = await rasterize(limit(load(box(probed.size, edge)), edge));
    const subject = cutout(working, await deps.mask(working), opts.threshold);
    if (!subject) deps.warn?.('no subject found in the mask; converting the whole image');
    const chosen = subject ?? working;
    image = fromRaster(chosen);
    grid = fit(opts, { width: chosen.width, height: chosen.height });
  } else {
    grid = fit(opts, probed.size);
    image = load(samples(grid, SUB));
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

/** The raster a grid consumes, which is what the source has to be rendered to. */
function samples(grid: Grid, sub: number): Size {
  return { width: grid.cols * sub, height: grid.rows * sub };
}

/** `size` scaled to sit inside a square of `edge`, which is what `limit` bounds it to. */
function box(size: Size, edge: number): Size {
  const scale = edge / Math.max(size.width, size.height);
  return { width: size.width * scale, height: size.height * scale };
}
