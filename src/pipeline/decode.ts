import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import type { Raster, Size } from '../raster.js';
import { DecodeError, InputError } from '../errors.js';

/** Reads an image file, or stdin when `source` is `-`. */
export async function readInput(source: string): Promise<Buffer> {
  if (source === '-') return readStdin();
  try {
    return await readFile(source);
  } catch (err) {
    throw new InputError(`cannot read ${source}: ${(err as NodeJS.ErrnoException).code ?? String(err)}`);
  }
}

async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const buf = Buffer.concat(chunks);
  if (buf.length === 0) throw new InputError('no image data on stdin');
  return buf;
}

/** The nominal size of a vector, and the format it was read from. */
export interface Probe {
  size: Size;
  /** sharp's format tag, so `svg` can be told apart from a bitmap. */
  format: string;
}

/** Dots per inch a vector is rendered at when nobody says otherwise. */
const BASE_DENSITY = 72;

/** sharp refuses a density beyond this. */
const MAX_DENSITY = 100_000;

/**
 * Opens the buffer with EXIF orientation applied. `density` only reaches a
 * vector, where it decides the size of the raster the rest of the pipeline sees.
 */
export function open(input: Buffer, density?: number): sharp.Sharp {
  return sharp(input, { failOn: 'none', ...(density === undefined ? {} : { density }) }).rotate();
}

/**
 * Dimensions after EXIF rotation, alongside the source format. `metadata()`
 * reports the stored dimensions, which are transposed for orientations 5
 * through 8, and for a vector it reports the nominal size at `BASE_DENSITY`.
 */
export async function probe(input: Buffer): Promise<Probe> {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { failOn: 'none' }).metadata();
  } catch (err) {
    throw new DecodeError(`not a recognisable image: ${(err as Error).message}`);
  }
  const { width, height, orientation, format } = meta;
  if (!width || !height) throw new DecodeError('image has no dimensions');
  return {
    size: (orientation ?? 1) >= 5 ? { width: height, height: width } : { width, height },
    format: format ?? '',
  };
}

/** True for a source that can be re-rendered at any resolution without loss. */
export function isVector(probed: Probe): boolean {
  return probed.format === 'svg';
}

/**
 * The density that renders a vector at the width the grid is about to sample.
 * At the default 72 dpi a 318 unit wide logo rasterises to 318 pixels, which a
 * 128 column grid then *upscales* to 512 samples: the hairlines are averaged
 * away before anything has looked at them. Only the width is matched, because
 * cells are never wider than they are tall and so the rows always come out
 * oversampled rather than short.
 */
export function densityFor(nominalWidth: number, targetWidth: number): number {
  const scaled = Math.ceil((BASE_DENSITY * targetWidth) / nominalWidth);
  return Math.min(MAX_DENSITY, Math.max(BASE_DENSITY, scaled));
}

/** Runs the sharp pipeline and returns raw RGBA. */
export async function rasterize(img: sharp.Sharp): Promise<Raster> {
  let data: Buffer;
  let info: sharp.OutputInfo;
  try {
    ({ data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
  } catch (err) {
    throw new DecodeError(`could not decode image: ${(err as Error).message}`);
  }
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
  };
}

/** Wraps raw RGBA back into a sharp pipeline. */
export function fromRaster(raster: Raster): sharp.Sharp {
  return sharp(Buffer.from(raster.data.buffer, raster.data.byteOffset, raster.data.byteLength), {
    raw: { width: raster.width, height: raster.height, channels: 4 },
  });
}
