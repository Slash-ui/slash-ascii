import { describe, expect, it } from 'vitest';
import { convert } from '../src/pipeline/run.js';
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
