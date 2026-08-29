import type { Raster } from '../raster.js';
import { boundingBox, close, largestComponent, open, padBox, threshold } from './morphology.js';

/** Structuring element relative to the shorter side, so it scales with the image. */
const RADIUS_DIVISOR = 256;

/** Breathing room around the subject, as a fraction of its longer side. */
const CROP_PADDING = 0.02;

/**
 * Turns a saliency map into an alpha channel and crops to what survives. The
 * crop is what stops a segmented subject from ending up as a small figure
 * adrift in a frame of blanks.
 */
export function cutout(raster: Raster, mask: Float32Array, level: number): Raster | null {
  const { width: w, height: h } = raster;
  const radius = Math.max(1, Math.round(Math.min(w, h) / RADIUS_DIVISOR));

  let binary = threshold(mask, level);
  binary = open(binary, w, h, radius);
  binary = close(binary, w, h, radius);
  binary = largestComponent(binary, w, h);

  const found = boundingBox(binary, w, h);
  if (!found) return null;
  const box = padBox(found, w, h, CROP_PADDING);

  const out = new Uint8ClampedArray(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const i = (y + box.y) * w + (x + box.x);
      const src = i * 4;
      const dst = (y * box.width + x) * 4;
      out[dst] = raster.data[src];
      out[dst + 1] = raster.data[src + 1];
      out[dst + 2] = raster.data[src + 2];
      // Keep the soft mask value inside the kept component so edges stay feathered
      // instead of stair-stepping along the threshold.
      out[dst + 3] = binary[i] ? Math.round(Math.min(1, mask[i]) * 255) : 0;
    }
  }
  return { width: box.width, height: box.height, data: out };
}
