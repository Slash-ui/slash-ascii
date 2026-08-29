import { describe, expect, it } from 'vitest';
import type { Raster } from '../src/pipeline/decode.js';
import { convert } from '../src/pipeline/run.js';
import { fixture } from './helpers.js';

/**
 * A stand-in for the network: an ellipse in the middle of the frame. The point of
 * these tests is the mask handling around inference, not the model itself.
 */
function ellipseMask(rx: number, ry: number) {
  return async (raster: Raster): Promise<Float32Array> => {
    const mask = new Float32Array(raster.width * raster.height);
    const cx = raster.width / 2;
    const cy = raster.height / 2;
    const a = raster.width * rx;
    const b = raster.height * ry;
    for (let y = 0; y < raster.height; y++) {
      for (let x = 0; x < raster.width; x++) {
        mask[y * raster.width + x] = ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2 < 1 ? 1 : 0;
      }
    }
    return mask;
  };
}

const lines = (out: string): string[] => out.replace(/\n$/, '').split('\n');

/** Trailing blanks are trimmed from text output, so a missing cell is a blank cell. */
const cellAt = (rows: string[], y: number, x: number): string => rows[y]?.[x] ?? ' ';

describe('background removal', () => {
  it('blanks the background and crops to what is left', async () => {
    const image = await fixture('subject.png');
    const whole = await convert(image, { width: 30, format: 'txt' });
    const cut = await convert(image, { width: 30, format: 'txt' }, { mask: ellipseMask(0.4, 0.2) });

    // Cropping to a wide subject leaves a wide frame, so the same column count
    // now covers far fewer rows than the whole image did.
    expect(lines(cut).length).toBeLessThan(lines(whole).length);
    // The ellipse touches the top and bottom of its own bounding box, so only the
    // corners are guaranteed to fall outside it.
    const rows = lines(cut);
    const last = rows.length - 1;
    const width = 29;
    for (const [y, x] of [[0, 0], [0, width], [last, 0], [last, width]] as const) {
      expect(cellAt(rows, y, x)).toBe(' ');
    }
    expect(cellAt(rows, Math.floor(last / 2), 15)).not.toBe(' ');
    expect(cut).toMatchSnapshot();
  });

  it('falls back to the whole image when the mask finds nothing', async () => {
    const warnings: string[] = [];
    const out = await convert(
      await fixture('subject.png'),
      { width: 20, format: 'txt' },
      {
        mask: async (raster) => new Float32Array(raster.width * raster.height),
        warn: (message) => warnings.push(message),
      },
    );

    expect(warnings).toEqual(['no subject found in the mask; converting the whole image']);
    expect(out.trim()).not.toBe('');
  });

  it('honours the mask threshold', async () => {
    const image = await fixture('subject.png');
    const soft = async (raster: Raster) => {
      const mask = new Float32Array(raster.width * raster.height);
      // A vertical ramp: a higher cutoff keeps strictly less of it.
      for (let y = 0; y < raster.height; y++) {
        mask.fill(y / raster.height, y * raster.width, (y + 1) * raster.width);
      }
      return mask;
    };

    const low = await convert(image, { width: 20, format: 'txt', threshold: 0.2 }, { mask: soft });
    const high = await convert(image, { width: 20, format: 'txt', threshold: 0.8 }, { mask: soft });
    expect(lines(high).length).toBeLessThan(lines(low).length);
  });
});
