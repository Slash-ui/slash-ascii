import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { DecodeError, InputError } from '../errors.js';

/** Interleaved RGBA, 8 bits per channel, row-major. */
export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface Size {
  width: number;
  height: number;
}

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

/** Opens the buffer with EXIF orientation applied. */
export function open(input: Buffer): sharp.Sharp {
  return sharp(input, { failOn: 'none' }).rotate();
}

/**
 * Dimensions after EXIF rotation. `metadata()` reports the stored dimensions,
 * which are transposed for orientations 5 through 8.
 */
export async function orientedSize(input: Buffer): Promise<Size> {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { failOn: 'none' }).metadata();
  } catch (err) {
    throw new DecodeError(`not a recognisable image: ${(err as Error).message}`);
  }
  const { width, height, orientation } = meta;
  if (!width || !height) throw new DecodeError('image has no dimensions');
  return (orientation ?? 1) >= 5 ? { width: height, height: width } : { width, height };
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
