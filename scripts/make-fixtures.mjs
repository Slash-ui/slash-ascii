// Regenerates the test fixtures. They are committed, so this only needs running
// when a fixture changes shape. Everything here is deterministic.
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const out = new URL('../test/fixtures/', import.meta.url);
await mkdir(out, { recursive: true });

const raw = (w, h, fn) => {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = fn(x, y);
      const p = (y * w + x) * 4;
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = a;
    }
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png({ compressionLevel: 9 });
};

// A two-axis gradient: exercises the ramp across its whole range.
await raw(96, 64, (x, y) => {
  const h = Math.round((x / 95) * 255);
  const v = Math.round((y / 63) * 255);
  return [h, v, 255 - h, 255];
}).toFile(new URL('gradient.png', out).pathname);

// Hard-edged geometry at four orientations: exercises edge-aware selection.
await raw(128, 128, (x, y) => {
  const inBox = x > 20 && x < 60 && y > 20 && y < 100;
  const onDiagonal = Math.abs(x - y) < 3 && x > 64;
  const onAnti = Math.abs(x + y - 190) < 3 && x > 64;
  const on = inBox || onDiagonal || onAnti;
  return on ? [250, 250, 250, 255] : [12, 12, 20, 255];
}).toFile(new URL('shapes.png', out).pathname);

// A blob on a busy background, for the segmentation path with a stub mask.
await raw(128, 128, (x, y) => {
  const dx = x - 64;
  const dy = y - 70;
  const inside = dx * dx + dy * dy < 40 * 40;
  if (inside) return [220, 90, 60, 255];
  return [40 + ((x * 7 + y * 3) % 60), 60 + ((x * 3) % 40), 90, 255];
}).toFile(new URL('subject.png', out).pathname);

console.log('fixtures written');
