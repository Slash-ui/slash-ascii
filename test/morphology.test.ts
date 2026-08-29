import { describe, expect, it } from 'vitest';
import {
  boundingBox,
  close,
  dilate,
  erode,
  largestComponent,
  open,
  padBox,
  threshold,
} from '../src/segment/morphology.js';

const parse = (rows: string[]) => ({
  w: rows[0].length,
  h: rows.length,
  data: Uint8Array.from([...rows.join('')].map((c) => (c === '#' ? 1 : 0))),
});

const draw = (data: Uint8Array, w: number, h: number): string[] =>
  Array.from({ length: h }, (_, y) =>
    [...data.slice(y * w, (y + 1) * w)].map((v) => (v ? '#' : '.')).join(''),
  );

describe('morphology', () => {
  const speckled = parse([
    '..........',
    '..####..#.',
    '..####....',
    '..####....',
    '..........',
  ]);

  it('erodes and dilates back to roughly where it started', () => {
    const { data, w, h } = speckled;
    const eroded = erode(data, w, h, 1);
    expect(draw(eroded, w, h)[2]).toBe('...##.....');
    expect(draw(dilate(eroded, w, h, 1), w, h)[1]).toBe('..####....');
  });

  it('opening drops the speck and keeps the block', () => {
    const { data, w, h } = speckled;
    expect(draw(open(data, w, h, 1), w, h)).toEqual([
      '..........',
      '..####....',
      '..####....',
      '..####....',
      '..........',
    ]);
  });

  it('closing fills a pinhole', () => {
    const holed = parse([
      '........',
      '........',
      '..####..',
      '..#.##..',
      '..####..',
      '........',
      '........',
    ]);
    expect(draw(close(holed.data, holed.w, holed.h, 1), holed.w, holed.h)).toEqual([
      '........',
      '........',
      '..####..',
      '..####..',
      '..####..',
      '........',
      '........',
    ]);
  });

  it('does not nibble a subject that runs off the edge of the frame', () => {
    // Erosion treats the outside as foreground on purpose: a portrait cropped at
    // the shoulders should not lose its edge to every opening.
    const full = new Uint8Array(16).fill(1);
    expect([...erode(full, 4, 4, 1)]).toEqual([...full]);
    expect([...open(full, 4, 4, 1)]).toEqual([...full]);
  });

  it('keeps only the largest blob', () => {
    const { data, w, h } = speckled;
    const kept = largestComponent(data, w, h);
    expect(draw(kept, w, h)[1]).toBe('..####....');
  });

  it('returns nothing for an empty mask', () => {
    const empty = new Uint8Array(16);
    expect(largestComponent(empty, 4, 4).some(Boolean)).toBe(false);
    expect(boundingBox(empty, 4, 4)).toBeNull();
  });

  it('finds the bounding box', () => {
    const { data, w, h } = speckled;
    const kept = largestComponent(data, w, h);
    expect(boundingBox(kept, w, h)).toEqual({ x: 2, y: 1, width: 4, height: 3 });
  });

  it('pads the box without running off the image', () => {
    expect(padBox({ x: 2, y: 1, width: 4, height: 3 }, 10, 5, 0.25)).toEqual({
      x: 1,
      y: 0,
      width: 6,
      height: 5,
    });
  });

  it('thresholds a soft map', () => {
    const soft = Float32Array.from([0, 0.49, 0.5, 1]);
    expect([...threshold(soft, 0.5)]).toEqual([0, 0, 1, 1]);
  });
});
