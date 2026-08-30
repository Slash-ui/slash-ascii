import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { resolveOptions } from '../src/options.js';
import { convert } from '../src/pipeline/run.js';
import { densityFor, isVector, probe } from '../src/pipeline/decode.js';
import { fitGrid } from '../src/pipeline/resize.js';
import { fixture } from './helpers.js';

describe('grid fitting', () => {
  const square = { width: 100, height: 100 };

  const aspect = { charAspect: 0.5 };

  it('halves the row count because cells are twice as tall as they are wide', () => {
    expect(fitGrid(square, { ...aspect, width: 40 })).toEqual({ cols: 40, rows: 20, ...aspect });
  });

  it('derives columns when only a height is given', () => {
    expect(fitGrid({ width: 200, height: 100 }, { ...aspect, height: 20 })).toEqual({
      cols: 80,
      rows: 20,
      ...aspect,
    });
  });

  it('honours both dimensions when both are given, distortion and all', () => {
    expect(fitGrid(square, { ...aspect, width: 10, height: 99 })).toEqual({
      cols: 10,
      rows: 99,
      ...aspect,
    });
  });

  it('falls back when there is no terminal width to read', () => {
    expect(fitGrid(square, aspect)).toEqual({ cols: 80, rows: 40, ...aspect });
  });

  it('never produces an empty grid', () => {
    expect(fitGrid({ width: 4000, height: 1 }, aspect)).toEqual({ cols: 80, rows: 1, ...aspect });
  });

  it('carries the cell aspect so renderers do not have to be told again', () => {
    expect(fitGrid(square, { charAspect: 0.42, width: 10 }).charAspect).toBe(0.42);
  });
});

describe('rendering', () => {
  it('renders the ramp and the edge characters', async () => {
    const out = await convert(await fixture('shapes.png'), { width: 40, format: 'txt' });
    expect(out).toMatchSnapshot();
  });

  it('renders a gradient across the whole ramp', async () => {
    const out = await convert(await fixture('gradient.png'), { width: 40, format: 'txt' });
    expect(out).toMatchSnapshot();
  });

  it('inverts the ramp for light backgrounds', async () => {
    const plain = await convert(await fixture('gradient.png'), {
      width: 20,
      format: 'txt',
      edges: false,
    });
    const inverted = await convert(await fixture('gradient.png'), {
      width: 20,
      format: 'txt',
      edges: false,
      invert: true,
    });
    expect(inverted).not.toEqual(plain);
    expect(inverted).toMatchSnapshot();
  });

  it('renders braille', async () => {
    const out = await convert(await fixture('shapes.png'), {
      width: 24,
      format: 'txt',
      charset: 'braille',
    });
    expect(out).toMatchSnapshot();
  });

  it('renders half blocks with a foreground and a background colour', async () => {
    const out = await convert(await fixture('subject.png'), {
      width: 12,
      charset: 'blocks',
      color: 'true',
    });
    expect(out).toContain('▀');
    expect(out).toMatch(/\x1b\[48;2;\d+;\d+;\d+m/);
    expect(out).toMatchSnapshot();
  });

  it('emits html', async () => {
    const out = await convert(await fixture('shapes.png'), { width: 16, format: 'html' });
    expect(out).toMatchSnapshot();
  });

  it('emits svg', async () => {
    const out = await convert(await fixture('shapes.png'), { width: 16, format: 'svg' });
    expect(out).toMatchSnapshot();
  });

  it('reads the image orientation rather than the stored dimensions', async () => {
    const out = await convert(await fixture('gradient.png'), { width: 30, format: 'txt' });
    expect(out.trimEnd().split('\n')).toHaveLength(10);
  });

  it('ignores option keys that are present but undefined', async () => {
    // A CLI builds its options object from flags the user did not pass, so every
    // absent flag arrives as an explicit undefined. Those must not erase defaults.
    const out = await convert(await fixture('gradient.png'), {
      width: 20,
      format: 'txt',
      charAspect: undefined,
      charset: undefined,
      ramp: undefined,
    } as never);
    expect(out.trimEnd().split('\n')).toHaveLength(7);
  });
});

describe('resolving options', () => {
  it('runs the median filter on a bitmap, which is where sensor noise lives', () => {
    expect(resolveOptions({}, false).denoise).toBe(true);
  });

  it('skips it for a vector, which has no noise for it to remove', () => {
    expect(resolveOptions({}, true).denoise).toBe(false);
  });

  it('still takes the filter back if the caller insists', () => {
    expect(resolveOptions({ denoise: true }, true).denoise).toBe(true);
  });

  it('ignores keys that are present but undefined', () => {
    // A CLI builds its options from flags the user did not pass, so every absent
    // flag arrives as an explicit undefined. Those must not erase a preset.
    expect(resolveOptions({ denoise: undefined } as never, true).denoise).toBe(false);
  });
});

describe('vector sources', () => {
  /** The fixture rasterised at the size its own header claims. */
  const nominal = (): Promise<Buffer> =>
    fixture('hairline.svg').then((svg) => sharp(svg).png().toBuffer());

  const art = (source: Buffer, width: number): Promise<string> =>
    convert(source, { width, charset: 'blocks', format: 'txt', denoise: false });

  it('renders at the width the grid samples rather than the nominal size', () => {
    // A 240 unit wide vector feeding an 80 column grid needs 320 samples, which
    // is 96 dpi rather than the 72 the file nominally carries.
    expect(densityFor(240, 320)).toBe(96);
  });

  it('never renders one smaller than its nominal size', () => {
    expect(densityFor(240, 40)).toBe(72);
  });

  it('clamps the density sharp is willing to accept', () => {
    expect(densityFor(1, 1_000_000)).toBe(100_000);
  });

  it('recognises what can be re-rendered and what cannot', async () => {
    expect(isVector(await probe(await fixture('hairline.svg')))).toBe(true);
    expect(isVector(await probe(await fixture('shapes.png')))).toBe(false);
  });

  it('matches its own nominal raster while the grid still fits inside it', async () => {
    // 30 columns wants 120 samples from a 240 unit wide file, so there is
    // nothing to gain by rendering larger and the two paths agree.
    expect(await art(await fixture('hairline.svg'), 30)).toEqual(await art(await nominal(), 30));
  });

  it('carries detail past it once the grid asks for more', async () => {
    // 128 columns wants 512 samples, which the nominal 240 pixel raster can only
    // supply by being enlarged. The vector does not have to be.
    expect(await art(await fixture('hairline.svg'), 128)).not.toEqual(
      await art(await nominal(), 128),
    );
  });
});
