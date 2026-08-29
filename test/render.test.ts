import { describe, expect, it } from 'vitest';
import type { Frame } from '../src/pipeline/charmap.js';
import { renderAnsi, to256 } from '../src/render/ansi.js';
import { renderText } from '../src/render/txt.js';

const frame = (): Frame => ({
  cols: 4,
  rows: 1,
  charAspect: 0.5,
  cells: [
    { ch: '@', fg: [255, 0, 0], bg: null },
    { ch: '#', fg: [255, 0, 0], bg: null },
    { ch: '.', fg: [0, 0, 255], bg: null },
    { ch: ' ', fg: null, bg: null },
  ],
});

describe('ansi output', () => {
  it('sets a colour once per run and resets at the end of the line', () => {
    const out = renderAnsi(frame(), 'true');
    expect(out).toBe('\x1b[38;2;255;0;0m@#\x1b[38;2;0;0;255m.\x1b[0m\n');
  });

  it('writes no escapes at all in mono', () => {
    expect(renderAnsi(frame(), 'mono')).toBe('@#.\n');
  });

  it('falls back to palette indices in 256 colour mode', () => {
    expect(renderAnsi(frame(), '256')).toBe('\x1b[38;5;196m@#\x1b[38;5;21m.\x1b[0m\n');
  });

  it('clears a background rather than leaving the previous one running', () => {
    const withBg: Frame = {
      cols: 2,
      rows: 1,
      charAspect: 0.5,
      cells: [
        { ch: '▀', fg: [10, 10, 10], bg: [20, 20, 20] },
        { ch: '▀', fg: [10, 10, 10], bg: null },
      ],
    };
    expect(renderAnsi(withBg, 'true')).toContain('\x1b[49m');
  });
});

describe('256 colour approximation', () => {
  it('maps the corners of the cube exactly', () => {
    expect(to256(0, 0, 0)).toBe(16);
    expect(to256(255, 255, 255)).toBe(231);
  });

  it('prefers the grey ramp for neutral colours, since it is much finer', () => {
    expect(to256(128, 128, 128)).toBe(244);
    expect(to256(18, 18, 18)).toBe(233);
  });

  it('uses the cube for saturated colours', () => {
    expect(to256(255, 0, 0)).toBe(196);
    expect(to256(0, 255, 0)).toBe(46);
  });
});

describe('text output', () => {
  it('drops trailing blanks', () => {
    expect(renderText(frame())).toBe('@#.\n');
  });
});
